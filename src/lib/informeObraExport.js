/**
 * Exportación del informe "Por obra" (Excel y PDF) con resumen + detalle por día.
 */
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { minutosATexto, calcularMinutosFichaje } from '@/components/horario/InformesTab';

const hora = (iso) => {
  if (!iso) return '';
  try { return format(parseISO(iso), 'HH:mm'); } catch { return ''; }
};

const fechaLarga = (d) => {
  if (!d) return 'Sin fecha';
  return format(parseISO(d.slice(0, 10)), 'EEE dd/MM/yyyy', { locale: es });
};

// Filas de detalle (una por fichaje) ordenadas por operario y fecha
function buildDetalle(porOperario, fichajes) {
  const rows = [];
  porOperario.forEach(g => {
    fichajes
      .filter(f => f.operario_id === g.id)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.entrada || '').localeCompare(b.entrada || ''))
      .forEach(f => {
        const min = calcularMinutosFichaje(f);
        rows.push({
          operarioId: g.id,
          operario: g.name,
          obra: f.project || f.obra_name || '',
          fecha: f.date ? f.date.slice(0, 10) : '',
          entrada: hora(f.entrada),
          salida: hora(f.salida),
          minutos: min,
          notas: f.notas || f.observaciones || '',
        });
      });
  });
  return rows;
}

const fileName = (obraFilter, periodValue, ext) =>
  `valoracion-obra-${obraFilter === 'all' ? 'todas' : obraFilter.replace(/\s+/g, '_')}-${periodValue}.${ext}`;

