import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarFichaTecnicaEquipo
 * OCR+IA especializado en fichas técnicas de equipos electromecánicos.
 * TYPE-AWARE: detecta el tipo de equipo y extrae especificacion_clave con
 * las claves variables según tipo (motor: potencia/tensión/corriente;
 * bomba: caudal/altura/potencia; condensador/intercambiador: refrigerante/
 * presión/capacidad; variador: potencia/tensión/corriente). NO usa un
 * schema fijo motor-céntrico.
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

    const prompt = `Eres un sistema OCR especializado en fichas técnicas de equipos electromecánicos de instalaciones (motores, variadores de frecuencia, bombas, ventiladores, compresores, condensadores, intercambiadores).
PRIMERO detecta el tipo de equipo por la placa/simbología/texto. LUEGO extrae las especificaciones clave QUE APLIQUEN a ese tipo — no un esquema fijo.

Devuelve SOLO un JSON con esta estructura:
{
  "tag_equipo": "TAG o denominación del equipo ('Motor compresor', 'Condensador Adiabático CD', 'Bomba NSCE 32-160'); cadena vacía si no aparece",
  "equipo_tipo": "motor|variador|bomba|ventilador|compresor|condensador|intercambiador|otro",
  "fabricante": "",
  "modelo": "",
  "especificacion_clave": {
    // JSON LIBRE: solo las claves que apliquen al tipo detectado.
    // motor:      potencia_kw, potencia_cv, tension_v, corriente_a, velocidad_rpm, factor_potencia, rendimiento_pct, ip_proteccion, clase_aislamiento, servicio, masa_kg
    // variador:   potencia_kw, tension_entrada_v, tension_salida_v, corriente_a, modelo_control, potencias_asociadas_kw (array)
    // bomba:      potencia_kw, caudal_m3h, altura_m, fluido, temperatura_c, diametro_impulsor_mm
    // ventilador: potencia_kw, caudal_m3h, presion_pa, diametro_mm
    // compresor: potencia_kw, caudal_m3h, refrigerante, presion_bar
    // condensador/intercambiador: refrigerante, presion_bar, capacidad_kw, potencia_electrica_kw, num_ventiladores, superficie_m2
    // Incluye cualquier otra clave técnica del fabricante no listada. Omite las que no apliquen.
  },
  "equipo_asociado": "denominación del equipo asociado si la ficha lo menciona (ej. 'variador FC102 315kW'); cadena vacía si no",
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible, línea por línea"
}

Instrucciones estrictas:
- especificacion_clave debe contener SOLO las claves relevantes al tipo detectado (no metas campos de motor en una bomba). Los valores numéricos van como número (sin unidad: 260, no "260 kW"); la unidad se sobreentiende por la clave.
- tension_v puede ser string compuesto ("400V 50Hz 3~") si la placa lo muestra así.
- refrigerante como texto ("R717", "R134a"). fluido como texto ("35% Propilenglicol").
- Si un dato no aparece, NO lo incluyas en especificacion_clave (mejor omitir que null).
- Los datos son los NOMINALES del fabricante; no interpretes condiciones de instalación.
- tag_equipo se usa para cruzar con UbicacionEquipo.tag_equipo e ItemLista.tag.`;

    const responseSchema = {
      type: 'object',
      properties: {
        tag_equipo: { type: 'string' },
        equipo_tipo: { type: 'string', enum: ['motor', 'variador', 'bomba', 'ventilador', 'compresor', 'condensador', 'intercambiador', 'otro'] },
        fabricante: { type: 'string' },
        modelo: { type: 'string' },
        especificacion_clave: { type: 'object', additionalProperties: true },
        equipo_asociado: { type: 'string' },
        confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        ocr_raw: { type: 'string' },
      },
      required: ['equipo_tipo', 'especificacion_clave'],
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