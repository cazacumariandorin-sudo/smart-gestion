/**
 * Utilidades para capturar telemetría del dispositivo/navegador
 * y enviar reportes al módulo de Diagnóstico.
 *
 * Captura enriquecida de sesión (v2):
 *  - Inicio de sesión (timestamp, email, rol)
 *  - Historial de navegación con marca temporal (últimas 25 rutas)
 *  - Historial cronológico de acciones / clics (últimas 30)
 *  - Transiciones de red (online/offline, cambios de calidad)
 *  - Resumen de sesión legible para IT
 */
import { base44 } from '@/api/base44Client';

// ── Estado de sesión en memoria ──
const sessionStart = new Date();
let loginInfo = null; // { at, email, role, metodo }
let navHistory = [];      // ["[HH:mm:ss] /path"]
let navHistoryPlain = []; // ["[HH:mm:ss] /path"] (mismo array, alias para compat)
let accionHistorial = []; // ["[HH:mm:ss] <acción>"]
let ultimaAccion = '';
let networkEvents = [];   // ["[HH:mm:ss] online 4g"]

const MAX_NAV = 25;
const MAX_ACCIONES = 30;
const MAX_NET = 15;

function ts() {
  try {
    return new Date().toLocaleTimeString('es-ES', { hour12: false });
  } catch {
    return new Date().toISOString().slice(11, 19);
  }
}

function trim(arr, max) {
  while (arr.length > max) arr.shift();
}

// ── Captura automática de cambios de ruta (con timestamps) ──
if (typeof window !== 'undefined') {
  let lastPath = window.location.pathname;
  navHistory.push(`[${ts()}] ${lastPath}`);
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      const previous = lastPath;
      lastPath = window.location.pathname;
      navHistory.push(`[${ts()}] ${lastPath}`);
      trim(navHistory, MAX_NAV);
      // Acción de navegación registrada
      accionHistorial.push(`[${ts()}] navegar: ${previous} → ${lastPath}`);
      trim(accionHistorial, MAX_ACCIONES);
      ultimaAccion = `navegar ${previous} → ${lastPath} @ ${lastPath}`;
    }
  }, 500);
}

// ── Captura de clics (con timestamps) ──
if (typeof window !== 'undefined') {
  window.addEventListener('click', (e) => {
    try {
      const target = e.target;
      const label = target?.getAttribute?.('aria-label')
        || target?.getAttribute?.('data-testid')
        || target?.tagName
        || 'element';
      const accion = `click ${label} @ ${window.location.pathname}`;
      ultimaAccion = accion;
      accionHistorial.push(`[${ts()}] ${accion}`);
      trim(accionHistorial, MAX_ACCIONES);
    } catch {}
  }, { passive: true });
}

// ── Transiciones de red ──
if (typeof window !== 'undefined' && navigator) {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
  let lastType = conn.effectiveType || '';

  const logNet = (evento) => {
    const tipo = navigator.onLine ? 'online' : 'offline';
    const calidad = conn.effectiveType || lastType || '';
    const entrada = `[${ts()}] ${evento} ${tipo} ${calidad}`.trim();
    networkEvents.push(entrada);
    trim(networkEvents, MAX_NET);
  };

  window.addEventListener('online', () => logNet('recuperada_red'));
  window.addEventListener('offline', () => logNet('perdida_red'));
  if (conn.addEventListener) {
    conn.addEventListener('change', () => {
      const nuevoTipo = conn.effectiveType || '';
      if (nuevoTipo && nuevoTipo !== lastType) {
        logNet(`cambio_calidad (${lastType || '—'}→${nuevoTipo})`);
        lastType = nuevoTipo;
      }
    });
  }
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
    for (const [k, t] of recentErrors) {
      if (now - t > 5 * 60_000) recentErrors.delete(k);
    }
  }
  return true;
}

// ── API de sesión: login / logout ──
export function registrarLoginSesion(user) {
  if (!user) return;
  loginInfo = {
    at: new Date().toISOString(),
    at_ts: ts(),
    email: user.email || '',
    role: user.role || '',
    full_name: user.full_name || '',
    operario_id: user.operario_id || '',
    empresa_nombre: user.empresa_nombre || '',
    tipo_cuenta: user.tipo_cuenta || 'real',
    metodo: user.metodo_login || 'session_token',
  };
  accionHistorial.push(`[${ts()}] LOGIN ${loginInfo.email} [${loginInfo.role}]`);
  trim(accionHistorial, MAX_ACCIONES);
}

