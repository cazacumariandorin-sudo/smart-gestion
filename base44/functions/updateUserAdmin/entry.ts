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

    // Usar service role para bypass de RLS
    await base44.asServiceRole.entities.User.update(userId, updates);

    return Response.json({ success: true, message: 'Usuario actualizado correctamente' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});