/**
 * Utilidades para capturar telemetría del dispositivo/navegador
 * y enviar reportes al módulo de Diagnóstico.
 */
import { base44 } from '@/api/base44Client';

// Historial de navegación en memoria (últimas 10 rutas)
let navHistory = [];
let ultimaAccion = '';

if (typeof window !== 'undefined') {
  // Capturar cambios de ruta
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      navHistory.push(lastPath);
      if (navHistory.length > 10) navHistory.shift();
      lastPath = window.location.pathname;
    }
  }, 500);
}

// Capturar clics para "última acción"
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    try {
      const target = e.target;
      const label = target?.getAttribute?.('aria-label')
        || target?.getAttribute?.('data-testid')
        || target?.tagName
        || 'element';
      ultimaAccion = `click ${label} @ ${window.location.pathname}`;
    } catch {}
  }, { passive: true });
}

// Throttle in-memory para no duplicar el mismo error 100 veces
const recentErrors = new Map();
const THROTTLE_MS = 60_000; // 1 minuto entre el mismo error

function shouldReport(errorKey) {
  const now = Date.now();
  const last = recentErrors.get(errorKey) || 0;
  if (now - last < THROTTLE_MS) return false;
  recentErrors.set(errorKey, now);
  if (recentErrors.size > 100) {
    // Limpieza
    for (const [k, t] of recentErrors) {
      if (now - t > 5 * 60_000) recentErrors.delete(k);
    }
  }
  return true;
}

/**
 * Recopila toda la telemetría del dispositivo/navegador.
 */
export function recopilarTelemetria() {
  const nav = navigator || {};
  const screen = window.screen || {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || {};

  let nivelBateria = null;
  let cargando = null;
  try {
    if (nav.getBattery) {
      // Async: se completa después; para snapshots sincrónicos devuelve null
    }
  } catch {}

  let memoriaUso = null;
  try {
    if (performance && performance.memory) {
      memoriaUso = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
  } catch {}

  // Parsear user-agent
  const ua = nav.userAgent || '';
  let navegador = 'desconocido';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)) navegador = 'Chrome';
  else if (/Edg\//.test(ua)) navegador = 'Edge';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) navegador = 'Opera';
  else if (/Firefox\//.test(ua)) navegador = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) navegador = 'Safari';
  else if (/SamsungBrowser\//.test(ua)) navegador = 'Samsung Internet';
  else if (/MIUIBrowser\//.test(ua)) navegador = 'Mi Browser';

  let so = 'desconocido';
  if (/Android\s([0-9.]+)/.test(ua)) {
    const m = ua.match(/Android\s([0-9.]+)/);
    so = 'Android ' + (m ? m[1] : '');
  } else if (/iPhone OS ([0-9_]+)/.test(ua)) {
    const m = ua.match(/iPhone OS ([0-9_]+)/);
    so = 'iOS ' + (m ? m[1].replace(/_/g, '.') : '');
  } else if (/iPad/.test(ua)) so = 'iPadOS';
  else if (/Windows NT ([0-9.]+)/.test(ua)) {
    const v = ua.match(/Windows NT ([0-9.]+)/)[1];
    so = 'Windows ' + v;
  } else if (/Mac OS X ([0-9_]+)/.test(ua)) so = 'macOS';
  else if (/Linux/.test(ua)) so = 'Linux';

  let dispositivoModelo = '';
  // Modelo de Android (móvil)
  const modelMatch = ua.match(/\(Linux;.*?;\s*([^;)]+?)\s*\)/);
  if (modelMatch) dispositivoModelo = modelMatch[1];
  if (/iPhone/.test(ua)) dispositivoModelo = 'iPhone';

  let cookiesHabilitadas = true;
  try { cookiesHabilitadas = nav.cookieEnabled !== false; } catch {}

  return {
    user_agent: ua,
    navegador,
    sistema_operativo: so,
    dispositivo_modelo: dispositivoModelo,
    resolucion_pantalla: `${screen.width || 0}x${screen.height || 0}`,
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
    nivel_bateria: nivelBateria,
    cargando_bateria: cargando,
    calidad_red: conn.effectiveType || '',
    downlink_mbps: conn.downlink || null,
    rtt_ms: conn.rtt || null,
    online: nav.onLine !== false,
    cookies_habilitadas: cookiesHabilitadas,
    memoria_uso_mb: memoriaUso,
    ultima_accion: ultimaAccion,
    historial_navegacion: [...navHistory],
    ruta: window.location.pathname || '',
    ruta_completa: window.location.href || ''
  };
}

/**
 * Envía un reporte de diagnóstico (manual o automático).
 */
export async function enviarReporteDiagnostico({
  tipo = 'error_auto',
  severidad = 'error',
  mensaje_error = '',
  stack_trace = '',
  notas_usuario = '',
  pasos_reproducir = '',
  user_email = '',
  user_id = '',
  user_role = ''
} = {}) {
  try {
    const errorKey = `${tipo}:${mensaje_error?.slice(0,80)}`;
    if (!shouldReport(errorKey)) return { skipped: true };

    const telemetria = recopilarTelemetria();
    const payload = {
      user_email: user_email || 'anonimo',
      user_id: user_id || '',
      user_role: user_role || '',
      tipo,
      severidad,
      mensaje_error: (mensaje_error || '').slice(0, 2000),
      stack_trace: (stack_trace || '').slice(0, 4000),
      notas_usuario: (notas_usuario || '').slice(0, 2000),
      pasos_reproducir: (pasos_reproducir || '').slice(0, 2000),
      ...telemetria
    };
    await base44.entities.DiagnosticoSesion.create(payload);
    return { ok: true };
  } catch (e) {
    console.warn('No se pudo enviar reporte de diagnóstico:', e);
    return { ok: false, error: e.message };
  }
}

export { navHistory, ultimaAccion };