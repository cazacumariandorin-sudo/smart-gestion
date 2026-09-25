// ═══════════════════════════════════════════════════════════
// OCR MULTAS — InvokeLLM desde el frontend (sin función backend)
// ═══════════════════════════════════════════════════════════
// Motor primario: InvokeLLM modelo por defecto (~1 crédito).
// Respaldo IA: gemini_3_flash (~5 créditos) para baja confianza.
// Replica la arquitectura del módulo Económico (ocrGastos.js).
// ═══════════════════════════════════════════════════════════

import { base44 } from '@/api/base44Client';

// ── Schema: Volante oficial / multa ──────────────────────────
export const MULTA_OCR_SCHEMA = {
  type: 'object',
  properties: {
    fecha_multa: { type: 'string', description: 'Fecha de la infracción en formato YYYY-MM-DD' },
    hora_multa: { type: 'string', description: 'Hora y minuto de la infracción en formato HH:MM (24h). IMPRESCINDIBLE extraer siempre que aparezca en el documento.' },
    importe: { type: 'number', description: 'Importe de la multa en euros (número, no string)' },
    autoridad: { type: 'string', description: 'Organismo o empresa que emite la multa (Ayuntamiento de..., SER, ORA, empresa de parking...)' },
    autoridad_nif: { type: 'string', description: 'NIF/CIF de la autoridad emisora si aparece impreso' },
    numero_expediente: { type: 'string', description: 'Número de expediente / referencia impreso en el volante' },
    lugar_infraccion: { type: 'string', description: 'Lugar o dirección donde se cometió la infracción' },
    matricula_impresa: { type: 'string', description: 'Matrícula del vehículo impresa en el documento' },
    motivo: { type: 'string', description: 'Motivo textual de la infracción tal como aparece impreso' },
    codigo_barras: { type: 'string', description: 'Código de barras o QR impreso en el documento' },
    confianza: { type: 'number', description: 'Confianza global de la extracción 0-1 (1 = muy seguro)' },
  },
};

const PROMPT_MULTA = `Analiza este aviso o multa de vehículo y extrae TODOS los datos estructurados visibles.
Instrucciones CRÍTICAS:
- fecha_multa: fecha de la infracción en formato YYYY-MM-DD. Si solo aparece dd/mm, usa el año actual.
- hora_multa: hora y minuto de la infracción en formato HH:MM (24h). ES IMPRESCINDIBLE extraerla siempre que aparezca en el documento, aunque esté parcialmente legible. Si el documento no trae hora, devuelve cadena vacía.
- importe: número en euros sin símbolo €.
- autoridad: organismo emisor (Ayuntamiento de Madrid, SER, ORA, empresa de parking, DGT...).
- autoridad_nif: NIF/CIF del emisor si es legible.
- numero_expediente: referencia/expediente impreso en el volante.
- lugar_infraccion: calle, zona o dirección donde se cometió la infracción.
- matricula_impresa: matrícula del vehículo si aparece impresa.
- motivo: texto literal del motivo de la infracción (no_exhibir_tique, exceso de tiempo, zona no autorizada, estacionamiento prohibido...).
- codigo_barras: código de barras o QR si aparece.
- confianza: tu estimación de seguridad global (0-1). Si el documento está borroso, mal iluminado o incompleto, baja la confianza.
Si un campo no es legible, devuelve cadena vacía o null. No inventes datos.`;

/**
 * OCR primario del volante/multa (modelo por defecto, ~1 crédito).
 */
export async function extraerDatosMulta(file_url) {
  if (!file_url) return { datos: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_MULTA,
      file_urls: [file_url],
      response_json_schema: MULTA_OCR_SCHEMA,
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error en InvokeLLM' };
  }
}

/**
 * Respaldo IA: re-procesamiento de precisión del volante (gemini_3_flash, ~5 créditos).
 */
export async function reprocesarPrecisionMulta(file_url) {
  if (!file_url) return { datos: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_MULTA + '\n\nEsta es una segunda pasada de alta precisión con un modelo superior: el documento fue marcado como de baja confianza en una extracción anterior. Esfuérzate al máximo para completar todos los campos posibles, especialmente fecha_multa, hora_multa e importe, aunque estén parcialmente legibles.',
      file_urls: [file_url],
      response_json_schema: MULTA_OCR_SCHEMA,
      model: 'gemini_3_flash',
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error en respaldo IA' };
  }
}

/**
 * Evalúa si los datos del volante necesitan respaldo IA.
 * Umbral: confianza < 0.6 o ausencia de campos clave (fecha, importe, hora).
 */
export function evaluarPrecisionMulta(datos) {
  if (!datos) return { precisa: true, motivo: 'Sin datos extraídos' };
  const confianza = typeof datos.confianza === 'number' ? datos.confianza : 0.7;
  const faltantes = [];
  if (datos.importe == null || datos.importe === '' || Number.isNaN(Number(datos.importe))) faltantes.push('importe');
  if (!datos.fecha_multa) faltantes.push('fecha_multa');
  if (!datos.hora_multa) faltantes.push('hora_multa');
  if (confianza < 0.6) {
    return { precisa: true, motivo: `Confianza baja (${confianza.toFixed(2)})${faltantes.length ? ' · faltan: ' + faltantes.join(', ') : ''}` };
  }
  if (faltantes.length > 0) {
    return { precisa: true, motivo: `Faltan campos clave: ${faltantes.join(', ')}` };
  }
  return { precisa: false, motivo: '' };
}

