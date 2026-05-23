import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, publicKeyBase64, destinatario_email } = await req.json();

    // Registrar o actualizar clave pública del usuario
    if (action === 'registrar') {
      if (!publicKeyBase64) {
        return Response.json({ error: 'Falta publicKeyBase64' }, { status: 400 });
      }

      // Buscar si ya existe
      const existentes = await base44.entities.ChatClavePublica.filter({ user_email: user.email });
      
      if (existentes.length > 0) {
        // Actualizar la más reciente
        const ultima = existentes.sort((a, b) => 
          new Date(b.created_date) - new Date(a.created_date)
        )[0];
        
        await base44.entities.ChatClavePublica.update(ultima.id, {
          clave_publica: publicKeyBase64,
          activa: true,
        });
        
        return Response.json({ success: true, clave_id: ultima.id });
      } else {
        // Crear nueva
        const nueva = await base44.entities.ChatClavePublica.create({
          user_email: user.email,
          nombre_display: user.full_name || user.email,
          clave_publica: publicKeyBase64,
          activa: true,
        });
        
        return Response.json({ success: true, clave_id: nueva.id });
      }
    }

    // Obtener clave pública de otro usuario
    if (action === 'obtener') {
      if (!destinatario_email) {
        return Response.json({ error: 'Falta destinatario_email' }, { status: 400 });
      }

      const claves = await base44.entities.ChatClavePublica.filter({ 
        user_email: destinatario_email,
        activa: true 
      });

      if (claves.length === 0) {
        return Response.json({ error: 'Usuario sin clave pública registrada' }, { status: 404 });
      }

      // Devolver la más reciente
      const ultima = claves.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      )[0];

      return Response.json({ 
        clave_publica: ultima.clave_publica,
        nombre_display: ultima.nombre_display 
      });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});