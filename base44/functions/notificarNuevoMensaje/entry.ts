import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Solo admin puede ejecutar esta función de notificación
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
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

    // Actualizar último mensaje
    const mensaje = await base44.entities.ChatMensaje.get(mensaje_id);
    
    await base44.entities.ChatConversacion.update(conversacion_id, {
      ultimo_mensaje_texto: mensaje?.tipo_mensaje === 'cifrado' 
        ? '🔒 Mensaje cifrado' 
        : mensaje?.mensaje_cifrado?.substring(0, 50) || 'Nuevo mensaje',
      ultimo_mensaje_fecha: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    });

    // Aquí se podría integrar con servicios de push notifications
    // Por ahora solo actualizamos la conversación

    return Response.json({ 
      success: true,
      conversacion_id,
      mensaje_id 
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});