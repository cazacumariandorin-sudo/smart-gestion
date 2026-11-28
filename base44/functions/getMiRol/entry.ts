import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Devuelve el rol real del usuario autenticado leyendo la entidad User
 * con asServiceRole, evitando problemas de RLS cuando el JWT tiene un rol
 * desactualizado (ej: token con 'operario' pero entidad con 'gerencia').
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Usar asServiceRole para que la query no dependa del rol del JWT activo
    // ACC-01: normalizar email para evitar fallos por mayúsculas (Google/Apple pueden devolver casing distinto)
    const cleanEmail = currentUser.email.toLowerCase().trim();
    const records = await base44.asServiceRole.entities.User.filter(
      { email: cleanEmail },
      '-created_date',
      1
    );

    if (!records || records.length === 0) {
      return Response.json({ role: currentUser.role || 'operario', source: 'token_fallback' });
    }

    const entityUser = records[0];

    // Buscar operario vinculado por email para obtener operario_id canónico
    let operario_id = entityUser.vinculo_id || null;
    let operario_name = entityUser.vinculo_nombre || null;
    try {
      const opRecords = await base44.asServiceRole.entities.Operario.filter(
        { user_email: cleanEmail },
        '-vinculacion_fecha',
        1
      );
      if (opRecords && opRecords.length > 0) {
        operario_id = opRecords[0].id;
        operario_name = opRecords[0].name;
      }
    } catch (_) { /* no bloquear si falla */ }

    return Response.json({
      role: entityUser.role || currentUser.role || 'operario',
      cargo: entityUser.cargo || '',
      tipo_cuenta: entityUser.tipo_cuenta || 'real',
      demo_expires_at: entityUser.demo_expires_at || null,
      invitado_por: entityUser.invitado_por || null,
      acceso_hasta: entityUser.acceso_hasta || null,
      vinculo_id: entityUser.vinculo_id || null,
      operario_id,
      operario_name,
      user_entity_id: entityUser.id,
      empresa_id: entityUser.empresa_id || null,
      empresa_nombre: entityUser.empresa_nombre || null,
      es_propietario_global: entityUser.es_propietario_global === true,
      source: 'entity',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});