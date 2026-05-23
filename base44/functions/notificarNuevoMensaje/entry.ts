import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversacion_id, mensaje_id } = await req.json();

    if (!conversacion_id) {
      return Response.json({ error: 'Falta conversacion_id' }, { status: 400 });
    }

    // Obtener conversación y participantes
    const conversacion = await base44.entities.ChatConversacion.get(conversacion_id);
    
    if (!conversacion) {
      return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    // Obtener mensaje
    const mensaje = await base44.entities.ChatMensaje.get(mensaje_id);
    
    // Actualizar último mensaje
    await base44.entities.ChatConversacion.update(conversacion_id, {
      ultimo_mensaje_texto: mensaje?.tipo_mensaje === 'cifrado' 
        ? '🔒 Mensaje cifrado' 
        : mensaje?.mensaje_cifrado?.substring(0, 50) || 'Nuevo mensaje',
      ultimo_mensaje_fecha: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    });

    // Enviar notificaciones push a los participantes (excepto al remitente)
    const remitenteEmail = mensaje?.autor_email || user.email;
    const conversacionNombre = conversacion.nombre || 'Chat';
    
    // Filtrar participantes que no son el remitente
    const participantesParaNotificar = conversacion.participantes?.filter(
      p => p.user_email !== remitenteEmail
    ) || [];

    // Enviar notificación a cada participante
    for (const participante of participantesParaNotificar) {
      try {
        // Enviar email de notificación
        await base44.integrations.Core.SendEmail({
          to: participante.user_email,
          subject: `Nuevo mensaje en ${conversacionNombre}`,
          body: `
            <p>Hola ${participante.nombre_display || participante.user_email},</p>
            <p>Tienes un nuevo mensaje en la conversación <strong>${conversacionNombre}</strong>.</p>
            <p>Abre la aplicación para verlo.</p>
          `,
          from_name: 'SmartGestión Chat'
        });
      } catch (emailError) {
        console.error(`Error enviando email a ${participante.user_email}:`, emailError);
      }
    }

    return Response.json({ 
      success: true,
      conversacion_id,
      mensaje_id,
      notificados: participantesParaNotificar.map(p => p.user_email)
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});