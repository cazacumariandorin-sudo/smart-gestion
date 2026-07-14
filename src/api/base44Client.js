import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getTimeoutByNetwork } from '@/hooks/useNetworkInfo';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Calcular timeout con fallback seguro
let timeout;
try {
  timeout = getTimeoutByNetwork();
  console.log('[Base44] Timeout dinámico:', timeout, 'ms');
} catch (e) {
  console.warn('[Base44] Error calculando timeout:', e.message);
  timeout = 15000;  // Fallback: 15 segundos
}

// Crear cliente con timeout dinámico y retry
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
  timeout,  // Timeout dinámico (5-20s según red) o 15s fallback
  retry: 2,  // Reintentar 2 veces si falla
  retryDelay: 500  // Esperar 500ms entre reintentos
});