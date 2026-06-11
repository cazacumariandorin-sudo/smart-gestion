import {
  Building2,
  Users,
  Sun,
  ClipboardList,
  BarChart2,
  Clock,
  Calendar,
  FileText,
  Receipt,
  CreditCard,
  Banknote,
  Lock,
  Car,
  Folder,
  Book,
  Images,
  Package,
  Settings,
  MessageSquare,
  FlaskConical,
  Link2,
  Database,
  Eye,
  HardHat,
  Truck,
  Briefcase
} from 'lucide-react';

/**
 * Schema de cada hub:
 * {
 *   id: string,              // identificador único, kebab-case
 *   label: string,           // etiqueta legible para el usuario
 *   icon: LucideIcon,        // componente importado de lucide-react
 *   color: string,           // clase Tailwind de texto, ej. 'text-purple-600'
 *   activeBg: string,        // clase Tailwind de fondo activo, ej. 'bg-purple-50 dark:bg-purple-950/40'
 *   borderColor: string,     // clase Tailwind de borde, ej. 'border-purple-400'
 *   module: string | null,   // string para canAccess(); null = visible sin restricción de módulo
 *   roleRestricted: string[] | null,  // null = visible para todos; array de roles = solo esos roles
 *   items: [
 *     {
 *       label: string,
 *       path: string,
 *       icon: LucideIcon,
 *       module: string       // string para canAccess(); null = sin restricción
 *     }
 *   ]
 * }
 */

export const HUBS = [
  {
    id: 'obras',
    label: 'Obras & Proyectos',
    icon: Building2,
    color: 'text-purple-600',
    activeBg: 'bg-purple-50 dark:bg-purple-950/40',
    borderColor: 'border-purple-400',
    module: 'obras-civiles',
    roleRestricted: null,
    items: [
      { label: 'Obras civiles', path: '/obras-civiles', icon: Building2, module: 'obras-civiles' },
      { label: 'Clientes', path: '/clients', icon: Users, module: 'clients' },
      { label: 'Solar', path: '/solar', icon: Sun, module: 'solar' },
      { label: 'Partes', path: '/work-orders', icon: ClipboardList, module: 'work-orders' },
      { label: 'Informe', path: '/informe-obras', icon: BarChart2, module: 'informe-obras' },
    ],
  },
  {
    id: 'personas',
    label: 'Personas & Equipos',
    icon: Users,
    color: 'text-teal-600',
    activeBg: 'bg-teal-50 dark:bg-teal-950/40',
    borderColor: 'border-teal-400',
    module: 'operarios',
    roleRestricted: null,
    items: [
      { label: 'Trabajadores', path: '/operarios', icon: Users, module: 'operarios' },
      { label: 'Horario', path: '/control-horario', icon: Clock, module: 'control-horario' },
      { label: 'Vacaciones', path: '/calendario-vacaciones', icon: Calendar, module: 'calendario-vacaciones' },
      { label: 'Apuntes', path: '/apuntes-horario', icon: Clock, module: 'apuntes-horario' },
      { label: 'Documentación', path: '/documentacion-operarios', icon: FileText, module: 'operarios' },
    ],
  },
  {
    id: 'economico',
    label: 'Económico',
    icon: Receipt,
    color: 'text-amber-600',
    activeBg: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-400',
    module: 'notas-gastos',
    roleRestricted: null,
    items: [
      { label: 'Gastos', path: '/notas-gastos', icon: Receipt, module: 'notas-gastos' },
      { label: 'Pedidos', path: '/orders', icon: CreditCard, module: 'orders' },
      { label: 'Nóminas', path: '/nominas', icon: Banknote, module: 'nominas' },
      { label: 'Presupuestos', path: '/presupuestos', icon: FileText, module: 'economico' },
      { label: 'Datos sensibles', path: '/datos-sensibles', icon: Lock, module: 'users' },
    ],
  },
  {
    id: 'flota',
    label: 'Flota & Movilidad',
    icon: Car,
    color: 'text-blue-600',
    activeBg: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-400',
    module: 'flota',
    roleRestricted: null,
    items: [
      { label: 'Vehículos', path: '/flota', icon: Truck, module: 'flota' },
    ],
  },
  {
    id: 'documental',
    label: 'Documental',
    icon: Folder,
    color: 'text-orange-600',
    activeBg: 'bg-orange-50 dark:bg-orange-950/40',
    borderColor: 'border-orange-400',
    module: 'orders',
    roleRestricted: null,
    items: [
      { label: 'Planos', path: '/drawings', icon: Folder, module: 'drawings' },
      { label: 'Manuales', path: '/manuales', icon: Book, module: 'manuales' },
      { label: 'Galería', path: '/galeria-fotos', icon: Images, module: 'galeria-fotos' },
      { label: 'Materiales', path: '/materials', icon: Package, module: 'orders' },
      { label: 'Inventario', path: '/inventario', icon: ClipboardList, module: 'users' },
      { label: 'Fabricantes', path: '/fabricantes', icon: Building2, module: 'users' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: Settings,
    color: 'text-slate-600',
    activeBg: 'bg-slate-50 dark:bg-slate-950/40',
    borderColor: 'border-slate-400',
    module: 'users',
    roleRestricted: ['admin', 'gerencia'],
    items: [
      { label: 'Chat', path: '/chat', icon: MessageSquare, module: 'chat' },
      { label: 'Usuarios', path: '/users', icon: Users, module: 'users' },
      { label: 'Demos', path: '/demo-users', icon: FlaskConical, module: 'users' },
      { label: 'Invitaciones', path: '/invitaciones-demo', icon: Link2, module: 'users' },
      { label: 'Backup', path: '/admin-backup', icon: Database, module: 'users' },
      { label: 'Informes', path: '/reports', icon: BarChart2, module: 'reports' },
      { label: 'Simulador', path: '/simulador-roles', icon: Eye, module: 'users' },
    ],
  },
];

/**
 * Determina si un hub es visible para un usuario dado su rol y si está en modo demo.
 * @param {Object} hub - El objeto hub a evaluar
 * @param {Object} options - Opciones de evaluación
 * @param {string} options.role - El rol del usuario
 * @param {boolean} options.isDemo - Si el usuario está en modo demo
 * @returns {boolean} - true si el hub es visible, false en caso contrario
 */
export function isHubVisible(hub, { role, isDemo }) {
  // Si el hub tiene restricción de rol y el usuario no está en esa lista, no es visible
  if (hub.roleRestricted && !hub.roleRestricted.includes(role)) {
    return false;
  }
  // Si es usuario demo, ocultar personas y sistema
  if (isDemo && (hub.id === 'personas' || hub.id === 'sistema')) {
    return false;
  }
  return true;
}