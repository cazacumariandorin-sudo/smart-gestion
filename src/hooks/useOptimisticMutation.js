import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { saveWithOfflineFallback, getQueue, updateQueue } from '@/utils/offlineQueue';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Hook optimista que guarda automáticamente en cola offline si falla
 * 
 * @param {Function} mutationFn - Función async que ejecuta la mutación
 * @param {string|Array} queryKey - Key(s) de React Query a invalidar
 * @param {Function} optimisticUpdater - Función para actualizar UI antes de request
 * @param {Function} onSuccess - Callback de éxito
 * @param {Function} onError - Callback de error
 * @param {string} entityName - Nombre de la entidad (ej: "WorkOrder")
 * @param {number} maxRetries - Máximo de reintentos (default: 3)
 */
export function useOptimisticMutation(
  mutationFn,
  queryKey,
  optimisticUpdater = null,
  onSuccess = null,
  onError = null,
  entityName = 'Unknown',
  maxRetries = 3
) {
  const queryClient = useQueryClient();
  const { isOnline } = useOnlineStatus();
  const retryCountRef = useRef(0);

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Si está online, intentar directamente
      if (isOnline) {
        retryCountRef.current = 0;
        return mutationFn(data);
      }

      // Si está offline, guardar en cola y retornar
      throw new OfflineError('Sin conexión a internet', { data, entityName });
    },

    onMutate: async (data) => {
      // Cancelar queries en vuelo
      if (queryKey) {
        const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
        keys.forEach(key => queryClient.cancelQueries({ queryKey: key }));
      }

      // Actualizar UI optimista
      if (optimisticUpdater && queryKey) {
        const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
        keys.forEach(key => {
          queryClient.setQueryData(key, (prev) => optimisticUpdater(prev ?? [], data));
        });
      }

      return { data };
    },

    onSuccess: (response, variables) => {
      // Invalidar queries relacionadas
      if (queryKey) {
        const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }

      if (onSuccess) {
        onSuccess(response, variables);
      }

      return response;
    },

    onError: async (error, variables, context) => {
      // Si es error offline
      if (error instanceof OfflineError) {
        // Guardar en cola offline
        await saveWithOfflineFallback({
          entityName: entityName,
          action: 'CREATE',
          payload: variables,
          timestamp: new Date().toISOString(),
          intentos: 0,
          maxRetries: maxRetries,
          autoRetry: true,
        });

        // Mostrar notificación
        if (onError) {
          onError(error, variables);
        }

        return {
          offline: true,
          queued: true,
          message: `Guardado offline. Se sincronizará cuando haya conexión.`,
        };
      }

      // Si es error de red (no es timeout)
      if (error.code === 'ECONNABORTED' || error.message.includes('Network')) {
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log(`Reintentando... (${retryCountRef.current}/${maxRetries})`);

          // Esperar con backoff exponencial
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));

          // Reintentar
          return mutation.mutate(variables);
        }

        // Si agotó reintentos, guardar en cola
        await saveWithOfflineFallback({
          entityName: entityName,
          action: 'CREATE',
          payload: variables,
          timestamp: new Date().toISOString(),
          intentos: retryCountRef.current,
          maxRetries: maxRetries,
          autoRetry: true,
          error: error.message,
        });
      }

      // Error normal - no guardar en cola
      if (onError) {
        onError(error, variables);
      }

      // Revertir cambios optimistas
      if (context?.data && queryKey) {
        const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
        keys.forEach(key => {
          queryClient.setQueryData(key, (old) => old);
        });
      }

      throw error;
    },
  });

  return mutation;
}

// Clase personalizada para errores offline
class OfflineError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'OfflineError';
    this.context = context;
    this.offline = true;
  }
}

export { OfflineError };