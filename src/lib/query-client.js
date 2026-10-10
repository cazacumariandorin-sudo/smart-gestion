import { QueryClient } from '@tanstack/react-query';
import { getTimeoutByNetwork, getTimeoutByRtt } from '@/hooks/useNetworkInfo';
import { toast } from 'sonner';
import { mensajeErrorGuardado } from '@/lib/workOrderUtils';

/**
 * Instancia global de QueryClient con configuración optimizada para app con offline support
 */
export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // No refetchar cuando la ventana recibe foco (evita spam de requests)
      refetchOnWindowFocus: false,
      
      // No refetchar cuando la red recupera conexión (lo maneja App.tsx)
      refetchOnReconnect: false,
      
      // Reintentar hasta 3 veces con backoff exponencial (máx. 30s), adaptado a la red
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Tiempo máximo que los datos se consideran fresh (5 min)
      staleTime: 5 * 60 * 1000,
      
      // Tiempo de caché en memoria antes de hacer garbage collect (10 min)
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      // Reintentar mutaciones 0 veces (manejo manual en useOptimisticMutation)
      retry: 0,
      
      // Reintentar después de 1 segundo (escalable)
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Red de seguridad: toda mutación SIN onError propio muestra un aviso visible
      // (antes 85 de 140 mutaciones fallaban en silencio). Si la mutación define su propio onError, este se ignora.
      onError: (error) => {
        console.error('[Mutación] Error no gestionado', error);
        toast.error(mensajeErrorGuardado(error), { duration: 8000 });
      },
    },
  },
});

/**
 * Middleware para loguear queries en desarrollo
 */
if (import.meta.env.DEV) {
  queryClientInstance.getDefaultOptions().queries.queryFn = async (context) => {
    console.log('🔍 Query:', context.queryKey);
    return context;
  };
}

/**
 * Timeout recomendado (ms) según la red actual — úsalo en llamadas fetch/AbortController.
 * getTimeoutByRtt reacciona a degradación puntual (p.ej. VoLTE) leyendo el RTT en el momento.
 */
export { getTimeoutByNetwork, getTimeoutByRtt };

/**
 * Reset de cache (útil para logout)
 */
export function resetQueryCache() {
  queryClientInstance.clear();
  console.log('🗑️ Cache cleared');
}

/**
 * Invalidar todas las queries de una entidad
 */
export function invalidateEntity(entityName) {
  return queryClientInstance.invalidateQueries({
    queryKey: [entityName],
  });
}

/**
 * Prefetch de data para offline
 */
export async function prefetchData(entityName, queryFn) {
  return queryClientInstance.prefetchQuery({
    queryKey: [entityName],
    queryFn,
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}