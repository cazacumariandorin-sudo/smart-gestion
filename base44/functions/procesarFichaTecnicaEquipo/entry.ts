import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarFichaTecnicaEquipo
 * OCR+IA especializado en fichas técnicas de equipos electromecánicos
 * (motores, variadores de frecuencia, bombas, ventiladores, compresores).
 * Extrae todos los datos nominales de placa/características para la
 * comparación motor↔variador (compatibilidad).
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

    const prompt = `Eres un sistema OCR especializado en fichas técnicas de equipos electromecánicos (motores, variadores de frecuencia, bombas, ventiladores, compresores).
Extrae TODOS los datos nominales de la placa/características del equipo.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "equipo_tipo": "motor|variador|bomba|ventilador|compresor|otro",
  "fabricante": "",
  "modelo": "",
  "referencia": "",
  "potencia_kw": null|número,
  "potencia_cv": null|número,
  "tension_v": null|número|cadena (ej "400V 3~" si la placa lo muestra compuesto),
  "intensidad_nominal_a": null|número,
  "rpm": null|número,
  "factor_potencia": null|número,
  "rendimiento_pct": null|número,
  "ip_proteccion": "IP54|IP55|...",
  "clase_aislamiento": "F|H|B|...",
  "servicio": "S1|S2|S3|...",
  "masa_kg": null|número,
  "normas": ["array de normas citadas; vacío si ninguna"],
  "numero_serie": "",
  "datos_adicionales": {},
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible"
}

Instrucciones estrictas:
- Si un dato no aparece, usa null (numéricos) o cadena vacía (textos) o array vacío (normas).
- "tension_v" puede ser string compuesto ("400V 50Hz 3~") si la placa lo muestra así.
- Los datos de la placa son los NOMINALES del fabricante; no interpretes condiciones de instalación.
- "datos_adicionales" es un objeto libre para cualquier parámetro no listado que sí aparezca.`;

    const responseSchema = {
      type: 'object',
      properties: {
        equipo_tipo: { type: 'string', enum: ['motor', 'variador', 'bomba', 'ventilador', 'compresor', 'otro'] },
        fabricante: { type: 'string' },
        modelo: { type: 'string' },
        referencia: { type: 'string' },
        potencia_kw: { type: ['number', 'null'] },
        potencia_cv: { type: ['number', 'null'] },
        tension_v: { type: ['number', 'string', 'null'] },
        intensidad_nominal_a: { type: ['number', 'null'] },
        rpm: { type: ['number', 'null'] },
        factor_potencia: { type: ['number', 'null'] },
        rendimiento_pct: { type: ['number', 'null'] },
        ip_proteccion: { type: 'string' },
        clase_aislamiento: { type: 'string' },
        servicio: { type: 'string' },
        masa_kg: { type: ['number', 'null'] },
        normas: { type: 'array', items: { type: 'string' } },
        numero_serie: { type: 'string' },
        datos_adicionales: { type: 'object', additionalProperties: true },
        confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        ocr_raw: { type: 'string' },
      },
      required: ['equipo_tipo'],
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