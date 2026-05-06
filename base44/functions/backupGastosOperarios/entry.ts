import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Obtener todas las notas de gastos
    const notas = await base44.asServiceRole.entities.NotaGasto.list('-created_date', 2000);

    // Construir estructura de backup
    const backup = {
      timestamp: new Date().toISOString(),
      generado_por: user.email,
      version: '1.0',
      resumen: {
        total_notas: notas.length,
        total_importe: notas.reduce((s, n) => s + (n.importe || 0), 0).toFixed(2),
        por_estado: {},
        por_categoria: {},
        por_operario: {},
      },
      notas: notas,
      archivos: [],
    };

    // Calcular estadísticas
    notas.forEach(n => {
      backup.resumen.por_estado[n.estado] = (backup.resumen.por_estado[n.estado] || 0) + 1;
      backup.resumen.por_categoria[n.categoria] = (backup.resumen.por_categoria[n.categoria] || 0) + 1;
      if (n.operario_name) {
        if (!backup.resumen.por_operario[n.operario_name]) {
          backup.resumen.por_operario[n.operario_name] = { count: 0, total: 0 };
        }
        backup.resumen.por_operario[n.operario_name].count++;
        backup.resumen.por_operario[n.operario_name].total += (n.importe || 0);
      }
    });

    // Recopilar URLs de archivos únicos
    const archivosSet = new Set();
    notas.forEach(n => {
      (n.archivos || []).forEach(a => {
        if (a.url && !archivosSet.has(a.url)) {
          archivosSet.add(a.url);
          backup.archivos.push({
            url: a.url,
            nombre: a.nombre,
            tipo: a.tipo,
            operario: n.operario_name,
            nota: n.numero_nota,
            fecha: n.fecha_documento,
          });
        }
      });
    });
    backup.resumen.total_archivos = backup.archivos.length;

    // Subir backup como JSON
    const jsonContent = JSON.stringify(backup, null, 2);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(jsonContent);
    const blob = new Blob([bytes], { type: 'application/json' });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });

    return Response.json({
      success: true,
      file_url,
      resumen: backup.resumen,
      timestamp: backup.timestamp,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});