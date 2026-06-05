import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Envía por email el link de invitación demo al destinatario.
 * Requiere: codigo, email_destino, generada_por_nombre, duracion_dias
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'gerencia', 'director_comercial'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { codigo, email_destino, generada_por_nombre, duracion_dias } = await req.json();

    if (!email_destino || !codigo) {
      return Response.json({ error: 'email_destino y codigo son requeridos' }, { status: 400 });
    }

    const link = `${Deno.env.get('APP_BASE_URL') || 'https://smart-gestion.base44.app'}/demo-join?codigo=${codigo}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email_destino,
      subject: 'Invitación de acceso demo a SMART-GESTIÓN',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Has recibido una invitación de acceso demo</h2>
          <p style="color: #475569;">
            <strong>${generada_por_nombre || 'El equipo de SIMANTEC'}</strong> te ha invitado a explorar 
            <strong>SMART-GESTIÓN</strong> de forma gratuita durante <strong>${duracion_dias} días</strong>.
          </p>
          <div style="margin: 32px 0;">
            <a href="${link}" 
               style="background-color: #3b82f6; color: white; padding: 14px 28px; 
                      border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Acceder al Demo →
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">
            O copia este enlace en tu navegador:<br/>
            <a href="${link}" style="color: #3b82f6;">${link}</a>
          </p>
          <p style="color: #94a3b8; font-size: 12px;">
            Este enlace caduca en ${duracion_dias} días. Si no esperabas este email, puedes ignorarlo.
          </p>
        </div>
      `,
    });

    return Response.json({ success: true, message: `Email enviado a ${email_destino}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});