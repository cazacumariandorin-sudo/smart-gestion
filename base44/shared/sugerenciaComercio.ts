// Patrón de aprendizaje: sugerir el comercio cuando sus datos identificativos
// (NIF, nombre completo) están tapados en la foto (p. ej. un justificante de pago
// grapado encima) pero el formato del documento y algún dato suelto coinciden con
// un comercio ya conocido de ese operario.
//
// IMPORTANTE — límite real de esta función: compara TEXTO (el leído por el OCR),
// no la imagen. No reconoce el "formato" visual de un documento (logotipos,
// maquetación) sin texto. Es una ayuda que reduce tecleo, con su confianza
// mostrada siempre, nunca un reconocimiento visual de plantillas.

const normaliza = (s) => String(s || '')
  .toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const PALABRAS_VACIAS = new Set(['SL', 'SA', 'SLU', 'SAU', 'CB', 'SCOOP', 'DE', 'LA', 'EL', 'Y', 'ESPANA', 'ESPAÑA']);

function tokensUtiles(texto) {
  return normaliza(texto).split(' ').filter((t) => t.length >= 3 && !PALABRAS_VACIAS.has(t));
}

/**
 * Compara el texto reconocido (ocr_raw o nombre_comercio parcial) con los patrones
 * ya confirmados del operario y propone el más parecido.
 *
 * patrones: [{ nombre_comercio_normalizado, nombre_comercio_display, nif_comercio,
 *              categoria_sugerida, veces_confirmado }]
 * pistas: { ocr_raw, nombre_comercio_parcial, nif_parcial }
 *
 * Devuelve null si no hay nada suficientemente parecido, o:
 *   { nombre_comercio, nif_comercio, categoria, confianza, motivo, veces_confirmado }
 */
export function sugerirComercioPorPistas(pistas = {}, patrones = []) {
  // Pista más fuerte: unos dígitos de NIF visibles coinciden exactamente
  const nifPista = normaliza(pistas.nif_parcial).replace(/[^A-Z0-9]/g, '');
  if (nifPista.length >= 5) {
    const porNif = patrones.find((p) => normaliza(p.nif_comercio).replace(/[^A-Z0-9]/g, '').includes(nifPista));
    if (porNif) {
      return {
        nombre_comercio: porNif.nombre_comercio_display,
        nif_comercio: porNif.nif_comercio,
        categoria: porNif.categoria_sugerida,
        confianza: 0.9,
        motivo: `Coincide el NIF visible (${pistas.nif_parcial}) con un comercio ya usado ${porNif.veces_confirmado} vez/veces`,
        veces_confirmado: porNif.veces_confirmado,
      };
    }
  }

  const textoPistas = `${pistas.nombre_comercio_parcial || ''} ${pistas.ocr_raw || ''}`;
  const tokPistas = new Set(tokensUtiles(textoPistas));
  if (!tokPistas.size) return null;

  let mejor = null;
  let mejorScore = 0;
  for (const p of patrones) {
    const tokPatron = tokensUtiles(p.nombre_comercio_normalizado || p.nombre_comercio_display);
    if (!tokPatron.length) continue;
    const coincide = tokPatron.filter((t) => tokPistas.has(t)).length;
    const score = coincide / tokPatron.length; // qué fracción del nombre del patrón aparece en el texto leído
    if (score > mejorScore) { mejorScore = score; mejor = p; }
  }
  // Umbral conservador: al menos la mitad de las palabras del nombre deben aparecer,
  // y un patrón visto una sola vez no es fiable todavía.
  if (!mejor || mejorScore < 0.5 || (mejor.veces_confirmado || 0) < 2) return null;

  return {
    nombre_comercio: mejor.nombre_comercio_display,
    nif_comercio: mejor.nif_comercio,
    categoria: mejor.categoria_sugerida,
    confianza: Math.min(0.75, 0.4 + mejorScore * 0.4),
    motivo: `El texto leído coincide en parte con «${mejor.nombre_comercio_display}», usado ${mejor.veces_confirmado} veces antes`,
    veces_confirmado: mejor.veces_confirmado,
  };
}