export function registrarLogoutSesion() {
  accionHistorial.push(`[${ts()}] LOGOUT ${loginInfo?.email || ''}`);
  trim(accionHistorial, MAX_ACCIONES);
}

export function registrarAccionSesion(label) {
  if (!label) return;
  const accion = `${label} @ ${typeof window !== 'undefined' ? window.location.pathname : '/'}`;
  ultimaAccion = accion;
  accionHistorial.push(`[${ts()}] ${accion}`);
  trim(accionHistorial, MAX_ACCIONES);
}

export function registrarEventoRed(tipo, detalle = '') {
  const entrada = `[${ts()}] ${tipo} ${detalle}`.trim();
  networkEvents.push(entrada);
  trim(networkEvents, MAX_NET);
}

/**
 * Devuelve un resumen legible de la sesión actual (estilo "línea de tiempo")
 * pensado para que IT pueda reconstruir qué pasó antes de un fallo.
 */
export function exportarResumenSesion() {
  const duracion = Math.round((Date.now() - sessionStart.getTime()) / 1000);
  const lineas = [];
  lineas.push('── Sesión ──');
  lineas.push(`Inicio: ${sessionStart.toISOString()}`);
  lineas.push(`Duración: ${duracion}s`);
  if (loginInfo) {
    lineas.push(
      `Login: ${loginInfo.email} | rol=${loginInfo.role} | ${loginInfo.full_name || '(sin nombre)'}` +
      (loginInfo.operario_id ? ` | operario=${loginInfo.operario_id}` : '') +
      (loginInfo.empresa_nombre ? ` | empresa=${loginInfo.empresa_nombre}` : '') +
      ` | cuenta=${loginInfo.tipo_cuenta}` +
      ` | at=${loginInfo.at_ts}`
    );
  } else {
    lineas.push('Login: (sin registro)');
  }
  lineas.push('');
  lineas.push('── Acciones recientes (cronológico) ──');
  lineas.push(...accionHistorial.slice(-20));
  lineas.push('');
  lineas.push('── Navegación ──');
  lineas.push(...navHistory.slice(-15));
  lineas.push('');
  lineas.push('── Red ──');
  if (networkEvents.length) lineas.push(...networkEvents);
  else lineas.push('(sin eventos)');
  return lineas.join('\n');
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

  let memoriaUso = null;
  try {
    if (performance && performance.memory) {
      memoriaUso = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
  } catch {}

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
 *
 * Si el reporte NO trae `pasos_reproducir` (reporte automático), se rellena
 * con `exportarResumenSesion()` (timeline de login + acciones + navegación + red)
 * para que IT pueda reconstruir qué hizo el usuario justo antes del fallo.
 *
 * Si el reporte trae `pasos_reproducir` (manual del usuario), se añade la
 * timeline al final con un separador para que los pasos del usuario se lean
 * primero y la captura técnica quede a continuación.
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
  user_role = '',
  ultima_accion_extra = ''
} = {}) {
  try {
    const errorKey = `${tipo}:${mensaje_error?.slice(0, 80)}`;
    if (!shouldReport(errorKey)) return { skipped: true };

    const telemetria = recopilarTelemetria();
    const timeline = exportarResumenSesion();

    let pasosFinal = pasos_reproducir || '';
    if (timeline) {
      pasosFinal = pasos_reproducir
        ? `${pasos_reproducir}\n\n── Captura automática de sesión ──\n${timeline}`
        : timeline;
    }

    const payload = {
      user_email: user_email || loginInfo?.email || 'anonimo',
      user_id: user_id || loginInfo?.email || '',
      user_role: user_role || loginInfo?.role || '',
      tipo,
      severidad,
      mensaje_error: (mensaje_error || '').slice(0, 2000),
      stack_trace: (stack_trace || '').slice(0, 4000),
      notas_usuario: (notas_usuario || '').slice(0, 2000),
      pasos_reproducir: (pasosFinal || '').slice(0, 4000),
      ...telemetria,
      ultima_accion: ultima_accion_extra || telemetria.ultima_accion
    };
    await base44.entities.DiagnosticoSesion.create(payload);
    return { ok: true };
  } catch (e) {
    console.warn('No se pudo enviar reporte de diagnóstico:', e);
    return { ok: false, error: e.message };
  }
}

export { navHistory, ultimaAccion };