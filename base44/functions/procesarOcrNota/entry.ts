import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * procesarOcrNota — 2 fases independientes.
 * body.fase = 'ocr'  → extrae texto bruto del documento
 * body.fase = 'ia'   → recibe ocr_raw y estructura los datos
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fase, file_url, ocr_raw } = body;

    if (!fase) return Response.json({ error: 'fase requerido: ocr | ia' }, { status: 400 });

    if (fase === 'ocr') {
      if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });
      if (file_url.startsWith('data:')) {
        return Response.json({ success: false, fase: 'ocr', error: 'Imagen no en Drive accesible' }, { status: 422 });
      }

      const texto = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un motor OCR. Transcribe EXACTAMENTE todo el texto visible en este documento, línea por línea.
REGLAS:
- Copia el texto tal como aparece, sin reformatear ni interpretar
- Si ves un código QR o código de barras, escribe su contenido entre [QR: ...] o [BARCODE: ...]
- Si hay tablas, usa espacios para alinear columnas
- No resumas, no interpretes, no estructures. Solo transcribe.
Devuelve únicamente el texto extraído, sin comentarios adicionales.`,
        file_urls: [file_url],
      });

      const textoStr = typeof texto === 'string' ? texto : JSON.stringify(texto);
      if (!textoStr || textoStr.trim().length < 5) {
        return Response.json({ success: false, fase: 'ocr', error: 'No se pudo extraer texto legible' });
      }
      return Response.json({ success: true, fase: 'ocr', ocr_raw: textoStr.trim() });
    }

    if (fase === 'ia') {
      if (!ocr_raw) return Response.json({ error: 'ocr_raw requerido' }, { status: 400 });

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Eres un sistema de análisis de facturas y tickets de gasto empresarial en España.
Se te proporciona el texto extraído por OCR. Analiza y extrae los datos estructurados.

TEXTO OCR:
${ocr_raw}

Devuelve JSON con esta estructura exacta (null para campos no determinables):
{
  "concepto": "descripción del gasto",
  "importe": 0.00,
  "nif_comercio": "NIF/CIF sin espacios",
  "nombre_comercio": "nombre del establecimiento",
  "fecha_documento": "YYYY-MM-DD",
  "categoria_sugerida": "material|combustible|peaje|parking|comida|otros",
  "confianza": "alta|media|baja",
  "codigo_validacion_fiscal": "contenido QR si existe o null",
  "mejoras_aplicadas": "qué mejoró la IA respecto al OCR crudo",
  "campos_inciertos": ["campos con baja confianza"]
}
Para importe: número decimal sin €. Si hay varios, usa el TOTAL.`,
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

    return Response.json({ error: `fase desconocida: ${fase}` }, { status: 400 });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});