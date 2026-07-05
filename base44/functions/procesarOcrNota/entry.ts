import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * procesarOcrNota — OCR puro sin IA.
 * Recibe file_base64 comprimido y extrae texto con InvokeLLM (messages/base64).
 * No hace análisis IA. Devuelve ocr_raw para que el usuario rellene el formulario.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { file_base64, file_tipo } = body;

    if (!file_base64) {
      return Response.json({ success: false, ocr_raw: '', error: 'file_base64 requerido' });
    }

    // Extraer base64 puro (sin prefijo data:image/...;base64,)
    const base64puro = file_base64.includes(',') ? file_base64.split(',')[1] : file_base64;
    const mimeType = file_base64.startsWith('data:') 
      ? file_base64.split(';')[0].split(':')[1] 
      : (file_tipo || 'image/jpeg');

    const OCR_PROMPT = `Eres un motor OCR para tickets y facturas en España. Transcribe EXACTAMENTE todo el texto visible en este documento, línea por línea. Incluye todos los números (importes, fechas, NIFs, teléfonos). No interpretes, no resumas. Solo transcribe el texto tal como aparece.`;

    let ocr_raw = '';
    const debug_steps: string[] = [];

    // InvokeLLM con base64 en formato nativo Anthropic (messages array)
    // No requiere upload ni URL pública — base64 directo a la API
    try {
      const texto = await base44.integrations.Core.InvokeLLM({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64puro,
                },
              },
              {
                type: 'text',
                text: OCR_PROMPT,
              },
            ],
          },
        ],
      });
      ocr_raw = (typeof texto === 'string' ? texto : (texto?.content?.[0]?.text || JSON.stringify(texto))).trim();
      debug_steps.push('messages_base64:ok');
    } catch (eMsg) {
      debug_steps.push('messages_base64:fail:' + String(eMsg.message).slice(0, 80));
      return Response.json({
        success: false,
        needs_manual: true,
        error: debug_steps.join(' | '),
      });
    }

    if (!ocr_raw || ocr_raw.length < 5) {
      return Response.json({
        success: false,
        needs_manual: true,
        error: 'Ilegible. Pasos: ' + debug_steps.join(' | '),
      });
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