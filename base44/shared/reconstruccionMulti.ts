// Lógica PURA (sin red) para la reconstrucción de registros con varias fotos.
// Decide qué fotos son PÁGINAS DEL MISMO DOCUMENTO (→ 1 registro) y qué fotos son
// tickets DISTINTOS (→ 1 registro por ticket). Se prueba aparte y se reutiliza en el
// planificador y en la función de reconstrucción.
//
// Entrada de cada foto: { idx, url, nombre, tipo, resultado?, error? }
//   resultado = respuesta del OCR: { tipo_caso, documentos:[...], pagina_numero?, pagina_total?,
//               es_continuacion?, muestra_total_final? }

export const normFactura = (s) => String(s || '').toUpperCase().replace(/[\s\-_./]/g, '');
export const normNif = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const vacio = (v) => v == null || String(v).trim() === '';

function mismoDocumento(grupo, u) {
  const ult = grupo.paginas[grupo.paginas.length - 1];
  const dA = ult.doc, dB = u.doc;
  const rA = ult.r, rB = u.r;

  const fa = normFactura(dA?.numero_factura), fb = normFactura(dB?.numero_factura);
  const nifA = normNif(dA?.nif_comercio), nifB = normNif(dB?.nif_comercio);

  // Marcas explícitas de página consistentes ("Página 2 de 4")
  const totA = Number(rA?.pagina_total) || 0, totB = Number(rB?.pagina_total) || 0;
  if (totB > 1 && totA === totB && (Number(rB?.pagina_numero) || 0) > 0) {
    return `Página ${rB.pagina_numero} de ${totB}`;
  }
  // Números de factura distintos y legibles → documentos distintos
  if (fa.length >= 4 && fb.length >= 4 && fa !== fb) return null;

  // Mismo nº de factura (y mismo NIF si ambos constan)
  if (fa.length >= 4 && fa === fb && (!nifA || !nifB || nifA === nifB)) return 'mismo nº de factura';

  // Continuación: la foto no tiene cabecera propia y el documento anterior no estaba cerrado
  const cerrado = rA?.muestra_total_final === true;
  const sinIdentidad = vacio(dB?.nombre_comercio) && fb.length < 4;
  const esCont = rB?.es_continuacion === true || (rB?.tipo_caso === 'ticket_parcial' && sinIdentidad);
  if (esCont && !cerrado) return 'continuación del documento anterior';
  return null;
}

export function agruparFotos(fotos, modo = 'auto') {
  const omitidas = [];
  const validas = [];
  for (const f of fotos) {
    if (f.error) { omitidas.push({ idx: f.idx, motivo: `Error de lectura: ${f.error}` }); continue; }
    const r = f.resultado || {};
    const docs = Array.isArray(r.documentos) ? r.documentos : [];
    const esReverso = r.tipo_caso === 'reverso_sin_importe' || (docs.length === 0 && r.tipo_caso !== 'imagen_invalida');
    if (r.tipo_caso === 'imagen_invalida') { omitidas.push({ idx: f.idx, motivo: 'Imagen no válida' }); continue; }
    validas.push({ f, r, docs, esReverso });
  }

  const grupos = [];
  const nuevoGrupo = (tipo) => ({ tipo, paginas: [], fotos: [], motivos: [], avisos: [] });

  if (modo === 'un_documento') {
    const g = nuevoGrupo('documento');
    for (const v of validas) {
      g.fotos.push(v.f.idx);
      if (v.docs.length) v.docs.forEach((d) => g.paginas.push({ doc: d, r: v.r, idx: v.f.idx }));
      if (v.docs.length > 1) g.avisos.push(`La foto ${v.f.idx + 1} parece contener varios tickets; se unen porque has indicado «un solo documento».`);
    }
    if (g.fotos.length) { g.motivos.push('Todas las fotos se tratan como páginas de UN documento'); grupos.push(g); }
  } else if (modo === 'separar') {
    for (const v of validas) {
      if (v.esReverso) { omitidas.push({ idx: v.f.idx, motivo: 'Reverso sin importe' }); continue; }
      v.docs.forEach((d, i) => {
        const g = nuevoGrupo('ticket');
        g.paginas.push({ doc: d, r: v.r, idx: v.f.idx }); g.fotos.push(v.f.idx);
        g.motivos.push(v.docs.length > 1 ? `Ticket ${i + 1} de ${v.docs.length} en la foto ${v.f.idx + 1}` : `Foto ${v.f.idx + 1}`);
        grupos.push(g);
      });
    }
  } else {
    let actual = null;
    const reversosPendientes = [];
    for (const v of validas) {
      if (v.esReverso) {
        if (actual) { actual.fotos.push(v.f.idx); actual.motivos.push(`Foto ${v.f.idx + 1}: reverso unido al documento anterior`); }
        else reversosPendientes.push(v.f.idx);
        continue;
      }
      if (v.docs.length > 1 || v.r.tipo_caso === 'multi_ticket') {
        actual = null;
        v.docs.forEach((d, i) => {
          const g = nuevoGrupo('ticket');
          g.paginas.push({ doc: d, r: v.r, idx: v.f.idx }); g.fotos.push(v.f.idx);
          g.motivos.push(`Ticket ${i + 1} de ${v.docs.length} en la foto ${v.f.idx + 1}`);
          grupos.push(g);
        });
        continue;
      }
      const u = { doc: v.docs[0], r: v.r, idx: v.f.idx };
      const motivo = actual ? mismoDocumento(actual, u) : null;
      if (actual && motivo) {
        actual.paginas.push(u); actual.fotos.push(v.f.idx); actual.tipo = 'documento';
        actual.motivos.push(`Foto ${v.f.idx + 1}: ${motivo}`);
      } else {
        actual = nuevoGrupo('ticket');
        actual.paginas.push(u); actual.fotos.push(v.f.idx); actual.motivos.push(`Foto ${v.f.idx + 1}`);
        grupos.push(actual);
      }
    }
    if (reversosPendientes.length && grupos.length) grupos[0].fotos.unshift(...reversosPendientes);
    else reversosPendientes.forEach((i) => omitidas.push({ idx: i, motivo: 'Reverso sin importe' }));
  }

  return { grupos: grupos.map(consolidarGrupo), omitidas };
}

