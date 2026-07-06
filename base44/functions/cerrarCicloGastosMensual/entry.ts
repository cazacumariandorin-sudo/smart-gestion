import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const hoy = new Date();
    const cicloMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const finPeriodo = `${cicloMes}-25`;

    const registros = await base44.asServiceRole.entities.RegistroGasto.filter({
      estado: { $in: ['borrador', 'pendiente'] },
    });

    const delMes = (registros || []).filter(r => (r.fecha_creacion_real || r.created_date || '').startsWith(cicloMes));

    if (delMes.length === 0) {
      return Response.json({ success: true, message: 'Sin registros que cerrar', cicloMes });
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

    return Response.json({ success: true, cicloMes, notas_creadas: creadas.length, detalle: creadas });

  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});