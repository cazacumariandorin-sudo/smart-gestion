import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Pasa automáticamente las previsiones 'planificada' a 'en_curso' cuando llega su fecha de inicio.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const hoy = new Date().toISOString().slice(0, 10);

    const planificadas = await base44.asServiceRole.entities.PrevisionObra.filter({ status: 'planificada' });
    const aActivar = planificadas.filter(p => p.fecha_inicio && p.fecha_inicio <= hoy);

    for (const p of aActivar) {
      await base44.asServiceRole.entities.PrevisionObra.update(p.id, { status: 'en_curso' });
    }

    return Response.json({ success: true, actualizadas: aActivar.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});