import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export function getNombreDisplay(email, trabajador, fullName) {
  if (trabajador?.name) return trabajador.name;
  if (fullName?.trim()) return fullName.trim();
  return email?.split('@')[0]?.replace(/[._-]/g, ' ') || 'Sin nombre';
}

export function getIniciales(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

export function useNombreUsuario(emailParam) {
  const { user } = useAuth();
  const email = emailParam || user?.email;

  const { data: trabajador } = useQuery({
    queryKey: ['trabajador_by_email', email],
    queryFn: () =>
      base44.entities.Operario.filter({ user_email: email }, '-created_date', 1)
        .then(r => r[0] || null),
    enabled: !!email,
    staleTime: 5 * 60_000,
  });

  const nombre = getNombreDisplay(email, trabajador, user?.full_name);
  const iniciales = getIniciales(nombre);

  return {
    nombre,
    iniciales,
    tieneFichaTrabajador: !!trabajador,
    trabajador,
  };
}