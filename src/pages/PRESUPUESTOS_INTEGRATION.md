/**
 * INTEGRACIÓN DE PRESUPUESTOS EN APP.JSX
 * 
 * Agregar estas líneas en el archivo App.jsx en los lugares indicados
 */

// ==================== 1. EN LOS LAZY IMPORTS (arriba con otros imports) ====================

// Agregar después de los otros lazy imports:
/*
const Presupuestos = lazy(() => import('./pages/Presupuestos'));
*/

// ==================== 2. EN LAS RUTAS (dentro del elemento Routes) ====================

/*
// Presupuestos
<Route path="/presupuestos" element={
  <ProtectedRoute module="obras-civiles">
    <Presupuestos />
  </ProtectedRoute>
} />
*/

// ==================== 3. EN EL USEROBJECT (ESTO YA DEBERÍA ESTAR EN useUserRole.js) ====================

/*
const ALL_MODULES = [
  'dashboard', 'work-orders', 'clients', 'reports', 'photos', 'users', 'materials',
  'drawings', 'manuales', 'orders', 'operarios', 'control-horario', 'obras',
  'obras-civiles', 'solar', 'inventario', 'fabricantes', 'admin-backup',
  'datos-sensibles', 'operarios', 'apuntes-horario', 'calendario-vacaciones',
  'chat', 'galeria-fotos', 'notas-gastos', 'flota', 'informe-obras',
  'vinculacion', 'diagnostico-operario', 'simulador-roles', 'presupuestos' // ← AGREGAR ESTO
];

const perms = {
  admin: ALL_MODULES,
  gerencia: ALL_MODULES.filter(m => !['datos-sensibles', 'admin-backup'].includes(m)),
  director_comercial: ALL_MODULES.filter(m => !['datos-sensibles', 'admin-backup'].includes(m)),
  jefe_obra: [...modules...],
  operario: [...modules...],
  // etc
};
*/

// ==================== 4. EN EL DASHBOARD (Dashboard.jsx) ====================

/*
// En HUB_CONFIG, agregar:
{
  id: 'presupuestos',
  label: 'Presupuestos',
  icon: DollarSign,
  path: '/presupuestos',
  color: 'text-green-800',
  iconBg: 'bg-green-600',
  bg: 'bg-gradient-to-br from-green-100 to-green-50',
  border: 'border-green-300',
  module: 'obras-civiles',
  links: [
    { label: 'Presupuestos', path: '/presupuestos', icon: DollarSign },
    { label: 'Simulador', path: '/presupuestos', icon: Calculator },
    { label: 'Reportes', path: '/presupuestos', icon: BarChart2 },
  ],
},
*/

// ==================== 5. AGREGAR IMPORTS EN Dashboard.jsx ====================

/*
import { DollarSign, Calculator } from 'lucide-react';
*/

// ==================== 6. EN MobileNav.jsx - Agregar en HUB_GROUPS ====================

/*
{
  id: 'presupuestos',
  label: 'Presupuestos',
  icon: DollarSign,
  color: 'text-green-600',
  activeBg: 'bg-green-100 dark:bg-green-900/40',
  module: 'presupuestos',
  items: [
    { label: 'Presupuestos', path: '/presupuestos', icon: DollarSign, module: 'presupuestos' },
  ],
},
*/

console.log('✅ Presupuestos integrado. Ver instrucciones arriba para completar la integración en App.jsx');
