/**
 * Cálculo del estado de pago de una nómina a partir de sus justificantes.
 * pagado  = suma de justificantes
 * falta   = líquido a percibir − pagado
 * estado  = pendiente | parcial | pagado | sin_importe
 */
export const ESTADOS_PAGO = {
  pagado: { label: 'Pagada', tono: 'verde' },
  parcial: { label: 'Pago parcial', tono: 'rojo' },
  pendiente: { label: 'Pendiente', tono: 'rojo' },
  sin_importe: { label: 'Sin importe', tono: 'neutro' },
};

export function estadoPago(liquido, pagado) {
  const liq = Number(liquido) || 0;
  const pag = Number(pagado) || 0;
  if (liq <= 0) return 'sin_importe';
  if (pag >= liq - 0.005) return 'pagado';
  return pag > 0.005 ? 'parcial' : 'pendiente';
}

export function resumenPago(nomina, justificantes = []) {
  const liquido = Number(nomina?.liquido_percibir) || 0;
  const pagado = justificantes.reduce((s, j) => s + (Number(j.importe) || 0), 0);
  const pagadoR = Math.round(pagado * 100) / 100;
  const falta = Math.max(0, Math.round((liquido - pagadoR) * 100) / 100);
  return { liquido, pagado: pagadoR, falta, estado: estadoPago(liquido, pagadoR) };
}

export function eur(v) {
  if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}