import { base44 } from '@/api/base44Client';

/** Número visible del parte: el nuevo (numero_parte) o, en partes antiguos, el order_number heredado. */
export const numeroParteVisible = (order) => order?.numero_parte || order?.order_number || '';

const conTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** Pide al servidor el número único del parte (idempotente). Devuelve el número o lanza error. */
export async function asignarNumeroParte(workOrderId, { timeoutMs = 20000 } = {}) {
  const res = await conTimeout(
    base44.functions.invoke('asignarNumeroParte', { work_order_id: workOrderId }),
    timeoutMs
  );
  const numero = res?.data?.numero_parte;
  if (!numero) throw new Error(res?.data?.error || 'El servidor no devolvió número');
  return numero;
}

/** Código único de cliente (C001…). Devuelve el código o null si falla. */
export async function asignarCodigoCliente(clientId) {
  try {
    const res = await base44.functions.invoke('asignarNumeroParte', { client_id: clientId });
    return res?.data?.codigo_cliente || null;
  } catch (e) {
    console.error('[Cliente] No se pudo asignar código', e);
    return null;
  }
}

/** Asigna códigos y números pendientes por lotes (admin/gerencia/administración). */
export async function asignarNumerosPendientes(onProgress) {
  const total = { clientes: 0, partes: 0, pendientes: 0 };
  for (let i = 0; i < 60; i++) {
    const res = await base44.functions.invoke('asignarNumeroParte', { modo: 'backfill', limite: 60 });
    const d = res?.data || {};
    if (d.error) throw new Error(d.error);
    const hechos = (d.asignados_clientes || 0) + (d.asignados_partes || 0);
    total.clientes += d.asignados_clientes || 0;
    total.partes += d.asignados_partes || 0;
    total.pendientes = d.pendientes || 0;
    onProgress?.({ ...total });
    if (!total.pendientes || hechos === 0) break; // sin trabajo o sin avance: evita bucles
  }
  return total;
}
