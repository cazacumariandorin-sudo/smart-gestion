import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarOcrPresupuesto
 * OCR especializado para presupuestos/facturas con JSON estructurado.
 * Patrón de la auditoría: Base44 InvokeLLM PRIMARY + Anthropic Claude FALLBACK.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_tipo } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    const prompt = `Eres un sistema OCR especializado en presupuestos, facturas y documentos comerciales en España.
Analiza la imagen/documento y extrae TODOS los conceptos o partidas que aparezcan.

Devuelve un JSON con esta estructura exacta:
{
  "cliente": "nombre del cliente o empresa",
  "fecha_documento": "YYYY-MM-DD",
  "importe_total": 0.00,
  "conceptos": [
    { "descripcion": "descripción", "cantidad": 1, "unidad": "ud|m²|m³|kg|h|día|mes", "precio_unitario": 0.00, "total": 0.00 }
  ],
  "notas": "observaciones o condiciones del documento",
  "confianza": "alta|media|baja",
  "ocr_raw": "texto completo extraído del documento"
}

Instrucciones:
- Extrae TODOS los conceptos que veas, incluso si son muchos.
- Si no hay cantidad explícita, usa 1.
- Si no hay precio unitario pero sí total, úsalo como precio_unitario y cantidad 1.
- El importe_total debe ser la suma de todos los conceptos (con IVA si aparece).
- Si no puedes extraer un dato, usa null.
- Si no hay conceptos claros, devuelve un array vacío.`;

    const responseSchema = {
      type: 'object',
      properties: {
        cliente: { type: 'string' },
        fecha_documento: { type: 'string' },
        importe_total: { type: 'number' },
        conceptos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              descripcion: { type: 'string' },
              cantidad: { type: 'number' },
              unidad: { type: 'string' },
              precio_unitario: { type: 'number' },
              total: { type: 'number' },
            },
          },
        },
        notas: { type: 'string' },
        confianza: { type: 'string' },
        ocr_raw: { type: 'string' },
      },
    };

    const r = await ocrDocumento(base44, {
      file_url,
      file_tipo: file_tipo || 'image/jpeg',
      prompt,
      response_json_schema: responseSchema,
    });

    if (!r.success) {
      return Response.json({ error: r.error, success: false }, { status: 502 });
    }

    return Response.json({
      success: true,
      datos: r.datos,
      modelo: r.modelo,
      fallback: r.fallback,
    });
  } catch (error) {
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
});