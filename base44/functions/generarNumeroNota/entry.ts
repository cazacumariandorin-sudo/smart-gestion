import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Obtener todas las notas del mes actual para calcular secuencia
    const notas = await base44.asServiceRole.entities.NotaGasto.list('-created_date', 500);
    const notasMes = notas.filter(n => {
      if (!n.numero_nota) return false;
      const parts = n.numero_nota.split('-');
      return parts[1] === String(year) && parts[3] === month;
    });

    const secuencia = notasMes.length + 1;
    const xx = String(secuencia).padStart(2, '0');
    const numero_nota = `NOT-${year}-${xx}-${month}`;

    return Response.json({ numero_nota, numero_secuencia: secuencia });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});