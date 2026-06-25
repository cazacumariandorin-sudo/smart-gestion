import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_tipo } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    // Rechazar Data URLs — el motor de IA no puede acceder a base64 embebido
    if (file_url.startsWith('data:')) {
      return Response.json({
        error: 'No se puede procesar OCR: la imagen no se subió a almacenamiento accesible. Verifica la conexión a Google Drive.',
        success: false,
      }, { status: 422 });
    }

    const prompt = `Eres un sistema OCR especializado en facturas y tickets de gasto empresarial en España.
Analiza la imagen/documento y extrae TODOS los datos relevantes.

**IMPORTANTE: Busca y decodifica cualquier código QR o código de barras visible.** Muchos tickets modernos incluyen un código de validación fiscal (ej: TicketBAI, Factura Electrónica) que es único por transacción.

Devuelve un JSON con esta estructura exacta:
{
  "concepto": "descripción del gasto o producto/servicio",
  "importe": 0.00,
  "nif_comercio": "NIF o CIF del comercio (sin espacios, ej: B12345678)",
  "nombre_comercio": "nombre del establecimiento o empresa",
  "fecha_documento": "YYYY-MM-DD",
  "categoria_sugerida": "material|combustible|peaje|parking|otros",
  "confianza": "alta|media|baja",
  "ocr_raw": "texto completo extraído del documento",
  "codigo_validacion_fiscal": "contenido exacto del QR o código de barras (si existe)",
  "detalles_adicionales": "cualquier información relevante adicional"
}

Criterios de categoría:
- material: compras de materiales, herramientas, suministros
- combustible: gasolineras, carburante, adblue
- peaje: autopistas, peajes, túneles
- parking: aparcamientos, parkings
- otros: cualquier otro tipo de gasto

Si no puedes extraer un dato, usa null. Para importe usa número decimal sin símbolo €.
Si no hay QR/código visible, codigo_validacion_fiscal debe ser null.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          concepto: { type: "string" },
          importe: { type: "number" },
          nif_comercio: { type: "string" },
          nombre_comercio: { type: "string" },
          fecha_documento: { type: "string" },
          categoria_sugerida: { type: "string" },
          confianza: { type: "string" },
          ocr_raw: { type: "string" },
          codigo_validacion_fiscal: { type: "string" },
          detalles_adicionales: { type: "string" }
        }
      }
    });

    return Response.json({ success: true, datos: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});