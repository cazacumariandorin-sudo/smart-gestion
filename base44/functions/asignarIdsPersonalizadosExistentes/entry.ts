import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Solo admin puede ejecutar esta función
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const todosUsuarios = await base44.asServiceRole.entities.User.list();
    const resultados = { actualizados: 0, errores: [], detalles: [] };

    // Procesar usuarios sin ID personalizado
    for (const usuario of todosUsuarios) {
      if (!usuario.user_id_personalizado && usuario.fecha_registro) {
        try {
          const fecha = new Date(usuario.fecha_registro);
          const year = fecha.getFullYear();
          
          // Obtener usuarios del mismo año
          const usuariosMismoAno = todosUsuarios.filter(u => {
            if (!u.fecha_registro || !u.user_id_personalizado) return false;
            const userYear = new Date(u.fecha_registro).getFullYear();
            return userYear === year;
          });

          // Calcular siguiente número secuencial
          let maxSecuencial = 0;
          usuariosMismoAno.forEach(u => {
            if (u.user_id_personalizado) {
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

          // Actualizar usuario
          await base44.asServiceRole.entities.User.update(usuario.id, {
            user_id_personalizado: idPersonalizado
          });

          resultados.actualizados++;
          resultados.detalles.push({
            email: usuario.email,
            id: usuario.id,
            user_id_personalizado: idPersonalizado,
            fecha_registro: usuario.fecha_registro
          });

        } catch (error) {
          resultados.errores.push({
            email: usuario.email,
            error: error.message
          });
        }
      }
    }

    return Response.json({
      success: true,
      message: `Se actualizaron ${resultados.actualizados} usuarios`,
      resultados
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});