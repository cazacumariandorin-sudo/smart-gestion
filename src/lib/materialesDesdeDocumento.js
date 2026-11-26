// ═══════════════════════════════════════════════════════════
// MATERIALES PENDIENTES DESDE DOCUMENTO
// Analiza un documento (PDF, Word, Excel, listado de materiales,
// mediciones, memoria...) y propone los materiales pendientes de
// solicitar. Nunca inventa cantidades: lo que no consta se marca.
// ═══════════════════════════════════════════════════════════

import { base44 } from '@/api/base44Client';

export const MATERIALES_DOCUMENTO_SCHEMA = {
  type: 'object',
  properties: {
    resumen: { type: 'string', description: 'Resumen de lo que describe el documento' },
    materiales: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          descripcion: { type: 'string', description: 'Material tal como figura en el documento' },
          referencia: { type: 'string', description: 'Código o referencia del material si figura. Vacío si no' },
          cantidad: { type: 'number', description: 'Cantidad indicada en el documento. Si no figura, 1' },
          cantidad_detectada: { type: 'boolean', description: 'true solo si la cantidad figura de forma explícita' },
          unidad: { type: 'string', description: 'Unidad del documento (ud, m, m2, m3, kg, rollo, caja...). Si no figura, "ud"' },
          prioridad: {
            type: 'string',
            enum: ['baja', 'media', 'alta'],
            description: 'alta si el documento la marca como urgente o es imprescindible para continuar; si no, media',
          },
          observaciones: { type: 'string', description: 'Aclaraciones del documento (ubicación, acabado, medida...)' },
        },
        required: ['descripcion'],
      },
    },
    datos_no_disponibles: { type: 'array', items: { type: 'string' } },
    confianza: { type: 'number', description: 'Confianza global de la extracción 0-1' },
  },
  required: ['materiales'],
};

const PROMPT = `Analiza el documento adjunto (listado de materiales, mediciones, memoria de obra, albarán o pedido pendiente, Excel de materiales...) y extrae los MATERIALES PENDIENTES de solicitar.

Reglas obligatorias:
- Una entrada por cada material o suministro identificable.
- Usa la descripción del documento. NO inventes materiales, referencias ni cantidades que no aparezcan.
- cantidad: solo si el documento la indica de forma explícita. Si no figura, devuelve 1 y cantidad_detectada=false.
- unidad: la del documento; si no figura, "ud".
- prioridad: "alta" solo si el documento la marca como urgente o imprescindible para continuar; en caso contrario "media".
- En "observaciones" recoge aclaraciones del documento (medidas, acabados, ubicación en obra).
- En "datos_no_disponibles" lista lo que el documento no permite determinar.
- Si el documento no trata de materiales (una factura ya recibida, un plano sin texto, una imagen ilegible), devuelve materiales vacío y explícalo en "resumen".
- confianza: tu seguridad global (0-1).`;

async function textoDelDocumento(file_url) {
  try {
    const res = await base44.functions.invoke('extraerTextoDocumento', { file_url });
    return String(res?.data?.texto || '');
  } catch {
    return '';
  }
}

/**
 * Analiza un documento y devuelve { datos, error }.
 */
export async function analizarMaterialesDocumento({ file_url, file_name, obra_name, cliente_name }) {
  if (!file_url) return { datos: null, error: 'Sin documento que analizar' };

  const texto = await textoDelDocumento(file_url);
  const contexto = [
    file_name ? `Documento: ${file_name}` : null,
    cliente_name ? `Cliente: ${cliente_name}` : null,
    obra_name ? `Obra: ${obra_name}` : null,
  ].filter(Boolean).join('\n');

  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: texto ? `${PROMPT}\n\n${contexto}\n\nTEXTO DEL DOCUMENTO:\n${texto}` : `${PROMPT}\n\n${contexto}`,
      ...(texto ? {} : { file_urls: [file_url] }),
      response_json_schema: MATERIALES_DOCUMENTO_SCHEMA,
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    if (!datos) return { datos: null, error: 'La IA no devolvió ningún material' };
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error al analizar el documento' };
  }
}