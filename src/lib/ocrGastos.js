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

// ═══════════════════════════════════════════════════════════
// OCR MULTI-TICKET — detecta N tickets en una sola foto
// ═══════════════════════════════════════════════════════════
// Schema: { n_documentos, tipo_caso, documentos[] }
// tipo_caso: uno_solo | multi_ticket | ticket_parcial | reverso_sin_importe | imagen_invalida
// ═══════════════════════════════════════════════════════════

export const GASTO_OCR_SCHEMA_MULTI = {
  type: 'object',
  properties: {
    n_documentos: {
      type: 'integer',
      description: 'Número de documentos distintos detectados en la imagen (0, 1, 2, 3...)',
    },
    tipo_caso: {
      type: 'string',
      enum: ['uno_solo', 'multi_ticket', 'ticket_parcial', 'reverso_sin_importe', 'imagen_invalida'],
      description: 'Clasificación del contenido de la imagen',
    },
    confianza_global: {
      type: 'number',
      description: 'Confianza global de la detección 0-1',
    },
    advertencias: {
      type: 'array',
      items: { type: 'string' },
      description: 'Avisos relevantes para el usuario o la administración',
    },
    documentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre_comercio:          { type: 'string' },
          nif_comercio:             { type: 'string' },
          fecha_documento:          { type: 'string' },
          hora_documento:           { type: 'string' },
          importe:                  { type: 'number' },
          categoria: {
            type: 'string',
            enum: ['combustible', 'peaje', 'parking', 'comida', 'material', 'otros'],
          },
          numero_factura:           { type: 'string' },
          codigo_validacion_fiscal: { type: 'string' },
          localidad:                { type: 'string' },
          forma_pago_documento:     { type: 'string' },
          concepto:                 { type: 'string' },
          confianza:                { type: 'number' },
          ocr_raw:                  { type: 'string' },
        },
      },
    },
  },
  required: ['n_documentos', 'tipo_caso', 'confianza_global', 'documentos'],
};

const PROMPT_OCR_MULTI = `Eres un sistema experto en análisis de justificantes de gasto en España
(tickets simplificados, facturas, albaranes, peajes, recibos de parking,
tickets de gasolina, facturas de restaurante y hostelería).

TAREA PRINCIPAL: analizar la imagen y determinar CUÁNTOS documentos distintos contiene.

PASO 1 — DETECCIÓN DE DOCUMENTOS EN LA IMAGEN

Antes de extraer datos, determina qué contiene la imagen:

■ TIPO A — 1 documento completo
  La imagen muestra un único ticket, factura o recibo completo y legible.
  → n_documentos=1, tipo_caso="uno_solo".

■ TIPO B — Múltiples documentos distintos en la misma foto
  La imagen muestra 2 o más tickets/facturas de DISTINTOS comercios o de
  distinto importe/fecha/número dispuestos en la misma fotografía.
  → Extrae los datos de CADA documento por separado en el array "documentos".
  → n_documentos = número de documentos distintos. tipo_caso="multi_ticket".
  SEÑALES DE DETECCIÓN:
  - Distintas cabeceras/logos de comercio en la misma imagen.
  - Distintos bloques de "TOTAL" / "IMPORTE" en distintas zonas de la imagen.
  - Distintas fechas/horas impresas en zonas distintas.
  - Distintos números de ticket o de factura.
  - Separación física entre tickets (espacio en blanco, borde, doblez).

■ TIPO C — Ticket parcial (imagen incompleta de un único documento)
  Foto cortada, borrosa en zona clave, o ticket doblado que oculta el total.
  → n_documentos=1, tipo_caso="ticket_parcial".
  → Extrae lo que puedas. Deja vacíos los campos no visibles.
  → Pon confianza baja (0.3-0.5).

■ TIPO D — Reverso o pie de ticket sin importe total
  El dorso de un ticket o una parte sin información fiscal.
  → n_documentos=0, tipo_caso="reverso_sin_importe". documentos=[].

■ TIPO E — Imagen inválida (blanco, negro, sin texto)
  → n_documentos=0, tipo_caso="imagen_invalida". documentos=[].

PASO 2 — EXTRACCIÓN DE DATOS (por cada documento)

Para CADA documento detectado, extrae:

• nombre_comercio: Nombre del comercio o proveedor emisor.
• nif_comercio: NIF/CIF del emisor (formato B12345678 o 12345678Z). Vacío si no aparece.
• fecha_documento: Fecha en YYYY-MM-DD. Si solo aparece dd/mm usa el año actual.
• hora_documento: Hora en HH:MM (24h). CRÍTICO para distinguir peajes del mismo tramo/día.
• importe: IMPORTE TOTAL FINAL como número (sin € ni puntos de miles; usa punto decimal).
  Busca "TOTAL", "TOTAL A PAGAR", "TOTAL FACTURA", "IMPORTE TOTAL".
  NUNCA uses subtotales, bases imponibles ni importes parciales.
  Si hay IVA desglosado: el importe es base+IVA (lo que paga el cliente).
  Si hay descuento aplicado: el importe es el precio tras el descuento.
  Si no puedes determinar el TOTAL con seguridad → null.
• categoria: "combustible"|"peaje"|"parking"|"comida"|"material"|"otros"
• numero_factura: Nº de ticket/factura/albarán impreso. Vacío en tickets sin número.
• codigo_validacion_fiscal: Código QR/CSV de validación fiscal. Vacío si no aparece.
• localidad: Solo el nombre de la población del emisor. Vacío si no aparece.
• forma_pago_documento: "EFECTIVO", "TARJETA", etc. Tal cual aparece. Vacío si no.
• concepto: Descripción breve del gasto (máx 60 chars).
• confianza: Seguridad global de esta extracción (0-1).
• ocr_raw: Transcripción COMPLETA del texto de ESTE documento (solo sus líneas).

PASO 3 — CASOS ESPECIALES

PEAJES SUCESIVOS DEL MISMO DÍA: si hay varios tickets del mismo operador de peaje
pero con DISTINTA HORA → son documentos DISTINTOS. Trátalos como multi_ticket.

TICKET CON DESCUENTO: el importe es el TOTAL DESPUÉS del descuento.

FACTURA CON IVA DESGLOSADO: importe = base + IVA (el total que paga el cliente).

TICKET DE GASOLINERA: importe = litros × precio/litro (precio total pagado).

DEVOLUCIÓN / ABONO: importe negativo (ej: -12.50).

REGLAS DEL JSON:
- Si tipo_caso="uno_solo" → documentos tiene exactamente 1 elemento.
- Si tipo_caso="multi_ticket" → documentos tiene N>=2 elementos, uno por ticket.
- Si tipo_caso="ticket_parcial" → documentos tiene 1 elemento con los campos disponibles.
- Si tipo_caso="reverso_sin_importe" o "imagen_invalida" → documentos es array vacío [].
- NUNCA mezcles datos de distintos tickets en el mismo objeto de documentos[].
- NUNCA dejes el array documentos como null; siempre es un array (puede ser vacío).
- Los strings vacíos van como "" (no como null).
- Los números van sin comillas. El importe null va como null (no como "null").

Devuelve SOLO el JSON. Sin texto adicional antes ni después.`;

