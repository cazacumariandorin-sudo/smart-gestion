// Configuración compartida del OCR multi-ticket de gastos.
// Usada por el frontend (src/lib/ocrGastos.js) y por el backend
// (reconstruirRegistroMultiTicket) para no duplicar el prompt y el schema.

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
    confianza_global: { type: 'number', description: 'Confianza global de la detección 0-1' },
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
          nombre_comercio: { type: 'string' },
          nif_comercio: { type: 'string' },
          fecha_documento: { type: 'string' },
          hora_documento: { type: 'string' },
          importe: { type: 'number' },
          categoria: {
            type: 'string',
            enum: ['combustible', 'peaje', 'parking', 'comida', 'material', 'otros'],
          },
          numero_factura: { type: 'string' },
          codigo_validacion_fiscal: { type: 'string' },
          localidad: { type: 'string' },
          forma_pago_documento: { type: 'string' },
          concepto: { type: 'string' },
          confianza: { type: 'number' },
          ocr_raw: { type: 'string' },
        },
      },
    },
  },
  required: ['n_documentos', 'tipo_caso', 'confianza_global', 'documentos'],
};

export const PROMPT_OCR_MULTI = `Eres un sistema experto en análisis de justificantes de gasto en España
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

PEAJES SUCESIVAS DEL MISMO DÍA: si hay varios tickets del mismo operador de peaje
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

export const PROMPT_OCR_PRECISION = PROMPT_OCR_MULTI +
  '\n\nEsta es una SEGUNDA PASADA DE ALTA PRECISIÓN. El documento fue marcado como ' +
  'de baja confianza o multi-ticket problemático. Esfuérzate al máximo para: ' +
  '1) identificar correctamente CUÁNTOS documentos hay; ' +
  '2) leer todos los importes aunque estén parcialmente tapados; ' +
  '3) distinguir claramente datos de tickets distintos; ' +
  '4) completar fecha, hora, comercio y NIF aunque estén en letra pequeña.';

/**
 * Convierte el resultado multi-ticket en una lista de registros procesados.
 * Misma lógica que src/lib/ocrGastos.js::procesarResultadoMulti (espejo backend).
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