import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getTimeoutByNetwork } from '@/hooks/useNetworkInfo';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

/**
 * Crea cliente Base44 con timeout dinámico según red
 * - Red buena (RTT < 50ms): 5s
 * - Red media (RTT < 150ms): 8s
 * - Red lenta (RTT < 500ms): 15s
 * - Red MUY lenta (RTT > 500ms): 20s
 */
export const createBase44WithDynamicTimeout = () => {
  const timeout = getTimeoutByNetwork();
  
  return createClient({
    appId,
    token,
    functionsVersion,
    serverUrl: '',
    requiresAuth: false,
    appBaseUrl,
    timeout,  // Timeout dinámico según RTT
    retry: 2,  // Reintentar 2 veces si falla
    retryDelay: 500  // Esperar 500ms entre reintentos
  });
};

export const base44 = createBase44WithDynamicTimeout();