// ── Schema: Justificante del técnico (ticket de parking, parquímetro...) ──
export const JUSTIFICANTE_OCR_SCHEMA = {
  type: 'object',
  properties: {
    fecha_documento: { type: 'string', description: 'Fecha del justificante en formato YYYY-MM-DD' },
    hora_documento: { type: 'string', description: 'Hora y minuto en formato HH:MM (24h). IMPRESCINDIBLE extraer siempre.' },
    importe: { type: 'number', description: 'Importe en euros (número)' },
    nombre_comercio: { type: 'string', description: 'Operador o empresa del parking / servicio' },
    lugar: { type: 'string', description: 'Lugar o dirección del parking' },
    matricula_impresa: { type: 'string', description: 'Matrícula impresa en el ticket' },
    codigo_validacion: { type: 'string', description: 'Código de validación / QR del ticket' },
    tipo_justificante: { type: 'string', enum: ['parking', 'parquimetro', 'ticket', 'otro'], description: 'Tipo de justificante' },
    confianza: { type: 'number', description: 'Confianza global 0-1' },
  },
};

const PROMPT_JUSTIFICANTE = `Analiza este justificante o ticket (de parking, parquímetro, etc.) y extrae TODOS los datos estructurados.
Instrucciones CRÍTICAS:
- fecha_documento: fecha del justificante en formato YYYY-MM-DD. Si solo dd/mm, usa el año actual.
- hora_documento: hora y minuto en formato HH:MM (24h). ES IMPRESCINDIBLE extraerla siempre que aparezca, aunque esté parcialmente legible. Si no aparece hora, devuelve cadena vacía.
- importe: número en euros sin símbolo.
- nombre_comercio: operador del parking o empresa emisora del ticket.
- lugar: dirección o zona del parking.
- matricula_impresa: matrícula del vehículo si aparece impresa en el ticket.
- codigo_validacion: código de validación o QR si aparece.
- tipo_justificante: parking, parquimetro, ticket, otro.
- confianza: 0-1. Baja si está borroso o ilegible.
No inventes datos. Si un campo no es legible, devuelve cadena vacía.`;

export async function extraerDatosJustificante(file_url) {
  if (!file_url) return { datos: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_JUSTIFICANTE,
      file_urls: [file_url],
      response_json_schema: JUSTIFICANTE_OCR_SCHEMA,
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error en InvokeLLM' };
  }
}

export async function reprocesarPrecisionJustificante(file_url) {
  if (!file_url) return { datos: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_JUSTIFICANTE + '\n\nSegunda pasada de alta precisión: el documento fue marcado como de baja confianza. Esfuérzate al máximo para completar fecha_documento, hora_documento e importe.',
      file_urls: [file_url],
      response_json_schema: JUSTIFICANTE_OCR_SCHEMA,
      model: 'gemini_3_flash',
    });
    const datos = res && typeof res === 'object' ? res : (res?.output || null);
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'Error en respaldo IA' };
  }
}

export function evaluarPrecisionJustificante(datos) {
  if (!datos) return { precisa: true, motivo: 'Sin datos extraídos' };
  const confianza = typeof datos.confianza === 'number' ? datos.confianza : 0.7;
  const faltantes = [];
  if (!datos.fecha_documento) faltantes.push('fecha_documento');
  if (!datos.hora_documento) faltantes.push('hora_documento');
  if (confianza < 0.6) {
    return { precisa: true, motivo: `Confianza baja (${confianza.toFixed(2)})${faltantes.length ? ' · faltan: ' + faltantes.join(', ') : ''}` };
  }
  if (faltantes.length > 0) {
    return { precisa: true, motivo: `Faltan campos clave: ${faltantes.join(', ')}` };
  }
  return { precisa: false, motivo: '' };
}

/**
 * Mapea el motivo textual extraído por OCR al enum motivo_autoridad del entity.
 */
export function mapearMotivoAutoridad(motivoTexto) {
  if (!motivoTexto) return { motivo_autoridad: 'no_exhibir_tique', detalle: '' };
  const t = motivoTexto.toLowerCase();
  if (t.includes('no exhibir') || t.includes('no exhib')) return { motivo_autoridad: 'no_exhibir_tique', detalle: '' };
  if (t.includes('exceso de tiempo') || t.includes('exceso') || t.includes('tiempo excedido')) return { motivo_autoridad: 'exceso_tiempo', detalle: '' };
  if (t.includes('zona no autorizada') || t.includes('no autorizada')) return { motivo_autoridad: 'zona_no_autorizada', detalle: '' };
  if (t.includes('estacionamiento prohibido') || t.includes('prohibido') || t.includes('estacionar')) return { motivo_autoridad: 'estacionamiento_prohibido', detalle: '' };
  return { motivo_autoridad: 'otro', detalle: motivoTexto };
}