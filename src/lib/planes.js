/**
 * planes.js — catálogo de planes comerciales (ediciones) de la app.
 *
 * Un plan NO cambia los permisos de datos: eso lo siguen decidiendo el rol
 * (permissions.js) y el acceso por registro. El plan solo recorta QUÉ MÓDULOS
 * ve la plantilla de la empresa que lo ha contratado. Un módulo fuera del plan
 * se comporta como uno no permitido por el rol: no aparece en menús ni hubs y
 * su ruta redirige al inicio.
 *
 * Los administradores (admin/propietario) no quedan afectados, para que siempre
 * puedan cambiar el plan sin quedarse fuera de la app.
 */

export const PLAN_POR_DEFECTO = 'completo';

/** Etiquetas legibles de los módulos (las claves son las de permissions.js/hubs.js). */
export const MODULO_LABELS = {
  dashboard: 'Inicio',
  'work-orders': 'Partes',
  'parte-diario': 'Parte diario',
  'trabajos-extras': 'Trabajos extras',
  'material-pendiente': 'Material pendiente',
  clients: 'Clientes',
  'informe-obras': 'Informe obras',
  'obras-civiles': 'Obras civiles',
  solar: 'Solar',
  operarios: 'Técnicos y personal',
  'control-horario': 'Control horario',
  'apuntes-horario': 'Apuntes de horario',
  'calendario-vacaciones': 'Vacaciones y ausencias',
  expedientes: 'Expedientes',
  'notas-gastos': 'Gastos y justificantes',
  orders: 'Pedidos',
  materials: 'Materiales',
  inventario: 'Inventario',
  fabricantes: 'Fabricantes',
  nominas: 'Nóminas',
  presupuestos: 'Presupuestos',
  'economico-dashboard': 'Dashboard económico',
  contabilidad: 'Contabilidad',
  flota: 'Flota',
  chat: 'Chat',
  'galeria-fotos': 'Galería de fotos',
  photos: 'Fotos de partes',
  drawings: 'Planos',
  manuales: 'Manuales',
  ingenieria: 'Ingeniería',
  reports: 'Informes',
  users: 'Usuarios y sistema',
  'datos-sensibles': 'Datos sensibles',
  'admin-backup': 'Copias de seguridad',
};

/**
 * Catálogo de planes.
 * `modulos: null` = sin recorte (todos los módulos que permita el rol).
 */
export const PLANES = [
  {
    key: 'completo',
    label: 'Completo / Empresa',
    descripcion: 'Todo el sistema: operación, obra, personal, económico y legal.',
    modulos: null,
  },
  {
    key: 'control_horario',
    label: 'Control horario',
    descripcion: 'Fichajes, apuntes, personal y ausencias. Sin económicos ni compras.',
    modulos: ['dashboard', 'control-horario', 'apuntes-horario', 'operarios', 'calendario-vacaciones', 'chat'],
  },
  {
    key: 'cliente_obra',
    label: 'Cliente / Obra',
    descripcion: 'Seguimiento de obra y documentación gráfica. Sin personal ni económicos.',
    modulos: ['dashboard', 'informe-obras', 'galeria-fotos', 'chat'],
  },
  {
    key: 'legal',
    label: 'Administrativa / Legal',
    descripcion: 'Registro horario legal, validación y expedientes.',
    modulos: ['dashboard', 'control-horario', 'expedientes', 'chat'],
  },
];

export function getPlan(key) {
  return PLANES.find((p) => p.key === key) || PLANES[0];
}

/** Devuelve los módulos del plan, o null si el plan no recorta nada. */
export function modulosDelPlan(key) {
  return getPlan(key).modulos;
}

/** ¿El plan contratado incluye este módulo? (null = sin restricción) */
export function moduloPermitidoPorPlan(key, module) {
  if (!module) return true;
  const modulos = modulosDelPlan(key);
  if (!modulos) return true;
  return modulos.includes(module);
}