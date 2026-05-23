import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar que es una llamada de automatización (service role)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, fechaRegistro } = await req.json();
    
    if (!userId || !fechaRegistro) {
      return Response.json({ error: 'userId and fechaRegistro are required' }, { status: 400 });
    }

    const fecha = new Date(fechaRegistro);
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const fechaStr = `${year}-${month}-${day}`;

    // Obtener todos los usuarios para calcular el secuencial
    const todosUsuarios = await base44.asServiceRole.entities.User.list();
    
    // Filtrar usuarios del mismo año
    const usuariosMismoAno = todosUsuarios.filter(u => {
      if (!u.fecha_registro || !u.user_id_personalizado) return false;
      const userYear = new Date(u.fecha_registro).getFullYear();
      return userYear === year;
    });

    // Calcular el siguiente número secuencial
    let maxSecuencial = 0;
    usuariosMismoAno.forEach(u => {
      if (u.user_id_personalizado) {
        // Extraer el número secuencial del ID personalizado (YYYY-NNNN)
        const partes = u.user_id_personalizado.split('-');
        if (partes.length === 2) {
          const secuencial = parseInt(partes[1], 10);
          if (!isNaN(secuencial) && secuencial > maxSecuencial) {
            maxSecuencial = secuencial;
          }
        }
      }
    });

    const nuevoSecuencial = maxSecuencial + 1;
    const idPersonalizado = `${year}-${String(nuevoSecuencial).padStart(4, '0')}`;

    // Actualizar el usuario con el ID personalizado
    await base44.asServiceRole.entities.User.update(userId, {
      user_id_personalizado: idPersonalizado
    });

    return Response.json({ 
      success: true, 
      user_id_personalizado: idPersonalizado,
      message: `ID personalizado generado: ${idPersonalizado}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});