import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Cierra el ciclo mensual de notas de gasto.
//
// Calendario natural (a partir del ciclo de septiembre de 2026): el ciclo es el mes
// de calendario completo. El cron corre el día 1 de cada mes y cierra el mes que
// acaba de terminar. fecha_cierre = último día real de ese mes (28/29/30/31).
//
// DOS MODOS DE CIERRE (body.tipo_cierre):
//   - 'definitivo' (por defecto): consolida TODOS los gastos reembolsables del ciclo
//     (cualquier estado salvo rechazada/registrado) en la NotaMensualGasto. Es
//     ADITIVO: como el filtro incluye aprobado_gerencia/en_administracion/pagada, los
//     gastos ya avanzados en un cierre parcial anterior NO se pierden del total.
//     Re-ejecutar no sobrescribe: el total refleja siempre el mes completo.
//   - 'parcial': crea un AdelantoParcialCiclo (corte a mitad de mes para adelantar
//     liquidez) con los gastos reclamables (borrador/pendiente) con fecha_documento
//     ≤ fecha_corte. Registros DISJUNTOS: el backend excluye los ya incluidos en otro
//     AdelantoParcialCiclo del mismo ciclo/operario. Requiere operario_id, fecha_corte
//     y motivo. Los AdelantoParcialCiclo pagados se descuentan del neto a liquidar.
//
// ACOTADO POR OPERARIO: body.operario_id opcional. Si viene, sólo ese operario; si no,
// todos (comportamiento del cron).
//
// Idempotente.

const ESTADOS_REEMBOLSABLES = ['borrador', 'pendiente', 'aprobado_gerencia', 'en_administracion', 'pagada'];
const ESTADOS_RECLAMABLES = ['borrador', 'pendiente'];

function ultimoDiaDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function round2(n) { return Math.round(n * 100) / 100; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // --- Control de acceso ---
    try {
      const user = await base44.auth.me();
      if (user && user.role) {
        const permitidos = ['admin', 'propietario', 'gerencia', 'administracion', 'director_comercial'];
        if (!permitidos.includes(user.role)) {
          return Response.json({ error: 'Unauthorized: solo gestión económica' }, { status: 403 });
        }
      }
    } catch (_) {
      // invocación sin usuario (cron) → permitido
    }

    const body = await req.json().catch(() => ({}));
    const tipoCierre = body?.tipo_cierre === 'parcial' ? 'parcial' : 'definitivo';
    const operarioId = body?.operario_id || null;
    const fechaCorte = body?.fecha_corte || null;
    const motivo = (body?.motivo || '').toString().trim();

    // Validaciones del cierre parcial
    if (tipoCierre === 'parcial') {
      if (!operarioId) {
        return Response.json({ success: false, error: 'El cierre parcial requiere operario_id' }, { status: 400 });
      }
      if (!fechaCorte || !/^\d{4}-\d{2}-\d{2}$/.test(fechaCorte)) {
        return Response.json({ success: false, error: 'El cierre parcial requiere fecha_corte (YYYY-MM-DD)' }, { status: 400 });
      }
      if (!motivo) {
        return Response.json({ success: false, error: 'El cierre parcial requiere motivo' }, { status: 400 });
      }
    }

    // ciclo_mes: explícito o, por defecto, el mes anterior al actual (cron).
    let cicloMes = body?.ciclo_mes;
    if (!cicloMes || !/^\d{4}-\d{2}$/.test(cicloMes)) {
      const hoy = new Date();
      const fechaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      cicloMes = `${fechaMesAnterior.getFullYear()}-${String(fechaMesAnterior.getMonth() + 1).padStart(2, '0')}`;
    }
    const [anioCicloStr, mesCicloStr] = cicloMes.split('-');
    const anioCiclo = parseInt(anioCicloStr, 10);
    const mesCiclo = parseInt(mesCicloStr, 10);
    const ultimoDia = ultimoDiaDelMes(anioCiclo, mesCiclo);
    const finPeriodo = `${cicloMes}-${String(ultimoDia).padStart(2, '0')}`;

    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const esMesEnCurso = cicloMes === mesActual;

    const enCiclo = (r) =>
      (r.ciclo_mes && r.ciclo_mes === cicloMes) ||
      (!r.ciclo_mes && (r.fecha_creacion_real || r.created_date || '').startsWith(cicloMes));

    // ====================== CIERRE PARCIAL ======================
    if (tipoCierre === 'parcial') {
      const candidatos = await base44.asServiceRole.entities.RegistroGasto.filter({
        operario_id: operarioId,
        estado: { $in: ESTADOS_RECLAMABLES },
      });

      const reclamables = (candidatos || []).filter(r => {
        if (r.origen_pago === 'medio_empresa' || r.origen_pago === 'credito_proveedor') return false;
        if (!enCiclo(r)) return false;
        const fdoc = r.fecha_documento || r.fecha_creacion_real;
        return !!fdoc && fdoc <= fechaCorte;
      });

      if (reclamables.length === 0) {
        return Response.json({
          success: true, message: 'Sin registros reclamables hasta la fecha de corte',
          cicloMes, tipoCierre, fechaCorte, esMesEnCurso,
        });
      }

      // Disjunción: excluir los ya incluidos en otro AdelantoParcialCiclo del mismo ciclo/operario
      const parcialesPrevios = await base44.asServiceRole.entities.AdelantoParcialCiclo.filter({
        ciclo_mes: cicloMes, operario_id: operarioId,
      });
      const yaIncluidos = new Set();
      for (const p of (parcialesPrevios || [])) {
        for (const rid of (p.registros_ids || [])) yaIncluidos.add(rid);
      }
      const nuevos = reclamables.filter(r => !yaIncluidos.has(r.id));

      if (nuevos.length === 0) {
        return Response.json({
          success: true, message: 'Todos los registros hasta la fecha de corte ya están en un cierre parcial anterior',
          cicloMes, tipoCierre, fechaCorte, esMesEnCurso,
        });
      }

      const importe = round2(nuevos.reduce((s, r) => s + (r.importe || 0), 0));
      const primer = nuevos[0];

      // Asegurar la NotaMensualGasto (puede no existir si el ciclo aún no se abrió)
      let nota = (await base44.asServiceRole.entities.NotaMensualGasto.filter({
        ciclo_mes: cicloMes, operario_id: operarioId,
      }))[0];
      if (!nota) {
        nota = await base44.asServiceRole.entities.NotaMensualGasto.create({
          ciclo_mes: cicloMes,
          operario_id: operarioId,
          operario_name: primer.operario_name || '',
          total_registros: 0,
          total_importe: 0,
          importe_adelanto: 0,
          total_adelantos_gastos: 0,
          total_adelantos_dieta: 0,
          importe_neto_liquidar: 0,
          saldo_pendiente: 0,
          registros_ids: [],
          estado: 'borrador',
          fecha_apertura: new Date().toISOString().slice(0, 10),
        });
      }

      const parcial = await base44.asServiceRole.entities.AdelantoParcialCiclo.create({
        nota_mensual_id: nota.id,
        ciclo_mes: cicloMes,
        numero_ciclo: nota.numero_ciclo || '',
        operario_id: operarioId,
        operario_name: primer.operario_name || '',
        operario_email: primer.operario_email || '',
        registros_ids: nuevos.map(r => r.id),
        total_registros: nuevos.length,
        importe,
        fecha_creacion_real: new Date().toISOString().slice(0, 10),
        fecha_corte: fechaCorte,
        estado: 'borrador',
        motivo,
      });

      // Reclamar los registros: pasan a pendiente
      for (const r of nuevos) {
        await base44.asServiceRole.entities.RegistroGasto.update(r.id, { estado: 'pendiente' });
      }

      return Response.json({
        success: true,
        cicloMes,
        tipoCierre,
        esMesEnCurso,
        fechaCorte,
        adelanto_parcial_id: parcial.id,
        registros: nuevos.length,
        importe,
        message: `Cierre parcial creado: ${nuevos.length} registro(s), ${importe} €`,
      });
    }

    // ====================== CIERRE DEFINITIVO ======================
    // ADITIVO: TODOS los gastos reembolsables del ciclo (cualquier estado salvo
    // rechazada/registrado), acotado a operario_id si viene.
    const queryFiltro = operarioId
      ? { operario_id: operarioId, estado: { $in: ESTADOS_REEMBOLSABLES } }
      : { estado: { $in: ESTADOS_REEMBOLSABLES } };
    const todos = await base44.asServiceRole.entities.RegistroGasto.filter(queryFiltro);

    const delMes = (todos || []).filter(r => {
      if (r.origen_pago === 'medio_empresa' || r.origen_pago === 'credito_proveedor') return false;
      return enCiclo(r);
    });

    if (delMes.length === 0) {
      return Response.json({
        success: true, message: 'Sin registros que cerrar',
        cicloMes, finPeriodo, tipoCierre: 'definitivo', esMesEnCurso,
      });
    }

    const porOperario = {};
    for (const r of delMes) {
      if (!r.operario_id) continue;
      (porOperario[r.operario_id] ||= []).push(r);
    }

    const creadas = [];
    for (const [opId, regs] of Object.entries(porOperario)) {
      try {
        const totalImporte = round2(regs.reduce((s, r) => s + (r.importe || 0), 0));
        const primer = regs[0];

        // Adelantos parciales ya PAGADOS del ciclo → se descuentan del neto a liquidar
        const parciales = await base44.asServiceRole.entities.AdelantoParcialCiclo.filter({
          ciclo_mes: cicloMes, operario_id: opId,
        });
        const totalAdelantos = round2(
          (parciales || []).filter(p => p.estado === 'pagada')
            .reduce((s, p) => s + (p.importe || 0), 0)
        );
        const netoLiquidar = round2(totalImporte - totalAdelantos);

        const registrosIds = regs.map(r => r.id);
        const existentes = await base44.asServiceRole.entities.NotaMensualGasto.filter({
          ciclo_mes: cicloMes, operario_id: opId,
        });

        const payloadNota = {
          total_registros: regs.length,
          total_importe: totalImporte,
          total_adelantos_gastos: totalAdelantos,
          importe_neto_liquidar: netoLiquidar,
          saldo_pendiente: netoLiquidar,
          registros_ids: registrosIds,
          estado: 'enviada',
          fecha_cierre: finPeriodo,
        };

        if (existentes && existentes.length > 0) {
          await base44.asServiceRole.entities.NotaMensualGasto.update(existentes[0].id, payloadNota);
        } else {
          await base44.asServiceRole.entities.NotaMensualGasto.create({
            ciclo_mes: cicloMes,
            operario_id: opId,
            operario_name: primer.operario_name || '',
            importe_adelanto: 0,
            ...payloadNota,
          });
        }

        // Mover a pendiente SÓLO los que siguen reclamables (no los ya avanzados en un parcial)
        for (const r of regs) {
          if (ESTADOS_RECLAMABLES.includes(r.estado)) {
            await base44.asServiceRole.entities.RegistroGasto.update(r.id, { estado: 'pendiente' });
          }
        }

        creadas.push({
          operario_id: opId,
          total: totalImporte,
          adelantos: totalAdelantos,
          neto: netoLiquidar,
          registros: regs.length,
        });
      } catch (_) { /* continuar con el siguiente operario */ }
    }

    return Response.json({
      success: true,
      cicloMes,
      finPeriodo,
      tipoCierre: 'definitivo',
      esMesEnCurso,
      esquema: 'calendario_1_31',
      notas_creadas: creadas.length,
      detalle: creadas,
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});