import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversacion_id, mensaje_id, preview_texto, incrementar_total = false } = await req.json();

    if (!conversacion_id) {
      return Response.json({ error: 'Falta conversacion_id' }, { status: 400 });
    }

    // Obtener conversación (lectura con RLS del usuario — participante o autor solo)
    const conversacion = await base44.entities.ChatConversacion.get(conversacion_id);

    if (!conversacion) {
      return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    // Verificar que el usuario sea participante o creador
    const esParticipante = (conversacion.participantes || []).some(
      p => p.user_email === user.email
    );
    if (!esParticipante && conversacion.created_by !== user.email) {
      return Response.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Obtener mensaje (lectura con RLS — jorge es destinatario o autor)
    const mensaje = mensaje_id
      ? await base44.entities.ChatMensaje.get(mensaje_id)
      : null;

    // Actualizar conversación como service role — bypassa RLS para que técnicos
    // (que no tienen update explícito en ChatConversacion) puedan actualizar el
    // último mensaje al enviar.
    const updateData: any = {
      ultimo_mensaje_texto: preview_texto ||
        (mensaje?.tipo_mensaje === 'cifrado'
          ? '🔒 Mensaje cifrado'
          : (mensaje?.mensaje_cifrado || '').substring(0, 50) || 'Nuevo mensaje'),
      ultimo_mensaje_fecha: new Date().toISOString(),
      ultimo_mensaje_autor: mensaje?.autor_nombre || user.full_name || user.email,
      updated_date: new Date().toISOString(),
    };
    if (incrementar_total) {
      updateData.total_mensajes = (conversacion.total_mensajes || 0) + 1;
    }
    await base44.asServiceRole.entities.ChatConversacion.update(conversacion_id, updateData);

    // Notificaciones por email DESACTIVADAS a petición — el chat es en tiempo real
    // dentro de la app y no debe spamear el correo de los usuarios por cada mensaje.
    // Se mantiene solo la actualización de la conversación (último mensaje) arriba.

    return Response.json({
      success: true,
      conversacion_id,
      mensaje_id,
      notificados: []
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});