import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Abre el ciclo mensual de notas de gasto.
//
// CAMBIO DE CALENDARIO (a partir del ciclo de septiembre de 2026):
// - Ciclos ANTERIORES a 2026-09 usaban el periodo 26→25 (histórico, no se tocan).
// - A partir de 2026-09, el ciclo pasa a ser el mes de calendario completo: día 1 al
//   último día de cada mes (28/29/30/31 según corresponda).
// - Cron: día 1 de cada mes a las 00:05 (Madrid). Abre el ciclo del MES ACTUAL (ya no
//   del mes siguiente) para cada operario activo, si aún no existe.
// - Idempotente: comprueba existencia antes de crear — si el ciclo ya existe (p. ej. los
//   ciclos de 2026-09 creados durante la transición bajo el esquema antiguo, vacíos),
//   NO se duplica ni se sobrescribe: simplemente se reutiliza tal cual.
// - El cierre del ciclo anterior ya NO se hace aquí: es responsabilidad exclusiva de
//   `cerrarCicloGastosMensual`, que ahora corre también el día 1 (justo después de abrir),
//   para separar claramente "abrir el nuevo" de "cerrar el que acaba de terminar".

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1; // 1-12

    // El ciclo que se abre es el del MES ACTUAL (calendario natural, día 1 a último día)
    const cicloMes = `${anioActual}-${String(mesActual).padStart(2, '0')}`;
    const fechaApertura = `${cicloMes}-01`;

    // 1. Listar operarios activos
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

    // 2. Para cada operario, asegurar que existe la NotaMensualGasto del ciclo del mes actual
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
          // Ya existe (puede venir de la transición de calendario, creado vacío bajo el
          // esquema antiguo) — se reutiliza sin tocar nada.
          yaExistian.push(operarioId);
          continue;
        }

        const nombreCorto = (op.name || operarioId)
          .trim()
          .replace(/\s+/g, '')
          .slice(0, 12)
          .toUpperCase();
        const numeroCiclo = `CIC-${anioActual}-${String(mesActual).padStart(2, '0')}-${nombreCorto}`;

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
      esquema: 'calendario_1_31',
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
