// Calculates net worked hours considering lunch break
export function calcularHoras(entrada, salida, pausaInicio, pausaFin) {
  if (!entrada || !salida) return 0;
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let total = toMin(salida) - toMin(entrada);
  if (pausaInicio && pausaFin) {
    const pausa = toMin(pausaFin) - toMin(pausaInicio);
    total -= Math.max(0, pausa);
  }
  return Math.max(0, parseFloat((total / 60).toFixed(2)));
}

// Groups fichajes by ISO week
export function groupByWeek(fichajes) {
  const map = {};
  fichajes.forEach(f => {
    const d = new Date(f.date);
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const diff = d - jan4;
    const week = Math.ceil((diff / 86400000 + jan4.getDay() + 1) / 7);
    const key = `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    if (!map[key]) map[key] = [];
    map[key].push(f);
  });
  return map;
}

// Groups fichajes by YYYY-MM month
export function groupByMonth(fichajes) {
  const map = {};
  fichajes.forEach(f => {
    const key = f.date.slice(0, 7);
    if (!map[key]) map[key] = [];
    map[key].push(f);
  });
  return map;
}

export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];