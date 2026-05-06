/**
 * Hook que resuelve el nombre de un operario a partir de su email de usuario.
 * Carga la lista de operarios una sola vez y devuelve una función de lookup.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useOperarioName() {
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios_lookup'],
    queryFn: () => base44.entities.Operario.list('name', 300),
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Dado un email de usuario, devuelve el nombre del operario vinculado.
   * Si no hay vinculación, devuelve el email tal cual (fallback).
   */
  const getOperarioName = (userEmail) => {
    if (!userEmail) return '—';
    const match = operarios.find(op => op.user_email === userEmail);
    return match ? match.name : userEmail;
  };

  return { getOperarioName, operarios };
}