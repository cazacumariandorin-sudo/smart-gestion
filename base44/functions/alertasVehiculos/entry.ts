import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (no user) or admin
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      isScheduled = true; // called from scheduler without user token
    }

    const vehiculos = await base44.asServiceRole.entities.Vehiculo.list();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ALERTAS_DIAS = [15, 5, 1];

    const checks = [
      { campo: 'itv_fecha',    label: 'ITV' },
      { campo: 'aceite_fecha', label: 'Cambio de aceite' },
      { campo: 'filtros_fecha',label: 'Cambio de filtros' },
      { campo: 'ac_fecha',     label: 'Revisión A/C' },
    ];

    const sent = [];

    for (const v of vehiculos) {
      if (!v.alertas_activas) continue;
      const emails = (v.alertas_email || '').split(',').map(e => e.trim()).filter(Boolean);
      if (emails.length === 0) continue;

      for (const check of checks) {
        const fechaStr = v[check.campo];
        if (!fechaStr) continue;

        const fecha = new Date(fechaStr);
        fecha.setHours(0, 0, 0, 0);
        const diffMs = fecha - today;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (!ALERTAS_DIAS.includes(diffDays)) continue;

        const asunto = `⚠️ ${check.label} vence en ${diffDays} día${diffDays > 1 ? 's' : ''} — ${v.matricula}`;
        const cuerpo = `
          <div style="font-family:sans-serif;max-width:500px">
            <h2 style="color:#e95d0c">⚠️ Alerta de mantenimiento</h2>
            <p><strong>Vehículo:</strong> ${v.matricula} — ${v.modelo}</p>
            <p><strong>Tipo:</strong> ${check.label}</p>
            <p><strong>Fecha caducidad:</strong> ${new Date(fechaStr).toLocaleDateString('es-ES')}</p>
            <p><strong>Días restantes:</strong> <span style="color:${diffDays <= 1 ? '#dc2626' : diffDays <= 5 ? '#f59e0b' : '#2563eb'}">${diffDays} día${diffDays > 1 ? 's' : ''}</span></p>
            ${v.asignado_a ? `<p><strong>Asignado a:</strong> ${v.asignado_a}</p>` : ''}
            <hr/>
            <p style="color:#64748b;font-size:12px">SIMANTEC — Gestión de Vehículos</p>
          </div>
        `;

        for (const email of emails) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: asunto,
            body: cuerpo,
            from_name: 'SIMANTEC Vehículos',
          });
          sent.push({ vehiculo: v.matricula, check: check.label, diffDays, email });
        }
      }
    }

    return Response.json({ ok: true, alertas_enviadas: sent.length, detalle: sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});