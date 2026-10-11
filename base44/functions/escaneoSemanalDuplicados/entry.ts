import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  mapRegistroGasto, mapFacturaAutonomo, mapNomina, mapPresupuesto,
  agruparDuplicados, GrupoDuplicado,
} from '../../shared/duplicadosEconomico.ts';

// Escaneo semanal de duplicados del módulo económico. Lo invoca el workflow
// programado (viernes 05:00 Europe/Madrid). No requiere usuario: corre como
// service-role. Si hay duplicados críticos/altos, crea (o refresca) una
// AsistenteTarea de alta prioridad para gerencia con resumen y enlace al panel.

const MAX_POR_ENTIDAD = 1500;
const MARCADOR_TAREA = 'escaneo_duplicados_economico_semanal';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const srv = base44.asServiceRole;

    const docs: any[] = [];

    // Gastos técnicos
    const gastos = await srv.entities.RegistroGasto.filter(
      // Los gastos 'rechazada' (incluidos los anulados por una reconstrucción multi-ticket) NO se comparan:
      // antes un original anulado y sus registros reconstruidos salían como duplicados «críticos» cada semana.
      { duplicado_confirmado: { $in: [null, false] }, estado: { $ne: 'rechazada' } },
      '-fecha_documento',
      MAX_POR_ENTIDAD,
    );
    for (const r of gastos || []) docs.push(mapRegistroGasto(r));

    // Facturas de autónomos
    const facturas = await srv.entities.FacturaAutonomo.filter(
      { estado: { $ne: 'anulada' } },
      '-fecha_factura',
      MAX_POR_ENTIDAD,
    );
    for (const r of facturas || []) docs.push(mapFacturaAutonomo(r));

    // Nóminas (solo duplicados intra-entidad por operario+mes)
    const nominas = await srv.entities.Nomina.filter({}, '-anio', MAX_POR_ENTIDAD);
    for (const r of nominas || []) docs.push(mapNomina(r));

    // Presupuestos
    const presup = await srv.entities.Presupuesto.filter(
      { es_duplicado_confirmado: { $in: [null, false] } },
      '-fecha',
      MAX_POR_ENTIDAD,
    );
    for (const r of presup || []) docs.push(mapPresupuesto(r));

    // Umbral alto: solo críticos+altos generan tarea (medios se revisan a mano)
    const grupos = agruparDuplicados(docs, 'alto');
    const criticos = grupos.filter((g: GrupoDuplicado) => g.severidad === 'critico');
    const altos = grupos.filter((g: GrupoDuplicado) => g.severidad === 'alto');
    const importeDuplicado = grupos.reduce((s: number, g: GrupoDuplicado) => {
      const conservar = g.conservar_id;
      return s + g.miembros.filter(m => m.id !== conservar).reduce((ss: number, m: any) => ss + (m.importe || 0), 0);
    }, 0);

    const ahora = new Date();
    const fechaISO = ahora.toISOString();
    const fechaLimite = new Date(ahora.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    // Resumen textual para la tarea
    const desglosePorEntidad = {};
    for (const g of grupos) {
      const ent = g.miembros[0].entidad;
      desglosePorEntidad[ent] = (desglosePorEntidad[ent] || 0) + 1;
    }
    const desgloseTxt = Object.entries(desglosePorEntidad)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');

    const detalleTop = grupos.slice(0, 8).map((g, i) => {
      const m = g.miembros[0];
      const aAnular = g.miembros.filter(x => x.id !== g.conservar_id).reduce((s, x) => s + (x.importe || 0), 0);
      return `${i + 1}. ${m.nombre || '(sin nombre)'} — ${m.fecha || '?'} — ${m.importe != null ? m.importe + '€' : '?'} [${g.severidad}] (-${aAnular.toFixed(2)}€)`;
    }).join('\n');

    // Buscar tarea pendiente previa del mismo marcador para refrescarla
    const existentes = await srv.entities.AsistenteTarea.filter({
      contexto_ia: MARCADOR_TAREA,
      estado: 'pendiente',
    });

    const hayDuplicados = grupos.length > 0;
    const prioridad = criticos.length > 0 ? 'urgente' : altos.length > 0 ? 'alta' : 'media';
    const titulo = `Duplicados económicos: ${grupos.length} grupo(s) (${criticos.length} críticos)`;

    const descripcion = [
      `Escaneo semanal de duplicados — ${fechaISO.slice(0, 16).replace('T', ' ')}`,
      `Documentos analizados: ${docs.length}`,
      `Grupos detectados: ${grupos.length} (críticos: ${criticos.length}, altos: ${altos.length})`,
      `Importe potencial a anular: ${importeDuplicado.toFixed(2)} €`,
      desgloseTxt ? `Desglose: ${desgloseTxt}` : '',
      '',
      'Top grupos:',
      detalleTop,
      '',
      'Revisar en: Dashboard Económico → pestaña "Duplicados", o Contabilidad → "Duplicados".',
    ].filter(Boolean).join('\n');

    if (hayDuplicados) {
      const payload = {
        titulo,
        descripcion,
        tipo: 'alerta',
        prioridad,
        estado: 'pendiente',
        asignada_a_rol: 'gerencia',
        fecha_limite: fechaLimite,
        entidad_relacionada_tipo: 'RegistroGasto',
        contexto_ia: MARCADOR_TAREA,
        creada_por: 'sistema',
        solo_gerencia: true,
        modulo: 'economico',
        origen_solicitud: 'Workflow semanal duplicados',
      };

      if (existentes && existentes.length > 0) {
        // Refrescar la tarea existente con el nuevo resumen
        await srv.entities.AsistenteTarea.update(existentes[0].id, {
          titulo, descripcion, prioridad, fecha_limite: fechaLimite,
        });
      } else {
        await srv.entities.AsistenteTarea.create(payload);
      }
    } else if (existentes && existentes.length > 0) {
      // No hay duplicados: cerrar la tarea pendiente previa
      await srv.entities.AsistenteTarea.update(existentes[0].id, {
        estado: 'completada',
        fecha_completada: fechaISO,
        feedback_usuario: 'Sin duplicados en el último escaneo.',
      });
    }

    return Response.json({
      success: true,
      fecha: fechaISO,
      total_docs: docs.length,
      total_grupos: grupos.length,
      criticos: criticos.length,
      altos: altos.length,
      importe_duplicado: importeDuplicado,
      tarea_creada_o_actualizada: hayDuplicados,
      tarea_cerrada: !hayDuplicados && existentes.length > 0,
    });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}