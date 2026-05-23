import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Solo admin puede actualizar usuarios' }, { status: 403 });
    }

    const { userId, updates } = await req.json();

    if (!userId || !updates) {
      return Response.json({ error: 'Faltan parámetros: userId y updates' }, { status: 400 });
    }

    // 1. Actualizar entidad User
    await base44.asServiceRole.entities.User.update(userId, updates);

    // 2. Si se actualiza el rol, sincronizar con Operario vinculado
    if (updates.role) {
      const operarios = await base44.asServiceRole.entities.Operario.filter({
        user_id: userId
      });

      // Actualizar todos los operarios vinculados a este usuario
      for (const operario of operarios) {
        await base44.asServiceRole.entities.Operario.update(operario.id, {
          role: updates.role
        });
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Usuario actualizado correctamente' 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});