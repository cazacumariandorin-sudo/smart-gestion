// Constantes de presentación para MultaVehiculo

export const ESTADO_MULTA = {
  pendiente_revision: { label: 'Pendiente revisión', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_disputa: { label: 'En disputa', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  recurrida: { label: 'Recurrida', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  recurso_aceptado: { label: 'Recurso aceptado', color: 'bg-green-100 text-green-700 border-green-200' },
  recurso_rechazado: { label: 'Recurso rechazado', color: 'bg-red-100 text-red-700 border-red-200' },
  pagada: { label: 'Pagada', color: 'bg-slate-200 text-slate-700 border-slate-300' },
  anulada: { label: 'Anulada', color: 'bg-muted text-muted-foreground border-border' },
};

export const MOTIVO_AUTORIDAD = {
  no_exhibir_tique: 'No exhibir tique',
  exceso_tiempo: 'Exceso de tiempo',
  zona_no_autorizada: 'Zona no autorizada',
  estacionamiento_prohibido: 'Estacionamiento prohibido',
  otro: 'Otro',
};

export const MOTIVO_DESCARGO = {
  no_exhibir_tique: 'No exhibir tique',
  exceso_tiempo: 'Exceso de tiempo',
  zona_no_autorizada: 'Zona no autorizada',
  sin_infraccion: 'Sin infracción',
  otro: 'Otro',
};

// Estados en los que el técnico aún puede actuar (subir/corregir descargo)
export const ESTADOS_ABIERTOS_TECNICO = ['pendiente_revision', 'en_disputa'];

// Estados que representan resolución final
export const ESTADOS_RESUELTOS = ['recurso_aceptado', 'recurso_rechazado', 'pagada', 'anulada'];

export function estadoLabel(e) { return ESTADO_MULTA[e]?.label || e || '—'; }
export function estadoColor(e) { return ESTADO_MULTA[e]?.color || 'bg-muted text-muted-foreground border-border'; }