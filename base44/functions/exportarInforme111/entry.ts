import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

/**
 * exportarInforme111
 * ════════════════════════════════════════════════════════════════
 * Genera el informe consolidado para la declaración Modelo 111.
 * Consolida:
 *   - Retenciones de autónomos (FacturaAutonomo) del trimestre
 *   - Retenciones de trabajadores (Nomina) del trimestre (datos AGREGADOS)
 *
 * Acceso: contabilidad + gerencia/administración/admin
 * POST body: { trimestre: "2026-T1", anio?: number, incluir_trabajadores?: boolean }
 * Response: { ok, trimestre, autonomos[], trabajadores_resumen, totales, modelo111_preview, informe_texto }
 */

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const rolesPermitidos = ['admin', 'propietario', 'gerencia', 'administracion', 'contabilidad'];
    if (!user || !rolesPermitidos.includes(user.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { trimestre, anio, incluir_trabajadores = true } = body;
    if (!trimestre) return Response.json({ error: 'trimestre requerido (ej: 2026-T1)' }, { status: 400 });

    // Parsear trimestre → rango de meses
    const [anioStr, qStr] = trimestre.split('-T');
    const anioNum = parseInt(anioStr || String(anio || new Date().getFullYear()));
    const q = parseInt(qStr || '1');
    const mesInicio = (q - 1) * 3 + 1;
    const mesFin = mesInicio + 2;
    const fechaInicio = `${anioNum}-${String(mesInicio).padStart(2, '0')}-01`;
    const fechaFin = `${anioNum}-${String(mesFin).padStart(2, '0')}-31`;

    // ── AUTÓNOMOS: todas las facturas del trimestre con retención ──────────
    const todasFacturas = await base44.asServiceRole.entities.FacturaAutonomo
      .list('fecha_factura', 200)
      .catch(() => []);

    const facturasTrims = (todasFacturas || []).filter((f) => {
      if (f.estado === 'anulada') return false;
      if (f.trimestre === trimestre) return true;
      const fecha = f.fecha_factura || '';
      return fecha >= fechaInicio && fecha <= fechaFin;
    });

    // Agrupar por autónomo (NIF)
    const autonomosMap = new Map();
    for (const f of facturasTrims) {
      const nif = f.nif_autonomo || 'SIN_NIF';
      if (!autonomosMap.has(nif)) {
        autonomosMap.set(nif, {
          nif_autonomo: nif,
          nombre_autonomo: f.nombre_autonomo || '',
          facturas: [],
          total_base: 0,
          total_retencion: 0,
          porcentaje_medio: 0,
        });
      }
      const entry = autonomosMap.get(nif);
      entry.facturas.push({
        id: f.id,
        numero_factura: f.numero_factura || '',
        fecha_factura: f.fecha_factura || '',
        concepto: f.concepto || '',
        base_imponible: f.base_imponible || 0,
        porcentaje_retencion: f.porcentaje_retencion || 0,
        importe_retencion: f.importe_retencion || 0,
        total_factura: f.total_factura || 0,
        estado: f.estado || '',
        precisa_revision: f.precisa_revision || false,
      });
      entry.total_base += f.base_imponible || 0;
      entry.total_retencion += f.importe_retencion || 0;
    }

    for (const [, entry] of autonomosMap) {
      entry.porcentaje_medio = entry.total_base > 0
        ? (entry.total_retencion / entry.total_base) * 100
        : 0;
      entry.porcentaje_medio = Math.round(entry.porcentaje_medio * 100) / 100;
    }

    const autonomos = Array.from(autonomosMap.values()).sort((a, b) =>
      (a.nombre_autonomo || '').localeCompare(b.nombre_autonomo || ''));

    // ── TRABAJADORES: retenciones de nóminas (datos AGREGADOS) ──
    let trabajadoresResumen = null;
    if (incluir_trabajadores) {
      // Nóminas del trimestre. Ambos tipos (nomina_individual y resumen_costes)
      // son registros por trabajador con operario_id y retencion_irpf propios;
      // no hay duplicación (1 registro por trabajador/mes). Se incluyen ambos.
      const todasNominas = await base44.asServiceRole.entities.Nomina
        .list('-anio', 500)
        .catch(() => []);

      const nominasTrims = (todasNominas || []).filter((n) => {
        const mes = n.mes || 0;
        const anioN = n.anio || 0;
        return anioN === anioNum && mes >= mesInicio && mes <= mesFin;
      });

      const totalRetencionTrabajadores = nominasTrims.reduce((s, n) => s + (n.retencion_irpf || 0), 0);
      const totalDevengadoTrabajadores = nominasTrims.reduce((s, n) => s + (n.total_devengado || 0), 0);
      const numTrabajadores = new Set(nominasTrims.map((n) => n.operario_id).filter(Boolean)).size;

      trabajadoresResumen = {
        trimestre,
        meses_incluidos: [mesInicio, mesInicio + 1, mesFin],
        num_trabajadores: numTrabajadores,
        total_devengado: Math.round(totalDevengadoTrabajadores * 100) / 100,
        total_retencion_irpf: Math.round(totalRetencionTrabajadores * 100) / 100,
        nota: 'Datos agregados. El detalle por trabajador se gestiona en el módulo Nóminas.',
      };
    }

    // ── TOTALES CONSOLIDADOS ─────────────────────────────────────────────
    const totalBaseAutonomos = autonomos.reduce((s, a) => s + a.total_base, 0);
    const totalRetencionAutonomos = autonomos.reduce((s, a) => s + a.total_retencion, 0);
    const totalRetencionTrabajadores = trabajadoresResumen?.total_retencion_irpf || 0;
    const totalRetencionConsolidado = totalRetencionAutonomos + totalRetencionTrabajadores;

    const modelo111Preview = {
      periodo: trimestre,
      presentador_nif: 'Ver Empresa en la app',
      casilla_01_perceptores_trabajo: trabajadoresResumen?.num_trabajadores || 0,
      casilla_02_base_trabajo: Math.round((trabajadoresResumen?.total_devengado || 0) * 100) / 100,
      casilla_03_retencion_trabajo: Math.round(totalRetencionTrabajadores * 100) / 100,
      casilla_04_perceptores_profesional: autonomos.length,
      casilla_05_base_profesional: Math.round(totalBaseAutonomos * 100) / 100,
      casilla_06_retencion_profesional: Math.round(totalRetencionAutonomos * 100) / 100,
      casilla_28_total_ingresar: Math.round(totalRetencionConsolidado * 100) / 100,
    };

    // ── TEXTO PLANO PARA EXPORTAR / COPIAR ──────────────────────────────
    const lineas = [
      `INFORME MODELO 111 — ${trimestre}`,
      `Generado: ${new Date().toLocaleDateString('es-ES')} por ${user.email}`,
      `${'═'.repeat(60)}`,
      '',
      `SECCIÓN A — RETENCIONES SOBRE RENDIMIENTOS PROFESIONALES (AUTÓNOMOS)`,
      `Número de perceptores: ${autonomos.length}`,
      `Base total: ${totalBaseAutonomos.toFixed(2)} €`,
      `Total retenciones: ${totalRetencionAutonomos.toFixed(2)} €`,
      '',
    ];

    for (const a of autonomos) {
      lineas.push(`  Autónomo: ${a.nombre_autonomo} (${a.nif_autonomo})`);
      lineas.push(`    Base: ${a.total_base.toFixed(2)} €  |  Retención: ${a.total_retencion.toFixed(2)} €  |  Tipo medio: ${a.porcentaje_medio.toFixed(2)}%`);
      for (const f of a.facturas) {
        lineas.push(`    · Fac. ${f.numero_factura || '-'}  ${f.fecha_factura}  Base: ${f.base_imponible.toFixed(2)}€  Ret: ${f.importe_retencion.toFixed(2)}€${f.precisa_revision ? ' ⚠ REVISAR' : ''}`);
      }
      lineas.push('');
    }

    if (trabajadoresResumen) {
      lineas.push(`SECCIÓN B — RETENCIONES SOBRE RENDIMIENTOS DEL TRABAJO (EMPLEADOS)`);
      lineas.push(`Número de trabajadores: ${trabajadoresResumen.num_trabajadores}`);
      lineas.push(`Total devengado: ${trabajadoresResumen.total_devengado.toFixed(2)} €`);
      lineas.push(`Total retenciones IRPF: ${trabajadoresResumen.total_retencion_irpf.toFixed(2)} €`);
      lineas.push(`(Datos agregados — detalle en módulo Nóminas)`);
      lineas.push('');
    }

    lineas.push(`${'═'.repeat(60)}`);
    lineas.push(`TOTAL A INGRESAR (MODELO 111): ${totalRetencionConsolidado.toFixed(2)} €`);
    lineas.push('');
    lineas.push('PREVIEW CASILLAS MODELO 111:');
    lineas.push(`  [01] Nº perceptores trabajo: ${modelo111Preview.casilla_01_perceptores_trabajo}`);
    lineas.push(`  [02] Base íntegra trabajo: ${modelo111Preview.casilla_02_base_trabajo.toFixed(2)} €`);
    lineas.push(`  [03] Retenciones trabajo: ${modelo111Preview.casilla_03_retencion_trabajo.toFixed(2)} €`);
    lineas.push(`  [04] Nº perceptores profesional: ${modelo111Preview.casilla_04_perceptores_profesional}`);
    lineas.push(`  [05] Base íntegra profesional: ${modelo111Preview.casilla_05_base_profesional.toFixed(2)} €`);
    lineas.push(`  [06] Retenciones profesional: ${modelo111Preview.casilla_06_retencion_profesional.toFixed(2)} €`);
    lineas.push(`  [28] TOTAL A INGRESAR: ${modelo111Preview.casilla_28_total_ingresar.toFixed(2)} €`);

    const facturasConRevision = facturasTrims.filter((f) => f.precisa_revision);
    if (facturasConRevision.length > 0) {
      lineas.push('');
      lineas.push(`⚠ FACTURAS QUE NECESITAN REVISIÓN ANTES DE PRESENTAR (${facturasConRevision.length}):`);
      for (const f of facturasConRevision) {
        lineas.push(`  · ${f.nombre_autonomo || 'Sin nombre'} (${f.nif_autonomo || 'Sin NIF'}) — ${f.revision_motivo || 'Revisar datos'}`);
      }
    }

    return Response.json({
      ok: true,
      trimestre,
      anio: anioNum,
      fecha_generacion: new Date().toISOString(),
      generado_por: user.email,
      autonomos,
      trabajadores_resumen: trabajadoresResumen,
      totales: {
        autonomos: {
          num_perceptores: autonomos.length,
          total_base: Math.round(totalBaseAutonomos * 100) / 100,
          total_retencion: Math.round(totalRetencionAutonomos * 100) / 100,
        },
        trabajadores: trabajadoresResumen ? {
          num_perceptores: trabajadoresResumen.num_trabajadores,
          total_retencion: totalRetencionTrabajadores,
        } : null,
        total_retenciones_consolidado: Math.round(totalRetencionConsolidado * 100) / 100,
      },
      modelo111_preview: modelo111Preview,
      facturas_pendientes_revision: facturasConRevision.length,
      informe_texto: lineas.join('\n'),
    });
  } catch (e) {
    console.error('exportarInforme111 error:', e);
    return Response.json({ error: e?.message || 'Error interno' }, { status: 500 });
  }
}