import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Roles que pueden consultar el listado de usuarios del equipo y activar/desactivar cuentas.
const ROLES_AUTORIZADOS = ['admin', 'propietario', 'gerencia', 'administracion'];
const ESTADOS_VALIDOS = ['activo', 'inactivo', 'pendiente_activacion', 'suspendido'];
const CAMPOS = [
  'full_name', 'email', 'role', 'cargo', 'avatar_initials', 'tipo_cuenta',
  'estado_cuenta', 'acceso_hasta', 'demo_expires_at', 'invitado_por',
  'vinculo_estado', 'vinculo_nombre', 'vinculo_tipo', 'vinculo_id',
  'user_id_personalizado', 'suspendido_por', 'fecha_suspension', 'motivo_suspension',
  'created_date',
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_AUTORIZADOS.includes(user.role)) {
      return Response.json({ error: 'No tienes permisos para gestionar usuarios' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'listar';

    if (action === 'listar') {
      const todos = await base44.asServiceRole.entities.User.list();
      const usuarios = todos
        .map((u) => {
          const out: Record<string, unknown> = { id: u.id };
          for (const campo of CAMPOS) out[campo] = u[campo] ?? null;
          return out;
        })
        .sort((a, b) => String(a.full_name || a.email || '').localeCompare(String(b.full_name || b.email || ''), 'es'));
      return Response.json({ usuarios, total: usuarios.length });
    }

    if (action === 'cambiar_estado') {
      const { userId, estado } = body;
      if (!userId || !ESTADOS_VALIDOS.includes(estado)) {
        return Response.json({ error: 'Parámetros inválidos' }, { status: 400 });
      }
      if (userId === user.id) {
        return Response.json({ error: 'No puedes cambiar el estado de tu propia cuenta' }, { status: 400 });
      }
      const patch: Record<string, unknown> = { estado_cuenta: estado };
      if (estado === 'suspendido') {
        patch.suspendido_por = user.email;
        patch.fecha_suspension = new Date().toISOString();
      }
      const cuenta = await base44.asServiceRole.entities.User.get(userId);
      await base44.asServiceRole.entities.User.update(userId, patch);

      // La ficha laboral (Operario.active) es lo que leen los selectores de los módulos
      // (adelantos, partes, horario, gastos...). Se sincroniza con la cuenta para que
      // Sistema > Usuarios y el resto de la app no muestren estados distintos.
      const activo = estado === 'activo';
      let fichas = await base44.asServiceRole.entities.Operario.filter({ user_id: userId });
      if (!fichas.length && cuenta?.email) {
        fichas = await base44.asServiceRole.entities.Operario.filter({ user_email: cuenta.email });
      }
      for (const ficha of fichas) {
        if ((ficha.active !== false) !== activo) {
          await base44.asServiceRole.entities.Operario.update(ficha.id, { active: activo });
        }
      }

      return Response.json({ success: true, estado, fichas_actualizadas: fichas.length });
    }

    return Response.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}