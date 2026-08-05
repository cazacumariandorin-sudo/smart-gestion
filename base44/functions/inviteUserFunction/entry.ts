import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'gerencia', 'director_comercial'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Admin, Gerencia o Director Comercial requerido' }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const validRoles = ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra', 'técnico', 'usuario_demo'];
    const userRole = validRoles.includes(role) ? role : 'operario';

    // La API de invitación solo acepta 'user' o 'admin'. Invitamos como 'user'
    // y luego actualizamos el rol personalizado en la entidad User.
    const inviteRole = userRole === 'admin' ? 'admin' : 'user';
    await base44.users.inviteUser(email, inviteRole);

    // Esperar un momento por si el invitado ya estaba autenticado (raro)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Buscar al usuario recién creado (puede tardar en aparecer hasta aceptar la invitación)
    const todosUsuarios = await base44.asServiceRole.entities.User.list();
    const nuevoUsuario = todosUsuarios.find(u => u.email === email);

    if (nuevoUsuario && nuevoUsuario.fecha_registro) {
      // Generar ID personalizado
      const fecha = new Date(nuevoUsuario.fecha_registro);
      const year = fecha.getFullYear();
      
      // Obtener usuarios del mismo año para calcular secuencial
      const usuariosMismoAno = todosUsuarios.filter(u => {
        if (!u.fecha_registro || !u.user_id_personalizado) return false;
        const userYear = new Date(u.fecha_registro).getFullYear();
        return userYear === year;
      });

      // Calcular siguiente número secuencial
      let maxSecuencial = 0;
      usuariosMismoAno.forEach(u => {
        if (u.user_id_personalizado) {
          const partes = u.user_id_personalizado.split('-');
          if (partes.length === 2) {
            const secuencial = parseInt(partes[1], 10);
            if (!isNaN(secuencial) && secuencial > maxSecuencial) {
              maxSecuencial = secuencial;
            }
          }
        }
      });

      const nuevoSecuencial = maxSecuencial + 1;
      const idPersonalizado = `${year}-${String(nuevoSecuencial).padStart(4, '0')}`;

      // Actualizar usuario con ID personalizado y rol personalizado
      await base44.asServiceRole.entities.User.update(nuevoUsuario.id, {
        user_id_personalizado: idPersonalizado,
        role: userRole
      });

      return Response.json({
        success: true,
        estado: 'registrado',
        message: `User ${email} successfully created and registered`,
        user_id_personalizado: idPersonalizado
      });
    }

    // El usuario fue invitado pero aún no ha aceptado la invitación por email.
    // No aparecerá en la lista hasta que complete el registro.
    return Response.json({
      success: true,
      estado: 'pendiente_aceptacion',
      message: `Invitación enviada a ${email}. El usuario aparecerá en la lista tras aceptar el email de invitación.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});