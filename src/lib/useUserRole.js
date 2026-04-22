import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useUserRole() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['current_user'],
    queryFn: () => base44.auth.me(),
    staleTime: 60000,
  });

  const role = user?.role || 'operario';
  const today = new Date().toISOString().split('T')[0];
  const tempFullAccess = user?.acceso_total_hasta && user.acceso_total_hasta >= today;

  const isAdmin = role === 'admin' || tempFullAccess;
  const isJefeObra = role === 'jefe_obra' || isAdmin;
  const isOperario = role === 'operario' || isAdmin;
  const isControlHorario = role === 'control_horario' || isAdmin;

  // Module access by role
  const canAccess = (module) => {
    if (isAdmin) return true;
    if (tempFullAccess) return true;

    const perms = {
      // Acceso completo
      admin: ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'users', 'materials', 'drawings', 'orders', 'operarios', 'gastos-operarios', 'control-horario', 'obras', 'calendario-vacaciones', 'manuales', 'solar', 'administracion', 'fabricantes'],
      // Partes de trabajo, clientes, pedidos y obras (orders+obras+materials+drawings+manuales), informes, galería de fotos
      jefe_obra: ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'orders', 'obras', 'materials', 'drawings', 'manuales'],
      // Control horario propio, documentación propia, gastos propios, doc obra, pedidos y obras, vacaciones propias, partes de trabajo, galería de fotos
      operario: ['dashboard', 'work-orders', 'control-horario', 'gastos-operarios', 'orders', 'obras', 'materials', 'drawings', 'manuales', 'calendario-vacaciones', 'photos'],
      // Solo control horario + pedidos y obras (orders+obras+materials+drawings+manuales) + partes de trabajo
      control_horario: ['dashboard', 'control-horario', 'work-orders', 'orders', 'obras', 'materials', 'drawings', 'manuales'],
    };

    return (perms[role] || []).includes(module);
  };

  return { user, role, isAdmin, isJefeObra, isOperario, isControlHorario, canAccess, isLoading };
}