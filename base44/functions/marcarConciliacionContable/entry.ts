import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * marcarConciliacionContable
 * Única vía de escritura de los campos de conciliación en RegistroGasto / MaterialDocumentoOrigen.
 * Solo el rol 'contabilidad' puede invocarla (403 en caso contrario).
 * Validaciones P0 (propuesta sección E):
 *  - exactamente uno de registro_id / material_doc_id
 *  - RegistroGasto.estado ∈ {aprobado_gerencia, en_administracion, pagada}
 *  - MaterialDocumentoOrigen.estado === 'procesado'
 *  - whitelist de campos escritos (nunca importe/estado)
 *  - si conciliado_con_discrepancia → crea AsistenteTarea alta para gerencia
 */
export default async function marcarConciliacionContable(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'contabilidad') {
      return Response.json({ error: 'Forbidden: solo el rol contabilidad puede conciliar' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { registro_id, material_doc_id, conciliado, nota, estado_conciliacion } = body || {};

    const hasReg = !!registro_id;
    const hasDoc = !!material_doc_id;
    if (hasReg === hasDoc) {
      return Response.json({ error: 'Debe indicar exactamente uno de registro_id o material_doc_id' }, { status: 400 });
    }

    const estadoConciliacion = estado_conciliacion || (conciliado ? 'conciliado' : 'no_conciliado');
    if (!['no_conciliado', 'conciliado', 'conciliado_con_discrepancia'].includes(estadoConciliacion)) {
      return Response.json({ error: 'estado_conciliacion inválido' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const svc = base44.asServiceRole;
    const marcado = conciliado !== false;

    const buildUpdate = () => ({
      conciliado_contabilidad: marcado,
      fecha_conciliacion: marcado ? now : '',
      conciliado_por: marcado ? user.email : '',
      nota_conciliacion: nota || '',
      estado_conciliacion: estadoConciliacion,
      discrepancia_tarea_id: '',
      resolucion_estado: 'sin_discrepancia',
    });

    const crearTareaDiscrepancia = async (titulo, descripcion, entidadTipo, entidadId) => {
      const tarea = await svc.entities.AsistenteTarea.create({
        titulo,
        descripcion,
        tipo: 'alerta',
        prioridad: 'alta',
        estado: 'pendiente',
        asignada_a_rol: 'gerencia',
        entidad_relacionada_tipo: entidadTipo,
        entidad_relacionada_id: entidadId,
        creada_por: 'sistema',
        solo_gerencia: true,
        modulo: 'economico',
        origen_solicitud: 'conciliacion',
      });
      return tarea.id;
    };

    if (hasReg) {
      const reg = await svc.entities.RegistroGasto.get(registro_id);
      if (!reg) return Response.json({ error: 'RegistroGasto no encontrado' }, { status: 404 });
      const estadosValidos = ['aprobado_gerencia', 'en_administracion', 'pagada'];
      if (!estadosValidos.includes(reg.estado)) {
        return Response.json(
          { error: `Solo se puede conciliar un gasto ya aprobado/pagado (estado actual: ${reg.estado})` },
          { status: 409 }
        );
      }

      const update = buildUpdate();
      if (estadoConciliacion === 'conciliado_con_discrepancia') {
        const tareaId = await crearTareaDiscrepancia(
          `Discrepancia conciliación - Gasto ${reg.numero_nota || reg.id}`,
          `Discrepancia detectada por gestoría en gasto de ${reg.operario_name || ''} (nº ${reg.numero_nota || ''}). Importe sistema: ${reg.importe}€. Nota gestoría: ${nota || ''}. Revisar y corregir importe/estado o contactar gestoría.`,
          'RegistroGasto',
          registro_id
        );
        update.discrepancia_tarea_id = tareaId;
        update.resolucion_estado = 'pendiente';
      }

      await svc.entities.RegistroGasto.update(registro_id, update);
      return Response.json({
        ok: true,
        registro_id,
        estado_conciliacion: estadoConciliacion,
        resolucion_estado: update.resolucion_estado,
        discrepancia_tarea_id: update.discrepancia_tarea_id || null,
      });
    }

    // MaterialDocumentoOrigen
    const doc = await svc.entities.MaterialDocumentoOrigen.get(material_doc_id);
    if (!doc) return Response.json({ error: 'MaterialDocumentoOrigen no encontrado' }, { status: 404 });
    if (doc.estado !== 'procesado') {
      return Response.json(
        { error: `Solo se puede conciliar un documento procesado (estado actual: ${doc.estado})` },
        { status: 409 }
      );
    }

    const update = buildUpdate();
    if (estadoConciliacion === 'conciliado_con_discrepancia') {
      const tareaId = await crearTareaDiscrepancia(
        `Discrepancia conciliación - Documento ${doc.numero_documento || doc.id}`,
        `Discrepancia detectada por gestoría en documento de materiales (${doc.tipo} nº ${doc.numero_documento || ''}, proveedor ${doc.proveedor_nombre || ''}). Nota gestoría: ${nota || ''}.`,
        'MaterialDocumentoOrigen',
        material_doc_id
      );
      update.discrepancia_tarea_id = tareaId;
      update.resolucion_estado = 'pendiente';
    }

    await svc.entities.MaterialDocumentoOrigen.update(material_doc_id, update);
    return Response.json({
      ok: true,
      material_doc_id,
      estado_conciliacion: estadoConciliacion,
      resolucion_estado: update.resolucion_estado,
      discrepancia_tarea_id: update.discrepancia_tarea_id || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}