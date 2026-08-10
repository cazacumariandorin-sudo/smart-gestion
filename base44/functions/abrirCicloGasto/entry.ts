import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Abre el ciclo mensual 26→25 de notas de gasto.
// - Cron: día 26 a las 09:00 (Madrid) de cada mes.
// - Crea una NotaMensualGasto (estado=borrador, fecha_apertura=hoy) para cada operario activo
//   si aún no existe para el ciclo_mes correspondiente.
// - Idempotente: comprueba existencia antes de crear.
// - El ciclo_mes abierto corresponde al MES SIGUIENTE al actual (el ciclo de septiembre
//   se abre el 26 de agosto).
// - Cierra el ciclo anterior (mes actual) si quedó abierto en estado 'borrador'/'enviada'.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1; // 1-12

    // El ciclo que abre hoy corresponde al mes SIGUIENTE
    const fechaCiclo = new Date(anioActual, hoy.getMonth() + 1, 1);
    const anioCiclo = fechaCiclo.getFullYear();
    const mesCiclo = fechaCiclo.getMonth() + 1;
    const cicloMes = `${anioCiclo}-${String(mesCiclo).padStart(2, '0')}`;
    const fechaApertura = hoy.toISOString().slice(0, 10); // YYYY-MM-DD

    // Mes actual = ciclo anterior que hay que cerrar si sigue abierto
    const cicloMesAnterior = `${anioActual}-${String(mesActual).padStart(2, '0')}`;
    const finPeriodoAnterior = `${cicloMesAnterior}-25`;

    // 1. Cerrar notas del ciclo anterior still in 'borrador'/'enviada'
    try {
      const previas = await base44.asServiceRole.entities.NotaMensualGasto.filter({
        ciclo_mes: cicloMesAnterior,
        estado: { $in: ['borrador', 'enviada'] },
      });
      for (const n of (previas || [])) {
        try {
          await base44.asServiceRole.entities.NotaMensualGasto.update(n.id, {
            estado: 'enviada',
            fecha_cierre: finPeriodoAnterior,
          });
        } catch (_) { /* continuar */ }
      }
    } catch (_) { /* no bloquear apertura por fallo al cerrar previo */ }

    // 2. Listar operarios activos
    let operarios = [];
    try {
      operarios = await base44.asServiceRole.entities.Operario.filter({ active: true });
    } catch (_) {
      operarios = [];
    }
    operarios = operarios || [];

    if (operarios.length === 0) {
      return Response.json({
        success: true,
        message: 'Sin operarios activos',
        cicloMes,
        fechaApertura,
      });
    }

    // 3. Para cada operario, asegurar que existe la NotaMensualGasto del nuevo ciclo
    const creadas = [];
    const yaExistian = [];
    const errores = [];

    for (const op of operarios) {
      const operarioId = op.id || op._id;
      if (!operarioId) continue;

      try {
        const existentes = await base44.asServiceRole.entities.NotaMensualGasto.filter({
          ciclo_mes: cicloMes,
          operario_id: operarioId,
        });

        if (existentes && existentes.length > 0) {
          yaExistian.push(operarioId);
          continue;
        }

        const nombreCorto = (op.name || operarioId)
          .trim()
          .replace(/\s+/g, '')
          .slice(0, 12)
          .toUpperCase();
        const numeroCiclo = `CIC-${anioCiclo}-${String(mesCiclo).padStart(2, '0')}-${nombreCorto}`;

        const nota = await base44.asServiceRole.entities.NotaMensualGasto.create({
          ciclo_mes: cicloMes,
          numero_ciclo: numeroCiclo,
          operario_id: operarioId,
          operario_name: op.name || '',
          fecha_apertura: fechaApertura,
          registros_ids: [],
          total_registros: 0,
          total_importe: 0,
          importe_adelanto: 0,
          saldo_pendiente: 0,
          estado: 'borrador',
        });

        creadas.push({ operario_id: operarioId, nota_id: nota.id || nota._id });
      } catch (e) {
        errores.push({ operario_id: operarioId, error: (e.message || String(e)).slice(0, 200) });
      }
    }

    return Response.json({
      success: true,
      cicloMes,
      fechaApertura,
      notas_creadas: creadas.length,
      notas_ya_existentes: yaExistian.length,
      errores: errores.length,
      detalle_creadas: creadas,
      detalle_errores: errores,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});