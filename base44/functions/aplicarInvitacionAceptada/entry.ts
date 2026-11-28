import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Vigilancia de invitaciones pendientes.
 *
 * IMPORTANTE: esta función NO activa invitaciones ni asigna empresa o rol.
 * Solo deja constancia de que ya existe una cuenta con el email invitado
 * (registrado_en / user_id_registrado) para que el propietario lo vea en su
 * bandeja. El acceso se concede únicamente cuando la persona invitada
 * confirma desde su sesión (gestionarInvitacionAcceso → confirmar).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const pendientes = await base44.asServiceRole.entities.InvitacionUsuario.filter({
      estado: 'pendiente_activacion',
    });
    if (!pendientes.length) {
      return Response.json({ success: true, revisadas: 0, detectadas: 0 });
    }

    const usuarios = await base44.asServiceRole.entities.User.list();
    const porEmail = new Map(
      usuarios.map((u: any) => [String(u.email || '').toLowerCase(), u])
    );

    let detectadas = 0;
    for (const inv of pendientes) {
      const cuenta = porEmail.get(String(inv.email || '').toLowerCase());
      if (!cuenta) continue;
      if (inv.user_id_registrado === cuenta.id && inv.registrado_en) continue;

      const historial = Array.isArray(inv.historial) ? inv.historial : [];
      await base44.asServiceRole.entities.InvitacionUsuario.update(inv.id, {
        user_id_registrado: cuenta.id,
        registrado_en: new Date().toISOString(),
        historial: [
          ...historial,
          {
            fecha: new Date().toISOString(),
            usuario_email: cuenta.email,
            accion: 'cuenta_detectada',
            nota: 'Existe una cuenta con este email. Espera su confirmación: no se concede acceso automáticamente.',
          },
        ],
      });
      detectadas += 1;
    }

    return Response.json({ success: true, revisadas: pendientes.length, detectadas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});