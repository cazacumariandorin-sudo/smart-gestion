import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const validRoles = ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra', 'usuario_demo'];
    const userRole = validRoles.includes(role) ? role : 'operario';

    // Invitar al usuario
    await base44.users.inviteUser(email, userRole);

    // Esperar un momento para que el usuario se registre
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Buscar al usuario recién creado
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

      // Actualizar usuario con ID personalizado
      await base44.asServiceRole.entities.User.update(nuevoUsuario.id, {
        user_id_personalizado: idPersonalizado
      });

      return Response.json({ 
        success: true, 
        message: `User ${email} invited successfully`,
        user_id_personalizado: idPersonalizado
      });
    }

    return Response.json({ success: true, message: `User ${email} invited successfully (ID pending)` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});