export function consolidarGrupo(g) {
  const docs = g.paginas.map((p) => p.doc);
  const primero = (campo) => docs.map((d) => d?.[campo]).find((v) => !vacio(v));
  const avisos = [...g.avisos];

  // Orden de páginas si el OCR dio numeración
  const paginas = [...g.paginas];
  if (paginas.length > 1 && paginas.every((p) => Number(p.r?.pagina_numero) > 0)) {
    paginas.sort((a, b) => Number(a.r.pagina_numero) - Number(b.r.pagina_numero));
  }

  // Importe: el de la página que muestra el TOTAL FINAL; si no, el único importe; si hay varios, el mayor (con aviso)
  const conImporte = paginas.filter((p) => p.doc?.importe != null && !Number.isNaN(Number(p.doc.importe)));
  const conTotal = conImporte.filter((p) => p.r?.muestra_total_final === true);
  let importe = null; let ambiguo = false;
  if (conTotal.length) importe = Number(conTotal[conTotal.length - 1].doc.importe);
  else if (conImporte.length === 1) importe = Number(conImporte[0].doc.importe);
  else if (conImporte.length > 1) {
    importe = Math.max(...conImporte.map((p) => Number(p.doc.importe)));
    ambiguo = g.tipo === 'documento';
    if (ambiguo) avisos.push('Varias páginas muestran importes distintos: se ha tomado el mayor. Revisa el total real.');
  }
  if (importe == null) avisos.push('No se ha podido leer el importe total.');
  if (g.tipo === 'documento' && !conTotal.length && importe != null && !ambiguo) avisos.push('Ninguna página indica claramente el total final: confirma el importe.');

  const categoria = docs.map((d) => d?.categoria).find((c) => !vacio(c) && c !== 'otros') || primero('categoria') || 'otros';
  const precisa = importe == null || ambiguo || (g.tipo === 'documento' && !conTotal.length);

  return {
    tipo: g.tipo,
    fotos: g.fotos,
    motivos: g.motivos,
    avisos,
    precisa_precision: precisa,
    precision_motivo: g.tipo === 'documento'
      ? `Documento de ${g.fotos.length} página(s) reconstruido${precisa ? ' — revisa el importe' : ''}`
      : (avisos[0] || ''),
    registro: {
      nombre_comercio: primero('nombre_comercio') || '',
      nif_comercio: primero('nif_comercio') || '',
      fecha_documento: primero('fecha_documento') || '',
      hora_documento: primero('hora_documento') || '',
      importe,
      categoria,
      numero_factura: primero('numero_factura') || '',
      codigo_validacion_fiscal: primero('codigo_validacion_fiscal') || '',
      localidad: primero('localidad') || '',
      forma_pago_documento: primero('forma_pago_documento') || '',
      concepto: primero('concepto') || '',
      ocr_raw: paginas.map((p, i) => (paginas.length > 1 ? `--- página ${i + 1} ---\n` : '') + (p.doc?.ocr_raw || '')).join('\n'),
    },
  };
}
