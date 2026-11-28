import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { enviarPush, limpiarTexto, usuariosPorEmails } from '../../shared/pushNotificaciones.ts';

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
    // Se mantiene la actualización de la conversación y se envía un push nativo,
    // que solo llega a la app instalada en el móvil (nunca al correo).

    // El push nunca interrumpe el envío del mensaje: si falla, se registra y se sigue.
    let push = { enviados: 0, omitidos: 0, errores: 0 };
    try {
      const participantes = (conversacion.participantes || []).filter(
        (p) => p?.user_email && p.user_email !== user.email && !p.silenciado
      );

      if (mensaje_id && participantes.length > 0) {
        const appUrl = req.headers.get('X-Base44-App-Url') || 'https://smart-gestion.base44.app';
        const usuarios = await usuariosPorEmails(base44, participantes.map((p) => p.user_email));
        const autor = limpiarTexto(mensaje?.autor_nombre || user.full_name || 'Un compañero', 60);

        push = await enviarPush(base44, {
          tipo: 'mensaje',
          referenciaId: mensaje_id,
          referenciaEtiqueta: conversacion.nombre || 'Chat',
          destinatarios: participantes.map((p) => ({
            user_id: usuarios[p.user_email]?.id || p.user_id || '',
            user_email: p.user_email,
          })),
          titulo: 'Nuevo mensaje',
          // El contenido del chat está cifrado: el push solo avisa, no lo reproduce.
          contenido: conversacion.tipo === 'grupo'
            ? limpiarTexto(`${conversacion.nombre || 'Grupo'}: nuevo mensaje`, 100)
            : `${autor} te ha escrito`,
          urlAccion: `${appUrl}/chat`,
          appUrl,
        });
      }
    } catch (error: any) {
      push = { enviados: 0, omitidos: 0, errores: 1, error: limpiarTexto(error?.message || 'Error', 200) };
    }

    return Response.json({
      success: true,
      conversacion_id,
      mensaje_id,
      notificados: [],
      push,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});