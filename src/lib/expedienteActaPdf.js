import { jsPDF } from 'jspdf';
import { format, parseISO } from 'date-fns';
import { drawSimantecLogoPdf } from '@/lib/simantecLogoPdf';
import { drawEmpresaDatosPdf, getEmpresaPrincipalPdf } from '@/lib/simantecEmpresaPdf';

const fechaLarga = (v) => {
  if (!v) return '—';
  try { return format(parseISO(String(v).slice(0, 10)), 'dd/MM/yyyy'); } catch { return String(v); }
};

export function nombrePdfActa(exp) {
  return `Acta_Conciliacion_${exp?.codigo || 'expediente'}.pdf`.replace(/[^\w.\-]/g, '_');
}

/** Dibuja el acta completa en el documento (una sola página A4). */
export function dibujarActaExpediente(doc, exp, empresa) {
  const margin = 18;
  const ancho = doc.internal.pageSize.getWidth();
  const bottom = doc.internal.pageSize.getHeight() - 20;
  let y = 14;

  const ensure = (h) => { if (y + h > bottom) { doc.addPage(); y = 16; } };
  const parrafo = (texto, opts = {}) => {
    const { size = 9.5, bold = false, indent = 0, gap = 4 } = opts;
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    doc.splitTextToSize(String(texto), ancho - margin * 2 - indent).forEach((linea) => {
      ensure(5);
      doc.text(linea, margin + indent, y);
      y += 4.6;
    });
    y += gap;
  };

  // Cabecera corporativa
  const alturaLogo = drawSimantecLogoPdf(doc, margin, y, 15);
  drawEmpresaDatosPdf(doc, empresa, ancho - margin, y + 2);
  y += Math.max(alturaLogo, 22);

  doc.setDrawColor(220, 224, 232);
  doc.line(margin, y, ancho - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(10, 31, 68);
  doc.text('ACTA DE ACUERDO DE CONCILIACIÓN INTERNA', ancho / 2, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 115, 128);
  doc.text('Sistema pre-judicial SMART-GESTION · Expediente ' + (exp.codigo || '—'), ancho / 2, y, { align: 'center' });
  y += 9;

  doc.setTextColor(40, 40, 40);
  parrafo(`En ${exp.acta_lugar || 'Las Rozas de Madrid'}, a ${fechaLarga(exp.acta_fecha)}.`, { gap: 6 });

  parrafo('REUNIDOS', { bold: true, gap: 2 });
  parrafo(
    `De una parte, la representación de la empresa ${empresa?.nombre || 'SIMANTEC S.L.'}, `
    + `${exp.firma_empresa_nombre || 'gerencia de la empresa'}.`,
  );
  parrafo(
    `De otra parte, el trabajador D. ${exp.operario_name || '—'}`
    + `${exp.operario_dni ? ` (DNI/NIE ${exp.operario_dni})` : ''}.`,
    { gap: 6 },
  );

  parrafo('MANIFESTAN', { bold: true, gap: 2 });
  parrafo(exp.acta_manifiestan || '', { gap: 6 });

  parrafo('ACUERDAN', { bold: true, gap: 2 });
  parrafo(
    'Como muestra de buena voluntad por ambas partes y con el objeto de resolver la controversia de manera interna '
    + 'sin necesidad de acudir al IRMA, ambas partes acuerdan:',
    { gap: 3 },
  );
  (exp.acta_acuerdos || []).forEach((acuerdo, i) => {
    parrafo(`${i + 1}. ${acuerdo}`, { indent: 4, gap: 2.5 });
  });
  y += 4;

  // Firmas
  const anchoFirma = (ancho - margin * 2 - 10) / 2;
  ensure(46);
  const firmaY = y;
  const bloques = [
    {
      titulo: 'Por la empresa',
      nombre: exp.firma_empresa_nombre || '—',
      firma: exp.firma_empresa,
      fecha: exp.firma_empresa_fecha,
    },
    {
      titulo: 'El trabajador',
      nombre: exp.operario_name || '—',
      firma: exp.firma_trabajador,
      fecha: exp.firma_trabajador_fecha,
    },
  ];

  bloques.forEach((b, i) => {
    const x = margin + i * (anchoFirma + 10);
    doc.setDrawColor(200, 205, 215);
    doc.rect(x, firmaY, anchoFirma, 30);
    if (b.firma) {
      try { doc.addImage(b.firma, 'PNG', x + 4, firmaY + 2, anchoFirma - 8, 24); } catch { /* firma ilegible */ }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(b.titulo, x + 2, firmaY + 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 100);
    doc.text(b.nombre, x + 2, firmaY + 39.5);
    doc.text(`Firmado: ${b.fecha ? fechaLarga(b.fecha) : '—'}`, x + 2, firmaY + 43.5);
  });

  y = firmaY + 52;
  ensure(12);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(130, 135, 145);
  doc.splitTextToSize(
    'Documento generado por SMART-GESTION. Con la firma de ambas partes el expediente pasa a ARCHIVADO CONCILIADO '
    + 'y el antecedente se elimina del historial visible al cumplirse el plazo de conservación. '
    + `Código de expediente: ${exp.codigo || '—'}.`,
    ancho - margin * 2,
  ).forEach((linea) => { doc.text(linea, margin, y); y += 3.6; });
}

export async function generarPdfActaExpediente(exp) {
  const empresa = await getEmpresaPrincipalPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  dibujarActaExpediente(doc, exp, empresa);
  return doc;
}

export async function descargarActaExpediente(exp) {
  const doc = await generarPdfActaExpediente(exp);
  doc.save(nombrePdfActa(exp));
}