import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * procesarOcrNota — implementación mínima y robusta.
 * Recibe cdn_url (URL pública de Base44 CDN) y ejecuta OCR + IA.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { cdn_url, ocr_raw: ocr_input, fase } = body;

    // Fase IA: re-analizar texto OCR ya existente
    if (fase === 'ia' && ocr_input) {
      try {
        const datos = await analizarIA(base44, ocr_input);
        return Response.json({ success: true, datos, ia_ok: true });
      } catch (e) {
        return Response.json({ success: false, ia_ok: false, error: e.message });
      }
    }

    // Fase OCR+IA automático (por defecto)
    if (!cdn_url) {
      return Response.json({ success: false, needs_manual: true, error: 'cdn_url requerido' });
    }

    // Validar que es una URL accesible (no Drive, no base64)
    if (cdn_url.startsWith('data:') || cdn_url.includes('drive.google.com')) {
      return Response.json({ success: false, needs_manual: true, error: 'URL no accesible' });
    }

    // OCR
    let ocr_raw = '';
    try {
      const texto = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un motor OCR para tickets y facturas en España. Transcribe EXACTAMENTE todo el texto visible en este documento, línea por línea. Incluye todos los números (importes, fechas, NIFs). No interpretes, no resumas. Solo transcribe.`,
        file_urls: [cdn_url],
      });
      ocr_raw = (typeof texto === 'string' ? texto : JSON.stringify(texto)).trim();
    } catch (e) {
      return Response.json({ success: false, needs_manual: true, ocr_raw: '', error: 'OCR fallido: ' + e.message });
    }

    if (!ocr_raw || ocr_raw.length < 5) {
      return Response.json({ success: false, needs_manual: true, ocr_raw: '', error: 'Documento ilegible' });
    }

    // IA
    let datos = null;
    let ia_ok = false;
    try {
      datos = await analizarIA(base44, ocr_raw);
      ia_ok = true;
    } catch (_) {
      ia_ok = false;
    }

    return Response.json({ success: ia_ok, ocr_raw, datos, ia_ok, needs_manual: !ia_ok });

  } catch (error) {
    return Response.json({ success: false, needs_manual: true, error: error.message });
  }
});

async function analizarIA(base44: any, ocr_raw: string) {
  return await base44.integrations.Core.InvokeLLM({
    prompt: `Analiza este texto OCR de un ticket/factura español y extrae los datos en JSON.

TEXTO:
${ocr_raw}

Devuelve SOLO este JSON (null para campos no encontrados):
{
  "concepto": "descripción del gasto",
  "importe": 0.00,
  "nombre_comercio": "nombre del establecimiento",
  "nif_comercio": null,
  "fecha_documento": "YYYY-MM-DD",
  "categoria_sugerida": "comida|combustible|material|peaje|parking|otros",
  "confianza": "alta|media|baja"
}

Para importe usa el TOTAL final. Para fecha usa formato YYYY-MM-DD.`,
    response_json_schema: {
      type: 'object',
      properties: {
        concepto: { type: 'string' },
        importe: { type: 'number' },
        nombre_comercio: { type: 'string' },
        nif_comercio: { type: 'string' },
        fecha_documento: { type: 'string' },
        categoria_sugerida: { type: 'string' },
        confianza: { type: 'string' },
      },
    },
  });
}