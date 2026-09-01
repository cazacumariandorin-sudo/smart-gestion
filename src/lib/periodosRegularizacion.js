/**
 * Helpers de agregación por periodo (trimestre / semestre / anual) para la
 * regularización de gastos. Todo el cálculo se hace en el cliente a partir
 * del campo `ciclo_mes` (clave YYYY-MM) de los registros de gasto.
 */

export const PERIODOS = [
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'semestre', label: 'Semestre' },
  { key: 'anual', label: 'Anual' },
];

export function mesDeCiclo(cicloMes) {
  if (!cicloMes) return null;
  const parts = String(cicloMes).split('-');
  return parts.length === 2 ? parseInt(parts[1], 10) : null;
}

export function anioDeCiclo(cicloMes) {
  if (!cicloMes) return null;
  return parseInt(String(cicloMes).split('-')[0], 10);
}

export function subPeriodosDe(periodo) {
  if (periodo === 'trimestre') {
    return [
      { key: 1, label: 'Q1 (Ene–Mar)' },
      { key: 2, label: 'Q2 (Abr–Jun)' },
      { key: 3, label: 'Q3 (Jul–Sep)' },
      { key: 4, label: 'Q4 (Oct–Dic)' },
    ];
  }
  if (periodo === 'semestre') {
    return [
      { key: 1, label: 'H1 (Ene–Jun)' },
      { key: 2, label: 'H2 (Jul–Dic)' },
    ];
  }
  return [{ key: 1, label: 'Anual' }];
}

export function enPeriodo(cicloMes, anio, periodo, subPeriodo) {
  const a = anioDeCiclo(cicloMes);
  const m = mesDeCiclo(cicloMes);
  if (a == null || m == null) return false;
  if (a !== anio) return false;
  if (periodo === 'anual') return true;
  if (periodo === 'trimestre') {
    const trims = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };
    return (trims[subPeriodo] || []).includes(m);
  }
  if (periodo === 'semestre') {
    const sems = { 1: [1, 2, 3, 4, 5, 6], 2: [7, 8, 9, 10, 11, 12] };
    return (sems[subPeriodo] || []).includes(m);
  }
  return false;
}

export function etiquetaPeriodo(periodo, subPeriodo, anio) {
  const subs = subPeriodosDe(periodo);
  const sub = subs.find(s => s.key === subPeriodo);
  if (periodo === 'anual') return `Anual ${anio}`;
  return `${sub?.label || ''} ${anio}`;
}