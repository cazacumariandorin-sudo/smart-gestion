import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Cierra el ciclo mensual de notas de gasto.
//
// CAMBIO DE CALENDARIO (a partir del ciclo de septiembre de 2026):
// - Ciclos ANTERIORES a 2026-09 se cerraban con periodo 26→25 (histórico, no se tocan;
//   sus NotaMensualGasto y RegistroGasto ya cerrados permanecen exactamente como están).
// - A partir de 2026-09, el ciclo es el mes de calendario completo. Este cron corre el
//   día 1 de cada mes (justo después de `abrirCicloGasto`) y cierra el MES QUE ACABA
//   DE TERMINAR (el anterior al actual), con fecha_cierre = último día real de ese mes
//   (28/29/30/31, calculado dinámicamente — nunca un "-25" fijo).
// - Idempotente: si la NotaMensualGasto del ciclo ya existe (creada por `abrirCicloGasto`
//   o heredada de la transición), se actualiza; si no, se crea.

function ultimoDiaDelMes(anio, mes) {
  // new Date(anio, mes, 0) da el último día del mes `mes` (1-12) en JS
  return new Date(anio, mes, 0).getDate();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const hoy = new Date();
    // Mes que se cierra = mes anterior al actual (este cron corre el día 1)
    const fechaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const anioCiclo = fechaMesAnterior.getFullYear();
    const mesCiclo = fechaMesAnterior.getMonth() + 1;
    const cicloMes = `${anioCiclo}-${String(mesCiclo).padStart(2, '0')}`;
    const ultimoDia = ultimoDiaDelMes(anioCiclo, mesCiclo);
    const finPeriodo = `${cicloMes}-${String(ultimoDia).padStart(2, '0')}`;

    const registros = await base44.asServiceRole.entities.RegistroGasto.filter({
      estado: { $in: ['borrador', 'pendiente'] },
    });

    // Solo los registros reembolsables (medios_propios) forman ciclo de liquidación personal.
    // medio_empresa y credito_proveedor NO se liquidan al técnico: la empresa ya los pagó /
    // son a crédito del proveedor. Quedan visibles en informes de contabilidad, pero fuera
    // del NotaMensualGasto de reembolso.
    const delMes = (registros || []).filter(r =>
      (r.fecha_creacion_real || r.created_date || '').startsWith(cicloMes)
      && r.origen_pago !== 'medio_empresa'
      && r.origen_pago !== 'credito_proveedor'
    );

    if (delMes.length === 0) {
      return Response.json({ success: true, message: 'Sin registros que cerrar', cicloMes, finPeriodo });
    }

    const porOperario = {};
    for (const r of delMes) {
      if (!r.operario_id) continue;
      if (!porOperario[r.operario_id]) porOperario[r.operario_id] = [];
      porOperario[r.operario_id].push(r);
    }

    const creadas = [];
    for (const [operarioId, regs] of Object.entries(porOperario)) {
      try {
        const totalImporte = regs.reduce((s, r) => s + (r.importe || 0), 0);
        const primer = regs[0];

        const existentes = await base44.asServiceRole.entities.NotaMensualGasto.filter({ ciclo_mes: cicloMes, operario_id: operarioId });

        if (existentes && existentes.length > 0) {
          await base44.asServiceRole.entities.NotaMensualGasto.update(existentes[0].id, {
            total_registros: regs.length,
            total_importe: Math.round(totalImporte * 100) / 100,
            saldo_pendiente: Math.round(totalImporte * 100) / 100,
            registros_ids: regs.map(r => r.id),
            estado: 'enviada',
            fecha_cierre: finPeriodo,
          });
        } else {
          await base44.asServiceRole.entities.NotaMensualGasto.create({
            ciclo_mes: cicloMes,
            operario_id: operarioId,
            operario_name: primer.operario_name || '',
            total_registros: regs.length,
            total_importe: Math.round(totalImporte * 100) / 100,
            saldo_pendiente: Math.round(totalImporte * 100) / 100,
            importe_adelanto: 0,
            registros_ids: regs.map(r => r.id),
            estado: 'enviada',
            fecha_cierre: finPeriodo,
          });
        }

        for (const r of regs) {
          await base44.asServiceRole.entities.RegistroGasto.update(r.id, { estado: 'pendiente' });
        }

        creadas.push({ operario_id: operarioId, total: totalImporte, registros: regs.length });
      } catch (e) { /* continuar con siguiente */ }
    }

    return Response.json({ success: true, cicloMes, finPeriodo, esquema: 'calendario_1_31', notas_creadas: creadas.length, detalle: creadas });

  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});