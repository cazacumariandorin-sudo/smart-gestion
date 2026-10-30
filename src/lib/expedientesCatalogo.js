import { addDays, addMonths, format, parseISO } from 'date-fns';

/**
 * Catálogo del módulo de expedientes sancionadores.
 * Plazos según el Convenio Colectivo del Metal de la Comunidad de Madrid:
 *   · Prescripción de la falta: 10 días (leves), 20 (graves), 60 (muy graves).
 *   · Conservación del antecedente: 3 / 6 / 12 meses desde el archivo.
 */
export const ESTADO_EXPEDIENTE_META = {
  abierto: {
    label: 'Abierto',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  },
  notificado: {
    label: 'Notificado',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  },
  en_conciliacion: {
    label: 'En conciliación',
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
  },
  archivado_conciliado: {
    label: 'Archivado conciliado',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  },
  sancionado: {
    label: 'Sancionado',
    className: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  },
  prescrito: {
    label: 'Prescrito',
    className: 'bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30',
  },
  caducado: {
    label: 'Caducado',
    className: 'bg-muted text-muted-foreground border-border',
  },
  anulado: {
    label: 'Anulado',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  },
};

export const TIPO_FALTA_META = {
  leve: {
    label: 'Leve',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30',
    prescripcion_dias: 10,
    caducidad_meses: 3,
  },
  grave: {
    label: 'Grave',
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
    prescripcion_dias: 20,
    caducidad_meses: 6,
  },
  muy_grave: {
    label: 'Muy grave',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
    prescripcion_dias: 60,
    caducidad_meses: 12,
  },
};

export const ARTICULOS_EXPEDIENTE = [
  { value: 'Art. 55.a', label: 'Art. 55.a — Impuntualidad injustificada' },
  { value: 'Art. 55.b', label: 'Art. 55.b — Inasistencia injustificada' },
  { value: 'Art. 55.c', label: 'Art. 55.c — Descuido / negligencia leve (flota, registro)' },
  { value: 'Art. 57.k', label: 'Art. 57.k — Reincidencia en inasistencias (muy grave)' },
  { value: 'Art. 57', label: 'Art. 57 — Otra falta grave o muy grave' },
  { value: 'otro', label: 'Otro' },
];

export const ORIGEN_EXPEDIENTE = [
  { value: 'manual', label: 'Apertura manual' },
  { value: 'puntualidad', label: 'Impuntualidad detectada en Control Horario' },
  { value: 'inasistencia', label: 'Inasistencia sin justificar' },
  { value: 'flota', label: 'Descuido en Flota / registro de ruta' },
  { value: 'otro', label: 'Otro' },
];

export const ACUERDOS_POR_DEFECTO = [
  'La empresa, haciendo uso de su facultad discrecional, ratifica la NO aplicación de sanciones económicas ni suspensión de empleo y sueldo para este periodo.',
  'El trabajador reconoce los hechos señalados y se compromete formalmente a cumplir de manera estricta el calendario laboral, los horarios de obra y el registro de jornada en SMART-GESTION.',
  'Ambas partes dan por resuelto el conflicto, solicitando al sistema el ARCHIVO del expediente en las condiciones pactadas.',
];

export const estadoMeta = (estado) =>
  ESTADO_EXPEDIENTE_META[estado] || { label: estado || '—', className: 'bg-muted text-muted-foreground border-border' };

export const tipoFaltaMeta = (tipo) =>
  TIPO_FALTA_META[tipo] || { label: tipo || '—', className: 'bg-muted text-muted-foreground border-border', prescripcion_dias: 10, caducidad_meses: 3 };

/** Prescripción desde la fecha de conocimiento y caducidad desde el archivo. */
export function calcularFechasExpediente({ tipo_falta, fecha_conocimiento, fecha_archivo }) {
  const meta = tipoFaltaMeta(tipo_falta);
  const base = fecha_conocimiento ? parseISO(fecha_conocimiento) : new Date();
  const prescripcion = addDays(base, meta.prescripcion_dias);
  const archivo = fecha_archivo ? new Date(fecha_archivo) : new Date();
  return {
    prescripcion_dias: meta.prescripcion_dias,
    caducidad_meses: meta.caducidad_meses,
    fecha_prescripcion: format(prescripcion, 'yyyy-MM-dd'),
    fecha_caducidad: format(addMonths(archivo, meta.caducidad_meses), 'yyyy-MM-dd'),
  };
}

/** Texto del apartado MANIFESTAN del acta, redactado con los hechos del expediente. */
export function textoManifiestanExpediente(exp) {
  const articulo = exp.articulo ? ` (${exp.articulo})` : '';
  const tipo = tipoFaltaMeta(exp.tipo_falta).label.toUpperCase();
  const notificacion = exp.fecha_notificacion ? `con fecha ${exp.fecha_notificacion}` : 'en la fecha de esta acta';
  return `Que ${notificacion} se notificó al trabajador la carta de sanción con código ${exp.codigo || '—'} `
    + `por una falta calificada como ${tipo}${articulo}.`;
}

/** Siguiente código EXP-AAAA-NNN a partir de los expedientes ya existentes. */
export function siguienteCodigoExpediente(expedientes, anio) {
  const prefijo = `EXP-${anio}-`;
  const max = (expedientes || []).reduce((acc, e) => {
    if (!String(e.codigo || '').startsWith(prefijo)) return acc;
    const n = parseInt(String(e.codigo).slice(prefijo.length), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `${prefijo}${String(max + 1).padStart(3, '0')}`;
}