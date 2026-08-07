import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, publicKeyBase64, destinatario_email, respaldoCifrado, forzar } = await req.json();

    // Comprobar si el usuario ya tiene una clave pública activa registrada,
    // y si tiene respaldo cifrado con PIN disponible. Se usa antes de
    // 'registrar' para evitar sobrescribir en silencio una clave existente
    // desde un dispositivo/navegador nuevo (lo que dejaría ilegibles los
    // mensajes cifrados con la clave anterior).
    if (action === 'verificar_propia') {
      const existentes = await base44.entities.ChatClavePublica.filter({ user_email: user.email });
      if (existentes.length === 0) {
        return Response.json({ existe: false, tiene_respaldo: false });
      }
      const ultima = existentes.sort((a, b) =>
        new Date(b.created_date) - new Date(a.created_date)
      )[0];
      return Response.json({
        existe: true,
        tiene_respaldo: !!ultima.clave_privada_cifrada,
        clave_publica: ultima.clave_publica,
        huella_digital: ultima.huella_digital || null,
      });
    }

    // Registrar o actualizar clave pública del usuario
    if (action === 'registrar') {
      if (!publicKeyBase64) {
        return Response.json({ error: 'Falta publicKeyBase64' }, { status: 400 });
      }

      // Buscar si ya existe
      const existentes = await base44.entities.ChatClavePublica.filter({ user_email: user.email });

      if (existentes.length > 0) {
        const ultima = existentes.sort((a, b) =>
          new Date(b.created_date) - new Date(a.created_date)
        )[0];

        // Si ya hay una clave pública activa distinta y no se ha pasado
        // 'forzar', no sobrescribir en silencio: el frontend debe avisar al
        // usuario de que va a perder acceso a los mensajes antiguos.
        if (ultima.clave_publica && ultima.clave_publica !== publicKeyBase64 && !forzar) {
          return Response.json({
            error: 'clave_existente',
            mensaje: 'Ya existe una clave activa para este usuario. Confirma para sobrescribirla (forzar: true).',
            clave_publica: ultima.clave_publica,
            tiene_respaldo: !!ultima.clave_privada_cifrada,
          }, { status: 409 });
        }

        const updateData = { clave_publica: publicKeyBase64, activa: true };
        if (respaldoCifrado) updateData.clave_privada_cifrada = respaldoCifrado;
        if (ultima.clave_publica !== publicKeyBase64) updateData.fecha_rotacion = new Date().toISOString();

        await base44.entities.ChatClavePublica.update(ultima.id, updateData);

        return Response.json({ success: true, clave_id: ultima.id });
      } else {
        // Crear nueva
        const nueva = await base44.entities.ChatClavePublica.create({
          user_email: user.email,
          nombre_display: user.full_name || user.email,
          clave_publica: publicKeyBase64,
          clave_privada_cifrada: respaldoCifrado || undefined,
          activa: true,
          fecha_creacion: new Date().toISOString(),
        });

        return Response.json({ success: true, clave_id: nueva.id });
      }
    }

    // Recuperar el respaldo cifrado de la propia clave privada (protegido
    // con el PIN del usuario en el navegador; el servidor nunca ve el PIN
    // ni la clave privada en claro).
    if (action === 'obtener_respaldo') {
      const existentes = await base44.entities.ChatClavePublica.filter({ user_email: user.email });
      if (existentes.length === 0) {
        return Response.json({ error: 'Sin clave registrada' }, { status: 404 });
      }
      const ultima = existentes.sort((a, b) =>
        new Date(b.created_date) - new Date(a.created_date)
      )[0];
      if (!ultima.clave_privada_cifrada) {
        return Response.json({ error: 'Sin respaldo disponible' }, { status: 404 });
      }
      return Response.json({
        respaldoCifrado: ultima.clave_privada_cifrada,
        publicKeyBase64: ultima.clave_publica,
      });
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