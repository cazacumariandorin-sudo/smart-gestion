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
        // 1. Sincronizar datos personales
        if (usuario.phone || usuario.position || usuario.department || usuario.avatar_initials) {
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

        // 2. Sincronizar rol con Operario vinculado
        const operarios = await base44.asServiceRole.entities.Operario.filter({
          user_id: usuario.id
        });

        for (const operario of operarios) {
          // Si el rol difiere, actualizar operario
          if (operario.role !== usuario.role) {
            await base44.asServiceRole.entities.Operario.update(operario.id, {
              role: usuario.role
            });
            resultados.detalles.push({
              operario_id: operario.id,
              operario_nombre: operario.name,
              usuario_email: usuario.email,
              rol_anterior: operario.role,
              rol_nuevo: usuario.role,
              sincronizacion: 'rol_actualizado'
            });
          }
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