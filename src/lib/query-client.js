import { QueryClient } from '@tanstack/react-query';

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
      
      // Reintentar 1 vez en caso de error
      retry: 1,
      
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
