import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarFacturaMateriales
 * OCR+IA especializado en facturas/albaranes/proformas/tickets de proveedor.
 * Extrae por línea de producto: fabricante, referencia, descripción, cantidad,
 * PVP, descuento empresa, IVA y precio neto.
 *
 * Patrón de la auditoría: Base44 InvokeLLM PRIMARIO + Anthropic Claude FALLBACK.
 * No escribe en DB — solo extracción. La persistencia va en guardarMaterialesOcr
 * después de la revisión del usuario (no se ensucia el catálogo sin confirmación).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_tipo } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    const prompt = `Eres un sistema OCR especializado en facturas, albaranes, proformas y tickets de proveedores en España.
Analiza el documento (probablemente pre-procesado tipo CamScanner: recortado, enderezado y con contraste mejorado).
Extrae TODAS las líneas de producto/material del cuerpo del documento.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "proveedor": "nombre del emisor del documento",
  "nif_proveedor": "CIF/NIF del emisor",
  "numero_documento": "nº de factura/albarán/proforma impreso; cadena vacía si no aparece",
  "fecha_documento": "YYYY-MM-DD (no la fecha de hoy)",
  "tipo_documento_inferido": "factura|albaran|ticket|proforma",
  "lineas": [
    {
      "fabricante": "marca/fabricante del producto; cadena vacía si no aparece",
      "referencia": "referencia/código de catálogo del producto; cadena vacía si no aparece",
      "descripcion": "descripción del producto",
      "cantidad": 1,
      "unidad": "ud|m²|m³|kg|ml|h|...",
      "pvp": null|número (precio público de venta si aparece por separado; null si NO figura),
      "descuento_empresa": null|número (% descuento aplicado al comprador, si aparece o se deduce; null si NO figura),
      "iva": null|número (% IVA de la línea),
      "precio_neto": número (precio por unidad realmente facturado, CON descuento incluido, SIN IVA)
    }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible, línea por línea"
}

Instrucciones estrictas:
- Extrae TODAS las líneas de producto, aunque sean muchas.
- NUNCA inventes PVP ni descuento si el documento NO los muestra por separado: si solo aparece el precio neto, deja pvp=null y descuento_empresa=null.
- precio_neto es OBLIGATORIO. Si el documento solo da el importe total de la línea, divídelo entre cantidad.
- La referencia es clave para cruzar con la base de datos de Materiales. Cadena vacía si no aparece.
- No incluyas en "lineas" totales, subtotales, bases imponibles, IVA global ni portes.
- Si no puedes extraer un dato, usa null (numéricos) o cadena vacía (textos).`;

    const responseSchema = {
      type: 'object',
      properties: {
        proveedor: { type: 'string' },
        nif_proveedor: { type: 'string' },
        numero_documento: { type: 'string' },
        fecha_documento: { type: 'string' },
        tipo_documento_inferido: { type: 'string', enum: ['factura', 'albaran', 'ticket', 'proforma'] },
        lineas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fabricante: { type: 'string' },
              referencia: { type: 'string' },
              descripcion: { type: 'string' },
              cantidad: { type: 'number' },
              unidad: { type: 'string' },
              pvp: { type: ['number', 'null'] },
              descuento_empresa: { type: ['number', 'null'] },
              iva: { type: ['number', 'null'] },
              precio_neto: { type: 'number' },
            },
            required: ['descripcion', 'precio_neto'],
          },
        },
        confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        ocr_raw: { type: 'string' },
      },
      required: ['lineas'],
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
    return Response.json({ error: String(error?.message || error).slice(0, 300), success: false }, { status: 500 });
  }
});