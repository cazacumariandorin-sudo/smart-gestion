import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * OCR especializado para presupuestos - extrae múltiples conceptos/partidas de documentos
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
    {
      "descripcion": "descripción detallada del concepto o partida",
      "cantidad": 1,
      "unidad": "ud|m²|m³|kg|h|día|mes",
      "precio_unitario": 0.00,
      "total": 0.00
    }
  ],
  "notas": "observaciones o condiciones del documento",
  "confianza": "alta|media|baja",
  "ocr_raw": "texto completo extraído del documento"
}

Instrucciones:
- Extrae TODOS los conceptos que veas, incluso si son muchos
- Para unidad, usa: ud (unidades), m² (metros cuadrados), m³ (metros cúbicos), kg (kilogramos), h (horas), día, mes, o la que aparezca
- Si no hay cantidad explícita, usa 1
- Si no hay precio unitario pero sí total, úsalo como precio_unitario y cantidad 1
- El importe_total debe ser la suma de todos los conceptos (con IVA si aparece)
- Si no puedes extraer un dato, usa null

Si no hay conceptos claros, devuelve un array vacío.`;

        const result = await base44.integrations.Core.InvokeLLM({
            prompt,
            file_urls: [file_url],
            response_json_schema: {
                type: "object",
                properties: {
                    cliente: { type: "string" },
                    fecha_documento: { type: "string" },
                    importe_total: { type: "number" },
                    conceptos: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                descripcion: { type: "string" },
                                cantidad: { type: "number" },
                                unidad: { type: "string" },
                                precio_unitario: { type: "number" },
                                total: { type: "number" }
                            }
                        }
                    },
                    notas: { type: "string" },
                    confianza: { type: "string" },
                    ocr_raw: { type: "string" }
                }
            }
        });

        return Response.json({ success: true, datos: result });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});