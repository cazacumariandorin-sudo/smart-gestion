import { jsPDF } from 'jspdf';
import { drawSimantecLogoPdf } from '@/lib/simantecLogoPdf';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_LABEL = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/**
 * Genera (cliente) un PDF corporativo del pedido con identidad Simantec
 * y dispara la descarga. Reutiliza drawSimantecLogoPdf (mismo estilo que el
 * resto de documentos del proyecto). No consume créditos backend.
 */
export function exportarPedidoPdf(order, showPrices = true) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Cabecera: logo + "PEDIDO"
  y += drawSimantecLogoPdf(doc, margin, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(10, 31, 68);
  doc.text('PEDIDO', margin, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 130);
  doc.text(order.title || '—', margin, y + 7);
  y += 12;

  // Línea separadora
  doc.setDrawColor(220, 222, 226);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Datos del pedido (2 columnas)
  const fmtFecha = (f) => {
    if (!f) return '—';
    try { return format(parseISO(f), 'd MMM yyyy', { locale: es }); } catch { return f; }
  };
  const colW = contentW / 2;
  const dato = (label, val, x) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 130);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 30);
    doc.text(String(val || '—'), x, y + 5);
  };
  dato('Obra', order.obra_name, margin);
  dato('Proveedor', order.proveedor, margin + colW);
  y += 12;
  dato('Fecha pedido', fmtFecha(order.fecha_pedido), margin);
  dato('Entrega prevista', fmtFecha(order.fecha_entrega), margin + colW);
  y += 12;
  dato('Estado', ESTADO_LABEL[order.estado] || order.estado, margin);
  if (showPrices) {
    const total = (order.items || []).reduce((s, it) => s + ((it.cantidad || 0) * (it.precio || 0)), 0) || order.importe || 0;
    dato('Importe total', `${total.toFixed(2)} €`, margin + colW);
  }
  y += 10;

  // Tabla de líneas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(10, 31, 68);
  doc.text('LÍNEAS DEL PEDIDO', margin, y);
  y += 3;

  // Cabecera tabla
  doc.setFillColor(238, 242, 255);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 31, 68);
  const descW = showPrices ? contentW - 20 - 20 - 24 - 24 : contentW - 20 - 20;
  doc.text('Descripción', margin + 2, y + 4.5);
  doc.text('Cant.', margin + descW + 2, y + 4.5, { align: 'right' });
  doc.text('Unidad', margin + descW + 22, y + 4.5);
  if (showPrices) {
    doc.text('Precio', margin + descW + 42, y + 4.5, { align: 'right' });
    doc.text('Subtotal', margin + contentW - 2, y + 4.5, { align: 'right' });
  }
  y += 7;

  // Filas
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 40);
  const items = order.items || [];
  const rowH = 6;
  items.forEach((it, i) => {
    if (y + rowH > 285) { doc.addPage(); y = margin; }
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, rowH, 'F');
    }
    doc.setTextColor(30, 30, 40);
    const nombre = (it.nombre || '—').toString();
    const nombreTrunc = doc.splitTextToSize(nombre, descW - 4)[0];
    doc.text(nombreTrunc, margin + 2, y + 4);
    doc.text(String(it.cantidad || 0), margin + descW + 2, y + 4, { align: 'right' });
    doc.text(String(it.unidad || ''), margin + descW + 22, y + 4);
    if (showPrices) {
      doc.text(`${(it.precio || 0).toFixed(2)} €`, margin + descW + 42, y + 4, { align: 'right' });
      doc.text(`${((it.cantidad || 0) * (it.precio || 0)).toFixed(2)} €`, margin + contentW - 2, y + 4, { align: 'right' });
    }
    y += rowH;
  });

  // Total
  if (showPrices && items.length > 0) {
    y += 2;
    doc.setDrawColor(200, 202, 206);
    doc.line(margin + contentW - 50, y, pageW - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(10, 31, 68);
    doc.text('Total:', margin + contentW - 24, y, { align: 'right' });
    const total = items.reduce((s, it) => s + ((it.cantidad || 0) * (it.precio || 0)), 0) || order.importe || 0;
    doc.text(`${total.toFixed(2)} €`, pageW - margin - 2, y, { align: 'right' });
    y += 6;
  }

  // Notas
  if (order.notas) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text('OBSERVACIONES', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    const lineas = doc.splitTextToSize(order.notas, contentW);
    lineas.forEach((ln) => {
      if (y > 285) { doc.addPage(); y = margin; }
      doc.text(ln, margin, y);
      y += 4.5;
    });
  }

  // Footer
  const pageH = 297;
  doc.setDrawColor(220, 222, 226);
  doc.line(margin, pageH - 18, pageW - margin, pageH - 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 160);
  doc.text('SIMANTEC S.L. · INTEGRACIÓN · MANTENIMIENTO · TECNOLOGÍA', margin, pageH - 13);
  doc.text(`Pedido ${order.title || ''}`, pageW - margin, pageH - 13, { align: 'right' });

  const fname = `pedido_${(order.title || 'pedido').replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
  doc.save(fname);
  return fname;
}