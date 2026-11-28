import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * El propietario aprueba o rechaza una solicitud de alta de empresa.
 * Aprobar NO da acceso a nadie: crea la empresa, su espacio y una invitación
 * de confirmación para el administrador local. El acceso llega solo cuando esa
 * persona confirma la invitación desde su propia sesión.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const esPropietario = user.es_propietario_global === true || user.role === 'propietario';
    if (!esPropietario) {
      return Response.json({ error: 'Solo el propietario decide las altas de empresa' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { solicitud_id, decision } = body;
    if (!['aprobar', 'rechazar'].includes(decision)) {
      return Response.json({ error: 'Falta decision (aprobar|rechazar)' }, { status: 400 });
    }

    let solicitud: any = null;

    if (solicitud_id) {
      solicitud = await base44.asServiceRole.entities.SolicitudEmpresa.get(solicitud_id).catch(() => null);
      if (!solicitud) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    } else if (decision === 'aprobar' && body.empresa) {
      // Alta directa del propietario: no hay solicitud previa, se registra aquí
      // con el mismo ciclo de vida (aprobada → confirmación del administrador).
      const e = body.empresa;
      if (!e.nombre_empresa || !e.cif) {
        return Response.json({ error: 'Nombre y CIF de la empresa son obligatorios' }, { status: 400 });
      }
      const adminEmail = String(body.admin_local_email || '').trim();
      if (!adminEmail) {
        return Response.json({ error: 'Indica el email del administrador local' }, { status: 400 });
      }
      const ahoraAlta = new Date().toISOString();
      solicitud = await base44.asServiceRole.entities.SolicitudEmpresa.create({
        nombre_empresa: e.nombre_empresa,
        cif: e.cif,
        actividad_principal: e.actividad_principal || '',
        telefono: e.telefono || '',
        email_empresa: e.email_empresa || '',
        domicilio: e.domicilio || '',
        localidad: e.localidad || '',
        provincia: e.provincia || '',
        codigo_postal: e.codigo_postal || '',
        web: e.web || '',
        solicitante_email: adminEmail,
        solicitante_nombre: body.admin_local_nombre || adminEmail,
        cargo: body.cargo || 'Administrador local',
        admin_local_email: adminEmail,
        admin_local_nombre: body.admin_local_nombre || adminEmail,
        origen: 'propietario',
        estado: 'pendiente',
        notas: body.comentario || '',
        historial: [
          {
            fecha: ahoraAlta,
            usuario_email: user.email,
            accion: 'alta_registrada_por_propietario',
            estado_anterior: null,
            estado_nuevo: 'pendiente',
            nota: '',
          },
        ],
      });
    } else {
      return Response.json({ error: 'Falta solicitud_id o los datos de la empresa' }, { status: 400 });
    }

    if (solicitud.estado !== 'pendiente') {
      // Idempotente: una solicitud ya decidida devuelve su estado, no se reprocesa.
      return Response.json({ success: true, ya_decidida: true, solicitud });
    }

    const ahora = new Date().toISOString();
    const historial = Array.isArray(solicitud.historial) ? solicitud.historial : [];
    const comentario = String(body.comentario || '').trim();

    if (decision === 'rechazar') {
      const actualizada = await base44.asServiceRole.entities.SolicitudEmpresa.update(solicitud.id, {
        estado: 'rechazada',
        decidido_por: user.email,
        decidido_en: ahora,
        comentario_decision: comentario || 'Solicitud rechazada',
        historial: [
          ...historial,
          {
            fecha: ahora,
            usuario_email: user.email,
            accion: 'rechazo',
            estado_anterior: 'pendiente',
            estado_nuevo: 'rechazada',
            nota: comentario || '',
          },
        ],
      });
      return Response.json({ success: true, solicitud: actualizada });
    }

    // ── Aprobar: empresa + espacio + invitación de confirmación ─────────────
    const cif = String(solicitud.cif || '').trim();
    const existentes = await base44.asServiceRole.entities.Empresa.list('-created_date', 200);
    let empresa = cif
      ? existentes.find((e: any) => String(e.cif || '').trim().toUpperCase() === cif.toUpperCase())
      : null;

    if (!empresa) {
      empresa = await base44.asServiceRole.entities.Empresa.create({
        nombre: solicitud.nombre_empresa,
        cif,
        actividad_principal: solicitud.actividad_principal || '',
        telefono: solicitud.telefono || '',
        email: solicitud.email_empresa || '',
        domicilio: solicitud.domicilio || '',
        localidad: solicitud.localidad || '',
        provincia: solicitud.provincia || '',
        codigo_postal: solicitud.codigo_postal || '',
        web: solicitud.web || '',
        activa: true,
        es_principal: false,
        empresa_id: '',
      });
      empresa = await base44.asServiceRole.entities.Empresa.update(empresa.id, { empresa_id: empresa.id });
    }

    const espacios = await base44.asServiceRole.entities.EspacioEmpresa.filter({ empresa_id: empresa.id });
    const adminEmail = String(body.admin_local_email || solicitud.admin_local_email || solicitud.solicitante_email).trim();
    const adminNombre = String(body.admin_local_nombre || solicitud.admin_local_nombre || solicitud.solicitante_nombre || adminEmail).trim();

    if (!espacios.length) {
      await base44.asServiceRole.entities.EspacioEmpresa.create({
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
        estado: 'pendiente_configuracion',
        plan: 'completo',
        fecha_alta: ahora.slice(0, 10),
        admin_local_email: adminEmail,
        admin_local_nombre: adminNombre,
        checklist: [
          { clave: 'espacio_creado', etiqueta: 'Espacio Base44 creado para la empresa', hecho: true, fecha: ahora },
          { clave: 'app_publicada', etiqueta: 'App publicada en el espacio', hecho: false },
          { clave: 'admin_local', etiqueta: 'Administrador local invitado', hecho: true, fecha: ahora },
          { clave: 'plan_asignado', etiqueta: 'Plan comercial asignado', hecho: false },
          { clave: 'acceso_verificado', etiqueta: 'Acceso y aislamiento verificados', hecho: false },
        ],
        actualizado_por: user.email,
        actualizado_en: ahora,
      });
    }

    // Invitación de confirmación (reutiliza una pendiente del mismo email y empresa)
    const invitaciones = await base44.asServiceRole.entities.InvitacionUsuario.filter({
      email: adminEmail,
      empresa_id: empresa.id,
      estado: 'pendiente_activacion',
    });

    let invitacion = invitaciones[0];
    if (!invitacion) {
      invitacion = await base44.asServiceRole.entities.InvitacionUsuario.create({
        email: adminEmail,
        rol: 'admin',
        tipo: 'administrador_local',
        full_name: adminNombre,
        cargo: solicitud.cargo || 'Administrador local',
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre,
        estado: 'pendiente_activacion',
        confirmada: false,
        solicitud_empresa_id: solicitud.id,
        invitado_por: user.email,
        fecha_invitacion: ahora,
        historial: [
          {
            fecha: ahora,
            usuario_email: user.email,
            accion: 'invitacion_creada',
            nota: 'Aprobación de la solicitud de alta de empresa',
          },
        ],
      });
    }

    const actualizada = await base44.asServiceRole.entities.SolicitudEmpresa.update(solicitud.id, {
      estado: 'aprobada',
      empresa_id: empresa.id,
      empresa_nombre: empresa.nombre,
      invitacion_id: invitacion.id,
      admin_local_email: adminEmail,
      admin_local_nombre: adminNombre,
      decidido_por: user.email,
      decidido_en: ahora,
      comentario_decision: comentario || 'Alta aprobada',
      historial: [
        ...historial,
        {
          fecha: ahora,
          usuario_email: user.email,
          accion: 'aprobacion',
          estado_anterior: 'pendiente',
          estado_nuevo: 'aprobada',
          nota: comentario || '',
        },
        {
          fecha: ahora,
          usuario_email: user.email,
          accion: 'invitacion_confirmacion_enviada',
          estado_anterior: null,
          estado_nuevo: null,
          nota: `Invitación a ${adminEmail}`,
        },
      ],
    });

    // Aviso por email de la plataforma solo si la cuenta aún no existe.
    const usuarios = await base44.asServiceRole.entities.User.list();
    const yaExiste = usuarios.some(
      (u: any) => String(u.email || '').toLowerCase() === adminEmail.toLowerCase()
    );
    if (!yaExiste) {
      try {
        await base44.users.inviteUser(adminEmail, 'admin');
      } catch (_) {
        // La invitación interna ya está registrada; el aviso es best-effort.
      }
    }

    return Response.json({
      success: true,
      solicitud: actualizada,
      empresa_id: empresa.id,
      invitacion_id: invitacion.id,
      admin_local_email: adminEmail,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});