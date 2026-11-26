/** Formatea una fecha ISO (YYYY-MM-DD o ISO completa) sin desfase de zona. */
export function fechaCorta(valor) {
  if (!valor) return '';
  const texto = String(valor);
  const soloFecha = texto.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(soloFecha)) {
    const [a, m, d] = soloFecha.split('-');
    return `${d}/${m}/${a}`;
  }
  return texto;
}

export function euros(valor) {
  if (valor == null || Number.isNaN(Number(valor))) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(valor));
}

export function horas(valor) {
  const n = Number(valor || 0);
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`;
}