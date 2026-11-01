/**
 * permissions.js — FUENTE ÚNICA de permisos de interfaz por rol.
 *
 * Sustituye al objeto `perms` y al array `DEMO_MODULES` que antes vivían
 * dentro de `useUserRole.js`, y a los arrays `roles:[...]` repartidos por
 * `hubs.js` (que resultaron ser código muerto: Sidebar y MobileNav ya
 * filtraban solo con `canAccess(module)`).
 *
 * Principio: NO cambia qué puede hacer cada rol hoy. Los arrays son una
 * copia exacta del estado corregido a fecha de la auditoría (incluidos
 * los ~13 arreglos puntuales de `administracion`). Cualquier ajuste de
 * alcance futuro se hace aquí, en un único sitio.
 *
 * `técnico` es el rol de campo principal y más usado en producción: su
 * alcance NO se toca salvo petición explícita y separada de gerencia.
 * `operario` es el rol legado, ya reemplazado por `técnico` y con 0
 * usuarios reales hoy; se mantiene con alcance idéntico a `técnico`.
 * `propietario` se trata como alias explícito de `admin` ({ all: true }).
 */

// Lista maestra de módulos (antes ALL_MODULES en useUserRole.js).
export const ALL_MODULES = [
  'dashboard', 'work-orders', 'clients', 'reports', 'photos', 'users',
  'materials', 'drawings', 'manuales', 'orders', 'operarios',
  'control-horario', 'obras', 'obras-civiles', 'solar',
  'calendario-vacaciones', 'informe-obras', 'fabricantes', 'admin-backup',
  'datos-sensibles', 'demo-users', 'solar-pedidos', 'inventario',
  'notas-gastos', 'vehiculos', 'chat', 'flota', 'galeria-fotos',
  'apuntes-horario', 'nominas', 'presupuestos', 'parte-diario',
  'economico-dashboard', 'trabajos-extras', 'material-pendiente',
  'conciliacion', 'contabilidad', 'ingenieria', 'expedientes',
];

/**
 * Objeto único rol → permisos de módulo.
 * - `{ all: true }`  → acceso total (admin y su alias propietario).
 * - `[ ... ]`        → lista explícita de módulos permitidos.
 */
export const ROLE_MODULE_PERMISSIONS = {
  admin:            { all: true },
  propietario:      { all: true }, // alias explícito de admin — documentado, no implícito

  gerencia: [
    'dashboard', 'work-orders', 'clients', 'reports', 'photos', 'orders',
    'obras', 'obras-civiles', 'solar', 'materials', 'drawings', 'manuales',
    'informe-obras', 'operarios', 'notas-gastos', 'vehiculos', 'chat',
    'flota', 'galeria-fotos', 'apuntes-horario', 'calendario-vacaciones',
    'control-horario', 'solar-pedidos', 'users', 'datos-sensibles',
    'inventario', 'fabricantes', 'demo-users', 'admin-backup', 'nominas',
    'presupuestos', 'parte-diario', 'economico-dashboard', 'trabajos-extras',
    'material-pendiente', 'conciliacion', 'contabilidad', 'ingenieria',
    'expedientes',
  ],

  // ingeniero = rol operativo del módulo Ingeniería/ObraCheck. Alcance de
  // campo + módulo Ingeniería completo + presupuestos (decisión de Dirección,
  // regla DOC-08). Sin users, datos-sensibles, admin-backup, nominas,
  // economico-dashboard ni contabilidad (esos son de dirección/administración).
  ingeniero: [
    'dashboard', 'ingenieria', 'work-orders', 'clients', 'obras',
    'obras-civiles', 'solar', 'materials', 'drawings', 'manuales',
    'informe-obras', 'operarios', 'notas-gastos', 'vehiculos', 'chat',
    'flota', 'galeria-fotos', 'apuntes-horario', 'photos', 'parte-diario',
    'presupuestos',
  ],

  // director_comercial = todo salvo datos-sensibles y admin-backup.
  director_comercial: ALL_MODULES.filter(m => !['datos-sensibles', 'admin-backup', 'expedientes'].includes(m)),

  jefe_obra: [
    'dashboard', 'work-orders', 'clients', 'reports', 'photos', 'orders',
    'obras', 'obras-civiles', 'solar', 'materials', 'drawings', 'manuales',
    'informe-obras', 'operarios', 'notas-gastos', 'vehiculos', 'chat',
    'flota', 'galeria-fotos', 'apuntes-horario', 'calendario-vacaciones',
    'control-horario', 'parte-diario', 'trabajos-extras', 'material-pendiente',
  ],

  // Rol de campo principal — el más usado en producción. NO tocar su alcance.
  técnico: [
    'dashboard', 'work-orders', 'clients', 'control-horario', 'orders',
    'obras', 'obras-civiles', 'materials', 'drawings', 'manuales',
    'calendario-vacaciones', 'photos', 'notas-gastos', 'vehiculos',
    'chat', 'galeria-fotos', 'apuntes-horario', 'reports', 'flota',
    'nominas', 'informe-obras', 'operarios', 'parte-diario',
  ],

  // Rol legado, 0 usuarios reales hoy. Alcance idéntico a `técnico`.
  operario: [
    'dashboard', 'work-orders', 'clients', 'control-horario', 'orders',
    'obras', 'obras-civiles', 'materials', 'drawings', 'manuales',
    'calendario-vacaciones', 'photos', 'notas-gastos', 'vehiculos',
    'chat', 'galeria-fotos', 'apuntes-horario', 'reports', 'flota',
    'nominas', 'informe-obras', 'operarios', 'parte-diario',
  ],

  control_horario: ['dashboard', 'control-horario', 'work-orders', 'chat'],

  cliente_obra: ['dashboard', 'informe-obras', 'chat'],

  contabilidad: ['economico-dashboard', 'notas-gastos', 'orders', 'conciliacion', 'contabilidad'],

  // Partir del estado ya corregido hoy; idéntico a gerencia.
  administracion: [
    'dashboard', 'work-orders', 'clients', 'reports', 'photos', 'orders',
    'obras', 'obras-civiles', 'solar', 'materials', 'drawings', 'manuales',
    'informe-obras', 'operarios', 'notas-gastos', 'vehiculos', 'chat',
    'flota', 'galeria-fotos', 'apuntes-horario', 'calendario-vacaciones',
    'control-horario', 'solar-pedidos', 'users', 'datos-sensibles',
    'inventario', 'fabricantes', 'demo-users', 'admin-backup', 'nominas',
    'presupuestos', 'parte-diario', 'economico-dashboard', 'trabajos-extras',
    'material-pendiente', 'conciliacion', 'contabilidad', 'expedientes',
  ],

  // Antes DEMO_MODULES — módulos visibles para cuentas de demostración.
  usuario_demo: [
    'dashboard', 'work-orders', 'clients', 'obras', 'orders', 'drawings',
    'manuales', 'notas-gastos', 'flota', 'galeria-fotos', 'control-horario',
    'calendario-vacaciones', 'apuntes-horario', 'photos',
  ],
};

/**
 * Comprueba si un rol puede acceder a un módulo.
 * @param {string} role  Rol efectivo (ya con simulación aplicada).
 * @param {string} module  Clave de módulo (la que usa hubs.js / ProtectedRoute).
 * @returns {boolean}
 */
export function canAccessModule(role, module) {
  if (!module) return true; // null = visible sin restricción de módulo
  const p = ROLE_MODULE_PERMISSIONS[role];
  if (!p) return false;
  if (p.all) return true;
  return p.includes(module);
}