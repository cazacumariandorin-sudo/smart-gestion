import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. Cargar invitaciones pendientes
    const pendientes = await base44.asServiceRole.entities.InvitacionUsuario.filter({
      estado: 'pendiente_activacion'
    });

    if (!pendientes.length) {
      return Response.json({ success: true, procesadas: 0, message: 'No hay invitaciones pendientes' });
    }

    // 2. Cargar todos los Users una sola vez para buscar coincidencias por email
    const todosUsuarios = await base44.asServiceRole.entities.User.list();

    // 3. Generar siguiente ID personalizado (construido sobre el máximo actual)
    let maxSecuencial = 0;
    const yearActual = new Date().getFullYear();
    todosUsuarios.forEach((u: any) => {
      if (u.user_id_personalizado) {
        const partes = u.user_id_personalizado.split('-');
        if (partes.length === 2) {
          const y = parseInt(partes[0], 10);
          const seq = parseInt(partes[1], 10);
          if (!isNaN(seq) && seq > maxSecuencial) maxSecuencial = seq;
          void y;
        }
      }
    });
    let nuevoSeqRunning = maxSecuencial + 1;

    const validRoles = ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra', 'técnico', 'usuario_demo'];

    const procesadas = [];

    for (const inv of pendientes) {
      // Buscar User con este email
      const userRegistrado = todosUsuarios.find((u: any) =>
        u.email?.toLowerCase() === String(inv.email).toLowerCase()
      );

      // Solo activamos si el usuario fue registrado y aún no tiene estado_cuenta activo
      if (!userRegistrado) continue;
      if (userRegistrado.estado_cuenta === 'activo') {
        // Ya activado por otro medio — marcar invitación como activada
        await base44.asServiceRole.entities.InvitacionUsuario.update(inv.id, {
          estado: 'activado',
          user_id_registrado: userRegistrado.id,
          fecha_aceptacion: new Date().toISOString()
        });
        continue;
      }

      const role = validRoles.includes(inv.rol) ? inv.rol : 'operario';
      const fechaReg = userRegistrado.fecha_registro ? new Date(userRegistrado.fecha_registro) : new Date();
      const year = fechaReg.getFullYear();
      const idPersonalizado = `${year}-${String(nuevoSeqRunning).padStart(4, '0')}`;
      nuevoSeqRunning += 1;

      const ahora = new Date().toISOString();

      await base44.asServiceRole.entities.User.update(userRegistrado.id, {
        role,
        cargo: inv.cargo,
        user_id_personalizado: idPersonalizado,
        empresa_id: inv.empresa_id,
        empresa_nombre: inv.empresa_nombre,
        fecha_vinculacion_empresa: ahora,
        estado_cuenta: 'activo',
        tipo_cuenta: 'real',
        invitado_por: inv.invitado_por,
        vinculo_estado: 'pendiente',
        acceso_hasta: inv.acceso_hasta || null
      });

      await base44.asServiceRole.entities.InvitacionUsuario.update(inv.id, {
        estado: 'activado',
        user_id_registrado: userRegistrado.id,
        fecha_aceptacion: ahora
      });

      procesadas.push({
        email: inv.email,
        user_id: userRegistrado.id,
        user_id_personalizado: idPersonalizado,
        rol: role,
        empresa_id: inv.empresa_id
      });
    }

    return Response.json({
      success: true,
      procesadas: procesadas.length,
      detalles: procesadas
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});