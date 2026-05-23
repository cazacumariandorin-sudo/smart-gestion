import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Solo admin o gerencia pueden ejecutar esta función
    if (!['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { accion, usuario_id } = await req.json();

    if (accion === 'inicializar_usuario') {
      // Inicializar usuario recién registrado
      const usuario = await base44.entities.User.get(usuario_id);
      
      if (!usuario) {
        return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });
      }

      const now = new Date().toISOString();
      const fechaLimite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Si es demo, no crear log
      if (usuario.tipo_cuenta === 'demo') {
        await base44.entities.User.update(usuario_id, {
          fecha_registro: now,
          fecha_limite_vinculacion: fechaLimite,
          vinculo_estado: 'demo',
          vinculo_tipo: 'demo_user',
          vinculo_nombre: `Demo User - ${usuario.email}`,
        });
        
        return Response.json({ success: true, tipo: 'demo' });
      }

      // Usuario real: crear log
      await base44.entities.User.update(usuario_id, {
        fecha_registro: now,
        fecha_limite_vinculacion: fechaLimite,
        vinculo_estado: 'pendiente',
        vinculo_tipo: 'sin_vincular',
        role: usuario.role || 'operario',
      });

      await base44.entities.VinculacionLog.create({
        usuario_id: usuario.id,
        usuario_email: usuario.email,
        usuario_nombre: usuario.full_name || usuario.email,
        accion: 'usuario_registrado',
        tipo_vinculo: 'sin_vincular',
        timestamp: now,
        realizado_por_email: user.email,
        realizado_por_rol: user.role,
      });

      return Response.json({ 
        success: true, 
        tipo: 'real',
        mensaje: `Usuario ${usuario.email} registrado — pendiente de vinculación (7 días)`
      });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});