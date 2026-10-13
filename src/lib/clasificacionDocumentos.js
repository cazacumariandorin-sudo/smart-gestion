// Clasificación de documentos de gasto según el Reglamento de facturación español
// (RD 1619/2012) y la Ley 27/2014 del Impuesto sobre Sociedades (LIS).
//
// Verificado en octubre de 2026. Fuentes: BOE-A-2012-14696 (RD 1619/2012, arts. 4, 6 y 7:
// factura completa vs. factura simplificada); LIS art. 15.c) (multas y sanciones: se
// contabilizan pero NO son fiscalmente deducibles); práctica contable estándar sobre
// albaranes (no tienen validez fiscal, no llevan IVA, deben asociarse a la factura real
// y al movimiento bancario/efectivo para conciliarse).
//
// NOTA sobre Verifactu: su entrada en vigor está aplazada a octubre de 2028 (nota del
// Ministerio de Hacienda del 5-10-2026, pendiente de confirmación en el BOE). No afecta
// a esta clasificación, que se basa en el Reglamento de facturación vigente.
//
// IMPORTANTE: esto es una ayuda a la clasificación, no asesoramiento fiscal. Un
// profesional de contabilidad debe revisar los casos dudosos.

export const TIPOS_DOCUMENTO = ['factura', 'factura_simplificada', 'ticket', 'albaran', 'tasa_multa', 'otro'];

export const TIPO_DOCUMENTO_LABELS = {
  factura: 'Factura',
  factura_simplificada: 'Factura simplificada',
  ticket: 'Ticket (sin validez fiscal)',
  albaran: 'Albarán / nota de entrega',
  tasa_multa: 'Tasa / multa',
  otro: 'Otro',
};

// Umbral general de factura simplificada (art. 4.1 RD 1619/2012): hasta 400 € siempre,
// o hasta 3.000 € si el destinatario no es empresario/profesional y lo solicita, y
// además para ciertos sectores sin límite de importe (ver SECTORES_SIN_LIMITE).
const LIMITE_SIMPLIFICADA_GENERAL = 400;
const LIMITE_SIMPLIFICADA_AMPLIADO = 3000;

// Sectores del art. 4.1 RD 1619/2012 en los que la factura simplificada no tiene límite
// de importe: ventas al por menor, transporte de personas y equipajes, aparcamiento,
// autopistas de peaje, hostelería y restauración, salas de baile y discotecas,
// peluquerías, servicios de revelado de fotografías, tintorerías, y aparcamientos.
const CATEGORIAS_SIN_LIMITE_IMPORTE = ['peaje', 'parking', 'comida', 'combustible'];

const normaliza = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const CONTIENE = (texto, ...palabras) => {
  const t = normaliza(texto);
  return palabras.some((p) => t.includes(normaliza(p)));
};

/**
 * Clasifica un documento según los datos extraídos (por OCR o editados a mano).
 * Devuelve { tipo_documento, confianza, motivo }. Determinista: mismos datos → mismo resultado.
 *
 * datos: { nombre_comercio, nif_comercio, importe, categoria, numero_factura,
 *          codigo_validacion_fiscal, ocr_raw, comprador_nif, desglose_iva }
 */
