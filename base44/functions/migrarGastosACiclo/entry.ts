import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Migra el histórico de RegistroGasto al nuevo modelo de ciclos (NotaMensualGasto):
//
// Para cada RegistroGasto sin nota_mensual_id:
//   1. Calcula ciclo_mes según fecha_documento (o fecha_creacion_real/created_date como fallback):
//        - Día >= 26 → ciclo del mes siguiente.
//        - Día  < 26 → ciclo del mismo mes.
//   2. Encuentra o crea la NotaMensualGasto correspondiente (ciclo_mes + operario_id).
//   3. Rellena nota_mensual_id, ciclo_mes, operario_email (si falta, de created_by) y
//      orden_en_ciclo (1..N por orden de fecha_documento dentro del ciclo).
//   4. Recalcula registros_ids, total_registros, total_importe y saldo_pendiente en
//      cada NotaMensualGasto afectada.
//
// No borra ni duplica datos: NotaGasto / GastoOperario (entidades legacy) se conservan
// intactas para histórico; el flujo operativo pasa a usar RegistroGasto + NotaMensualGasto.
//
// Admin only. Por defecto dry_run=true (solo simulación); dry_run=false aplica cambios.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: solo administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { dry_run = true } = body;

    // Cargar todos los RegistroGasto; asServiceRole para cumplir requisitos de admin, ya que
    // la lectura puede incluir registros que el admin actual no "creó".
    const all = await base44.asServiceRole.entities.RegistroGasto.list('-created_date', 9999);

    // Operarios activos (para resolver nombre al crear NotaMensualGasto)
    let operariosMap = {};
    try {
      const ops = await base44.asServiceRole.entities.Operario.list('-created_date', 9999);
      for (const op of (ops || [])) {
        operariosMap[op.id || op._id] = op;
      }
    } catch (_) { /* no bloquear la migración si falla la carga de operarios */ }

    const sinVincular = (all || []).filter(r => !r.nota_mensual_id);
    if (sinVincular.length === 0) {
      return Response.json({
        success: true,
        dry_run,
        message: 'No hay registros pendientes de vincular (todos ya tienen nota_mensual_id)',
        total_registros: all.length,
      });
    }

    // Agrupar por (operario_id, ciclo_mes)
    const grupos = {};
    for (const r of sinVincular) {
      const ciclo = calcularCicloMes(r.fecha_documento || r.fecha_creacion_real || (r.created_date || '').split('T')[0]);
      if (!r.operario_id) continue;
      const key = `${r.operario_id}::${ciclo}`;
      if (!grupos[key]) grupos[key] = { operario_id: r.operario_id, ciclo_mes: ciclo, registros: [] };
      grupos[key].registros.push(r);
    }

    // Plan de migración
    const plan = [];
    const errores = [];
    for (const [key, g] of Object.entries(grupos)) {
      g.registros.sort((a, b) => (a.fecha_documento || '').localeCompare(b.fecha_documento || ''));
      // Email del operario: usar el del registro si existe, si no created_by
      const operarioEmailFallback = g.registros[0].operario_email || g.registros[0].created_by || '';
      g.registros.forEach((r, idx) => {
        plan.push({
          registro_id: r.id,
          operario_id: g.operario_id,
          ciclo_mes: g.ciclo_mes,
          nota_mensual_id: null, // se rellenará tras encontrar/crear
          operario_email: r.operario_email || operarioEmailFallback,
          orden_en_ciclo: idx + 1,
          fecha: r.fecha_documento || r.fecha_creacion_real || '',
        });
      });
      g._operario_email = operarioEmailFallback;
      g._operario_name = operariosMap[g.operario_id]?.name || g.registros[0].operario_name || g.operario_id;
    }

    if (dry_run) {
      return Response.json({
        success: true,
        dry_run: true,
        total_registros_totales: all.length,
        total_sin_vincular: sinVincular.length,
        grupos: Object.keys(grupos).length,
        plan: plan.slice(0, 200),
        plan_total: plan.length,
        mensaje: 'Simulación. Envía { "dry_run": false } para aplicar.',
      });
    }

    // Aplicar: por cada grupo, encontrar/crear NotaMensualGasto y vincular registros
    const notasCreadas = [];
    const notasActualizadas = [];
    const registrosVinculados = [];

    for (const [key, g] of Object.entries(grupos)) {
      try {
        let existentes = await base44.asServiceRole.entities.NotaMensualGasto.filter({
          ciclo_mes: g.ciclo_mes,
          operario_id: g.operario_id,
        });

        let notaId;
        const hoy = new Date().toISOString().slice(0, 10);

        if (existentes && existentes.length > 0) {
          notaId = existentes[0].id || existentes[0]._id;
          notasActualizadas.push(notaId);
        } else {
          const [y, m] = g.ciclo_mes.split('-');
          const nombreCorto = (g._operario_name || g.operario_id).trim().replace(/\s+/g, '').slice(0, 12).toUpperCase();
          const nuevaNota = await base44.asServiceRole.entities.NotaMensualGasto.create({
            ciclo_mes: g.ciclo_mes,
            numero_ciclo: `CIC-${y}-${m}-${nombreCorto}`,
            operario_id: g.operario_id,
            operario_name: g._operario_name,
            fecha_apertura: hoy,
            fecha_cierre: `${g.ciclo_mes}-25`,
            registros_ids: [],
            total_registros: 0,
            total_importe: 0,
            importe_adelanto: 0,
            saldo_pendiente: 0,
            estado: 'borrador',
          });
          notaId = nuevaNota.id || nuevaNota._id;
          notasCreadas.push(notaId);
        }

        // Vincular cada registro del grupo
        const bulkUpdates = g.registros.map((r, idx) => ({
          id: r.id,
          nota_mensual_id: notaId,
          ciclo_mes: g.ciclo_mes,
          operario_email: r.operario_email || g._operario_email,
          orden_en_ciclo: idx + 1,
        }));

        // bulkUpdate espera array de {id, ...campos}
        await base44.asServiceRole.entities.RegistroGasto.bulkUpdate(bulkUpdates);
        for (const b of bulkUpdates) registrosVinculados.push(b.id);

        // Recalcular totales de la NotaMensualGasto
        const vinculados = await base44.asServiceRole.entities.RegistroGasto.filter({ nota_mensual_id: notaId });
        const totalImporte = (vinculados || []).reduce((s, r) => s + (r.importe || 0), 0);
        const totalRegistros = (vinculados || []).length;
        // Obtener importe_adelanto actual (si nota existía previamente) y recalcular saldo
        const notaFinal = await base44.asServiceRole.entities.NotaMensualGasto.get(notaId);
        const adelanto = notaFinal?.importe_adelanto || 0;
        await base44.asServiceRole.entities.NotaMensualGasto.update(notaId, {
          registros_ids: (vinculados || []).map(r => r.id),
          total_registros: totalRegistros,
          total_importe: Math.round(totalImporte * 100) / 100,
          saldo_pendiente: Math.round((totalImporte - adelanto) * 100) / 100,
        });
      } catch (e) {
        errores.push({ grupo: key, error: (e.message || String(e)).slice(0, 200) });
      }
    }

    return Response.json({
      success: true,
      dry_run: false,
      total_sin_vincular: sinVincular.length,
      notas_creadas: notasCreadas.length,
      notas_actualizadas: notasActualizadas.length,
      registros_vinculados: registrosVinculados.length,
      grupos_total: Object.keys(grupos).length,
      errores: errores.length,
      detalle_notas_creadas: notasCreadas,
      detalle_errores: errores,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});

function calcularCicloMes(fechaISO) {
  if (!fechaISO) {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
  }
  const f = new Date(fechaISO);
  if (isNaN(f.getTime())) {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
  }
  let y = f.getFullYear();
  let m = f.getMonth() + 1;
  const d = f.getDate();
  if (d >= 26) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}