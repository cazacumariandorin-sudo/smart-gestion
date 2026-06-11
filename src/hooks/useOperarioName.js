/**
 * Hook que resuelve el nombre de un técnico a partir de su email de usuario.
 * Carga la lista de técnicos una sola vez y devuelve una función de lookup.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useTecnicoName() {
  const { data: tecnicos = [] } = useQuery({
    queryKey: ['tecnicos_lookup'],
    queryFn: () => base44.entities.Operario.list('name', 300),
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Dado un email de usuario, devuelve el nombre del técnico vinculado.
   * Si no hay vinculación, devuelve el email tal cual (fallback).
   */
  const getTecnicoName = (userEmail) => {
    if (!userEmail) return '—';
    const match = tecnicos.find(op => op.user_email === userEmail);
    return match ? match.name : userEmail;
  };

  return { getTecnicoName, tecnicos };
}