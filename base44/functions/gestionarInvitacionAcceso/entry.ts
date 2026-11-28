import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Ciclo de vida de una invitación. El acceso se concede SOLO en `confirmar`,
 * y solo si la sesión pertenece al email invitado. Ninguna otra acción asigna
 * empresa ni rol.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion || '');
    const esPropietario = user.es_propietario_global === true || user.role === 'propietario';
    const ahora = new Date().toISOString();
    const emailSesion = String(user.email || '').toLowerCase();

    // ── Mi invitación pendiente ────────────────────────────────────────────
    if (accion === 'miPendiente') {
      const mias = await base44.asServiceRole.entities.InvitacionUsuario.filter({
        email: user.email,
        estado: 'pendiente_activacion',
      });
      const invitacion = mias.sort(
        (a: any, b: any) => String(b.fecha_invitacion || '').localeCompare(String(a.fecha_invitacion || ''))
      )[0] || null;
      return Response.json({
        success: true,
        invitacion,
        ya_tiene_empresa: !!user.empresa_id,
      });
    }

    const { invitacion_id } = body;
    if (!invitacion_id) return Response.json({ error: 'Falta invitacion_id' }, { status: 400 });

    const invitacion = await base44.asServiceRole.entities.InvitacionUsuario.get(invitacion_id).catch(() => null);
    if (!invitacion) return Response.json({ error: 'Invitación no encontrada' }, { status: 404 });

    const esInvitado = String(invitacion.email || '').toLowerCase() === emailSesion;
    const esAdminDeLaEmpresa = !!user.empresa_id
      && user.empresa_id === invitacion.empresa_id
      && ['admin', 'gerencia'].includes(user.role);
    const historial = Array.isArray(invitacion.historial) ? invitacion.historial : [];

    // ── Confirmar (solo la persona invitada) ───────────────────────────────
    if (accion === 'confirmar') {
      if (!esInvitado) {
        return Response.json({ error: 'Esta invitación no corresponde a tu cuenta' }, { status: 403 });
      }
      if (invitacion.estado !== 'pendiente_activacion') {
        return Response.json({ error: `La invitación no está pendiente (${invitacion.estado})` }, { status: 409 });
      }
      if (user.empresa_id && user.empresa_id !== invitacion.empresa_id) {
        return Response.json(
          { error: 'Tu acceso ya pertenece a otra empresa. El propietario debe autorizar el cambio.' },
          { status: 409 }
        );
      }

      const empresa = await base44.asServiceRole.entities.Empresa.get(invitacion.empresa_id).catch(() => null);
      if (!empresa) return Response.json({ error: 'La empresa de la invitación ya no existe' }, { status: 404 });
      if (empresa.activa === false) {
        return Response.json({ error: 'La empresa está desactivada' }, { status: 409 });
      }

      const rol = invitacion.rol || 'operario';

      await base44.asServiceRole.entities.User.update(user.id, {
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
        role: rol,
        cargo: invitacion.cargo || user.cargo || '',
        estado_cuenta: 'activo',
        tipo_cuenta: 'real',
        invitado_por: invitacion.invitado_por || null,
        fecha_vinculacion_empresa: ahora,
        acceso_hasta: invitacion.acceso_hasta || null,
      });

      await base44.asServiceRole.entities.InvitacionUsuario.update(invitacion.id, {
        estado: 'activado',
        confirmada: true,
        confirmada_en: ahora,
        confirmada_por_email: user.email,
        user_id_registrado: user.id,
        fecha_aceptacion: ahora,
        historial: [
          ...historial,
          { fecha: ahora, usuario_email: user.email, accion: 'confirmada', nota: 'Acceso aceptado por el invitado' },
        ],
      });

      if (invitacion.tipo === 'administrador_local') {
        const espacios = await base44.asServiceRole.entities.EspacioEmpresa.filter({ empresa_id: empresa.id });
        const espacio = espacios[0];
        const checklist = (espacio?.checklist || []).map((p: any) =>
          p.clave === 'admin_local' ? { ...p, hecho: true, fecha: ahora } : p
        );
        if (espacio) {
          await base44.asServiceRole.entities.EspacioEmpresa.update(espacio.id, {
            admin_local_email: user.email,
            admin_local_nombre: user.full_name || user.email,
            admin_local_user_id: user.id,
            estado: espacio.estado === 'pendiente_configuracion' ? 'configurado' : espacio.estado,
            checklist,
            actualizado_por: user.email,
            actualizado_en: ahora,
          });
        } else {
          await base44.asServiceRole.entities.EspacioEmpresa.create({
            empresa_id: empresa.id,
            empresa_nombre: empresa.nombre,
            estado: 'configurado',
            plan: 'completo',
            fecha_alta: ahora.slice(0, 10),
            admin_local_email: user.email,
            admin_local_nombre: user.full_name || user.email,
            admin_local_user_id: user.id,
            checklist,
            actualizado_por: user.email,
            actualizado_en: ahora,
          });
        }
      }

      if (invitacion.solicitud_empresa_id) {
        const solicitud = await base44.asServiceRole.entities.SolicitudEmpresa
          .get(invitacion.solicitud_empresa_id).catch(() => null);
        if (solicitud) {
          const h = Array.isArray(solicitud.historial) ? solicitud.historial : [];
          await base44.asServiceRole.entities.SolicitudEmpresa.update(solicitud.id, {
            estado: 'confirmada',
            confirmada_en: ahora,
            confirmada_por_email: user.email,
            historial: [
              ...h,
              { fecha: ahora, usuario_email: user.email, accion: 'confirmacion', estado_anterior: 'aprobada', estado_nuevo: 'confirmada', nota: '' },
            ],
          });
        }
      }

      return Response.json({
        success: true,
        empresa: { id: empresa.id, nombre: empresa.nombre },
        rol,
      });
    }

    // ── Rechazar (solo la persona invitada) ────────────────────────────────
    if (accion === 'rechazar') {
      if (!esInvitado) {
        return Response.json({ error: 'Esta invitación no corresponde a tu cuenta' }, { status: 403 });
      }
      if (invitacion.estado !== 'pendiente_activacion') {
        return Response.json({ error: 'La invitación ya no está pendiente' }, { status: 409 });
      }
      const motivo = String(body.motivo || '').trim();
      await base44.asServiceRole.entities.InvitacionUsuario.update(invitacion.id, {
        estado: 'rechazada',
        confirmada: false,
        motivo_suspension: motivo || 'Rechazada por la persona invitada',
        historial: [
          ...historial,
          { fecha: ahora, usuario_email: user.email, accion: 'rechazada', nota: motivo || '' },
        ],
      });
      if (invitacion.solicitud_empresa_id) {
        const solicitud = await base44.asServiceRole.entities.SolicitudEmpresa
          .get(invitacion.solicitud_empresa_id).catch(() => null);
        if (solicitud) {
          const h = Array.isArray(solicitud.historial) ? solicitud.historial : [];
          await base44.asServiceRole.entities.SolicitudEmpresa.update(solicitud.id, {
            estado: 'anulada',
            comentario_decision: motivo || 'Invitación rechazada por el administrador propuesto',
            historial: [
              ...h,
              { fecha: ahora, usuario_email: user.email, accion: 'anulada', estado_anterior: 'aprobada', estado_nuevo: 'anulada', nota: motivo || '' },
            ],
          });
        }
      }
      return Response.json({ success: true });
    }

    // ── Reenviar / revocar (propietario o administrador de la empresa) ─────
    if (!esPropietario && !esAdminDeLaEmpresa) {
      return Response.json({ error: 'No puedes gestionar esta invitación' }, { status: 403 });
    }

    if (accion === 'reenviar') {
      await base44.asServiceRole.entities.InvitacionUsuario.update(invitacion.id, {
        estado: 'pendiente_activacion',
        confirmada: false,
        fecha_invitacion: ahora,
        historial: [
          ...historial,
          { fecha: ahora, usuario_email: user.email, accion: 'reenviada', nota: '' },
        ],
      });
      try {
        await base44.users.inviteUser(invitacion.email, invitacion.rol === 'admin' ? 'admin' : 'user');
      } catch (_) { /* el aviso por email es best-effort */ }
      return Response.json({ success: true });
    }

    if (accion === 'revocar') {
      await base44.asServiceRole.entities.InvitacionUsuario.update(invitacion.id, {
        estado: 'suspendido',
        suspendido_por: user.email,
        fecha_suspension: ahora,
        motivo_suspension: String(body.motivo || '').trim() || 'Revocada',
        historial: [
          ...historial,
          { fecha: ahora, usuario_email: user.email, accion: 'revocada', nota: String(body.motivo || '').trim() },
        ],
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: `Acción no reconocida: ${accion}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});