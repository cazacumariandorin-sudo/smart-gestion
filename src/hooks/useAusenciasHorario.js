import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { parseISO, differenceInDays, format } from 'date-fns';

/**
 * Fuente única de ausencias del control horario.
 * Une las dos vías de registro que existen hoy en la app:
 *  - Vacacion (Calendario Vacaciones → "Registrar Ausencia"): vacaciones, baja médica,
 *    asunto personal, fiesta, vacaciones convenio.
 *  - FaltaAsistencia (Control Horario → Faltas, convenio del Metal): permisos,
 *    ausencia justificada, falta injustificada, permiso sin sueldo.
 */

export const TIPOS_AUSENCIA = {
  vacaciones: { label: 'Vacaciones', dot: 'bg-blue-500', soft: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900' },
  vacaciones_convenio: { label: 'Vac. convenio', dot: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
  baja_medica: { label: 'Baja médica', dot: 'bg-red-500', soft: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900' },
  dia_asunto_personal: { label: 'Asunto personal', dot: 'bg-purple-500', soft: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900' },
  fiesta: { label: 'Fiesta', dot: 'bg-yellow-500', soft: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900' },
  permiso_retribuido: { label: 'Permiso retribuido', dot: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900' },
  ausencia_justificada: { label: 'Ausencia justificada', dot: 'bg-teal-500', soft: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900' },
  ausencia_injustificada: { label: 'Falta injustificada', dot: 'bg-rose-600', soft: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900' },
  permiso_sin_sueldo: { label: 'Permiso sin sueldo', dot: 'bg-stone-500', soft: 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-900/40 dark:text-stone-300 dark:border-stone-800' },
};

export const metaAusencia = (tipo) =>
  TIPOS_AUSENCIA[tipo] || { label: tipo || 'Ausencia', dot: 'bg-muted-foreground', soft: 'bg-muted text-muted-foreground border-border' };

const dia = (f) => (f ? String(f).slice(0, 10) : '');

function normalizar(v) {
  return {
    id: `vac_${v.id}`,
    origen: 'vacacion',
    operario_id: v.operario_id || '',
    operario_name: v.operario_name || '',
    inicio: dia(v.fecha_inicio),
    fin: dia(v.fecha_fin || v.fecha_inicio),
    tipo: v.tipo || 'vacaciones',
    notas: v.notas || '',
    estado: v.aprobado ? 'aprobada' : 'pendiente',
  };
}

function normalizarFalta(f) {
  return {
    id: `fal_${f.id}`,
    origen: 'falta',
    operario_id: f.operario_id || '',
    operario_name: f.operario_name || '',
    inicio: dia(f.fecha_inicio),
    fin: dia(f.fecha_fin || f.fecha_inicio),
    tipo: f.tipo || 'ausencia_justificada',
    notas: f.observaciones || '',
    estado: f.estado || 'pendiente_revision',
  };
}

const solapan = (a, b) => a.inicio <= b.fin && b.inicio <= a.fin;

export function unificarAusencias(vacaciones = [], faltas = []) {
  const vacs = vacaciones.map(normalizar).filter((a) => a.inicio);
  const fts = faltas.map(normalizarFalta).filter((a) => a.inicio);
  // Una baja médica registrada en los dos módulos no debe contar dos veces:
  // manda la del módulo Faltas (convenio, con justificante y estado).
  const sinDuplicar = vacs.filter((v) => v.tipo !== 'baja_medica'
    || !fts.some((f) => f.tipo === 'baja_medica' && f.operario_id === v.operario_id && solapan(f, v)));
  return [...sinDuplicar, ...fts];
}

/** Normaliza una fecha a 'YYYY-MM-DD' (admite Date o cadena). */
const isoDia = (v) => {
  if (!v) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : format(v, 'yyyy-MM-dd');
  return String(v).slice(0, 10);
};

/** Días de la ausencia dentro del rango [start, end] (fechas 'YYYY-MM-DD'). */
export function diasEnRango(a, start, end) {
  if (!a.inicio) return 0;
  const ini = isoDia(a.inicio);
  const fin = isoDia(a.fin || a.inicio);
  const s = isoDia(start);
  const e = isoDia(end);
  if (!ini || !fin || !s || !e) return 0;
  if (fin < s || ini > e) return 0;
  const desde = ini > s ? ini : s;
  const hasta = fin < e ? fin : e;
  return Math.max(1, differenceInDays(parseISO(hasta), parseISO(desde)) + 1);
}

/** Ausencias que tocan el rango (por solape de fechas). */
export function ausenciasEnRango(ausencias = [], start, end, operarioId) {
  return ausencias.filter((a) => {
    if (!a.inicio) return false;
    if (operarioId && a.operario_id !== operarioId) return false;
    return diasEnRango(a, start, end) > 0;
  });
}

export function useAusenciasHorario() {
  const { data: vacaciones = [], isLoading: loadingVac } = useQuery({
    queryKey: ['vacaciones'],
    queryFn: () => base44.entities.Vacacion.list('-fecha_inicio', 500),
  });
  const { data: faltas = [], isLoading: loadingFaltas } = useQuery({
    queryKey: ['faltas-asistencia'],
    queryFn: () => base44.entities.FaltaAsistencia.list('-fecha_inicio', 500),
  });

  const ausencias = useMemo(() => unificarAusencias(vacaciones, faltas), [vacaciones, faltas]);

  return { ausencias, isLoading: loadingVac || loadingFaltas };
}