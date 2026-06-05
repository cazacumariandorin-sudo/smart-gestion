import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Función pública (sin auth) que valida si un código de invitación demo
 * es válido (activa, no usada, no expirada). No expone datos sensibles.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { codigo } = await req.json();

    if (!codigo) {
      return Response.json({ valida: false, motivo: 'Código no proporcionado' }, { status: 400 });
    }

    // Leer con asServiceRole para no depender de auth del visitante
    const registros = await base44.asServiceRole.entities.InvitacionDemo.filter(
      { codigo },
      '-created_date',
      1
    );

    if (!registros || registros.length === 0) {
      return Response.json({ valida: false, motivo: 'Invitación no encontrada' });
    }

    const inv = registros[0];

    if (!inv.activa) {
      return Response.json({ valida: false, motivo: 'Invitación revocada' });
    }

    if (inv.usada) {
      return Response.json({ valida: false, motivo: 'Invitación ya utilizada' });
    }

    if (inv.fecha_expiracion && new Date(inv.fecha_expiracion) < new Date()) {
      return Response.json({ valida: false, motivo: 'Invitación expirada' });
    }

    // Solo devolver los datos mínimos necesarios para el flujo de registro
    return Response.json({
      valida: true,
      duracion_dias: inv.duracion_dias,
      generada_por_nombre: inv.generada_por_nombre || 'SIMANTEC',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});