/**
 * horarioEmpresa.ts — FUENTE ÚNICA del horario de empresa y del cálculo de horas.
 *
 * Decisión interna de la empresa:
 *   · Lunes a jueves: 08:00 - 18:00 con 1 hora de comida (14:00 - 15:00).
 *   · Viernes:        08:00 - 13:00, sin comida.
 *   · Desayunos y pausas cortas los asume la empresa: no descuentan jornada.
 *
 * Cualquier función o pantalla que necesite saber "qué jornada toca tal día" o
 * cuántas horas netas hay entre dos horas DEBE usar este módulo. No duplicar
 * horarios en otras funciones (el antiguo cierre automático tenía 8:01-18:04 y
 * aplicaba la comida también a los viernes).
 *
 * Los FESTIVOS no viven aquí: están en la entidad CalendarioLaboral, que se
 * actualiza cada 1 de enero con el calendario del BOCM.
 */

export interface HorarioDia {
  inicio: string;
  fin: string;
  pausa_inicio: string | null;
  pausa_fin: string | null;
}

const JORNADA_LARGA: HorarioDia = {
  inicio: '08:00',
  fin: '18:00',
  pausa_inicio: '14:00',
  pausa_fin: '15:00',
};

const JORNADA_VIERNES: HorarioDia = {
  inicio: '08:00',
  fin: '13:00',
  pausa_inicio: null,
  pausa_fin: null,
};

/** getDay(): 0 = domingo … 6 = sábado. null = día no laborable. */
export const HORARIO_EMPRESA: Record<number, HorarioDia | null> = {
  0: null,
  1: JORNADA_LARGA,
  2: JORNADA_LARGA,
  3: JORNADA_LARGA,
  4: JORNADA_LARGA,
  5: JORNADA_VIERNES,
  6: null,
};

/** "HH:MM" → minutos desde medianoche. */
export function minutosDe(hora: string | null | undefined): number {
  if (!hora) return 0;
  const [h, m] = String(hora).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** minutos desde medianoche → "HH:MM". */
export function aHHMM(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Fecha de hoy (YYYY-MM-DD) en hora de Madrid.
 * El cierre automático corre de noche: usar UTC adelantaba el día y cerraba
 * los fichajes de la fecha equivocada.
 */
export function fechaMadridISO(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Día de la semana (0 = domingo) de una fecha YYYY-MM-DD, sin desfase de zona. */
export function diaSemanaDe(fechaISO: string): number {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function esFinDeSemana(fechaISO: string): boolean {
  const dia = diaSemanaDe(fechaISO);
  return dia === 0 || dia === 6;
}

/** Jornada de empresa del día indicado, o null si no es laborable. */
export function horarioDelDia(fechaISO: string): HorarioDia | null {
  return HORARIO_EMPRESA[diaSemanaDe(fechaISO)] ?? null;
}

/**
 * Horas netas entre dos horas del día, descontando SOLO la pausa de comida que
 * realmente se solape con el tramo trabajado.
 */
export function calcularHorasNetas(
  entrada: string,
  salida: string,
  horario: Pick<HorarioDia, 'pausa_inicio' | 'pausa_fin'>,
): number {
  const inicioTrabajo = minutosDe(entrada);
  const finTrabajo = minutosDe(salida);
  const bruto = Math.max(0, finTrabajo - inicioTrabajo);

  let pausa = 0;
  if (horario?.pausa_inicio && horario?.pausa_fin) {
    const inicioPausa = minutosDe(horario.pausa_inicio);
    const finPausa = minutosDe(horario.pausa_fin);
    pausa = Math.max(0, Math.min(finPausa, finTrabajo) - Math.max(inicioPausa, inicioTrabajo));
  }

  return Math.round(((bruto - pausa) / 60) * 100) / 100;
}