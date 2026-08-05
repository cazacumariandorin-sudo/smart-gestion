/**
 * Vigilancia silenciosa — módulo de telemetría activado por Gerencia.
 *
 * El usuario NO nota diferencia:
 *  - No añade UI.
 *  - No consologuea nada (ni en producción ni en dev — el usuario no lo verá en consola).
 *  - Las llamadas al backend devuelven 200 siempre, y el backend ignora sin errores.
 *
 * Funcionamiento:
 *  1. Al cargar, llama a gestionVigilanciaDiagnostico(action=verificar) silenciosamente.
 *  2. Si hay vigilancia activa para el usuario logueado → empieza a capturar eventos.
 *  3. Captura: navegación, clics, red (online/offline/cambio calidad), errores JS,
 *     promise rejections y solicitudes de red fallidas.
 *  4. Cada 20s envía el lote acumulado a registrarEventoVigilancia (también silencioso).
 *  5. Re-verifica cada 5 min por si Gerencia activó/desactivó la vigilancia a media sesión.
 *
 * Importa este módulo una sola vez en App.jsx. No exporta API: es fire-and-forget.
 */
import { base44 } from '@/api/base44Client';

let vigilanciaActiva = false;
let vigilanciaId = null;
let buffer = [];
let listenersActivos = false;
let flushTimer = null;
let checkTimer = null;

const FLUSH_INTERVAL_MS = 20_000; // 20s
const CHECK_INTERVAL_MS = 5 * 60_000; // 5 min
const MAX_BUFFER = 500;

function ahoraISO() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function rgbPath() {
  try { return window.location.pathname || ''; } catch { return ''; }
}

function registrar(tipo, datos = {}, rutaOverride = null) {
  if (!vigilanciaActiva) return;
  if (buffer.length >= MAX_BUFFER) return;
  buffer.push({
    tipo_evento: tipo,
    timestamp: ahoraISO(),
    ruta: rutaOverride !== null ? rutaOverride : rgbPath(),
    datos
  });
}

function instalarListeners() {
  if (listenersActivos || typeof window === 'undefined') return;
  listenersActivos = true;

  // Navegación (polling suave; diagnosticoUtils hace lo mismo)
  let lastPath = window.location.pathname;
  setInterval(() => {
    try {
      if (window.location.pathname !== lastPath) {
        const prev = lastPath;
        lastPath = window.location.pathname;
        registrar('nav', { from: prev, to: lastPath }, lastPath);
      }
    } catch {}
  }, 800);

  // Clics
  window.addEventListener('click', (e) => {
    try {
      const t = e.target;
      const label = t?.getAttribute?.('aria-label')
        || t?.getAttribute?.('data-testid')
        || t?.tagName
        || 'element';
      registrar('click', { label });
    } catch {}
  }, { passive: true });

  // Red
  window.addEventListener('online', () => registrar('red', { tipo: 'online' }));
  window.addEventListener('offline', () => registrar('red', { tipo: 'offline' }));
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    let lastType = conn?.effectiveType || '';
    if (conn?.addEventListener) {
      conn.addEventListener('change', () => {
        const nuevo = conn.effectiveType || '';
        if (nuevo && nuevo !== lastType) {
          registrar('red', { tipo: 'cambio_calidad', from: lastType, to: nuevo });
          lastType = nuevo;
        }
      });
    }
  } catch {}

  // Errores JS no capturados
  window.addEventListener('error', (e) => {
    try {
      registrar('error', {
        message: e.message || '',
        filename: e.filename || '',
        lineno: e.lineno || 0,
        colno: e.colno || 0,
        stack: (e.error && e.error.stack) ? String(e.error.stack).slice(0, 800) : ''
      });
    } catch {}
  }, true);

  // Promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    try {
      const reason = e.reason;
      registrar('promise_rejection', {
        message: reason?.message || String(reason || '').slice(0, 300),
        stack: reason?.stack ? String(reason.stack).slice(0, 600) : ''
      });
    } catch {}
  });

  // Visibilidades (tab oculta / visible) — útil para detectar pantallas blancas
  document.addEventListener('visibilitychange', () => {
    try {
      registrar('visibility', { state: document.visibilityState });
    } catch {}
  });

  // Solicitudes fetch fallidas (wrap fetch)
  try {
    const originalFetch = window.fetch;
    if (originalFetch && !window.__vigilFetchWrapped) {
      window.__vigilFetchWrapped = true;
      window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '?';
        try {
          const resp = await originalFetch(...args);
          if (!resp.ok && resp.status >= 400) {
            registrar('network_request', { url: String(url).slice(0, 200), status: resp.status });
          }
          return resp;
        } catch (err) {
          registrar('network_request', { url: String(url).slice(0, 200), error: String(err?.message || err).slice(0, 200) });
          throw err;
        }
      };
    }
  } catch {}
}

async function flushBuffer() {
  if (!vigilanciaActiva || buffer.length === 0) return;
  const lote = buffer;
  buffer = [];
  try {
    await base44.functions.invoke('registrarEventoVigilancia', { eventos: lote });
  } catch {
    // Re-intentar sinacentamente
    try {
      await base44.functions.invoke('registrarEventoVigilancia', { eventos: lote });
    } catch {}
  }
}

async function verificar() {
  try {
    const r = await base44.functions.invoke('gestionVigilanciaDiagnostico', { action: 'verificar' });
    const data = r?.data || r;
    if (data?.activa && data?.vigilancia_id) {
      if (!vigilanciaActiva) {
        vigilanciaActiva = true;
        vigilanciaId = data.vigilancia_id;
        instalarListeners();
        if (!flushTimer) {
          flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
        }
      }
    } else {
      // Vigilancia desactivada → detener captura y enviar últimos eventos
      if (vigilanciaActiva) {
        await flushBuffer();
        vigilanciaActiva = false;
        vigilanciaId = null;
        if (flushTimer) {
          clearInterval(flushTimer);
          flushTimer = null;
        }
      }
    }
  } catch {
    // No propagar: el usuario no debe notar nada.
  }
}

export function iniciarVigilanciaSilenciosa() {
  if (typeof window === 'undefined') return;
  if (window.__vigilanciaSilenciosaIniciada) return;
  window.__vigilanciaSilenciosaIniciada = true;
  // Pequeño delay inicial para no competir con el arranque
  setTimeout(() => {
    verificar();
    checkTimer = setInterval(verificar, CHECK_INTERVAL_MS);
  }, 2500);
  // Flush final al cerrar
  window.addEventListener('beforeunload', () => {
    if (vigilanciaActiva && buffer.length) flushBuffer();
  });
}