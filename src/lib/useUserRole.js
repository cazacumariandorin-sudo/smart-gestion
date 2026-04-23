import { useAuth } from '@/lib/AuthContext';

/**
 * Derives role and permission helpers directly from the AuthContext user.
 * Does NOT use useQuery — avoids any hook-count instability between renders.
 */
export function useUserRole() {
  const { user, isLoadingAuth } = useAuth();

  const role = user?.role || 'operario';
  const today = new Date().toISOString().split('T')[0];
  const tempFullAccess = user?.acceso_total_hasta && user.acceso_total_hasta >= today;

  const isAdmin = role === 'admin' || tempFullAccess;
  const isJefeObra = role === 'jefe_obra' || isAdmin;
  const isOperario = role === 'operario' || isAdmin;
  const isControlHorario = role === 'control_horario' || isAdmin;
  const isControlHorarioOnly = role === 'control_horario' && !isAdmin;
  const isClienteObra = role === 'cliente_obra';

  const canAccess = (module) => {
    if (isAdmin) return true;

    const perms = {
      admin: ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'users', 'materials', 'drawings', 'orders', 'operarios', 'gastos-operarios', 'control-horario', 'obras', 'calendario-vacaciones', 'manuales', 'solar', 'administracion', 'fabricantes'],
      jefe_obra: ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'orders', 'obras', 'materials', 'drawings', 'manuales'],
      operario: ['dashboard', 'work-orders', 'control-horario', 'gastos-operarios', 'orders', 'obras', 'materials', 'drawings', 'manuales', 'calendario-vacaciones', 'photos'],
      control_horario: ['dashboard', 'control-horario', 'work-orders', 'orders', 'obras', 'materials', 'drawings', 'manuales', 'operarios'],
      cliente_obra: ['dashboard', 'informe-obras'],
    };

    return (perms[role] || []).includes(module);
  };

  return { user, role, isAdmin, isJefeObra, isOperario, isControlHorario, isControlHorarioOnly, isClienteObra, canAccess, isLoading: isLoadingAuth };
}