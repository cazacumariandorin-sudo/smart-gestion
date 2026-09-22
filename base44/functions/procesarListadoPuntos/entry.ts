import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarListadoPuntos
 * OCR+IA especializado en listados de puntos / pedidos ingenieriles (BMS,
 * refrigeración industrial). Extrae puntos con ID (PT-01), descripción
 * técnica, referencia de equipo y ubicación — sin campos comerciales
 * (PVP/descuento/IVA van en la factura, no en el listado de puntos).
 *
 * Patrón: Base44 InvokeLLM PRIMARIO + Anthropic Claude FALLBACK (aiOrchestrator).
 * No escribe en DB — solo extracción.
 *
 * Acceso: admin, propietario, gerencia e ingeniero.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user?.role || 'operario';
    if (role !== 'admin' && role !== 'propietario' && role !== 'gerencia' && role !== 'ingeniero') {
      return Response.json({ error: 'Forbidden: el módulo Ingeniería requiere rol admin, gerencia o ingeniero' }, { status: 403 });
    }

    const { file_url, file_tipo } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requerido' }, { status: 400 });

    const prompt = `Eres un sistema OCR especializado en listados de puntos y pedidos de ingeniería de instalaciones técnicas (BMS, refrigeración industrial, climatización).
Analiza el documento (probablemente pre-procesado tipo CamScanner).
Extrae TODOS los puntos del listado.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "proveedor": "nombre del emisor si es un pedido a proveedor; cadena vacía si es listado interno",
  "numero_documento": "nº de pedido/listado impreso; cadena vacía si no aparece",
  "fecha_documento": "YYYY-MM-DD; cadena vacía si no aparece",
  "puntos": [
    {
      "punto_id": "ID del punto (PT-01, PT-02...); cadena vacía si no aparece",
      "descripcion": "descripción técnica del punto/equipo",
      "referencia": "referencia comercial del equipo; cadena vacía si no aparece",
      "fabricante": "fabricante si aparece; cadena vacía si no",
      "ubicacion": "zona/ubicación técnica del punto (Sala máquinas, Planta 2...); cadena vacía si no",
      "cantidad": 1,
      "unidad": "ud|m²|m³|kg|ml|...",
    }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible"
}

Instrucciones estrictas:
- Extrae TODOS los puntos, aunque sean muchos.
- NO extraigas PVP, descuento ni IVA: esos van en la factura, no en el listado de puntos.
- La referencia es clave para cruzar con la base de datos de Materiales. Cadena vacía si no aparece.
- Si no puedes extraer un dato, usa cadena vacía (textos) o null (numéricos).
- No incluyas en "puntos" totales, subtotales ni cabeceras.`;

    const responseSchema = {
      type: 'object',
      properties: {
        proveedor: { type: 'string' },
        numero_documento: { type: 'string' },
        fecha_documento: { type: 'string' },
        puntos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              punto_id: { type: 'string' },
              descripcion: { type: 'string' },
              referencia: { type: 'string' },
              fabricante: { type: 'string' },
              ubicacion: { type: 'string' },
              cantidad: { type: 'number' },
              unidad: { type: 'string' },
            },
            required: ['descripcion'],
          },
        },
        confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        ocr_raw: { type: 'string' },
      },
      required: ['puntos'],
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
}