import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarOcrNota
 * OCR de tickets/facturas. Patrón de la auditoría: Base44 InvokeLLM
 * PRIMARY (vision nativa) + Anthropic Claude FALLBACK.
 * Recibe file_url (la subida la hace el cliente con UploadFile).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_url, file_tipo } = body;

    if (!file_url) {
      return Response.json({
        success: false,
        ocr_raw: '',
        error: 'file_url requerido (usa UploadFile desde el cliente).',
      });
    }

    const prompt = `Analiza este ticket o factura española y extrae los campos clave en JSON:
- fecha_documento: fecha del documento en formato YYYY-MM-DD (no la fecha de hoy).
- importe: importe TOTAL final, como número (sin símbolo € ni separadores de miles; usa punto decimal, ej: 11.75).
- nombre_comercio: nombre del establecimiento emisor.
- nif_comercio: CIF/NIF del emisor, en mayúsculas (ej: A28986636).
- concepto: descripción breve del gasto (máx 60 caracteres).
- codigo_validacion_fiscal: número de factura simplificada o código fiscal si aparece; si no, cadena vacía.
- ocr_raw: transcripción COMPLETA del texto visible, línea por línea, tal cual aparece.`;

    const schema = {
      type: 'object',
      properties: {
        fecha_documento: { type: 'string' },
        importe: { type: 'number' },
        nombre_comercio: { type: 'string' },
        nif_comercio: { type: 'string' },
        concepto: { type: 'string' },
        codigo_validacion_fiscal: { type: 'string' },
        ocr_raw: { type: 'string' },
      },
    };

    const r = await ocrDocumento(base44, {
      file_url,
      file_tipo: file_tipo || 'image/jpeg',
      prompt,
      response_json_schema: schema,
    });

    if (!r.success) {
      return Response.json({ success: false, ocr_raw: '', error: r.error });
    }

    const datos = r.datos || {};
    const raw = datos.ocr_raw || r.ocr_raw || '';
    if (!raw || raw.length < 5) {
      return Response.json({ success: false, ocr_raw: '', error: 'Documento ilegible o vacío' });
    }

    return Response.json({
      success: true,
      datos,
      ocr_raw: raw,
      modelo: r.modelo,
      fallback: r.fallback,
    });
  } catch (error) {
    return Response.json({
      success: false,
      ocr_raw: '',
      error: String(error?.message || error).slice(0, 200),
    });
  }
});