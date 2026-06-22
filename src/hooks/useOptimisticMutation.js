import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook optimista simple y fiable para mutaciones CRUD.
 * Actualiza la UI optimistamente y revierte en caso de error.
 */
export function useOptimisticMutation(
  mutationFn,
  queryKey,
  optimisticUpdater = null,
  onSuccess = null,
  onError = null,
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn,

    onMutate: async (data) => {
      if (!queryKey || !optimisticUpdater) return { previousData: null };

      const keys = Array.isArray(queryKey) ? queryKey : [queryKey];

      // Cancelar queries en vuelo para evitar conflictos
      await Promise.all(keys.map(key => queryClient.cancelQueries({ queryKey: [key] })));

      // Guardar snapshot del estado anterior para poder revertir
      const previousData = {};
      keys.forEach(key => {
        previousData[key] = queryClient.getQueryData([key]);
      });

      // Aplicar actualización optimista
      keys.forEach(key => {
        queryClient.setQueryData([key], (prev) => optimisticUpdater(prev ?? [], data));
      });

      return { previousData };
    },

    onSuccess: (response, variables) => {
      // Refrescar datos reales desde el servidor
      if (queryKey) {
        const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
        keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
      }
      if (onSuccess) onSuccess(response, variables);
    },

    onError: (error, variables, context) => {
      // Revertir cambios optimistas al estado anterior
      if (context?.previousData && queryKey) {
        const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
        keys.forEach(key => {
          if (context.previousData[key] !== undefined) {
            queryClient.setQueryData([key], context.previousData[key]);
          }
        });
      }
      if (onError) onError(error, variables);
    },
  });

  return mutation;
}