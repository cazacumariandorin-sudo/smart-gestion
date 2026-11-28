import { ROLE_LABELS } from '@/lib/roleLabels';

/** Estados del espacio Base44 de una empresa. */
export const ESTADOS_ESPACIO = {
  pendiente_configuracion: { label: 'Pendiente de configurar', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  configurado: { label: 'Configurado', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  activo: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  suspendido: { label: 'Suspendido', className: 'bg-red-50 text-red-700 border-red-200' },
};

/** Pasos de aprovisionamiento de un espacio de empresa. */
export const PASOS_ESPACIO = [
  { clave: 'espacio_creado', etiqueta: 'Espacio Base44 creado para la empresa' },
  { clave: 'app_publicada', etiqueta: 'App publicada en el espacio' },
  { clave: 'admin_local', etiqueta: 'Administrador local invitado' },
  { clave: 'plan_asignado', etiqueta: 'Plan comercial asignado' },
  { clave: 'acceso_verificado', etiqueta: 'Acceso y aislamiento verificados' },
];

export const checklistInicial = () =>
  PASOS_ESPACIO.map((p) => ({ clave: p.clave, etiqueta: p.etiqueta, hecho: false }));

/** Estados de una solicitud de privilegios. */
export const ESTADOS_SOLICITUD = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  aprobada: { label: 'Aprobada', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazada: { label: 'Rechazada', className: 'bg-red-50 text-red-700 border-red-200' },
  aplicada: { label: 'Aplicada', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  anulada: { label: 'Anulada', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

/** Roles que una empresa puede solicitar. El propietario no se solicita: es único. */
export const ROLES_SOLICITABLES = Object.keys(ROLE_LABELS).filter((rol) => rol !== 'propietario');

export const etiquetaRol = (rol) => ROLE_LABELS[rol]?.label || rol || '—';