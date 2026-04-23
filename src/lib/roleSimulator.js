/**
 * Role Simulator — lets admins preview the app as any role
 * without modifying real user data.
 * Uses sessionStorage so it resets on tab close.
 */

const KEY = 'role_simulator_override';

export function getSimulatedRole() {
  try { return sessionStorage.getItem(KEY) || null; } catch { return null; }
}

export function setSimulatedRole(role) {
  try {
    if (role) sessionStorage.setItem(KEY, role);
    else sessionStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event('role-simulator-change'));
}

export function clearSimulatedRole() {
  setSimulatedRole(null);
}