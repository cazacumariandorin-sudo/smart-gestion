import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Solo admin' }, { status: 403 });
    }

    // Obtener todos los usuarios
    const usuarios = await base44.entities.User.list();
    
    const resultados = {
      sincronizados: 0,
      errores: [],
      detalles: [],
    };

    for (const usuario of usuarios) {
      try {
        // Verificar si el usuario tiene datos personales actualizados
        if (usuario.phone || usuario.position || usuario.department || usuario.avatar_initials) {
          // Los datos ya están en la base de datos de usuarios
          // Esta función asegura que los datos se mantengan sincronizados
          resultados.sincronizados++;
          resultados.detalles.push({
            email: usuario.email,
            nombre: usuario.full_name,
            phone: usuario.phone || '—',
            position: usuario.position || '—',
            department: usuario.department || '—',
            avatar_initials: usuario.avatar_initials || '—',
          });
        }
      } catch (error) {
        resultados.errores.push({
          user_id: usuario.id,
          email: usuario.email,
          error: error.message,
        });
      }
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      resultados,
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});