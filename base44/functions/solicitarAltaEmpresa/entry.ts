import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Alta de empresa solicitada por la propia persona.
 * No concede ningún acceso: crea una solicitud pendiente que el propietario
 * debe aprobar. La identidad sale de la sesión; cualquier empresa_id enviado
 * por el cliente se ignora.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const nombre = String(body.nombre_empresa || '').trim();
    const cif = String(body.cif || '').trim();
    if (!nombre || !cif) {
      return Response.json({ error: 'El nombre y el CIF de la empresa son obligatorios' }, { status: 400 });
    }

    // Un acceso ya asignado no solicita otra empresa: se gestiona como traslado.
    if (user.empresa_id) {
      return Response.json(
        { error: 'Tu acceso ya está asignado a una empresa. Para cambiarla, pide al propietario un traslado.' },
        { status: 400 }
      );
    }

    const email = String(user.email || '').toLowerCase();
    const propias = await base44.asServiceRole.entities.SolicitudEmpresa.filter({
      solicitante_email: user.email,
    });
    const pendiente = propias.find((s: any) => s.estado === 'pendiente');
    if (pendiente) {
      // Idempotente: no se duplica una solicitud ya en curso.
      return Response.json({ success: true, solicitud: pendiente, ya_existia: true });
    }

    const ahora = new Date().toISOString();
    const solicitud = await base44.asServiceRole.entities.SolicitudEmpresa.create({
      nombre_empresa: nombre,
      cif,
      actividad_principal: body.actividad_principal || '',
      telefono: body.telefono || '',
      email_empresa: body.email_empresa || '',
      domicilio: body.domicilio || '',
      localidad: body.localidad || '',
      provincia: body.provincia || '',
      codigo_postal: body.codigo_postal || '',
      web: body.web || '',
      solicitante_email: user.email,
      solicitante_nombre: user.full_name || user.email,
      solicitante_user_id: user.id,
      cargo: body.cargo || '',
      admin_local_email: email,
      admin_local_nombre: user.full_name || user.email,
      origen: 'registro',
      estado: 'pendiente',
      notas: body.notas || '',
      historial: [
        {
          fecha: ahora,
          usuario_email: user.email,
          accion: 'solicitud_alta_empresa',
          estado_anterior: null,
          estado_nuevo: 'pendiente',
          nota: 'Alta solicitada desde el registro',
        },
      ],
    });

    return Response.json({ success: true, solicitud });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});