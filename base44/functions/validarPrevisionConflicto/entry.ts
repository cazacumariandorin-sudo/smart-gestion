import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, fecha_inicio, client_id, usuario_id } = await req.json();

    if (!obra_id || !fecha_inicio) {
      return Response.json({ error: 'obra_id y fecha_inicio son requeridos' }, { status: 400 });
    }

    // Buscar previsiones existentes para la misma obra y fecha
    const previsionesExistentes = await base44.entities.PrevisionObra.filter({
      obra_id: obra_id,
      fecha_inicio: fecha_inicio,
      status: { $in: ['planificada', 'en_curso'] }
    });

    // Filtrar para excluir la propia previsión si estamos editando
    const previsionesConflictivas = previsionesExistentes.filter(p => {
      // Si es el mismo cliente, no hay conflicto
      if (p.client_id === client_id) return false;
      return true;
    });

    if (previsionesConflictivas.length > 0) {
      // Hay conflicto - crear tarea para gerencia
      const previsionConflictiva = previsionesConflictivas[0];
      
      await base44.entities.AsistenteTarea.create({
        titulo: 'Conflicto en previsión de obra - Validación requerida',
        descripcion: `El usuario ${user.full_name || user.email} ha solicitado una previsión para la obra "${previsionConflictiva.obra_name}" en la fecha ${fecha_inicio}, pero ya existe una previsión activa para otro cliente (${previsionConflictiva.client_name}).`,
        tipo: 'alerta',
        prioridad: 'alta',
        estado: 'pendiente',
        asignada_a_rol: 'gerencia',
        entidad_relacionada_tipo: 'PrevisionObra',
        entidad_relacionada_id: previsionConflictiva.id,
        contexto_ia: `Conflicto detectado: Obra ${previsionConflictiva.obra_name}, Fecha ${fecha_inicio}, Cliente existente: ${previsionConflictiva.client_name}, Nuevo solicitante: ${user.full_name || user.email}`,
        solo_gerencia: true,
        modulo: 'informe-obras',
        origen_solicitud: user.full_name || user.email,
        fecha_limite: fecha_inicio,
      });

      return Response.json({
        conflicto: true,
        mensaje: 'Pendiente de confirmación por gerencia',
        prevision_existente: {
          id: previsionConflictiva.id,
          obra_name: previsionConflictiva.obra_name,
          client_name: previsionConflictiva.client_name,
          fecha_inicio: previsionConflictiva.fecha_inicio,
        }
      }, { status: 409 }); // 409 Conflict
    }

    // No hay conflicto
    return Response.json({
      conflicto: false,
      mensaje: 'Disponible'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});