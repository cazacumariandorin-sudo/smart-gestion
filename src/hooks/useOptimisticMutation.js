import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook para mutations con optimistic updates automáticos
 * @param {string} mutationFn - Función de mutación
 * @param {string} queryKey - Clave de query a actualizar
 * @param {function} optimisticUpdater - Función que actualiza cache optimistamente
 * @param {function} onSuccess - Callback al éxito
 * @param {function} onError - Callback al error
 */
export function useOptimisticMutation(mutationFn, queryKey, optimisticUpdater, onSuccess, onError) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancelar queries pendientes
      await qc.cancelQueries({ queryKey: [queryKey] });

      // Snapshot del estado anterior
      const previousData = qc.getQueryData([queryKey]);

      // Update optimista
      if (optimisticUpdater && previousData) {
        const optimistic = optimisticUpdater(previousData, variables);
        qc.setQueryData([queryKey], optimistic);
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Revert automático en error
      if (context?.previousData) {
        qc.setQueryData([queryKey], context.previousData);
      }
      onError?.(err);
    },
    onSuccess: (data, variables) => {
      // Invalidar para refetch si necesario, o confiar en optimistic
      qc.invalidateQueries({ queryKey: [queryKey] });
      onSuccess?.(data);
    },
  });
}