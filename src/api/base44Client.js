import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { getTimeoutByNetwork } from '@/hooks/useNetworkInfo';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Calcular timeout dinámico según la red
const timeout = getTimeoutByNetwork();

// Crear cliente con timeout dinámico
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl,
  timeout,  // Timeout dinámico: 5-20s según RTT
  retry: 2,  // Reintentar 2 veces si falla
  retryDelay: 500  // Esperar 500ms entre reintentos
});