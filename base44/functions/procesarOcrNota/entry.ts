import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * procesarOcrNota — recibe file_base64 comprimido del frontend.
 * Sube a CDN internamente (URL accesible por InvokeLLM) → OCR → IA.
 * El upload desde el backend genera URLs que la API de Anthropic SÍ puede acceder.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_base64, file_nombre, file_tipo, fase, ocr_raw: ocr_input } = body;

    // ── FASE IA SOLA (re-analizar texto ya existente) ─────────────────────
    if (fase === 'ia' && ocr_input) {
      try {
        const datos = await analizarIA(base44, ocr_input);
        return Response.json({ success: true, datos, ia_ok: true });
      } catch (e) {
        return Response.json({ success: false, ia_ok: false, error: e.message });
      }
    }

    // ── FASE AUTO: base64 → CDN (backend) → OCR → IA ─────────────────────
    if (!file_base64) {
      return Response.json({ success: false, needs_manual: true, error: 'file_base64 requerido' });
    }

    // 1. Subir a CDN desde el backend (esta URL SÍ es accesible por InvokeLLM)
    let cdn_url;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: file_base64 });
      cdn_url = file_url;
    } catch (e) {
      return Response.json({ success: false, needs_manual: true, error: 'Upload fallido: ' + e.message });
    }

    if (!cdn_url) {
      return Response.json({ success: false, needs_manual: true, error: 'Sin URL de almacenamiento' });
    }

    // 2. OCR — extraer texto del documento
    let ocr_raw = '';
    try {
      const texto = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un motor OCR para tickets y facturas en España. Transcribe EXACTAMENTE todo el texto visible en este documento, línea por línea. Incluye todos los números (importes, fechas, NIFs, teléfonos). No interpretes, no resumas. Solo transcribe el texto tal como aparece.`,
        file_urls: [cdn_url],
      });
      ocr_raw = (typeof texto === 'string' ? texto : JSON.stringify(texto)).trim();
    } catch (e) {
      return Response.json({ success: false, needs_manual: true, cdn_url, error: 'OCR fallido: ' + e.message });
    }

    if (!ocr_raw || ocr_raw.length < 5) {
      return Response.json({ success: false, needs_manual: true, cdn_url, error: 'Documento ilegible' });
    }

    // 3. Análisis IA — estructurar los datos extraídos
    let datos = null;
    let ia_ok = false;
    try {
      datos = await analizarIA(base44, ocr_raw);
      ia_ok = true;
    } catch (_) {
      ia_ok = false;
    }

    return Response.json({
      success: ia_ok,
      ocr_raw,
      datos,
      ia_ok,
      cdn_url,
      needs_manual: !ia_ok,
    });

  } catch (error) {
    return Response.json({ success: false, needs_manual: true, error: error.message });
  }
});

async function analizarIA(base44, ocr_raw) {
  return await base44.integrations.Core.InvokeLLM({
    prompt: `Analiza este texto OCR de un ticket/factura español y extrae los datos estructurados.

TEXTO OCR:
${ocr_raw}

Devuelve ÚNICAMENTE este JSON (null para campos no encontrados):
{
  "concepto": "descripción del gasto o producto principal",
  "importe": 0.00,
  "nombre_comercio": "nombre del establecimiento",
  "nif_comercio": null,
  "fecha_documento": "YYYY-MM-DD",
  "categoria_sugerida": "material|combustible|comida|peaje|parking|otros",
  "confianza": "alta|media|baja"
}

Reglas:
- importe: usa el TOTAL final (incluyendo IVA)
- fecha_documento: formato YYYY-MM-DD siempre
- categoria_sugerida: herramientas/material de obra → "material"
- confianza alta: todos los datos claros y verificados`,
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