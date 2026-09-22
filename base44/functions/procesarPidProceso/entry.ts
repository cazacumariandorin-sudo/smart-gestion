import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarPidProceso
 * OCR+IA especializado en P&ID de proceso (diagramas de instrumentación).
 * Extrae instrumentos con tags ISA (TT-101, FV-202), bucles de control y
 * anotaciones manuscritas (literal, sin interpretar como cambios).
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

    const prompt = `Eres un sistema OCR especializado en diagramas P&ID de proceso (Piping and Instrumentation Diagram).
Analiza el P&ID (probablemente pre-procesado tipo CamScanner).
Extrae TODOS los instrumentos con sus tags ISA y los bucles de control.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "tipo_diagrama": "pid_proceso|esquema_electrico|unifilar|otro",
  "instrumentos": [
    {
      "tag": "tag ISA (TT-101, FV-202, PDI-305...)",
      "tipo_instrumento": "transmisor|controlador|indicador|valvula_regulacion|valvula_onoff|sensor|otro",
      "funcion": "letra función ISA (T=temperatura, F=caudal, P=presión, L=nivel...)",
      "linea_proceso": "identificación de la línea/tubería a la que se conecta, si aparece; cadena vacía si no",
      "referencia": "referencia comercial si aparece; cadena vacía si no",
      "posicion_aprox": { "zona": "descripción de la zona del P&ID" }
    }
  ],
  "bucles_control": [
    {
      "tag": "tag del bucle (TIC-101...)",
      "instrumentos": ["lista de tags ISA que forman el bucle"]
    }
  ],
  "anotaciones_manuscritas": [
    { "texto": "transcripción literal", "color_aprox": "rojo|azul|negro|otro", "zona": "descripción de la zona" }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible"
}

Instrucciones estrictas:
- Los tags ISA siguen el formato XX-NNN (letras función + número). Transcríbelos literalmente.
- Las anotaciones manuscritas en color NO se interpretan como cambios incorporados: se transcriben literalmente en "anotaciones_manuscritas", sin asumir que modifican el P&ID base.
- Si un dato no aparece, usa cadena vacía (textos) o null (numéricos).
- "posicion_aprox.zona" es descriptivo, NO coordenadas en píxeles.`;

    const responseSchema = {
      type: 'object',
      properties: {
        tipo_diagrama: { type: 'string', enum: ['pid_proceso', 'esquema_electrico', 'unifilar', 'otro'] },
        instrumentos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tag: { type: 'string' },
              tipo_instrumento: { type: 'string', enum: ['transmisor', 'controlador', 'indicador', 'valvula_regulacion', 'valvula_onoff', 'sensor', 'otro'] },
              funcion: { type: 'string' },
              linea_proceso: { type: 'string' },
              referencia: { type: 'string' },
              posicion_aprox: {
                type: 'object',
                properties: { zona: { type: 'string' } },
              },
            },
            required: ['tag', 'tipo_instrumento'],
          },
        },
        bucles_control: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tag: { type: 'string' },
              instrumentos: { type: 'array', items: { type: 'string' } },
            },
            required: ['tag'],
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
      required: ['instrumentos'],
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