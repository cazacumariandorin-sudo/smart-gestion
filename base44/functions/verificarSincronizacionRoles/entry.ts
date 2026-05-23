import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Solo admin' }, { status: 403 });
    }

    const resultados = {
      total_usuarios: 0,
      total_operarios: 0,
      roles_sincronizados: 0,
      roles_reparados: 0,
      discrepancias: [],
      errores: [],
    };

    // 1. Obtener todos los usuarios
    const usuarios = await base44.asServiceRole.entities.User.list();
    resultados.total_usuarios = usuarios.length;

    for (const usuario of usuarios) {
      try {
        // 2. Buscar operarios vinculados a este usuario
        const operarios = await base44.asServiceRole.entities.Operario.filter({
          user_id: usuario.id
        });

        resultados.total_operarios += operarios.length;

        // 3. Verificar si el rol coincide
        for (const operario of operarios) {
          if (operario.role !== usuario.role) {
            resultados.discrepancias.push({
              usuario_email: usuario.email,
              usuario_nombre: usuario.full_name,
              usuario_id: usuario.id,
              operario_id: operario.id,
              operario_nombre: operario.name,
              rol_usuario: usuario.role,
              rol_operario: operario.role,
            });

            // 4. Reparar: actualizar rol del operario
            await base44.asServiceRole.entities.Operario.update(operario.id, {
              role: usuario.role
            });

            resultados.roles_reparados++;
          } else {
            resultados.roles_sincronizados++;
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
      resumen: {
        total_usuarios: resultados.total_usuarios,
        total_operarios: resultados.total_operarios,
        roles_sincronizados: resultados.roles_sincronizados,
        roles_reparados: resultados.roles_reparados,
        discrepancias_encontradas: resultados.discrepancias.length,
      },
      discrepancias: resultados.discrepancias,
      errores: resultados.errores,
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});