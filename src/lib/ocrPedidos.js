// ═══════════════════════════════════════════════════════════
// OCR PEDIDOS — InvokeLLM desde el frontend (sin función backend)
// ═══════════════════════════════════════════════════════════
// Motor primario: InvokeLLM modelo por defecto (~1 crédito, plan Starter).
// Re-procesamiento de precisión: gemini_3_flash (~5 créditos, plan superior).
// Siempre se intenta primero el nativo de Base44 (Starter) y solo se refuerza
// con el modelo superior cuando la primera pasada es incompleta.
// ═══════════════════════════════════════════════════════════

import { base44 } from '@/api/base44Client';

// JSON schema que el LLM debe devolver (siempre object, nunca array).
export const PEDIDO_OCR_SCHEMA = {
  type: 'object',
  properties: {
    order_number: { type: 'string', description: 'Número de pedido o albarán si existe, si no cadena vacía' },
    supplier: { type: 'string', description: 'Nombre del proveedor/vendedor' },
    date: { type: 'string', description: 'Fecha del documento en formato YYYY-MM-DD' },
    notes: { type: 'string', description: 'Observaciones o comentarios relevantes' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Descripción del artículo' },
          cantidad: { type: 'number', description: 'Cantidad (número)' },
          unidad: { type: 'string', description: 'Unidad (ud, m, kg, etc)' },
          precio: { type: 'number', description: 'Precio unitario con decimales' },
        },
      },
    },
    confianza: { type: 'number', description: 'Confianza global de la extracción 0-1 (1 = muy seguro)' },
  },
};

const PROMPT_OCR = `Extrae todos los datos del siguiente documento de pedido/albarán/factura de compra.
Instrucciones:
- date en formato YYYY-MM-DD. Si solo aparece dd/mm, usa el año actual.
- cantidad y precio como números (sin símbolos).
- unidad: unidad de medida (ud, m, kg, m², etc).
- Extrae TODAS las líneas de artículos que aparezcan.
- confianza: tu estimación de seguridad global (0-1). Si el documento está borroso, mal iluminado o incompleto, baja la confianza.
Si no encuentras algún campo déjalo vacío/0. No inventes datos.`;

/**
 * OCR primario (modelo por defecto, ~1 crédito, plan Starter).
 * Devuelve { datos, error }.
 */
export async function extraerDatosPedido(file_url) {
  if (!file_url) return { datos: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_OCR,
      file_urls: [file_url],
      response_json_schema: PEDIDO_OCR_SCHEMA,
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error en InvokeLLM' };
  }
}

/**
 * Re-procesamiento de precisión (gemini_3_flash, ~5 créditos, plan superior).
 * Mismo schema, modelo superior con visión. Solo se usa como refuerzo.
 */
export async function reprocesarPrecisionPedido(file_url) {
  if (!file_url) return { datos: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_OCR + '\n\nEsta es una segunda pasada de alta precisión: el documento fue marcado como de baja confianza en una extracción anterior. Esfuérzate al máximo para completar todos los campos y líneas de artículos posibles, aunque estén parcialmente legibles.',
      file_urls: [file_url],
      response_json_schema: PEDIDO_OCR_SCHEMA,
      model: 'gemini_3_flash',
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error en InvokeLLM (precisión)' };
  }
}

/**
 * Evalúa si los datos extraídos necesitan re-procesamiento de precisión.
 * Umbral: confianza < 0.6, o ausencia de campos clave, o sin líneas de artículos.
 * Devuelve { precisa: boolean, motivo: string }.
 */
export function evaluarPrecisionPedido(datos) {
  if (!datos) return { precisa: true, motivo: 'Sin datos extraídos' };
  const confianza = typeof datos.confianza === 'number' ? datos.confianza : 0.7;
  const faltantes = [];
  if (!datos.supplier) faltantes.push('supplier');
  if (!datos.date) faltantes.push('date');
  if (!datos.items || datos.items.length === 0) faltantes.push('items');

  if (confianza < 0.6) {
    return { precisa: true, motivo: `Confianza baja (${confianza.toFixed(2)})${faltantes.length ? ' · faltan: ' + faltantes.join(', ') : ''}` };
  }
  if (faltantes.length > 0) {
    return { precisa: true, motivo: `Faltan campos clave: ${faltantes.join(', ')}` };
  }
  return { precisa: false, motivo: '' };
}