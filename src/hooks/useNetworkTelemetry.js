/**
 * useNetworkTelemetry — captura anónima de eventos de red/queries y envío por lotes cada 30s.
 * Uso: const { logQuery, logNetworkStats } = useNetworkTelemetry();
 */
import { useCallback, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNetworkInfo } from '@/hooks/useNetworkInfo';

async function hashEmail(email) {
  if (!email || typeof crypto === 'undefined' || !crypto.subtle) return 'unknown';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function detectDeviceType() {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function detectOs() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'unknown';
}

export function useNetworkTelemetry() {
  const { user } = useAuth();
  const { effectiveType, downlink, rtt, isVoLTECall } = useNetworkInfo();
  const bufferRef = useRef([]);
  const userHashRef = useRef('unknown');

  useEffect(() => {
    if (user?.email) hashEmail(user.email).then(h => { userHashRef.current = h; });
  }, [user?.email]);

  const logQuery = useCallback(({ moduleName, operation, durationMs, sizeBytes, success, errorType, retryCount = 0 }) => {
    const now = new Date();
    bufferRef.current.push({
      timestamp: now.toISOString(),
      user_id: userHashRef.current,
      device_type: detectDeviceType(),
      os: detectOs(),
      effective_type: effectiveType || '4g',
      downlink_mbps: downlink ?? null,
      rtt_ms: rtt ?? null,
      is_volte_active: !!isVoLTECall,
      location_region: 'unknown',
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
      module_accessed: moduleName || 'unknown',
      operation: operation || 'list',
      query_duration_ms: durationMs ?? null,
      query_size_bytes: sizeBytes ?? null,
      success: success !== false,
      error_type: errorType || 'null',
      retry_count: retryCount,
    });
  }, [effectiveType, downlink, rtt, isVoLTECall]);

  const logNetworkStats = useCallback((moduleName) => {
    logQuery({ moduleName, operation: 'list', success: true });
  }, [logQuery]);

  useEffect(() => {
    const flush = async () => {
      if (bufferRef.current.length === 0) return;
      const batch = bufferRef.current.splice(0, bufferRef.current.length);
      try {
        await base44.entities.NetworkTelemetry.bulkCreate(batch);
      } catch (e) {
        // No bloquear la app por fallos de telemetría
      }
    };
    const interval = setInterval(flush, 30000);
    return () => { clearInterval(interval); flush(); };
  }, []);

  return { logQuery, logNetworkStats };
}