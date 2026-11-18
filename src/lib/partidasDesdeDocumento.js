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

// Esquema con precios: al completar un presupuesto sí se recogen los importes
// que el documento indica en sus tablas (nunca se inventan).
const PARTIDAS_COMPLETAS_SCHEMA = {
  type: 'object',
  properties: {
    partidas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          capitulo: { type: 'string', description: 'Capítulo o apartado del documento (A. Albañilería, B. Instalación eléctrica...)' },
          descripcion: { type: 'string', description: 'Descripción de la partida tal como figura en el documento' },
          cantidad: { type: 'number', description: 'Cantidad indicada en el documento. Si no figura, 1' },
          cantidad_detectada: { type: 'boolean', description: 'true solo si la cantidad figura de forma explícita' },
          unidad: { type: 'string', description: 'Unidad del documento (ud, ml, m, m2, PA). Si no figura, "ud"' },
          medicion: { type: 'string', description: 'Texto de medición del que sale la cantidad' },
          detalle: { type: 'string', description: 'Aclaraciones del documento sobre la partida' },
          precio_unitario: { type: 'number', description: 'Precio unitario del documento. 0 si no figura' },
          precio_detectado: { type: 'boolean', description: 'true solo si el documento da precio o importe de esa partida' },
          iva_pct: { type: 'number', description: 'IVA indicado en el documento (ej. 10 en reforma de vivienda). 0 si no figura' },
        },
      },
    },
    datos_no_disponibles: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * Extrae el texto del documento (Word) para que la IA trabaje sobre el contenido
 * real y no lo interprete. Si no se puede, se devuelve cadena vacía.
 */
async function textoDelDocumento(file_url) {
  try {
    const res = await base44.functions.invoke('extraerTextoDocumento', { file_url });
    return String(res?.data?.texto || '');
  } catch (e) {
    return '';
  }
}

/**
 * Analiza el documento y devuelve SOLO las partidas que aún no están en el
 * presupuesto (comparación semántica: no repite partidas ya cubiertas).
 */
export async function partidasFaltantesDocumento({ file_url, file_name, cliente_name, obra_name, existentes = [] }) {
  if (!file_url) return { datos: null, error: 'Sin documento que analizar' };

  const texto = await textoDelDocumento(file_url);
  const contexto = [
    file_name ? `Documento: ${file_name}` : null,
    cliente_name ? `Cliente: ${cliente_name}` : null,
    obra_name ? `Obra: ${obra_name}` : null,
  ].filter(Boolean).join('\n');

  const yaIncluidas = existentes
    .filter(c => c.descripcion)
    .map((c, i) => `${i + 1}. ${c.descripcion}${c.cantidad ? ` (${c.cantidad} ${c.unidad || 'ud'})` : ''}`)
    .join('\n');

  const prompt = `Analiza el presupuesto de obra adjunto y devuelve las PARTIDAS de trabajo que contiene.

Reglas:
- Una partida por cada línea de las tablas del documento (capítulos A, B...), con su capítulo.
- Usa la descripción, cantidad, unidad y precio EXACTOS del documento. Si el documento no da precio, 0 y precio_detectado=false.
- Si el documento indica un importe cerrado (PA / "importe"), cantidad 1, unidad "PA" y precio_unitario = importe.
- Incluye también las líneas de cable, zanja y mecanismos que el documento detalla, con sus mediciones.
- PROHIBIDO añadir trabajos que el documento no mencione y PROHIBIDO incluir lo que el documento marque como excluido.
- iva_pct: el tipo de IVA que indique el documento para el conjunto; 0 si no figura.

El presupuesto que se está revisando YA incluye estas líneas:
${yaIncluidas || '(ninguna)'}

Devuelve ÚNICAMENTE las partidas del documento que NO estén ya cubiertas por esa lista, comparando por concepto aunque cambie la redacción (sinónimos: roza/regata, zanja/excavación, mecanismo/aparato, cuadro/armario, marco/placa). No devuelvas partidas ya incluidas ni variantes de ellas.

${contexto}`;

  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: texto ? `${prompt}\n\nTEXTO DEL DOCUMENTO:\n${texto}` : prompt,
      ...(texto ? {} : { file_urls: [file_url] }),
      response_json_schema: PARTIDAS_COMPLETAS_SCHEMA,
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    if (!datos) return { datos: null, error: 'La IA no devolvió ninguna partida' };
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error al analizar el documento' };
  }
}

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