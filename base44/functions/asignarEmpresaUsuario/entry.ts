import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Asigna un usuario a una empresa (y traslada su perfil laboral y sus datos
 * sensibles). Solo el propietario de la app puede hacerlo: es la operación con
 * la que se "mueve" a una persona a su espacio.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const esPropietario = user.es_propietario_global === true || user.role === 'propietario';
    if (!esPropietario) {
      return Response.json({ error: 'Solo el propietario puede asignar empresas' }, { status: 403 });
    }

    const { user_email, empresa_id } = await req.json();
    if (!user_email || !empresa_id) {
      return Response.json({ error: 'Faltan user_email y empresa_id' }, { status: 400 });
    }

    const empresa = await base44.asServiceRole.entities.Empresa.get(empresa_id);
    if (!empresa) return Response.json({ error: 'Empresa no encontrada' }, { status: 404 });

    const usuarios = await base44.asServiceRole.entities.User.list();
    const destino = usuarios.find(
      (u: any) => String(u.email || '').toLowerCase() === String(user_email).toLowerCase()
    );
    if (!destino) return Response.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const ahora = new Date().toISOString();

    await base44.asServiceRole.entities.User.update(destino.id, {
      empresa_id: empresa.id,
      empresa_nombre: empresa.nombre,
      fecha_vinculacion_empresa: ahora,
    });

    // Trasladar su perfil laboral y sus datos sensibles a la misma empresa
    const porUsuario = await base44.asServiceRole.entities.Operario.filter({ user_email: destino.email });
    const porEmail = await base44.asServiceRole.entities.Operario.filter({ email: destino.email });
    const operarios = [...porUsuario, ...porEmail].filter(
      (op: any, i: number, arr: any[]) => arr.findIndex((o) => o.id === op.id) === i
    );
    for (const op of operarios) {
      await base44.asServiceRole.entities.Operario.update(op.id, {
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
        empresa_cif: empresa.cif || '',
      });
    }

    const sensibles = await base44.asServiceRole.entities.DatosSensiblesUsuario.filter({
      user_email: destino.email,
    });
    for (const ds of sensibles) {
      await base44.asServiceRole.entities.DatosSensiblesUsuario.update(ds.id, {
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
      });
    }

    return Response.json({
      success: true,
      usuario: destino.email,
      empresa: empresa.nombre,
      operarios_movidos: operarios.length,
      datos_sensibles_movidos: sensibles.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});