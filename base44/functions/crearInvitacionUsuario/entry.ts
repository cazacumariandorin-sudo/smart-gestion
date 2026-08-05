import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Admin o Gerencia requerido' }, { status: 403 });
    }

    const { email, role, full_name, cargo, empresa_id, empresa_nombre, acceso_hasta, notas } = await req.json();

    if (!email || !full_name || !cargo) {
      return Response.json({ error: 'Faltan campos obligatorios (email, full_name, cargo)' }, { status: 400 });
    }

    // Validación: no duplicar invitación pendiente
    const existentes = await base44.asServiceRole.entities.InvitacionUsuario.filter({
      email: email,
      estado: 'pendiente_activacion'
    });
    if (existentes.length > 0) {
      return Response.json({ error: 'Ya existe una invitación pendiente para este email' }, { status: 400 });
    }

    const validRoles = ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra', 'técnico', 'usuario_demo'];
    const userRole = validRoles.includes(role) ? role : 'operario';

    // Crear registro de invitación pendiente vinculado a la empresa
    await base44.asServiceRole.entities.InvitacionUsuario.create({
      email,
      rol: userRole,
      full_name,
      cargo,
      empresa_id: empresa_id || null,
      empresa_nombre: empresa_nombre || null,
      acceso_hasta: acceso_hasta || null,
      estado: 'pendiente_activacion',
      invitado_por: user.email,
      fecha_invitacion: new Date().toISOString(),
      notas: notas || null
    });

    // Enviar invitación por email (plataforma). La API solo admite 'user' o 'admin'.
    const inviteRole = userRole === 'admin' ? 'admin' : 'user';
    await base44.users.inviteUser(email, inviteRole);

    return Response.json({
      success: true,
      estado: 'pendiente_activacion',
      message: `Invitación enviada a ${email}. La cuenta se activará automáticamente cuando el usuario acepte el email.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});