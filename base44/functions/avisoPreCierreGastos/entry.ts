import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Aviso pre-cierre del ciclo de gastos 26→25.
// - Cron: días 22, 23 y 24 a las 18:00 (Madrid) de cada mes.
// - Crea una AsistenteTarea (tipo=alerta, prioridad=alta, solo_gerencia=true) recordando
//   que el ciclo de gastos se cierra el día 25.
// - Idempotente: evita duplicados buscando tareas previas del mismo mes con el mismo título.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const hoy = new Date();
    const cicloMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const diaCierre = 25;
    const tituloAviso = `Cierre de ciclo de gastos · ${cicloMes} (día ${diaCierre})`;

    // Evitar duplicados: si ya existe tarea con el mismo título para este ciclo, no crear otra
    const previas = await base44.asServiceRole.entities.AsistenteTarea.filter({
      titulo: tituloAviso,
    });
    if (previas && previas.length > 0) {
      return Response.json({
        success: true,
        message: 'Aviso ya existe',
        cicloMes,
        tareas_existentes: previas.length,
      });
    }

    const diasRestantes = diaCierre - hoy.getDate();
    const descripcion = `El ciclo de notas de gasto ${cicloMes} se cierra el día ${diaCierre}. ` +
      `Faltan ${diasRestantes} días. Revisa pendientes en /notas-gastos antes del cierre automático.`;

    // Buscar usuarios con rol gerencia para asignar (opcional, el campo solo_gerencia ya filtra)
    let asignadaA = null;
    try {
      const gerentes = await base44.asServiceRole.entities.User.filter({ role: 'gerencia' });
      if (gerentes && gerentes.length > 0) {
        asignadaA = gerentes[0];
      }
    } catch (_) { /* si no se puede listar, la tarea sigue siendo visible para gerencia por solo_gerencia */ }

    const payload = {
      titulo: tituloAviso,
      descripcion,
      tipo: 'alerta',
      prioridad: 'alta',
      estado: 'pendiente',
      asignada_a_rol: 'gerencia',
      modulo: 'economico',
      entidad_relacionada_tipo: 'NotaMensualGasto',
      solo_gerencia: true,
      creada_por: 'sistema',
      origen_solicitud: 'cron_aviso_pre_cierre_gastos',
    };
    if (asignadaA) {
      payload.asignada_a_user_id = asignadaA.id || asignadaA._id;
      payload.asignada_a_nombre = asignadaA.full_name || asignadaA.email || '';
    }

    await base44.asServiceRole.entities.AsistenteTarea.create(payload);

    return Response.json({
      success: true,
      message: 'Aviso creado',
      cicloMes,
      dias_restantes: diasRestantes,
      asignado_a: asignadaA ? (asignadaA.email || asignadaA.id) : null,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message });
  }
});