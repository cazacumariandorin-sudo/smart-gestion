import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarEsquemaConexion
 * OCR+IA especializado en esquemas eléctricos / diagramas de conexión de
 * instalaciones técnicas (BMS, refrigeración, climatización).
 * Extrae componentes, conexiones y anotaciones manuscritas (literal, sin
 * interpretar como cambios incorporados).
 *
 * Patrón: Base44 InvokeLLM PRIMARIO + Anthropic Claude FALLBACK (aiOrchestrator).
 * No escribe en DB — solo extracción. La persistencia va tras revisión humana.
 *
 * Acceso: admin, propietario, gerencia e ingeniero (rol operativo del módulo).
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

    const prompt = `Eres un sistema OCR especializado en esquemas eléctricos y diagramas de conexión de instalaciones técnicas (BMS, refrigeración, climatización).
Analiza el esquema (probablemente pre-procesado tipo CamScanner).
Extrae TODOS los componentes y sus conexiones.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "tipo_diagrama": "esquema_electrico|pid_proceso|unifilar|otro",
  "componentes": [
    {
      "etiqueta": "texto impreso junto al símbolo (Q1, KM1, F1...)",
      "tipo_componente": "motor|variador|contactor|protector|rele|sensor|valvula|otro",
      "referencia": "referencia comercial si aparece; cadena vacía si no",
      "fabricante": "si aparece; cadena vacía si no",
      "parametros": { "potencia_kw": null|número, "tension_v": null|número, "intensidad_a": null|número },
      "posicion_aprox": { "zona": "descripción de la zona del esquema (esquina superior, centro...)" }
    }
  ],
  "conexiones": [
    { "origen": "etiqueta componente origen", "destino": "etiqueta componente destino", "tipo_cable": "potencia|control|senal", "seccion_mm2": null|número }
  ],
  "anotaciones_manuscritas": [
    { "texto": "transcripción literal", "color_aprox": "rojo|azul|negro|otro", "zona": "descripción de la zona" }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible"
}

Instrucciones estrictas:
- Las anotaciones manuscritas en color NO se interpretan como cambios incorporados: se transcriben literalmente en "anotaciones_manuscritas" con su color, sin asumir que modifican el esquema base.
- Si un parámetro no aparece, usa null (numéricos) o cadena vacía (textos).
- "posicion_aprox.zona" es descriptivo (esquina superior, centro), NO coordenadas en píxeles.`;

    const responseSchema = {
      type: 'object',
      properties: {
        tipo_diagrama: { type: 'string', enum: ['esquema_electrico', 'pid_proceso', 'unifilar', 'otro'] },
        componentes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              etiqueta: { type: 'string' },
              tipo_componente: { type: 'string', enum: ['motor', 'variador', 'contactor', 'protector', 'rele', 'sensor', 'valvula', 'otro'] },
              referencia: { type: 'string' },
              fabricante: { type: 'string' },
              parametros: {
                type: 'object',
                properties: {
                  potencia_kw: { type: ['number', 'null'] },
                  tension_v: { type: ['number', 'null'] },
                  intensidad_a: { type: ['number', 'null'] },
                },
              },
              posicion_aprox: {
                type: 'object',
                properties: { zona: { type: 'string' } },
              },
            },
            required: ['etiqueta', 'tipo_componente'],
          },
        },
        conexiones: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              origen: { type: 'string' },
              destino: { type: 'string' },
              tipo_cable: { type: 'string', enum: ['potencia', 'control', 'senal'] },
              seccion_mm2: { type: ['number', 'null'] },
            },
            required: ['origen', 'destino'],
          },
        },
        anotaciones_manuscritas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              texto: { type: 'string' },
              color_aprox: { type: 'string', enum: ['rojo', 'azul', 'negro', 'otro'] },
              zona: { type: 'string' },
            },
            required: ['texto'],
          },
        },
        confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        ocr_raw: { type: 'string' },
      },
      required: ['componentes'],
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