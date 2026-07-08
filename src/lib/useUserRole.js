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

  // When simulating, treat the simulated role as-is (no admin override)
  const isSimulating = isRealAdmin && !!simulatedRole;
  const isAdmin = isSimulating ? false : (role === 'admin');
  const isDemo = role === 'usuario_demo';
  const isGerencia = role === 'gerencia' || isAdmin;
  const isJefeObra = role === 'jefe_obra' || isAdmin;
  const isTecnico = role === 'técnico' || isAdmin;
  const isOperario = role === 'operario' || isAdmin;
  const isControlHorario = role === 'control_horario' || isAdmin;
  const isControlHorarioOnly = role === 'control_horario' && !isAdmin;
  const isClienteObra = role === 'cliente_obra';

  // Check if demo account is expired
  const isDemoExpired = isDemo && user?.demo_expires_at
    ? new Date(user.demo_expires_at) < new Date()
    : false;

  const DEMO_MODULES = ['dashboard', 'work-orders', 'clients', 'obras', 'orders', 'drawings', 'manuales', 'notas-gastos', 'flota', 'galeria-fotos', 'control-horario', 'calendario-vacaciones', 'apuntes-horario', 'photos'];

  const canAccess = (module) => {
    if (isAdmin) return true;
    if (isDemo) return DEMO_MODULES.includes(module);

    const ALL_MODULES = ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'users', 'materials', 'drawings', 'manuales', 'orders', 'operarios', 'control-horario', 'obras', 'obras-civiles', 'solar', 'calendario-vacaciones', 'informe-obras', 'fabricantes', 'admin-backup', 'datos-sensibles', 'demo-users', 'solar-pedidos', 'inventario', 'notas-gastos', 'vehiculos', 'chat', 'flota', 'galeria-fotos', 'apuntes-horario', 'nominas', 'presupuestos'];

    const perms = {
      director_comercial: ALL_MODULES.filter(m => !['datos-sensibles', 'admin-backup'].includes(m)),
      jefe_obra:        ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'orders', 'obras', 'obras-civiles', 'solar', 'materials', 'drawings', 'manuales', 'informe-obras', 'operarios', 'notas-gastos', 'vehiculos', 'chat', 'flota', 'galeria-fotos', 'apuntes-horario', 'calendario-vacaciones', 'control-horario'],
      'técnico':        ['dashboard', 'work-orders', 'clients', 'control-horario', 'orders', 'obras', 'obras-civiles', 'materials', 'drawings', 'manuales', 'calendario-vacaciones', 'photos', 'notas-gastos', 'vehiculos', 'chat', 'galeria-fotos', 'apuntes-horario', 'reports', 'flota', 'nominas', 'informe-obras'],
      operario:         ['dashboard', 'work-orders', 'clients', 'control-horario', 'orders', 'obras', 'obras-civiles', 'materials', 'drawings', 'manuales', 'calendario-vacaciones', 'photos', 'notas-gastos', 'vehiculos', 'chat', 'galeria-fotos', 'apuntes-horario', 'reports', 'flota', 'nominas', 'informe-obras'],
      gerencia:         ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'orders', 'obras', 'obras-civiles', 'solar', 'materials', 'drawings', 'manuales', 'informe-obras', 'operarios', 'notas-gastos', 'vehiculos', 'chat', 'flota', 'galeria-fotos', 'apuntes-horario', 'calendario-vacaciones', 'control-horario', 'solar-pedidos', 'users', 'datos-sensibles', 'inventario', 'fabricantes', 'demo-users', 'admin-backup', 'nominas', 'presupuestos'],
      control_horario:  ['dashboard', 'control-horario', 'work-orders', 'chat'],
      cliente_obra:     ['dashboard', 'informe-obras', 'chat'],
    };

    return (perms[role] || []).includes(module);
  };

  return { user, role, isAdmin, isDemo, isDemoExpired, isGerencia, isJefeObra, isTecnico, isOperario, isControlHorario, isControlHorarioOnly, isClienteObra, canAccess, isLoading: isLoadingAuth, isSimulating, simulatedRole };
}