export function exportInformeObraExcel({ porOperario, totales, fichajes, obraFilter, periodValue }) {
  const resumen = porOperario.map(g => ({
    Operario: g.name,
    'Horas (texto)': minutosATexto(g.minutos),
    'Horas (decimal)': Number(g.horas.toFixed(2)),
    Días: g.diasCount,
    Fichajes: g.fichajes,
    'Coste/hora (€)': g.costeHora || '',
    'Valoración (€)': Number(g.valoracion.toFixed(2)),
  }));
  resumen.push({
    Operario: 'TOTAL',
    'Horas (texto)': minutosATexto(totales.totalMins),
    'Horas (decimal)': Number(totales.totalHoras.toFixed(2)),
    Días: '',
    Fichajes: totales.totalFichajes,
    'Coste/hora (€)': '',
    'Valoración (€)': Number(totales.totalValor.toFixed(2)),
  });

  const detalle = buildDetalle(porOperario, fichajes).map(r => ({
    Operario: r.operario,
    Obra: r.obra,
    Fecha: r.fecha ? format(parseISO(r.fecha), 'dd/MM/yyyy') : '',
    Día: r.fecha ? format(parseISO(r.fecha), 'EEEE', { locale: es }) : '',
    Entrada: r.entrada,
    Salida: r.salida,
    'Horas (texto)': minutosATexto(r.minutos),
    'Horas (decimal)': Number((r.minutos / 60).toFixed(2)),
    Notas: r.notas,
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(resumen);
  ws1['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
  const ws2 = XLSX.utils.json_to_sheet(detalle);
  ws2['!cols'] = [{ wch: 34 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Valoración obra');
  XLSX.utils.book_append_sheet(wb, ws2, 'Detalle por día');
  XLSX.writeFile(wb, fileName(obraFilter, periodValue, 'xlsx'));
}

export function exportInformeObraPDF({ porOperario, totales, fichajes, obraLabel, periodLabel, obraFilter, periodValue }) {
  const doc = new jsPDF();
  const L = 14;
  let y;

  const cell = (text, x, w, opts = {}) => {
    if (opts.fill) { doc.setFillColor(...opts.fill); doc.rect(x, y, w, 6, 'F'); }
    doc.setTextColor(...(opts.color || [20, 20, 20]));
    doc.text(String(text), opts.right ? x + w - 2 : x + 2, y + 4, opts.right ? { align: 'right' } : undefined);
  };

  const newPage = () => { doc.addPage(); y = 20; };

  // ── Cabecera ──
  doc.setFontSize(15); doc.setFont(undefined, 'bold'); doc.setTextColor(0, 0, 0);
  doc.text('Valoración de horas por obra', L, 18);
  doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(80, 80, 80);
  doc.text(`${obraLabel} · ${periodLabel}`, L, 25);
  doc.setDrawColor(0, 0, 0); doc.line(L, 28, 196, 28);
  y = 36;

  // ── Resumen ──
  const cw = [62, 28, 16, 22, 24, 30];
  const hdrs = ['Operario', 'Horas', 'Días', 'Fichajes', 'Coste/h', 'Valoración'];
  doc.setFontSize(8); doc.setFont(undefined, 'bold');
  let x = L;
  hdrs.forEach((h, i) => { cell(h, x, cw[i], { fill: [249, 115, 22], color: [255, 255, 255], right: i > 0 }); x += cw[i]; });
  y += 6;
  doc.setFont(undefined, 'normal');
  porOperario.forEach((g, ri) => {
    if (y > 275) newPage();
    const fill = ri % 2 === 0 ? [255, 255, 255] : [245, 245, 248];
    const vals = [(g.name || '').slice(0, 32), minutosATexto(g.minutos), String(g.diasCount), String(g.fichajes),
      g.costeHora ? `${g.costeHora} €` : '—', `${g.valoracion.toFixed(2)} €`];
    x = L;
    vals.forEach((v, i) => { cell(v, x, cw[i], { fill, right: i > 0 }); x += cw[i]; });
    y += 6;
  });
  if (y > 275) newPage();
  doc.setFont(undefined, 'bold');
  const tot = ['TOTAL', minutosATexto(totales.totalMins), '', String(totales.totalFichajes), '', `${totales.totalValor.toFixed(2)} €`];
  x = L;
  tot.forEach((v, i) => { cell(v, x, cw[i], { fill: [235, 235, 242], right: i > 0 }); x += cw[i]; });
  y += 12;

  // ── Detalle por día ──
  const detalle = buildDetalle(porOperario, fichajes);
  const dcw = [38, 24, 24, 24, 72];
  const dh = ['Fecha', 'Entrada', 'Salida', 'Horas', 'Obra / notas'];

  porOperario.forEach(g => {
    const rows = detalle.filter(r => r.operarioId === g.id);
    if (y > 245) newPage();
    doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(0, 0, 0);
    doc.text(`${g.name} — ${minutosATexto(g.minutos)} · ${g.diasCount} día${g.diasCount !== 1 ? 's' : ''}`, L, y + 3);
    y += 6;
    doc.setFontSize(8);
    x = L;
    dh.forEach((h, i) => { cell(h, x, dcw[i], { fill: [90, 90, 105], color: [255, 255, 255], right: i >= 1 && i <= 3 }); x += dcw[i]; });
    y += 6;
    doc.setFont(undefined, 'normal');
    rows.forEach((r, ri) => {
      if (y > 280) newPage();
      const fill = ri % 2 === 0 ? [255, 255, 255] : [245, 245, 248];
      const extra = [r.obra, r.notas].filter(Boolean).join(' · ').slice(0, 44);
      const vals = [fechaLarga(r.fecha), r.entrada || '—', r.salida || '—', minutosATexto(r.minutos), extra];
      x = L;
      vals.forEach((v, i) => { cell(v, x, dcw[i], { fill, right: i >= 1 && i <= 3 }); x += dcw[i]; });
      y += 6;
    });
    y += 6;
  });

  if (y > 285) newPage();
  doc.setFontSize(8); doc.setTextColor(150, 150, 150);
  doc.text(`${totales.numOperarios} operarios · ${totales.totalFichajes} fichajes · ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, L, y);
  doc.save(fileName(obraFilter, periodValue, 'pdf'));
}