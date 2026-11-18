// ═══════════════════════════════════════════════════════════
// PARTIDAS DESDE DOCUMENTACIÓN DE OBRA — Fase 1
// Analiza un documento (Word, Excel, PDF) con InvokeLLM y propone
// partidas de presupuesto (descripción + cantidad detectada, sin precios).
// Nunca inventa mediciones: lo que no consta se marca como no disponible.
// ═══════════════════════════════════════════════════════════

import { base44 } from '@/api/base44Client';

export const PARTIDAS_DOCUMENTO_SCHEMA = {
  type: 'object',
  properties: {
    resumen: { type: 'string', description: 'Resumen del alcance de los trabajos descritos en el documento' },
    partidas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          capitulo: { type: 'string', description: 'Capítulo o apartado del documento (vacío si no tiene)' },
          descripcion: { type: 'string', description: 'Descripción del trabajo tal como figura en el documento' },
          cantidad: { type: 'number', description: 'Cantidad indicada en el documento. Si no figura, 1' },
          cantidad_detectada: { type: 'boolean', description: 'true solo si la cantidad figura de forma explícita en el documento' },
          unidad: { type: 'string', description: 'Unidad del documento (ud, m, m2, m3, kg, h, día). Si no figura, "ud"' },
          medicion: { type: 'string', description: 'Texto de medición del que sale la cantidad, si existe' },
          detalle: { type: 'string', description: 'Aclaraciones del documento sobre la partida (materiales, ubicación...)' },
        },
      },
    },
    supuestos: { type: 'array', items: { type: 'string' }, description: 'Decisiones tomadas al interpretar el documento' },
    datos_no_disponibles: { type: 'array', items: { type: 'string' }, description: 'Datos que el documento no permite determinar' },
    confianza: { type: 'number', description: 'Confianza global de la extracción 0-1' },
  },
};

const PROMPT_BASE = `Analiza el documento adjunto (documentación de obra: memoria, pliego, listado de trabajos, mediciones, Excel de partidas, descripción de trabajos...) y propone las PARTIDAS de presupuesto que describe.

Reglas obligatorias:
- Extrae una partida por cada trabajo o suministro identificable.
- Usa la descripción del documento. NO inventes trabajos, materiales ni mediciones que no aparezcan.
- cantidad: solo si el documento la indica de forma explícita o mediante una medición clara. Si no figura, devuelve 1 y cantidad_detectada=false.
- unidad: la que use el documento; si no figura, "ud".
- NO devuelvas precios ni importes: la valoración económica se hace en una fase posterior.
- Agrupa en "capitulo" cuando el documento tenga apartados o capítulos; si no, déjalo vacío.
- En "supuestos" explica en una frase cada decisión de interpretación que hayas tomado.
- En "datos_no_disponibles" lista lo que el documento no permite determinar (por ejemplo "No consta la medición de zanjas").
- Si el documento no describe trabajos (una factura, un plano sin texto, una imagen ilegible), devuelve partidas vacías y explícalo en resumen.
- confianza: tu seguridad global (0-1).`;

/**
 * Analiza un documento y devuelve { datos, error }.
 */
export async function analizarPartidasDocumento({ file_url, file_name, cliente_name, obra_name }) {
  if (!file_url) return { datos: null, error: 'Sin documento que analizar' };
  const contexto = [
    file_name ? `Documento: ${file_name}` : null,
    cliente_name ? `Cliente: ${cliente_name}` : null,
    obra_name ? `Obra: ${obra_name}` : null,
  ].filter(Boolean).join('\n');

  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `${PROMPT_BASE}\n\n${contexto}`,
      file_urls: [file_url],
      response_json_schema: PARTIDAS_DOCUMENTO_SCHEMA,
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    if (!datos) return { datos: null, error: 'La IA no devolvió ninguna partida' };
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error al analizar el documento' };
  }
}