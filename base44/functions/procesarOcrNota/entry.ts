import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * procesarOcrNota — OCR + IA en un único paso robusto.
 *
 * FLUJO:
 *   1. Recibe file_base64 directamente del frontend
 *   2. Sube a Base44 CDN internamente (Core.UploadFile)
 *   3. Ejecuta OCR con la URL CDN (siempre accesible por InvokeLLM)
 *   4. Ejecuta análisis IA sobre el texto OCR
 *   5. Devuelve { ocr_raw, datos, cdn_url, ia_ok }
 *
 * Si la IA falla, devuelve ocr_raw para que el usuario revise manualmente.
 * Si el OCR falla, devuelve needs_manual:true.
 * body.fase = 'ia' sigue disponible para re-analizar texto OCR ya existente.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fase, file_base64, ocr_raw: ocr_raw_input } = body;

    // ── FASE IA SOLA (re-análisis de texto ya extraído) ──────────────────────
    if (fase === 'ia') {
      if (!ocr_raw_input) return Response.json({ error: 'ocr_raw requerido' }, { status: 400 });
      try {
        const datos = await analizarConIA(base44, ocr_raw_input);
        return Response.json({ success: true, fase: 'ia', datos, ia_ok: true });
      } catch (e) {
        return Response.json({ success: false, fase: 'ia', ia_ok: false, error: e.message });
      }
    }

    // ── FASE AUTO (por defecto) — base64 → CDN → OCR → IA ───────────────────
    if (!file_base64) {
      return Response.json({ error: 'file_base64 requerido' }, { status: 400 });
    }

    // PASO 1: Subir a CDN de Base44 (internamente, sin pasar por el frontend)
    let cdn_url: string;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: file_base64 });
      cdn_url = file_url;
    } catch (e) {
      return Response.json({
        success: false,
        needs_manual: true,
        error: 'No se pudo procesar el archivo: ' + e.message,
      });
    }

    // PASO 2: OCR — extraer texto bruto
    let ocr_raw = '';
    let ocr_ok = false;
    try {
      const texto = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un motor OCR especializado en tickets y facturas españolas. Transcribe EXACTAMENTE todo el texto visible en este documento, línea por línea.

REGLAS:
- Copia el texto TAL COMO APARECE, sin reformatear ni interpretar
- Si ves código QR o código de barras, escríbelo entre [QR: ...] o [BARCODE: ...]  
- Si hay tablas, usa espacios para representarlas
- Incluye TODOS los números: importes, fechas, NIFs, teléfonos
- No resumas, no interpretes, no omitas nada

Devuelve únicamente el texto transcrito, sin comentarios.`,
        file_urls: [cdn_url],
      });
      const textoStr = typeof texto === 'string' ? texto : JSON.stringify(texto);
      if (textoStr && textoStr.trim().length >= 5) {
        ocr_raw = textoStr.trim();
        ocr_ok = true;
      }
    } catch (_) {
      ocr_ok = false;
    }

    if (!ocr_ok) {
      return Response.json({
        success: false,
        needs_manual: true,
        cdn_url,
        error: 'No se pudo extraer texto del documento. Verifica que la imagen es legible.',
      });
    }

    // PASO 3: Análisis IA — estructurar los datos
    let datos = null;
    let ia_ok = false;
    try {
      datos = await analizarConIA(base44, ocr_raw);
      ia_ok = true;
    } catch (_) {
      ia_ok = false;
    }

    return Response.json({
      success: true,
      ocr_raw,
      ocr_ok: true,
      datos,
      ia_ok,
      cdn_url,
      // Si IA falló, el frontend muestra el texto OCR para revisión manual
      message: ia_ok
        ? `Datos extraídos (confianza: ${datos?.confianza || 'media'})`
        : 'OCR completado. La IA no pudo estructurar los datos — revisa el texto.',
    });

  } catch (error) {
    return Response.json({ success: false, needs_manual: true, error: error.message }, { status: 500 });
  }
});

async function analizarConIA(base44: any, ocr_raw: string): Promise<any> {
  return await base44.integrations.Core.InvokeLLM({
    prompt: `Eres un sistema de análisis de facturas y tickets de gasto empresarial en España.
Analiza este texto OCR y extrae los datos estructurados.

TEXTO OCR:
${ocr_raw}

INSTRUCCIONES:
- "importe": TOTAL final del ticket (no base imponible, no subtotales)
- "fecha_documento": formato YYYY-MM-DD
- "nif_comercio": CIF/NIF del COMERCIO (no del cliente)
- "categoria_sugerida": comida|combustible|material|peaje|parking|otros
- "confianza": alta (todos claros) | media (alguna duda) | baja (ambiguos)
- null para campos no determinables

Devuelve ÚNICAMENTE el JSON:
{
  "concepto": "descripción corta del gasto",
  "importe": 0.00,
  "nif_comercio": null,
  "nombre_comercio": "nombre del establecimiento",
  "fecha_documento": "YYYY-MM-DD",
  "categoria_sugerida": "comida",
  "confianza": "alta",
  "codigo_validacion_fiscal": null,
  "mejoras_aplicadas": "qué detectó/corrigió la IA",
  "campos_inciertos": []
}`,
    response_json_schema: {
      type: 'object',
      properties: {
        concepto: { type: 'string' },
        importe: { type: 'number' },
        nif_comercio: { type: 'string' },
        nombre_comercio: { type: 'string' },
        fecha_documento: { type: 'string' },
        categoria_sugerida: { type: 'string' },
        confianza: { type: 'string' },
        codigo_validacion_fiscal: { type: 'string' },
        mejoras_aplicadas: { type: 'string' },
        campos_inciertos: { type: 'array', items: { type: 'string' } },
      },
    },
  });
}