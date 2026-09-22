import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';
import { OCR_CONFIG, derivarDeDocumento } from '../../shared/ingenieriaOcrConfig.ts';

const MAX_POR_EJECUCION = 10;
const MAX_INTENTOS = 3;

/**
 * procesarLoteDocumentosPendientes — cron cada 5 min (y disparo manual admin).
 * Procesa los MaterialDocumentoOrigen en estado 'pendiente_revision' que ya
 * tengan archivo subido: ejecuta el OCR según su tipo, persiste datos_extraidos,
 * deriva ItemLista/FichaTecnicaEquipo y marca 'procesado' (o 'error' tras reintentos).
 *
 * Patrón idéntoco a healthCheckDiario: GET = cron sin usuario; POST = manual con auth.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const esManual = req.method === 'POST';

    if (esManual) {
      try {
        const requester = await base44.auth.me();
        if (!requester || (requester.role !== 'gerencia' && requester.role !== 'admin' && requester.role !== 'propietario' && requester.role !== 'ingeniero')) {
          return Response.json({ error: 'Solo ingeniería/gerencia puede disparar el procesamiento manual' }, { status: 403 });
        }
      } catch (_) { /* sin usuario */ }
    }

    const pendientes = await base44.asServiceRole.entities.MaterialDocumentoOrigen.filter(
      { estado: 'pendiente_revision', archivo_url_mejorado: { $ne: '' } },
      'created_date',
      MAX_POR_EJECUCION
    );

    if (pendientes.length === 0) {
      return Response.json({ success: true, procesados: 0, mensaje: 'Sin documentos pendientes.' });
    }

    let ok = 0, errores = 0;
    const detalles = [];

    for (const doc of pendientes) {
      const cfg = OCR_CONFIG[doc.tipo];
      if (!cfg) {
        await base44.asServiceRole.entities.MaterialDocumentoOrigen.update(doc.id, { estado: 'error' });
        errores++;
        detalles.push({ id: doc.id, tipo: doc.tipo, error: 'tipo sin configuración OCR' });
        continue;
      }

      try {
        const r = await ocrDocumento(base44, {
          file_url: doc.archivo_url_mejorado,
          file_tipo: 'image/jpeg',
          prompt: cfg.prompt,
          response_json_schema: cfg.schema,
        });

        if (!r.success) throw new Error(r.error || 'OCR fallido');

        const datos = r.datos;
        const revFinal = doc.revision || datos.revision || '';
        const obraId = doc.proyecto_ingenieria_id || doc.obra_id || '';

        let derivados = 0;
        if (cfg.deriva) {
          const obra = await base44.asServiceRole.entities.Obra.get(obraId).catch(() => null);
          derivados = await derivarDeDocumento(base44, {
            docId: doc.id, tipo: doc.tipo, datos, revFinal, obraId,
            disciplina: obra?.disciplina_ingenieria,
          });
        }

        await base44.asServiceRole.entities.MaterialDocumentoOrigen.update(doc.id, {
          revision: revFinal,
          numero_documento: datos.numero_documento || doc.numero_documento || '',
          proveedor_nombre: datos.proveedor || doc.proveedor_nombre || '',
          fecha_documento: datos.fecha_documento || doc.fecha_documento,
          datos_extraidos: datos,
          estado: 'procesado',
          lineas_count: datos.puntos?.length || datos.lineas?.length || datos.componentes?.length || datos.instrumentos?.length || datos.equipos_candidatos?.length || 0,
        });

        ok++;
        detalles.push({ id: doc.id, tipo: doc.tipo, numero: datos.numero_documento || '', derivados, modelo: r.modelo, fallback: r.fallback });
      } catch (e) {
        const intentos = (doc.datos_extraidos?._intentos || 0) + 1;
        const estadoFinal = intentos >= MAX_INTENTOS ? 'error' : 'pendiente_revision';
        await base44.asServiceRole.entities.MaterialDocumentoOrigen.update(doc.id, {
          estado: estadoFinal,
          datos_extraidos: { ...(doc.datos_extraidos || {}), _intentos: intentos, _ultimo_error: String(e?.message || e).slice(0, 200) },
        });
        errores++;
        detalles.push({ id: doc.id, tipo: doc.tipo, error: String(e?.message || e).slice(0, 150), intentos });
      }
    }

    return Response.json({ success: true, procesados: ok, errores, total: pendientes.length, detalles });
  } catch (error) {
    return Response.json({ success: false, error: String(error?.message || error).slice(0, 300) }, { status: 500 });
  }
});