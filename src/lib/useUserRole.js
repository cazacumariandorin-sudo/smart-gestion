import { useAuth } from '@/lib/AuthContext';
import { getSimulatedRole } from '@/lib/roleSimulator';
import { useState, useEffect } from 'react';

/**
 * Derives role and permission helpers directly from the AuthContext user.
 * Does NOT use useQuery — avoids any hook-count instability between renders.
 */
export function useUserRole() {
  const { user, isLoadingAuth } = useAuth();

  // Listen for simulator changes so nav/sidebar re-renders instantly
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('role-simulator-change', handler);
    return () => window.removeEventListener('role-simulator-change', handler);
  }, []);

  const realRole = user?.role || 'operario';
  const simulatedRole = getSimulatedRole();
  // Only allow simulation for real admins
  const isRealAdmin = realRole === 'admin';
  const role = (isRealAdmin && simulatedRole) ? simulatedRole : realRole;
  const today = new Date().toISOString().split('T')[0];
  const tempFullAccess = user?.acceso_total_hasta && user.acceso_total_hasta >= today;

  // When simulating, treat the simulated role as-is (no admin override)
  const isSimulating = isRealAdmin && !!simulatedRole;
  const isAdmin = isSimulating ? false : (role === 'admin' || tempFullAccess);
  const isJefeObra = role === 'jefe_obra' || isAdmin;
  const isOperario = role === 'operario' || isAdmin;
  const isControlHorario = role === 'control_horario' || isAdmin;
  const isControlHorarioOnly = role === 'control_horario' && !isAdmin;
  const isClienteObra = role === 'cliente_obra';

  const canAccess = (module) => {
    if (isAdmin) return true;

    const perms = {
      admin: ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'users', 'materials', 'drawings', 'orders', 'operarios', 'gastos-operarios', 'control-horario', 'obras', 'calendario-vacaciones', 'manuales', 'informe-obras', 'fabricantes', 'admin-backup', 'datos-sensibles', 'demo-users', 'solar-pedidos', 'inventario'],
      jefe_obra: ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'orders', 'obras', 'materials', 'drawings', 'manuales', 'informe-obras', 'operarios', 'gastos-operarios'],
      operario: ['dashboard', 'work-orders', 'control-horario', 'gastos-operarios', 'orders', 'obras', 'materials', 'drawings', 'manuales', 'calendario-vacaciones', 'photos'],
      control_horario: ['dashboard', 'control-horario', 'work-orders', 'orders', 'obras', 'materials', 'drawings', 'manuales', 'informe-obras'],
      cliente_obra: ['dashboard', 'informe-obras'],
    };

    return (perms[role] || []).includes(module);
  };

  return { user, role, isAdmin, isJefeObra, isOperario, isControlHorario, isControlHorarioOnly, isClienteObra, canAccess, isLoading: isLoadingAuth, isSimulating, simulatedRole };
}