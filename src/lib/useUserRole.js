import { useAuth } from '@/lib/AuthContext';
import { getSimulatedRole } from '@/lib/roleSimulator';
import { canAccessModule } from '@/lib/permissions';
import { moduloPermitidoPorPlan } from '@/lib/planes';
import { getPlanActivo, suscribirPlan, cargarPlanActivo } from '@/lib/planActivo';
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

  // Plan comercial vigente (recorta módulos; los administradores no se ven afectados).
  const [planKey, setPlanKey] = useState(getPlanActivo());
  useEffect(() => {
    const unsubscribe = suscribirPlan((p) => setPlanKey(p.key));
    cargarPlanActivo().catch(() => {});
    return unsubscribe;
  }, []);

  const realRole = user?.role || 'operario';
  const simulatedRole = getSimulatedRole();
  // Only allow simulation for real admins
  const isRealAdmin = realRole === 'admin';
  const role = (isRealAdmin && simulatedRole) ? simulatedRole : realRole;

  // When simulating, treat the simulated role as-is (no admin override)
  const isSimulating = isRealAdmin && !!simulatedRole;
  const isAdmin = isSimulating ? false : (role === 'admin' || role === 'propietario');
  const isDemo = role === 'usuario_demo';
  const isGerencia = role === 'gerencia' || isAdmin;
  const isJefeObra = role === 'jefe_obra' || isAdmin;
  const isTecnico = role === 'técnico' || isAdmin;
  const isOperario = role === 'operario' || isAdmin;
  const isControlHorario = role === 'control_horario' || isAdmin;
  const isControlHorarioOnly = role === 'control_horario' && !isAdmin;
  const isClienteObra = role === 'cliente_obra';
  const isContabilidad = role === 'contabilidad';
  const isAdministracion = role === 'administracion';

  // Check if demo account is expired
  const isDemoExpired = isDemo && user?.demo_expires_at
    ? new Date(user.demo_expires_at) < new Date()
    : false;

  // Fuente única: src/lib/permissions.js (ROLE_MODULE_PERMISSIONS).
  // isAdmin / isDemo ya están cubiertos ahí (admin/propietario = all; usuario_demo = su lista).
  // El plan comercial de la empresa recorta además los módulos (planes.js).
  // Los administradores no se ven afectados por el plan: siempre ven todo para
  // poder cambiarlo sin quedarse fuera de la app.
  const canAccess = (module) =>
    canAccessModule(role, module) && (isAdmin || moduloPermitidoPorPlan(planKey, module));

  return { user, role, planKey, isAdmin, isDemo, isDemoExpired, isGerencia, isJefeObra, isTecnico, isOperario, isControlHorario, isControlHorarioOnly, isClienteObra, isContabilidad, isAdministracion, canAccess, isLoading: isLoadingAuth, isSimulating, simulatedRole };
}