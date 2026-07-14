import { useState, useEffect, useRef } from 'react';

function getConnection() {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

/** Timeout dinámico según RTT — cubre degradación por VoLTE en redes 4G nominales. */
export function getTimeoutByRtt(rtt) {
  if (rtt == null) return 5000;
  if (rtt < 50) return 5000;
  if (rtt < 150) return 8000;
  if (rtt < 500) return 15000;
  return 20000;
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

/**
 * Detecta el tipo de conexión de red (Network Information API), incluyendo
 * degradación por VoLTE (llamada activa en 4G), y expone timeouts recomendados.
 * Se actualiza en tiempo real (evento 'change' + sondeo periódico del RTT).
 */
export function useNetworkInfo() {
  const [info, setInfo] = useState(() => buildInfo(null));
  const prevRttRef = useRef(info.rtt);

  useEffect(() => {
    const connection = getConnection();
    const update = () => {
      const next = buildInfo(prevRttRef.current);
      prevRttRef.current = next.rtt;
      setInfo(next);
    };
    connection?.addEventListener?.('change', update);
    // El evento 'change' no siempre dispara con variaciones de RTT (p.ej. VoLTE) — sondeo cada 3s
    const interval = setInterval(update, 3000);
    return () => {
      connection?.removeEventListener?.('change', update);
      clearInterval(interval);
    };
  }, []);

  return info;
}

export function getTimeoutByNetwork() {
  try {
    return buildInfo(null).timeout;
  } catch (e) {
    console.warn('[Network] Error calculando timeout, usando fallback:', e.message);
    return 15000;  // Fallback seguro para navegadores sin Network API
  }
}