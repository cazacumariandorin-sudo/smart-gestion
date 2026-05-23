import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversacion_id, clave_aes_cifrada, iv_base64 } = await req.json();

    if (!conversacion_id || !clave_aes_cifrada) {
      return Response.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // Verificar que el usuario es participante de la conversación
    const conversacion = await base44.entities.ChatConversacion.get(conversacion_id);
    
    if (!conversacion) {
      return Response.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const esParticipante = conversacion.participantes?.some(
      p => p.user_email === user.email
    );

    if (!esParticipante && conversacion.created_by !== user.email) {
      return Response.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Registrar la clave AES cifrada para la conversación
    // Cada participante tendrá su propia entrada con la clave cifrada con su RSA pública
    const existente = await base44.entities.ChatClavePublica.filter({
      user_email: user.email,
      activa: true
    });

    if (existente.length === 0) {
      return Response.json({ error: 'Usuario sin clave pública' }, { status: 400 });
    }

    // Guardar el mensaje con la clave AES cifrada
    // El IV se genera aleatoriamente en el frontend y se envía junto con el ciphertext
    const mensaje = await base44.entities.ChatMensaje.create({
      conversacion_id,
      autor_email: user.email,
      autor_nombre: user.full_name || user.email,
      mensaje_cifrado: clave_aes_cifrada, // Contiene IV + ciphertext
      iv: iv_base64 || 'encrypted',
      fecha_envio: new Date().toISOString(),
      tipo_mensaje: 'cifrado',
      cifrado_tipo: 'AES-256-GCM',
    });

    // Actualizar conversación con último mensaje
    await base44.entities.ChatConversacion.update(conversacion_id, {
      ultimo_mensaje_texto: '🔒 Mensaje cifrado',
      ultimo_mensaje_fecha: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    });

    return Response.json({ success: true, mensaje_id: mensaje.id });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});