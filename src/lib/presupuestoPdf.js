/**
 * presupuestoPdf — genera el PDF de un presupuesto (y, con marca de agua, de una factura borrador)
 * con la misma estructura que los documentos de Contasimple: logo, emisor | cliente, título, número y fechas,
 * tabla Concepto / Uds. / Base Ud. / Base Total / % IVA / IVA, desglose por tipo de IVA, totales y pie de pago.
 * Módulo puro: no accede a datos. Los datos de empresa, cliente y logo se pasan ya cargados.
 */
import { jsPDF } from 'jspdf';
import { calcularDocumento } from './presupuestoCalculo.js';

const ML = 14, MR = 196;                 // márgenes izquierdo y derecho (mm)
const COL = { desc: 15, descAncho: 71, uds: 96, baseUd: 122, baseTotal: 149, iva: 172, cuota: 196 };
const LH = 4.1;                           // alto de línea de texto (mm)
const Y_TABLA = 140;                      // cabecera de la tabla en la primera página
const Y_LIMITE = 270;                     // último y para filas
const Y_TOTALES = 236;                    // inicio del bloque de totales (en la última página)
const GRIS = [90, 90, 90];

export const eur = (n) => {
  const [e, d] = Math.abs(Number(n) || 0).toFixed(2).split('.');
  return `${n < 0 && (Number(e) || Number(d)) ? '-' : ''}${e.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d} €`;
};
const num = (n) => String(Number(n) || 0).replace('.', ',');
const fechaEs = (f) => {
  const m = String(f || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(f || '');
};
const mayus = (s) => String(s || '').toUpperCase();

const ETIQUETAS = {
  presupuesto: { titulo: 'PRESUPUESTO', numero: 'Número de presupuesto:', fecha: 'Fecha presupuesto:' },
  factura_borrador: { titulo: 'FACTURA BORRADOR', numero: 'Número de factura:', fecha: 'Fecha factura:' },
};

function bloqueDatos(doc, x, y, anchoMax, lineas) {
  let yy = y;
  lineas.filter((l) => l && l.texto).forEach((l, i) => {
    doc.setFont('helvetica', l.negrita ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    doc.splitTextToSize(String(l.texto), anchoMax).forEach((t) => { doc.text(t, x, yy); yy += LH; });
  });
  return yy;
}

function cabeceraTabla(doc, y) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text('Concepto', COL.desc, y);
  doc.text('Uds.', COL.uds, y, { align: 'right' });
  doc.text('Base Ud.', COL.baseUd, y, { align: 'right' });
  doc.text('Base Total', COL.baseTotal, y, { align: 'right' });
  doc.text('% IVA', COL.iva, y, { align: 'right' });
  doc.text('IVA', COL.cuota, y, { align: 'right' });
  doc.setDrawColor(...GRIS); doc.setLineWidth(0.6); doc.line(ML, y + 2, MR, y + 2);
  return y + 8;
}

/**
 * @param {object} p
 * @param {object} p.presupuesto  { codigo_registro, fecha, valido_hasta, conceptos[], forma_pago, notas, referencia_cliente }
 * @param {object} p.empresa      { razon_social | nombre, cif, domicilio, codigo_postal, localidad, provincia, web, iban }
 * @param {object} p.cliente      { name, nif, address, postal_code, localidad, provincia, pais, telefono }
 * @param {string} [p.logo]       data URL PNG/JPEG (opcional)
 * @param {'presupuesto'|'factura_borrador'} [p.tipo]
 * @param {string} [p.marcaAgua]  texto diagonal (obligatorio para borradores de factura)
 */
export function construirPresupuestoPdf({ presupuesto, empresa = {}, cliente = {}, logo, tipo = 'presupuesto', marcaAgua }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const et = ETIQUETAS[tipo] || ETIQUETAS.presupuesto;
  const calculo = calcularDocumento(presupuesto.conceptos || []);
  const hayTexto = calculo.lineas.some((l) => l.tipo === 'texto');

  // ── Cabecera: logo, emisor, cliente ────────────────────────────────────────
  if (logo) {
    try {
      // Formato según el data URL y proporción original (un logo rectangular no se deforma), dentro de 42×42 mm
      const fmt = /^data:image\/jpe?g/i.test(logo) ? 'JPEG' : 'PNG';
      const { width: iw, height: ih } = doc.getImageProperties(logo);
      const esc = Math.min(42 / iw, 42 / ih);
      doc.addImage(logo, fmt, ML, 14, iw * esc, ih * esc);
    } catch (_) { /* sin logo */ }
  }
  const cpEmp = [empresa.codigo_postal, mayus(empresa.localidad)].filter(Boolean).join(' ');
  bloqueDatos(doc, ML, 66, 92, [
    { texto: empresa.razon_social || empresa.nombre, negrita: true },
    { texto: empresa.cif && `NIF: ${empresa.cif}` },
    { texto: empresa.domicilio },
    { texto: cpEmp },
    { texto: empresa.provincia && `${mayus(empresa.provincia)}, España` },
    { texto: empresa.web },
  ]);
  const cpCli = [cliente.postal_code, mayus(cliente.localidad)].filter(Boolean).join(' ');
  bloqueDatos(doc, 113, 66, 83, [
    { texto: cliente.name, negrita: true },
    { texto: cliente.nif && `NIF: ${cliente.nif}` },
    { texto: cliente.address },
    { texto: cpCli },
    { texto: [cliente.provincia && mayus(cliente.provincia), cliente.pais || 'España'].filter(Boolean).join(', ') },
    { texto: cliente.telefono && `Telf: ${cliente.telefono}` },
  ]);

  // ── Título y datos del documento ───────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.setTextColor(...GRIS);
  doc.text(et.titulo, ML, 127);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const meta = [[et.numero, presupuesto.codigo_registro || ''], [et.fecha, fechaEs(presupuesto.fecha)]];
  if (presupuesto.valido_hasta) meta.push(['Válido hasta:', fechaEs(presupuesto.valido_hasta)]);
  meta.forEach(([k, v], i) => { doc.text(k, 134, 114 + i * 4.2); doc.text(String(v), 173, 114 + i * 4.2); });

  // ── Tabla de líneas ────────────────────────────────────────────────────────
  let y = cabeceraTabla(doc, Y_TABLA);
  const ancho = COL.descAncho;
  const filas = calculo.lineas.map((l) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    let lineas = doc.splitTextToSize(String(l.descripcion || ''), ancho);
    if (l.detalle) lineas = [...lineas, '', ...doc.splitTextToSize(String(l.detalle), ancho)];
    return { l, lineas, alto: Math.max(1, lineas.length) * LH + 3.2 };
  });
  if (presupuesto.referencia_cliente) {
    const ref = doc.splitTextToSize(`Referencia del cliente: ${presupuesto.referencia_cliente}`, ancho);
    filas.unshift({ l: { tipo: 'texto' }, lineas: ref, alto: ref.length * LH + 3.2 });
  }
  const dibujarFila = (f) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    f.lineas.forEach((t, i) => doc.text(t, COL.desc, y + i * LH));
    const l = f.l; const esTexto = l.tipo === 'texto';
    if (!esTexto || hayTexto) {
      doc.text(esTexto ? '0' : num(l.cantidad), COL.uds, y, { align: 'right' });
      doc.text(esTexto ? eur(0) : eur(l.precio_unitario), COL.baseUd, y, { align: 'right' });
      doc.text(esTexto ? eur(0) : eur(l.total), COL.baseTotal, y, { align: 'right' });
      doc.text(esTexto ? '0%' : `${num(l.iva_pct)}%`, COL.iva, y, { align: 'right' });
      doc.text(esTexto ? eur(0) : eur(l.cuota_iva), COL.cuota, y, { align: 'right' });
    }
    y += f.alto;
  };
  filas.forEach((f) => {
    if (y + f.alto > Y_LIMITE) { doc.addPage(); y = cabeceraTabla(doc, 20); }
    dibujarFila(f);
  });
  if (y > Y_TOTALES - 6) { doc.addPage(); cabeceraTabla(doc, 20); }

  // ── Totales (siempre al pie de la última página) ───────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
  doc.text('Base Imponible', 123, Y_TOTALES, { align: 'right' });
  doc.text('Tipo impuesto', 159, Y_TOTALES, { align: 'right' });
  doc.text('Impuesto', MR, Y_TOTALES, { align: 'right' });
  doc.setDrawColor(...GRIS); doc.setLineWidth(0.6); doc.line(ML, Y_TOTALES + 2, MR, Y_TOTALES + 2);
  const desglose = [...calculo.desglose_iva];
  if (hayTexto && !desglose.some((d) => d.tipo === 0)) desglose.push({ tipo: 0, base: 0, cuota: 0 });
  let yt = Y_TOTALES + 6.5;
  doc.setFont('helvetica', 'normal');
  desglose.forEach((d) => {
    doc.text(eur(d.base), 123, yt, { align: 'right' });
    doc.text(`IVA ${num(d.tipo)}%`, 159, yt, { align: 'right' });
    doc.text(eur(d.cuota), MR, yt, { align: 'right' });
    yt += 4.4;
  });
  doc.setLineWidth(0.25); doc.line(ML, yt - 2.2, MR, yt - 2.2);
  // Las etiquetas se colocan según el ancho de la cifra más ancha, para que nunca se solapen
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  const anchoTotal = doc.getTextWidth(eur(calculo.total_con_iva));
  doc.setFontSize(8);
  const anchoMenor = Math.max(doc.getTextWidth(eur(calculo.base_imponible)), doc.getTextWidth(eur(calculo.iva_total)));
  const xEtiqueta = MR - Math.max(anchoMenor, anchoTotal) - 4;
  doc.text('Total B.I.:', xEtiqueta, yt + 2, { align: 'right' }); doc.text(eur(calculo.base_imponible), MR, yt + 2, { align: 'right' });
  doc.text('Total IVA:', xEtiqueta, yt + 6, { align: 'right' }); doc.text(eur(calculo.iva_total), MR, yt + 6, { align: 'right' });
  doc.setFontSize(13);
  doc.text('TOTAL:', xEtiqueta, yt + 12, { align: 'right' }); doc.text(eur(calculo.total_con_iva), MR, yt + 12, { align: 'right' });

  // ── Pie: forma de pago, IBAN y notas ───────────────────────────────────────
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS);
  const pie = [];
  if (presupuesto.forma_pago) pie.push(...doc.splitTextToSize(String(presupuesto.forma_pago), 120));
  if (empresa.iban) pie.push(`IBAN: ${empresa.iban}`);
  if (presupuesto.notas) pie.push(...doc.splitTextToSize(String(presupuesto.notas), 120));
  pie.forEach((t, i) => doc.text(t, ML, 268 + i * 3.8));

  // ── Marca de agua (borradores) y numeración de páginas ─────────────────────
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    if (marcaAgua) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(46); doc.setTextColor(255, 205, 205);
      doc.text(marcaAgua, 52, 238, { angle: 50 });
    }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(...GRIS);
    doc.text(`Página ${p} de ${n}`, MR, 289, { align: 'right' });
  }
  return doc;
}