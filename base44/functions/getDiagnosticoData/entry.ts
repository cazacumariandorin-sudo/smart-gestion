import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Función backend para gestionar el módulo de Diagnóstico.
 * Permite acceso a usuarios autorizados en DiagnosticoAcceso (IT externo)
 * sin necesidad de cambiar su rol en el sistema.
 *
 * Acciones (body.action):
 *  - "list_sesiones"   → Devuelve DiagnosticoSesion (con filtros opcionales)
 *  - "get_sesion"      → Devuelve una sesión por id
 *  - "update_sesion"   → Actualiza estado/comentario de una sesión
 *  - "delete_sesion"   → Elimina una sesión
 *  - "list_accesos"    → Devuelve DiagnosticoAcceso
 *  - "create_acceso"   → Crea nuevo acceso (solo gerencia/admin)
 *  - "update_acceso"   → Actualiza acceso (solo gerencia/admin)
 *  - "delete_acceso"   → Elimina acceso (solo gerencia/admin)
 *  - "check_access"    → Verifica si el usuario actual tiene acceso
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list_sesiones';

    // Verificar acceso: admin, gerencia, o en DiagnosticoAcceso
    async function checkAuthorized() {
      if (user.role === 'admin' || user.role === 'gerencia') return { ok: true, isGerencia: true };
      const accesos = await base44.asServiceRole.entities.DiagnosticoAcceso.filter({
        user_email: user.email,
        activo: true
      });
      if (!accesos || accesos.length === 0) {
        return { ok: false };
      }
      // Verificar expiración si existe
      const acceso = accesos[0];
      if (acceso.fecha_expiracion && new Date(acceso.fecha_expiracion) < new Date()) {
        return { ok: false };
      }
      return { ok: true, isGerencia: false, acceso };
    }

    const authCheck = await checkAuthorized();
    if (!authCheck.ok) {
      return Response.json({ error: 'Forbidden — no autorizado al módulo de Diagnóstico' }, { status: 403 });
    }
    const isGerencia = authCheck.isGerencia;

    const sr = base44.asServiceRole;

    // ---- Listar sesiones ----
    if (action === 'list_sesiones') {
      const limit = Math.min(parseInt(body.limit || '100', 10), 500);
      const sort = body.sort || '-created_date';
      const filtro = {};
      if (body.user_email) filtro.user_email = body.user_email;
      if (body.tipo) filtro.tipo = body.tipo;
      if (body.estado) filtro.estado = body.estado;
      if (body.severidad) filtro.severidad = body.severidad;
      const sesiones = await sr.entities.DiagnosticoSesion.filter(filtro, sort, limit);
      return Response.json({ sesiones });
    }

    // ---- Obtener sesión por id ----
    if (action === 'get_sesion') {
      if (!body.sesion_id) return Response.json({ error: 'sesion_id requerido' }, { status: 400 });
      const sesion = await sr.entities.DiagnosticoSesion.get(body.sesion_id);
      return Response.json({ sesion });
    }

    // ---- Actualizar sesión (estado/comentario) ----
    if (action === 'update_sesion') {
      if (!body.sesion_id) return Response.json({ error: 'sesion_id requerido' }, { status: 400 });
      const update = {};
      if (body.estado) update.estado = body.estado;
      if (body.comentario_soporte !== undefined) update.comentario_soporte = body.comentario_soporte;
      if (body.severidad) update.severidad = body.severidad;
      update.revisado_por = user.email;
      update.fecha_revision = new Date().toISOString();
      const updated = await sr.entities.DiagnosticoSesion.update(body.sesion_id, update);
      return Response.json({ sesion: updated });
    }

    // ---- Eliminar sesión ----
    if (action === 'delete_sesion') {
      if (!body.sesion_id) return Response.json({ error: 'sesion_id requerido' }, { status: 400 });
      await sr.entities.DiagnosticoSesion.delete(body.sesion_id);
      return Response.json({ ok: true });
    }

    // ---- Gestión de accesos (solo gerencia/admin) ----
    if (action === 'list_accesos') {
      const accesos = await sr.entities.DiagnosticoAcceso.filter({}, '-created_date', 200);
      return Response.json({ accesos });
    }

    if (action === 'create_acceso') {
      if (!isGerencia) return Response.json({ error: 'Forbidden — solo Gerencia/Admin' }, { status: 403 });
      if (!body.user_email || !body.rol_asignado) {
        return Response.json({ error: 'user_email y rol_asignado requeridos' }, { status: 400 });
      }
      // Verificar que no exista ya
      const existentes = await sr.entities.DiagnosticoAcceso.filter({ user_email: body.user_email });
      if (existentes && existentes.length > 0) {
        // Reactivar si existía
        const updated = await sr.entities.DiagnosticoAcceso.update(existentes[0].id, {
          activo: true,
          rol_asignado: body.rol_asignado,
          user_name: body.user_name || existentes[0].user_name,
          autorizado_por: user.email,
          fecha_autorizacion: new Date().toISOString(),
          fecha_expiracion: body.fecha_expiracion || null,
          notas: body.notas || ''
        });
        return Response.json({ acceso: updated });
      }
      const nuevo = await sr.entities.DiagnosticoAcceso.create({
        user_email: body.user_email,
        user_id: body.user_id || null,
        user_name: body.user_name || '',
        rol_asignado: body.rol_asignado,
        autorizado_por: user.email,
        fecha_autorizacion: new Date().toISOString(),
        fecha_expiracion: body.fecha_expiracion || null,
        activo: true,
        notas: body.notas || ''
      });
      return Response.json({ acceso: nuevo });
    }

    if (action === 'update_acceso') {
      if (!isGerencia) return Response.json({ error: 'Forbidden — solo Gerencia/Admin' }, { status: 403 });
      if (!body.acceso_id) return Response.json({ error: 'acceso_id requerido' }, { status: 400 });
      const update = {};
      if (body.rol_asignado) update.rol_asignado = body.rol_asignado;
      if (body.activo !== undefined) update.activo = body.activo;
      if (body.user_name !== undefined) update.user_name = body.user_name;
      if (body.fecha_expiracion !== undefined) update.fecha_expiracion = body.fecha_expiracion;
      if (body.notas !== undefined) update.notas = body.notas;
      const updated = await sr.entities.DiagnosticoAcceso.update(body.acceso_id, update);
      return Response.json({ acceso: updated });
    }

    if (action === 'delete_acceso') {
      if (!isGerencia) return Response.json({ error: 'Forbidden — solo Gerencia/Admin' }, { status: 403 });
      if (!body.acceso_id) return Response.json({ error: 'acceso_id requerido' }, { status: 400 });
      await sr.entities.DiagnosticoAcceso.delete(body.acceso_id);
      return Response.json({ ok: true });
    }

    if (action === 'check_access') {
      return Response.json({
        autorizado: true,
        isGerencia,
        rol_asignado: authCheck.acceso?.rol_asignado || (isGerencia ? 'gerencia' : null),
        user_email: user.email,
        user_name: user.full_name || ''
      });
    }

    return Response.json({ error: 'Acción no reconocida: ' + action }, { status: 400 });
  } catch (error) {
    console.error('Error getDiagnosticoData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}