export function clasificarTipoDocumento(datos = {}) {
  const raw = datos.ocr_raw || '';
  const importe = Number(datos.importe);
  const tieneImporte = Number.isFinite(importe);

  // 1) Palabras clave inequívocas en el texto reconocido
  if (CONTIENE(raw, 'ALBARAN', 'ALBARÁN', 'NOTA DE ENTREGA', 'NOTA DE ENTREGA', 'VALE DE ENTREGA')
    && !CONTIENE(raw, 'FACTURA')) {
    return { tipo_documento: 'albaran', confianza: 0.85, motivo: 'El documento se identifica como albarán / nota de entrega' };
  }
  if (CONTIENE(raw, 'MULTA', 'SANCION', 'SANCIÓN', 'DENUNCIA', 'BOLETIN DE DENUNCIA', 'TASA', 'DGT', 'ZONA AZUL EXCESO')) {
    return { tipo_documento: 'tasa_multa', confianza: 0.8, motivo: 'El documento menciona una multa, sanción o tasa' };
  }

  // 2) Factura completa: NIF del emisor + NIF o nombre del comprador identificado + desglose de IVA
  const tieneNifEmisor = !!(datos.nif_comercio || '').trim();
  const tieneDatosComprador = !!(datos.comprador_nif || datos.desglose_iva);
  if (tieneNifEmisor && tieneDatosComprador) {
    return { tipo_documento: 'factura', confianza: 0.8, motivo: 'Lleva NIF del emisor y datos del destinatario (factura completa)' };
  }

  // 3) Factura simplificada: tiene NIF del emisor y un número/código de documento,
  //    dentro del límite de importe (o sin límite si el sector lo permite)
  const tieneIdentificador = !!((datos.numero_factura || '').trim() || (datos.codigo_validacion_fiscal || '').trim());
  const sinLimiteImporte = CATEGORIAS_SIN_LIMITE_IMPORTE.includes(datos.categoria);
  const dentroDeLimite = !tieneImporte || sinLimiteImporte || importe <= LIMITE_SIMPLIFICADA_AMPLIADO;
  if (tieneNifEmisor && tieneIdentificador && dentroDeLimite) {
    const avisoImporte = !sinLimiteImporte && tieneImporte && importe > LIMITE_SIMPLIFICADA_GENERAL;
    return {
      tipo_documento: 'factura_simplificada',
      confianza: avisoImporte ? 0.55 : 0.75,
      motivo: avisoImporte
        ? `Factura simplificada con importe de ${importe.toFixed(2)} €, por encima de los 400 € generales (solo válida si el comprador no es profesional y lo solicitó, hasta 3.000 €)`
        : 'Lleva NIF del emisor y número/código de documento, dentro del límite de la factura simplificada',
    };
  }

  // 4) Ticket informal: sin NIF del emisor o sin identificador — no cumple los requisitos
  //    fiscales mínimos. Sirve para la nota mensual del operario, pero no para IVA/IS.
  if (!tieneNifEmisor || !tieneIdentificador) {
    return { tipo_documento: 'ticket', confianza: 0.6, motivo: 'Sin NIF del emisor o sin número de documento: no cumple los requisitos de factura simplificada' };
  }

  return { tipo_documento: 'otro', confianza: 0.3, motivo: 'No se ha podido clasificar con los datos disponibles' };
}

/**
 * ¿Este tipo de documento genera asiento contable?
 *   - factura / factura_simplificada: sí, son el documento fiscal válido.
 *   - tasa_multa: sí se contabiliza (cuenta 678), aunque NO es fiscalmente deducible
 *     (art. 15.c LIS) — el ajuste lo aplica la gestoría en el Impuesto sobre Sociedades.
 *   - albaran / ticket / otro: no. El albarán debe esperar a la factura real; el ticket
 *     informal no tiene validez fiscal (sigue sirviendo para la nota mensual del operario).
 */
export function generaAsientoContable(tipo_documento) {
  return tipo_documento === 'factura' || tipo_documento === 'factura_simplificada' || tipo_documento === 'tasa_multa';
}

/** ¿Este tipo de documento necesita asociarse a una factura real antes de conciliarse? */
export function requiereFacturaAsociada(tipo_documento) {
  return tipo_documento === 'albaran';
}

/** Nota explicativa corta para mostrar al lado del tipo, en el formulario y en los informes. */
export function notaTipoDocumento(tipo_documento) {
  switch (tipo_documento) {
    case 'albaran': return 'No lleva IVA ni genera asiento contable. Vale para la nota mensual del operario; en contabilidad debe asociarse a la factura real y al movimiento bancario.';
    case 'ticket': return 'Sin validez fiscal (falta NIF del emisor o número de documento). Vale para la nota mensual; no se contabiliza como factura.';
    case 'tasa_multa': return 'Se registra en contabilidad (cuenta 678), pero no es gasto deducible en el Impuesto sobre Sociedades (art. 15.c LIS).';
    case 'factura_simplificada': return 'Va a nota mensual y a un asiento contable propio, distinto al de las facturas completas.';
    case 'factura': return 'Documento fiscal completo: va a nota mensual y a asiento contable.';
    default: return '';
  }
}
