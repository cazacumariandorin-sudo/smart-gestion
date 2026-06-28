import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * procesarOcrNota — 2 fases independientes.
 *
 * PROBLEMA RESUELTO: Google Drive URLs (drive.google.com/uc?id=...) no son
 * accesibles por la API de Anthropic → InvokeLLM ve imagen vacía → todo a cero.
 * SOLUCIÓN: si se recibe file_base64, se sube primero a Base44 CDN via
 * Core.UploadFile() para obtener una URL pública accesible por InvokeLLM.
 *
 * body.fase = 'ocr'  → extrae texto bruto del documento
 * body.fase = 'ia'   → recibe ocr_raw y estructura los datos
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fase, file_url, file_base64, ocr_raw } = body;

    if (!fase) return Response.json({ error: 'fase requerido: ocr | ia' }, { status: 400 });

    // ── FASE OCR ─────────────────────────────────────────────────────────────
    if (fase === 'ocr') {
      if (!file_url && !file_base64) {
        return Response.json({ error: 'file_url o file_base64 requerido' }, { status: 400 });
      }

      const esDriveUrl = file_url && (
        file_url.includes('drive.google.com') ||
        file_url.includes('docs.google.com')
      );
      const esDataUrl = file_url && file_url.startsWith('data:');

      let urlAccesible = null;

      if (file_base64) {
        // Siempre preferir base64 → subir a CDN de Base44
        try {
          const uploaded = await base44.integrations.Core.UploadFile({ file: file_base64 });
          urlAccesible = uploaded.file_url;
        } catch (e) {
          return Response.json({
            success: false, fase: 'ocr',
            error: 'No se pudo subir imagen a CDN para OCR: ' + e.message,
          });
        }
      } else if (!esDriveUrl && !esDataUrl && file_url) {
        // URL ya es pública (Base44 CDN, S3, etc.) — usar directamente
        urlAccesible = file_url;
      } else if (esDriveUrl || esDataUrl) {
        return Response.json({
          success: false, fase: 'ocr',
          error: 'La imagen está en Drive o es local. Pasa file_base64 para que el OCR pueda procesarla.',
        }, { status: 422 });
      }

      if (!urlAccesible) {
        return Response.json({ success: false, fase: 'ocr', error: 'No hay URL accesible para OCR' });
      }

      const texto = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un motor OCR especializado en tickets y facturas españolas. Tu única tarea es transcribir EXACTAMENTE todo el texto visible en este documento, línea por línea.

REGLAS ESTRICTAS:
- Copia el texto TAL COMO APARECE en el documento, sin reformatear ni interpretar
- Mantén el orden y la disposición visual del texto
- Si ves un código QR o código de barras, escribe su contenido entre [QR: ...] o [BARCODE: ...]
- Si hay tablas (descripción, precio, importe...), usa espacios/tabulaciones para representarlas
- Incluye TODOS los números, incluyendo importes, fechas, NIFs, teléfonos
- NO resumas, NO interpretes, NO omitas nada. Solo transcribe.

Devuelve únicamente el texto transcrito, sin ningún comentario adicional.`,
        file_urls: [urlAccesible],
      });

      const textoStr = typeof texto === 'string' ? texto : JSON.stringify(texto);
      if (!textoStr || textoStr.trim().length < 10) {
        return Response.json({
          success: false, fase: 'ocr',
          error: 'No se pudo extraer texto legible del documento. Verifica que la imagen es clara y el documento es legible.',
        });
      }

      return Response.json({ success: true, fase: 'ocr', ocr_raw: textoStr.trim() });
    }

    // ── FASE IA ───────────────────────────────────────────────────────────────
    if (fase === 'ia') {
      if (!ocr_raw) return Response.json({ error: 'ocr_raw requerido para fase ia' }, { status: 400 });

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un sistema de análisis de facturas y tickets de gasto empresarial en España.

Se te proporciona el texto extraído por OCR de un ticket o factura. Analiza el texto y extrae los datos estructurados.

TEXTO OCR:
${ocr_raw}

INSTRUCCIONES:
- Para "importe": usa el TOTAL final del ticket (no la base imponible, no subtotales)
- Para "fecha_documento": convierte al formato YYYY-MM-DD
- Para "nif_comercio": busca el CIF/NIF del COMERCIO (no del cliente ni del titular personal)
- Para "categoria_sugerida": comida/restaurante → "comida"; gasolina → "combustible"; materiales → "material"; autopista → "peaje"; aparcamiento → "parking"; resto → "otros"
- Para "confianza": alta si todos los campos están claros; media si hay alguna duda; baja si datos ambiguos
- Usa null para campos que no puedas determinar con certeza

Devuelve ÚNICAMENTE el JSON, sin texto adicional:
{
  "concepto": "descripción corta del gasto",
  "importe": 0.00,
  "nif_comercio": "CIF/NIF del comercio o null",
  "nombre_comercio": "nombre del establecimiento",
  "fecha_documento": "YYYY-MM-DD",
  "categoria_sugerida": "comida|combustible|material|peaje|parking|otros",
  "confianza": "alta|media|baja",
  "codigo_validacion_fiscal": "número de factura simplificada o código QR o null",
  "mejoras_aplicadas": "resumen de lo que detectó/corrigió la IA",
  "campos_inciertos": ["lista de campos con baja confianza"]
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

      return Response.json({ success: true, fase: 'ia', datos: resultado });
    }

    return Response.json({ error: `fase desconocida: ${fase}. Usa 'ocr' o 'ia'` }, { status: 400 });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});