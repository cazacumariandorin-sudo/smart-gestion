import { jsPDF } from 'jspdf';
import { drawSimantecLogoPdf } from '@/lib/simantecLogoPdf';
import { drawEmpresaDatosPdf, getEmpresaPrincipalPdf } from '@/lib/simantecEmpresaPdf';
import { DESPLAZAMIENTO_LABELS, FIRMA_STATUS_LABELS } from '@/lib/workOrderUtils';
import { fechaES, fechaHoraES } from '@/lib/fechaES';

const ESTADOS = { pendiente: 'Pendiente', en_curso: 'En curso', completado: 'Completado' };
const numeroDe = (o) => o?.numero_parte || o?.order_number || '';

/** Dibuja UN parte empezando en la página actual del documento (la primera línea es el número, centrado). */
export function dibujarParte(doc, order, empresa) {
  const margin = 14;
  const bottom = doc.internal.pageSize.getHeight() - 18;
  let y = 12;
  const numero = numeroDe(order);
  if (numero) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 30, 30);
    doc.text(`Parte ${numero}`, doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    y += 9;
  }
  const ensure = (h) => { if (y + h > bottom) { doc.addPage(); y = 16; } };
  const heading = (t) => { ensure(12); doc.setFontSize(10); doc.setTextColor(40, 40, 40); doc.text(t, margin, y); y += 5; };
  const text = (t, indent = 0) => {
    doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.splitTextToSize(String(t), 182 - indent).forEach((l) => { ensure(5); doc.text(l, margin + indent, y); y += 5; });
  };

  const logoH = drawSimantecLogoPdf(doc, margin, y, 16);
  drawEmpresaDatosPdf(doc, empresa, 196, 16);
  y = y + logoH + 4;

  doc.setFontSize(18); doc.setTextColor(40, 40, 40);
  doc.text('Parte de Trabajo', margin, y); y += 8;
  doc.setFontSize(11); doc.setTextColor(100, 100, 100);
  doc.text(`${order.project || ''} — ${order.client_name || ''}`, margin, y); y += 6;
  doc.setFontSize(9);
  doc.text(`Fecha: ${fechaES(order.date) || '—'}  |  Estado: ${ESTADOS[order.status] || order.status}  |  Horas: ${order.total_hours || 0}h`, margin, y); y += 4;
  if (order.hora_inicio || order.hora_fin) {
    doc.text(`Hora inicio: ${order.hora_inicio || '—'}  |  Hora fin: ${order.hora_fin || '—'}`, margin, y); y += 4;
  }
  doc.text(`Firma: ${FIRMA_STATUS_LABELS[order.firma_status] || 'Sin firmar'}`, margin, y); y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, 196, y); y += 6;

  if (order.description) { heading('Descripción:'); text(order.description); y += 2; }
  if (order.workers?.length) {
    heading('Operarios:');
    order.workers.forEach((w) => text(`• ${w.name}${w.role ? ' (' + w.role + ')' : ''} — ${w.hours || 0}h`, 4));
    y += 2;
  }
  if (order.materials?.length) {
    heading('Materiales:');
    order.materials.forEach((m) => text(`• ${m.name} — ${m.quantity || 0} ${m.unit || ''}`, 4));
    y += 2;
  }
  if (order.vehiculo_matricula || order.desplazamiento_tipo || order.desplazamiento_valor || order.desplazamiento_modalidad === 'pactado') {
    heading('Vehículo / Desplazamiento:');
    if (order.vehiculo_matricula) text(`• Vehículo: ${order.vehiculo_matricula}`, 4);
    if (order.desplazamiento_tipo) text(`• Tipo: ${DESPLAZAMIENTO_LABELS[order.desplazamiento_tipo] || order.desplazamiento_tipo}`, 4);
    if (order.desplazamiento_modalidad === 'pactado') {
      text(`• Importe pactado con el cliente: ${Number(order.desplazamiento_importe_eur || 0).toFixed(2)} €${order.desplazamiento_concepto ? ' — ' + order.desplazamiento_concepto : ''}`, 4);
    } else if (order.desplazamiento_valor) {
      text(`• Distancia: ${order.desplazamiento_valor} km${order.desplazamiento_importe_eur ? ' — ' + Number(order.desplazamiento_importe_eur).toFixed(2) + ' €' : ''}`, 4);
    }
    y += 2;
  }
  if (order.notes) { heading('Observaciones:'); text(order.notes); y += 2; }

  // Firmas (con paginación)
  ensure(52);
  y += 28;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, 95, y);
  doc.line(110, y, 196, y);
  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text('Firma Operario', margin, y + 4);
  doc.text('Firma Cliente', 110, y + 4);
  const metaOp = fechaHoraES(order.firma_operario_fecha);
  const metaCli = [order.firma_cliente_nombre, order.firma_cliente_nif, fechaHoraES(order.firma_cliente_fecha)].filter(Boolean).join(' · ');
  if (metaOp) doc.text(metaOp, margin, y + 8);
  if (metaCli) doc.text(doc.splitTextToSize(metaCli, 85), 110, y + 8);
  try { if (order.firma_operario) doc.addImage(order.firma_operario, 'PNG', margin, y - 26, 60, 24); } catch (e) { console.warn('[PDF] firma operario', e); }
  try { if (order.firma_cliente) doc.addImage(order.firma_cliente, 'PNG', 110, y - 26, 60, 24); } catch (e) { console.warn('[PDF] firma cliente', e); }
}

export function nombrePdfParte(order) {
  const base = (numeroDe(order) || order.project || 'parte').replace(/[^\w-]+/g, '-');
  return `parte-${base}-${fechaES(order.date)}.pdf`;
}

/** Un PDF con uno o varios partes (cada parte empieza en página nueva). */
export async function descargarPartesPdf(orders, nombre) {
  const empresa = await getEmpresaPrincipalPdf();
  const doc = new jsPDF();
  orders.forEach((o, i) => {
    if (i > 0) doc.addPage();
    dibujarParte(doc, o, empresa);
  });
  doc.save(nombre || (orders.length === 1 ? nombrePdfParte(orders[0]) : `partes-${orders.length}.pdf`));
}
