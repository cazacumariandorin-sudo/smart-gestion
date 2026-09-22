import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { ocrDocumento } from '../../shared/aiOrchestrator.ts';

/**
 * procesarPlanoPlanta
 * OCR+IA especializado en planos de planta de instalaciones técnicas.
 * NO extrae la escala automáticamente (regla de diseño del documento:
 * "nunca extraer escala automáticamente sin calibración explícita").
 * En su lugar, propone UbicacionEquipo candidatas por simbología
 * reconocible y superficies rotuladas, para que el ingeniero las
 * confirme/reposicione en la página "Marcado de Equipos".
 *
 * Patrón: Base44 InvokeLLM PRIMARIO + Anthropic Claude FALLBACK (aiOrchestrator).
 * No escribe en DB — solo extracción (sugerencias candidatas).
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

    const prompt = `Eres un sistema OCR+visión especializado en planos de planta de instalaciones técnicas (BMS, refrigeración industrial, climatización, electricidad).
Analiza el plano (probablemente pre-procesado tipo CamScanner: recortado, enderezado).
Propón UbicacionEquipo CANDIDATAS por simbología reconocible y superficies rotuladas.
NUNCA extraigas ni asumas la escala: las coordenadas que devuelvas son APROXIMADAS en píxeles de la imagen para que el ingeniero las confirme/reposicione; la calibración se hace aparte (PlanoCalibracion).

Devuelve SOLO un JSON con esta estructura:
{
  "nombre_planta": "nombre de la planta/estancia si está rotulada ('Planta Baja', 'Sala de Máquinas'); cadena vacía si no",
  "superficies_rotuladas": [
    { "nombre": "Sala Estabulario", "superficie_m2": 26.60 },
    { "nombre": "Sala de Despiece", "superficie_m2": null }
  ],
  "equipos_candidatos": [
    {
      "tag_equipo": "TAG o etiqueta del equipo si está rotulada (M1, V01, C01, CD, BMS-NODO-3); cadena vacía si no rotulado",
      "tipo": "cuadro_control|caldera|bomba|enfriadora|sonda|valvula|climatizador|compresor|condensador|otro",
      "x_pct": número entre 0 y 1 (posición horizontal APROXIMADA sobre el ancho de la imagen),
      "y_pct": número entre 0 y 1 (posición vertical APROXIMADA sobre el alto de la imagen),
      "confianza_ubicacion": "alta|media|baja",
      "observacion": "por qué se reconoce (símbolo de bomba, cuadro rotulado, etc.)"
    }
  ],
  "anotaciones_manuscritas": [
    "texto literal de anotaciones manuscritas en color detectadas, si las hay"
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible (rótulos, cotas, leyendas)"
}

Instrucciones estrictas:
- Las posiciones (x_pct, y_pct) son FRACCIÓN de la imagen (0-1), NO píxeles ni metros: el frontend las convierte a píxeles del canvas. Es una sugerencia para que el ingeniero reubique.
- tipo se infiere por la simbología estándar (cuadro = rectángulo con barras, bomba = círculo con flecha, caldera = rectángulo con serpentín, sonda = círculo pequeño, válvula = dos triángulos).
- NO asumas escala ni distancias: si el plano NO tiene cota impresa, deja superficies_rotuladas con superficie_m2 null y obvia cualquier cálculo de metros.
- Solo propone equipos con confianza_ubicacion media o alta; los de baja se omiten (mejor no sugerir que sugerir mal).
- anotaciones_manuscritas: solo texto literal, sin interpretar (la clasificación patrón la hace el backend de conciliación, no esta función).`;

    const responseSchema = {
      type: 'object',
      properties: {
        nombre_planta: { type: 'string' },
        superficies_rotuladas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string' },
              superficie_m2: { type: ['number', 'null'] },
            },
            required: ['nombre'],
          },
        },
        equipos_candidatos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tag_equipo: { type: 'string' },
              tipo: { type: 'string', enum: ['cuadro_control', 'caldera', 'bomba', 'enfriadora', 'sonda', 'valvula', 'climatizador', 'compresor', 'condensador', 'otro'] },
              x_pct: { type: 'number' },
              y_pct: { type: 'number' },
              confianza_ubicacion: { type: 'string', enum: ['alta', 'media', 'baja'] },
              observacion: { type: 'string' },
            },
            required: ['tipo', 'x_pct', 'y_pct'],
          },
        },
        anotaciones_manuscritas: { type: 'array', items: { type: 'string' } },
        confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
        ocr_raw: { type: 'string' },
      },
      required: ['equipos_candidatos'],
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