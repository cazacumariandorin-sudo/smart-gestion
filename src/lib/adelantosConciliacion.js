/**
 * Conciliación de adelantos al cierre de ciclo de Notas de Gastos.
 *
 * Lógica determinista (sin IA) que cruza los Adelanto de tipo 'gastos' y 'dieta'
 * de un ciclo con los RegistroGasto justificados del mismo ciclo, y produce los
 * totales a escribir en NotaMensualGasto al cerrar.
 *
 * Política de degradación por plan (Sección I de la propuesta):
 * - Esta lógica vive en cliente y no requiere backend functions.
 * - Es tolerante a ciclos históricos (es_historico_adelanto): si un ciclo tiene
 *   importe_adelanto > 0 pero ningún Adelanto asociado, NO se sobrescribe el
 *   valor histórico; se marca es_historico_adelanto para revisión manual de gerencia.
 */
import { base44 } from '@/api/base44Client';

export const ADELANTO_ESTADOS_ACTIVOS = ['entregado', 'justificado', 'parcialmente_justificado'];
export const GASTO_ESTADOS_APROBADOS = ['aprobado_gerencia', 'en_administracion', 'pagada'];

/**
 * Calcula la conciliación de un ciclo sin persistir nada.
 * @param {object} nota - NotaMensualGasto (con id, ciclo_mes, operario_id)
 * @returns {Promise<object>} totales + adelantos + flags
 */
export async function conciliarCicloAdelantos(nota) {
  if (!nota) return null;

  // 1. Gastos del ciclo
  let regs = [];
  if (nota.id) {
    try {
      regs = await base44.entities.RegistroGasto.filter({ nota_mensual_id: nota.id });
    } catch {}
  }
  if (!regs?.length && nota.ciclo_mes && nota.operario_id) {
    try {
      regs = await base44.entities.RegistroGasto.filter({
        ciclo_mes: nota.ciclo_mes,
        operario_id: nota.operario_id,
      });
    } catch {}
  }
  const regsAprobados = (regs || []).filter(r => GASTO_ESTADOS_APROBADOS.includes(r.estado));
  const total_gastos = regsAprobados.reduce((s, r) => s + (r.importe || 0), 0);

  // 2. Adelantos del ciclo
  let adelantos = [];
  try {
    adelantos = await base44.entities.Adelanto.filter({
      ciclo_mes: nota.ciclo_mes,
      operario_id: nota.operario_id,
    });
  } catch {}

  const adGastos = adelantos.filter(a => a.tipo === 'gastos' && ADELANTO_ESTADOS_ACTIVOS.includes(a.estado));
  const adDieta = adelantos.filter(a => a.tipo === 'dieta' && ADELANTO_ESTADOS_ACTIVOS.includes(a.estado));
  const total_adelantos_gastos = adGastos.reduce((s, a) => s + (a.importe || 0), 0);
  const total_adelantos_dieta = adDieta.reduce((s, a) => s + (a.importe || 0), 0);

  // 3. Histórico: importe_adelanto > 0 pero ningún Adelanto de gastos asociado
  const es_historico_adelanto = (nota.importe_adelanto || 0) > 0 && adGastos.length === 0 && !(nota.es_historico_adelanto === false);

  // 4. Importe efectivo: si es histórico, respeta el valor manual; si no, usa el calculado
  const importe_adelanto_efectivo = es_historico_adelanto
    ? (nota.importe_adelanto || 0)
    : total_adelantos_gastos;

  const importe_neto_liquidar = total_gastos - importe_adelanto_efectivo;

  return {
    total_gastos: Number(total_gastos.toFixed(2)),
    total_adelantos_gastos: Number(total_adelantos_gastos.toFixed(2)),
    total_adelantos_dieta: Number(total_adelantos_dieta.toFixed(2)),
    importe_adelanto: Number(importe_adelanto_efectivo.toFixed(2)),
    importe_neto_liquidar: Number(importe_neto_liquidar.toFixed(2)),
    saldo_pendiente: Number(importe_neto_liquidar.toFixed(2)),
    es_historico_adelanto: !!es_historico_adelanto,
    adelantos_gastos: adGastos,
    adelantos_dieta: adDieta,
    registros_count: regsAprobados.length,
  };
}

/**
 * Aplica la conciliación al cierre: actualiza estados de los adelantos y
 * escribe los totales en NotaMensualGasto.
 *
 * @param {object} nota - NotaMensualGasto a cerrar
 * @param {object} user - usuario actual (para pagado_por)
 * @param {object} [opts] - { estado: 'pagada' | 'en_contabilidad' }
 * @returns {Promise<object>} resultado de la conciliación
 */
export async function aplicarConciliacionCierre(nota, user, opts = {}) {
  const c = await conciliarCicloAdelantos(nota);

  // Marcar adelantos justificado / pendiente_devolucion (solo si no es histórico)
  if (!c.es_historico_adelanto && c.adelantos_gastos.length > 0) {
    for (const a of c.adelantos_gastos) {
      const nuevoEstado = c.total_gastos >= (a.importe || 0) ? 'justificado' : 'pendiente_devolucion';
      const saldo = Math.max(0, (a.importe || 0) - c.total_gastos);
      try {
        await base44.entities.Adelanto.update(a.id, {
          estado: nuevoEstado,
          saldo_adelanto: Number(saldo.toFixed(2)),
        });
      } catch {}
    }
  }

  await base44.entities.NotaMensualGasto.update(nota.id, {
    estado: opts.estado || 'pagada',
    fecha_cierre: new Date().toISOString().slice(0, 10),
    pagado_por: user?.email,
    fecha_pago: new Date().toISOString(),
    total_importe: c.total_gastos,
    total_registros: c.registros_count,
    total_adelantos_gastos: c.total_adelantos_gastos,
    total_adelantos_dieta: c.total_adelantos_dieta,
    importe_adelanto: c.importe_adelanto,
    importe_neto_liquidar: c.importe_neto_liquidar,
    saldo_pendiente: c.saldo_pendiente,
    es_historico_adelanto: c.es_historico_adelanto,
  });

  return c;
}

/** Calcula el ciclo_mes (YYYY-MM) a partir de una fecha.
 * A partir de 2026-09: ciclo = mes natural (1→último día).
 * Pre-2026-09: histórico 26→25 (día >= 26 → mes siguiente). */
export function calcularCicloMes(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return null;
  const ref = new Date(d);
  const iso = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
  if (iso < '2026-09-01') {
    if (ref.getDate() >= 26) ref.setMonth(ref.getMonth() + 1);
  }
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
}