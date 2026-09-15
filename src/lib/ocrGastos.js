// ═══════════════════════════════════════════════════════════
// OCR GASTOS — InvokeLLM desde el frontend (sin función backend)
// ═══════════════════════════════════════════════════════════
// Motor primario: InvokeLLM modelo por defecto (~1 crédito).
// Re-procesamiento de precisión: gemini_3_flash (~5 créditos).
// Funciona en el plan Starter (no requiere funciones backend).
// ═══════════════════════════════════════════════════════════

import { base44 } from '@/api/base44Client';

// JSON schema que el LLM debe devolver (siempre object, nunca array).
export const GASTO_OCR_SCHEMA = {
  type: 'object',
  properties: {
    nombre_comercio: { type: 'string', description: 'Nombre del comercio o proveedor emisor del ticket/factura' },
    nif_comercio: { type: 'string', description: 'NIF/CIF del comercio emisor (B12345678)' },
    fecha_documento: { type: 'string', description: 'Fecha del documento en formato YYYY-MM-DD' },
    importe: { type: 'number', description: 'Importe total en euros (número, no string)' },
    categoria: {
      type: 'string',
      enum: ['material', 'combustible', 'peaje', 'parking', 'comida', 'otros'],
      description: 'Categoría del gasto deducida del documento',
    },
    numero_factura: { type: 'string', description: 'Número de factura/albarán/proforma impreso' },
    localidad: { type: 'string', description: 'Localidad / población del emisor impresa en el justificante' },
    forma_pago_documento: { type: 'string', description: 'Forma de pago impresa en el justificante (EFECTIVO, TARJETA, TRANSFERENCIA...)' },
    hora_documento: { type: 'string', description: 'Hora impresa en el justificante en formato HH:MM (24h). Clave para distinguir documentos del mismo día/comercio/importe emitidos a distinta hora (ej: peajes de tramos sucesivos).' },
    codigo_validacion_fiscal: { type: 'string', description: 'Código QR o de barras (identificador único de transacción) si aparece' },
    concepto: { type: 'string', description: 'Descripción breve del concepto del gasto' },
    confianza: { type: 'number', description: 'Confianza global de la extracción 0-1 (1 = muy seguro)' },
  },
};

const PROMPT_OCR = `Analiza este ticket o factura de gasto y extrae los datos estructurados.
Instrucciones:
- fecha_documento en formato YYYY-MM-DD. Si solo aparece dd/mm, usa el año actual.
- importe como número (sin símbolo €).
- categoria: elige la más adecuada (material, combustible, peaje, parking, comida, otros).
- nif_comercio: NIF/CIF del emisor si es legible.
- numero_factura: número impreso del documento.
- localidad: población/localidad del emisor si aparece impresa (ej: Madrid, Valencia). Solo la localidad, no la dirección completa.
- forma_pago_documento: forma de pago impresa en el justificante (EFECTIVO, TARJETA, TRANSFERENCIA, etc.). Tal cual aparece, en mayúsculas si así viene.
- hora_documento: hora impresa en el justificante en formato HH:MM (24h). Si el documento no trae hora, devuelve cadena vacía. Es CRÍTICO para distinguir peajes del mismo día, mismo importe y mismo comercio pero a hora distinta (tramos sucesivos de autopista).
- codigo_validacion_fiscal: código QR/hash si aparece.
- confianza: tu estimación de seguridad global (0-1). Si el documento está borroso, mal iluminado o incompleto, baja la confianza.
Si un campo no es legible, devuelve cadena vacía o null. No inventes datos.`;

/**
 * OCR primario (modelo por defecto, ~1 crédito).
 * Devuelve { datos, error }.
 */
export async function extraerDatosGasto(file_url) {
  if (!file_url) return { datos: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_OCR,
      file_urls: [file_url],
      response_json_schema: GASTO_OCR_SCHEMA,
    });
    // InvokeLLM con schema devuelve un dict (no hace falta parsear).
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error en InvokeLLM' };
  }
}

/**
 * Re-procesamiento de precisión (gemini_3_flash, ~5 créditos).
 * Mismo schema, modelo superior con visión.
 */
export async function reprocesarPrecisionGasto(file_url) {
  if (!file_url) return { datos: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_OCR + '\n\nEsta es una segunda pasada de alta precisión: el documento fue marcado como de baja confianza en una extracción anterior. Esfuérzate al máximo para completar todos los campos posibles, aunque estén parcialmente legibles.',
      file_urls: [file_url],
      response_json_schema: GASTO_OCR_SCHEMA,
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
 * Umbral: confianza < 0.6 o ausencia de campos clave.
 * Devuelve { precisa: boolean, motivo: string }.
 */
export function evaluarPrecision(datos) {
  if (!datos) return { precisa: true, motivo: 'Sin datos extraídos' };
  const confianza = typeof datos.confianza === 'number' ? datos.confianza : 0.7;
  const faltantes = [];
  if (datos.importe == null || datos.importe === '' || Number.isNaN(Number(datos.importe))) faltantes.push('importe');
  if (!datos.fecha_documento) faltantes.push('fecha_documento');
  if (!datos.nombre_comercio) faltantes.push('nombre_comercio');

  if (confianza < 0.6) {
    return { precisa: true, motivo: `Confianza baja (${confianza.toFixed(2)})${faltantes.length ? ' · faltan: ' + faltantes.join(', ') : ''}` };
  }
  if (faltantes.length > 0) {
    return { precisa: true, motivo: `Faltan campos clave: ${faltantes.join(', ')}` };
  }
  return { precisa: false, motivo: '' };
}

/**
 * Compara datos guardados vs extraídos en la pasada de precisión
 * y construye un diff legible para auditoría.
 */
export function construirDiff(guardado, extraido) {
  const campos = ['importe', 'fecha_documento', 'hora_documento', 'nombre_comercio', 'nif_comercio', 'numero_factura', 'localidad', 'forma_pago_documento', 'categoria', 'codigo_validacion_fiscal', 'concepto'];
  const cambios = [];
  for (const c of campos) {
    const a = guardado?.[c];
    const b = extraido?.[c];
    const aStr = a == null || a === '' ? '' : String(a);
    const bStr = b == null || b === '' ? '' : String(b);
    if (aStr !== bStr) {
      // solo registrar si el nuevo aporta algo que antes estaba vacío o corrige
      if (bStr && bStr !== aStr) {
        cambios.push(`${c}: "${aStr || '—'}" → "${bStr}"`);
      }
    }
  }
  return cambios.join(' | ');
}