const PROMPT_OCR_PRECISION = PROMPT_OCR_MULTI +
  '\n\nEsta es una SEGUNDA PASADA DE ALTA PRECISIÓN. El documento fue marcado como ' +
  'de baja confianza o multi-ticket problemático. Esfuérzate al máximo para: ' +
  '1) identificar correctamente CUÁNTOS documentos hay; ' +
  '2) leer todos los importes aunque estén parcialmente tapados; ' +
  '3) distinguir claramente datos de tickets distintos; ' +
  '4) completar fecha, hora, comercio y NIF aunque estén en letra pequeña.';

/**
 * OCR multi-ticket primario (modelo por defecto, ~1 crédito).
 * Devuelve { resultado, error }. resultado = { n_documentos, tipo_caso, documentos[] }.
 */
export async function extraerDatosGastoMulti(file_url) {
  if (!file_url) return { resultado: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_OCR_MULTI,
      file_urls: [file_url],
      response_json_schema: GASTO_OCR_SCHEMA_MULTI,
    });
    const resultado = res && typeof res === 'object' ? res : (res?.output || null);
    if (!resultado || !Array.isArray(resultado.documentos)) {
      return { resultado: null, error: 'Respuesta inválida del modelo' };
    }
    return { resultado, error: null };
  } catch (e) {
    return { resultado: null, error: e?.message || 'Error en InvokeLLM' };
  }
}

/**
 * Re-procesamiento multi-ticket de precisión (gemini_3_flash, ~5 créditos).
 */
export async function reprocesarPrecisionMulti(file_url) {
  if (!file_url) return { resultado: null, error: 'Sin URL de archivo' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT_OCR_PRECISION,
      file_urls: [file_url],
      response_json_schema: GASTO_OCR_SCHEMA_MULTI,
      model: 'gemini_3_flash',
    });
    const resultado = res && typeof res === 'object' ? res : (res?.output || null);
    if (!resultado || !Array.isArray(resultado.documentos)) {
      return { resultado: null, error: 'Respuesta inválida (precisión)' };
    }
    return { resultado, error: null };
  } catch (e) {
    return { resultado: null, error: e?.message || 'Error en InvokeLLM (precisión)' };
  }
}

/**
 * Convierte el resultado multi-ticket en una lista de registros procesados.
 * Cada registro lleva: { datos, precisa_precision, precision_motivo, file_url, tipo_caso, advertencias, _idx, _total_en_foto }.
 */
export function procesarResultadoMulti(resultado, file_url) {
  if (!resultado || !Array.isArray(resultado.documentos)) return [];
  const { tipo_caso, advertencias = [], documentos } = resultado;
  if (tipo_caso === 'imagen_invalida' || tipo_caso === 'reverso_sin_importe') return [];
  return documentos.map((doc, idx) => {
    const confianza = typeof doc.confianza === 'number' ? doc.confianza : 0.7;
    const faltantes = [];
    if (doc.importe == null || isNaN(Number(doc.importe))) faltantes.push('importe');
    if (!doc.fecha_documento) faltantes.push('fecha');
    if (!doc.nombre_comercio) faltantes.push('comercio');
    const precisa = tipo_caso === 'ticket_parcial' || tipo_caso === 'multi_ticket' || confianza < 0.6 || faltantes.length > 0;
    const motivo = tipo_caso === 'multi_ticket'
      ? `Ticket ${idx + 1} de ${documentos.length} en la misma foto`
      : tipo_caso === 'ticket_parcial'
        ? 'Ticket incompleto — revisa el importe'
        : confianza < 0.6
          ? `Confianza baja (${(confianza * 100).toFixed(0)}%)${faltantes.length ? ' · faltan: ' + faltantes.join(', ') : ''}`
          : faltantes.length > 0 ? `Faltan campos: ${faltantes.join(', ')}` : '';
    return {
      datos: doc,
      precisa_precision: precisa,
      precision_motivo: motivo,
      file_url,
      tipo_caso,
      advertencias: idx === 0 ? advertencias : [],
      _idx: idx,
      _total_en_foto: documentos.length,
    };
  });
}