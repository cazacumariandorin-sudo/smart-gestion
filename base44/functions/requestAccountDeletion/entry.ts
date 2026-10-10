import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Elimina la cuenta del usuario que llama (botón "Eliminar mi cuenta" del Perfil).
 *
 * - Solo puede borrarse a sí mismo (usa el usuario autenticado, nunca un id recibido).
 * - Bloquea el borrado de la única cuenta admin (evita dejar la empresa sin administrador).
 * - Desvincula su ficha de Operario/Técnico en lugar de borrarla: el histórico laboral
 *   (fichajes, partes) se conserva por obligación legal.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole.entities;

    if (user.role === 'admin') {
      const admins = await svc.User.filter({ role: 'admin' });
      if (admins.length <= 1) {
        return Response.json(
          { error: 'No puedes eliminar la única cuenta de administrador. Asigna otro administrador primero.' },
          { status: 400 }
        );
      }
    }

    // Desvincular (no borrar) la ficha de operario/técnico asociada
    try {
      const fichas = await svc.Operario.filter({ user_id: user.id });
      for (const f of fichas) {
        await svc.Operario.update(f.id, { user_id: '', user_email: '' });
      }
    } catch (e) {
      console.error('No se pudo desvincular la ficha de operario', e);
    }

    await svc.User.delete(user.id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
