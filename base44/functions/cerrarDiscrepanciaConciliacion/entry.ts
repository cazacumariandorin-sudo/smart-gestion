import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * cerrarDiscrepanciaConciliacion
 * Se invoca vía automation entity (AsistenteTarea update: estado === 'completada' && origen_solicitud === 'conciliacion').
 * Marca resolucion_estado = 'resuelta' en el RegistroGasto / MaterialDocumentoOrigen cuya discrepancia_tarea_id coincide.
 * NO toca estado_conciliacion (eso lo decide contabilidad al re-revisar → 'cerrada' vía marcarConciliacionContable).
 */
export default async function cerrarDiscrepanciaConciliacion(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const tarea = body?.data || body?.event?.data || {};
    const tareaId = body?.event?.entity_id || tarea.id || body?.tarea_id;

    if (!tareaId) return Response.json({ error: 'tarea_id requerido' }, { status: 400 });
    if (tarea.origen_solicitud !== 'conciliacion') {
      return Response.json({ ok: true, skipped: 'origen no conciliacion' });
    }
    if (tarea.estado !== 'completada') {
      return Response.json({ ok: true, skipped: 'estado no completada' });
    }

    const completadaPor = tarea.asignada_a_nombre || 'gerencia';
    const now = new Date().toISOString();
    const svc = base44.asServiceRole;

    let actualizados = 0;

    const gastos = await svc.entities.RegistroGasto.filter({ discrepancia_tarea_id: tareaId, resolucion_estado: 'pendiente' });
    for (const g of gastos) {
      await svc.entities.RegistroGasto.update(g.id, {
        resolucion_estado: 'resuelta',
        resolucion_por: completadaPor,
        fecha_resolucion: now,
      });
      actualizados++;
    }

    const docs = await svc.entities.MaterialDocumentoOrigen.filter({ discrepancia_tarea_id: tareaId, resolucion_estado: 'pendiente' });
    for (const d of docs) {
      await svc.entities.MaterialDocumentoOrigen.update(d.id, {
        resolucion_estado: 'resuelta',
        resolucion_por: completadaPor,
        fecha_resolucion: now,
      });
      actualizados++;
    }

    return Response.json({ ok: true, tarea_id: tareaId, actualizados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}