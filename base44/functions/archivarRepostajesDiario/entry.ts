import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Archiva automáticamente los avisos de repostaje del día a las 23:59 (hora local).
// Pone avisos_visible=false y registra fecha_archivado. Una vez archivados, solo
// gerencia/administración puede verlos (controlado por RLS), quedando accesibles
// para los reportes semanal/mensual/anual.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const hoy = new Date().toISOString().split('T')[0];

    const res = await base44.asServiceRole.entities.AlertaVehiculo.updateMany(
      { tipo: 'repostaje', avisos_visible: { $ne: false } },
      {
        $set: {
          avisos_visible: false,
          fecha_archivado: hoy,
        },
      }
    );

    return Response.json({
      success: true,
      fecha: hoy,
      archivadas: res?.modifiedCount ?? 0,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});