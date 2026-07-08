import { useState, useEffect } from 'react';

const TIMEOUT_BY_TYPE = {
  '4g': 5000,
  'slow-4g': 8000,
  '3g': 15000,
  '2g': 30000,
};

function getConnection() {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function buildInfo() {
  const connection = getConnection();
  const effectiveType = connection?.effectiveType || '4g';
  const downlink = connection?.downlink ?? null;
  const rtt = connection?.rtt ?? null;
  const isSlowNetwork = ['2g', '3g', 'slow-2g'].includes(effectiveType) || (rtt && rtt > 500);
  const timeout = TIMEOUT_BY_TYPE[effectiveType] || TIMEOUT_BY_TYPE['4g'];
  return { effectiveType, downlink, rtt, connectionType: connection?.type || 'unknown', isSlowNetwork, timeout };
}

/**
 * Detecta el tipo de conexión de red (Network Information API) y expone
 * timeouts recomendados según velocidad. Se actualiza en tiempo real.
 */
export function useNetworkInfo() {
  const [info, setInfo] = useState(buildInfo);

  useEffect(() => {
    const connection = getConnection();
    if (!connection) return;
    const update = () => setInfo(buildInfo());
    connection.addEventListener('change', update);
    return () => connection.removeEventListener('change', update);
  }, []);

  return info;
}

export function getTimeoutByNetwork() {
  return buildInfo().timeout;
}