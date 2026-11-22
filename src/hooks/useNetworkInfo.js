import { useState, useEffect } from 'react';

function getConnection() {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

/** Timeout dinámico según RTT — cubre degradación por VoLTE en redes 4G nominales.
 *  Suelo de 12 s: las llamadas de IA/OCR (materiales, nóminas, multas) tardan
 *  3-8 s de forma habitual; con 5 s abortaban intermitentemente en escritorio
 *  (RTT<50) y el SDK devolvía undefined → "OCR no devolvió líneas válidas". */
export function getTimeoutByRtt(rtt) {
  if (rtt == null) return 12000;
  if (rtt < 50) return 12000;
  if (rtt < 150) return 15000;
  if (rtt < 500) return 20000;
  return 25000;
}

function buildInfo(prevRtt) {
  const connection = getConnection();
  const effectiveType = connection?.effectiveType || '4g';
  const downlink = connection?.downlink ?? null;
  const rtt = connection?.rtt ?? null;
  const isVoLTECall = effectiveType === '4g' && rtt != null && rtt > 500;
  const rttJump = prevRtt != null && rtt != null && rtt - prevRtt > 200;
  const isDegraded = isVoLTECall || rttJump || (rtt != null && rtt > 150);
  const isSlowNetwork = ['2g', '3g', 'slow-2g'].includes(effectiveType) || isDegraded;
  const timeout = getTimeoutByRtt(rtt);
  return { effectiveType, downlink, rtt, connectionType: connection?.type || 'unknown', isSlowNetwork, isVoLTECall, isDegraded, timeout };
}

/* ── Estado único compartido ────────────────────────────────────────────────
   Antes cada componente que usaba el hook abría su propio setInterval de 3 s
   (hasta 9 sondeos simultáneos del mismo dato). Ahora hay un solo sondeo y un
   solo listener de 'change', y los componentes se suscriben a él. */
let currentInfo = buildInfo(null);
let prevRtt = currentInfo.rtt;
let timer = null;
let listenerAttached = false;
const subscribers = new Set();

function emit() {
  currentInfo = buildInfo(prevRtt);
  prevRtt = currentInfo.rtt;
  subscribers.forEach(fn => fn(currentInfo));
}

function startPolling() {
  if (timer) return;
  const connection = getConnection();
  if (connection && !listenerAttached) {
    connection.addEventListener?.('change', emit);
    listenerAttached = true;
  }
  timer = setInterval(emit, 3000);
}

function stopPolling() {
  if (subscribers.size > 0 || !timer) return;
  clearInterval(timer);
  timer = null;
  if (listenerAttached) {
    getConnection()?.removeEventListener?.('change', emit);
    listenerAttached = false;
  }
}

/**
 * Detecta el tipo de conexión de red (Network Information API), incluyendo
 * degradación por VoLTE (llamada activa en 4G), y expone timeouts recomendados.
 * Un único sondeo compartido por toda la app (singleton).
 */
export function useNetworkInfo() {
  const [info, setInfo] = useState(currentInfo);

  useEffect(() => {
    subscribers.add(setInfo);
    startPolling();
    setInfo(currentInfo); // sincroniza al montar por si el estado cambió
    return () => {
      subscribers.delete(setInfo);
      stopPolling();
    };
  }, []);

  return info;
}

export function getTimeoutByNetwork() {
  try {
    return buildInfo(null).timeout;
  } catch (e) {
    console.warn('[Network] Error calculando timeout, usando fallback:', e.message);
    return 20000;  // Fallback seguro para navegadores sin Network API
  }
}