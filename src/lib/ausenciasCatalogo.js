// Catálogo visual único de ausencias (Vacacion) y faltas (FaltaAsistencia).
// Las clases Tailwind deben ser literales para que el build no las elimine.

export const TIPOS_VACACION = [
  { key: 'vacaciones', label: 'Vacaciones', color: 'bg-blue-500', light: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'baja_medica', label: 'Baja médica', color: 'bg-rose-500', light: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'dia_asunto_personal', label: 'Asunto personal', color: 'bg-purple-500', light: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'fiesta', label: 'Fiesta / festivo', color: 'bg-yellow-500', light: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: 'vacaciones_convenio', label: 'Vacaciones convenio', color: 'bg-emerald-500', light: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

export const TIPOS_FALTA = [
  { key: 'permiso_retribuido', label: 'Permiso retribuido', color: 'bg-teal-500', light: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'baja_medica', label: 'Baja médica', color: 'bg-rose-500', light: 'bg-rose-100 text-rose-700 border-rose-200' },
  { key: 'ausencia_justificada', label: 'Ausencia justificada', color: 'bg-sky-500', light: 'bg-sky-100 text-sky-700 border-sky-200' },
  { key: 'ausencia_injustificada', label: 'Ausencia injustificada', color: 'bg-red-600', light: 'bg-red-100 text-red-700 border-red-200' },
  { key: 'permiso_sin_sueldo', label: 'Permiso sin sueldo', color: 'bg-amber-500', light: 'bg-amber-100 text-amber-700 border-amber-200' },
];

export const ESTADOS_FALTA = [
  { key: 'pendiente_revision', label: 'Pendiente de revisión' },
  { key: 'justificada', label: 'Justificada' },
  { key: 'injustificada', label: 'Injustificada' },
  { key: 'sancionada', label: 'Sancionada' },
];

const index = (list) => Object.fromEntries(list.map(t => [t.key, t]));

export const cfgVacacion = index(TIPOS_VACACION);
export const cfgFalta = index(TIPOS_FALTA);
export const cfgEstadoFalta = index(ESTADOS_FALTA);

/** Devuelve la configuración visual de un registro unificado. */
export function cfgRegistro(reg) {
  if (reg?.source === 'falta') {
    return cfgFalta[reg.tipo] || { label: reg.tipo || 'Falta', color: 'bg-slate-500', light: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
  return cfgVacacion[reg.tipo] || { label: reg.tipo || 'Ausencia', color: 'bg-slate-500', light: 'bg-slate-100 text-slate-700 border-slate-200' };
}

/** Duración en días naturales entre dos fechas ISO (inclusive). */
export function diasEntre(inicio, fin) {
  if (!inicio) return 1;
  if (!fin || fin < inicio) return 1;
  return Math.max(1, differenceInDaysSafe(inicio, fin));
}

function differenceInDaysSafe(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db - da) / 86400000) + 1;
}