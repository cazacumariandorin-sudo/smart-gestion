/**
 * Exportación del control horario — FUENTE ÚNICA del cálculo y de los ficheros.
 *
 * El PDF, el Excel y el CSV se construyen aquí a partir de los fichajes y
 * ausencias ya filtrados por permisos en pantalla; el filtro de PERIODO y de
 * trabajador se aplica siempre en estas funciones para que el archivo
 * descargado coincida exactamente con lo que el usuario ve.
 *
 * Todo lo que se genera es documentación OPERATIVA: nunca acredita el registro
 * legal oficial (RegistroHorarioLegal), que solo produce administración.
 */
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { drawSimantecLogoPdf } from '@/lib/simantecLogoPdf';
import { metaAusencia } from '@/hooks/useAusenciasHorario';
import { ORIGEN_META } from '@/lib/registroLegalConstantes';

const MARGEN = 14;
const AZUL = [21, 33, 249];
const TEXTO = [20, 24, 31];
const GRIS = [106, 113, 129];
const BORDE = [229, 231, 235];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const AVISO_OPERATIVO = 'Documento operativo de control horario. No acredita el registro legal de jornada, que solo genera y valida administración.';

// ── cálculo de horas ────────────────────────────────────────────────────────

export function horasMinutos(hStr) {
  if (!hStr) return null;
  const [h, m] = String(hStr).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutosATexto(mins) {
  if (!mins || mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function calcularMinutosFichaje(f) {
  const entrada = horasMinutos(f?.hora_entrada);
  const salida = horasMinutos(f?.hora_salida);
  if (!entrada || !salida) return 0;
  let diff = salida - entrada;
  if (f.pausa_inicio && f.pausa_fin) {
    const pi = horasMinutos(f.pausa_inicio);
    const pf = horasMinutos(f.pausa_fin);
    if (pi !== null && pf !== null) diff -= Math.max(0, pf - pi);
  }
  return Math.max(0, diff);
}

const decimal = (mins) => Math.round((mins / 60) * 100) / 100;

// ── periodo ─────────────────────────────────────────────────────────────────

/** Rango de fechas (ISO 'YYYY-MM-DD') según el modo de periodo del diálogo. */
export function rangoDePeriodo(modo, { anio, mes, desde, hasta } = {}) {
  const pad = (n) => String(n).padStart(2, '0');
  if (modo === 'rango' && desde && hasta) {
    return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde };
  }
  if (modo === 'anio') {
    return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
  }
  const ultimo = new Date(Number(anio), Number(mes), 0).getDate();
  return { desde: `${anio}-${pad(mes)}-01`, hasta: `${anio}-${pad(mes)}-${pad(ultimo)}` };
}

export function etiquetaPeriodo({ desde, hasta }) {
  const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
  const f = (iso, conAnio) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}${conAnio ? `/${iso.slice(0, 4)}` : ''}`;
  if (desde === `${desde.slice(0, 4)}-01-01` && hasta === `${desde.slice(0, 4)}-12-31`) {
    return `Año ${desde.slice(0, 4)}`;
  }
  if (desde.slice(0, 7) === hasta.slice(0, 7)) {
    return `${MESES[Number(desde.slice(5, 7)) - 1]} ${desde.slice(0, 4)}`;
  }
  return `${f(desde, !mismoAnio)} a ${f(hasta, true)}`;
}

const diaISO = (f) => (f ? String(f).slice(0, 10) : '');

export function filtrarFichajes(fichajes = [], { desde, hasta, operarioId } = {}) {
  return fichajes.filter((f) => {
    const d = diaISO(f.date);
    if (!d || (desde && d < desde) || (hasta && d > hasta)) return false;
    if (operarioId && f.operario_id !== operarioId) return false;
    return true;
  });
}

export function filtrarAusencias(ausencias = [], { desde, hasta, operarioId } = {}) {
  return ausencias.filter((a) => {
    if (!a.inicio) return false;
    if (operarioId && a.operario_id !== operarioId) return false;
    const fin = a.fin || a.inicio;
    return a.inicio <= hasta && fin >= desde;
  });
}

function diasSolape(a, desde, hasta) {
  const ini = a.inicio > desde ? a.inicio : desde;
  const fin = (a.fin || a.inicio) < hasta ? (a.fin || a.inicio) : hasta;
  const d = Math.round((new Date(`${fin}T00:00:00`) - new Date(`${ini}T00:00:00`)) / 86400000) + 1;
  return Math.max(1, d);
}

// ── filas normalizadas ──────────────────────────────────────────────────────

export function filasFichajes(fichajes = []) {
  return [...fichajes]
    .sort((a, b) => (a.date === b.date ? (a.operario_name || '').localeCompare(b.operario_name || '') : a.date > b.date ? 1 : -1))
    .map((f) => {
      const mins = calcularMinutosFichaje(f);
      const d = diaISO(f.date);
      const pausaMin = (f.pausa_inicio && f.pausa_fin) ? Math.max(0, (horasMinutos(f.pausa_fin) ?? 0) - (horasMinutos(f.pausa_inicio) ?? 0)) : 0;
      return {
        fecha: d,
        fechaTexto: `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`,
        dia: d ? DIAS[new Date(`${d}T00:00:00`).getDay()] : '',
        trabajador: f.operario_name || '',
        entrada: f.hora_entrada || '',
        salida: f.hora_salida || '',
        pausaInicio: f.pausa_inicio || '',
        pausaFin: f.pausa_fin || '',
        pausaMin,
        pausaTexto: pausaMin > 0 ? `${f.pausa_inicio.slice(0, 5)}-${f.pausa_fin.slice(0, 5)}` : '—',
        minutos: mins,
        horasDecimal: decimal(mins),
        horasTexto: mins > 0 ? minutosATexto(mins) : '—',
        obra: f.project || f.obra_name || '',
        origen: ORIGEN_META[f.origen] || f.origen || 'Trabajador',
        notas: f.notas || '',
      };
    });
}

export function resumenTrabajadores(fichajes = []) {
  const map = new Map();
  filasFichajes(fichajes).forEach((f) => {
    if (!map.has(f.trabajador)) map.set(f.trabajador, { trabajador: f.trabajador, dias: new Set(), registros: 0, minutos: 0 });
    const r = map.get(f.trabajador);
    r.dias.add(f.fecha);
    r.registros += 1;
    r.minutos += f.minutos;
  });
  return [...map.values()]
    .sort((a, b) => a.trabajador.localeCompare(b.trabajador))
    .map((r) => ({
      trabajador: r.trabajador || 'Sin asignar',
      dias: r.dias.size,
      registros: r.registros,
      horasDecimal: decimal(r.minutos),
      horasTexto: minutosATexto(r.minutos),
      minutos: r.minutos,
    }));
}

export function filasAusencias(ausencias = [], { desde, hasta } = {}) {
  return [...ausencias]
    .sort((a, b) => (a.inicio > b.inicio ? 1 : a.inicio < b.inicio ? -1 : (a.operario_name || '').localeCompare(b.operario_name || '')))
    .map((a) => ({
      trabajador: a.operario_name || '',
      inicio: a.inicio,
      fin: a.fin || a.inicio,
      inicioTexto: `${a.inicio.slice(8, 10)}/${a.inicio.slice(5, 7)}/${a.inicio.slice(0, 4)}`,
      finTexto: `${(a.fin || a.inicio).slice(8, 10)}/${(a.fin || a.inicio).slice(5, 7)}/${(a.fin || a.inicio).slice(0, 4)}`,
      dias: diasSolape(a, desde, hasta),
      tipo: metaAusencia(a.tipo).label,
      estado: a.estado === 'aprobada' || a.estado === 'justificada' ? 'Aprobada' : (a.estado || '').replace(/_/g, ' '),
      notas: a.notas || '',
    }));
}

function agruparPorTrabajador(filas) {
  const map = new Map();
  filas.forEach((f) => {
    const k = f.trabajador || 'Sin asignar';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(f);
  });
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const truncar = (txt, max) => {
  const s = String(txt || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

export function nombreArchivo({ desde, hasta, operarioNombre, ext }) {
  const limpio = (txt) => String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const quien = limpio(operarioNombre) ? `-${limpio(operarioNombre)}` : '';
  return `control-horario${quien}-${desde}_${hasta}.${ext}`;
}

// ── PDF ─────────────────────────────────────────────────────────────────────

const COLS_PDF = [
  { key: 'fechaTexto', label: 'Fecha', w: 20, max: 12 },
  { key: 'dia', label: 'Día', w: 14, max: 6 },
  { key: 'entrada', label: 'Entrada', w: 15, max: 6, align: 'center' },
  { key: 'salida', label: 'Salida', w: 15, max: 6, align: 'center' },
  { key: 'pausaTexto', label: 'Pausa', w: 24, max: 12, align: 'center' },
  { key: 'obra', label: 'Obra', w: 48, max: 34 },
  { key: 'horasTexto', label: 'Horas', w: 16, max: 9, align: 'right' },
  { key: 'origen', label: 'Origen', w: 30, max: 20 },
];

const COLS_AUS_PDF = [
  { key: 'inicioTexto', label: 'Inicio', w: 22, max: 12 },
  { key: 'finTexto', label: 'Fin', w: 22, max: 12 },
  { key: 'dias', label: 'Días', w: 14, max: 6, align: 'center' },
  { key: 'tipo', label: 'Tipo', w: 62, max: 40 },
  { key: 'estado', label: 'Estado', w: 32, max: 20 },
  { key: 'notas', label: 'Notas', w: 30, max: 22 },
];

function cabecera(doc, { titulo, periodo, usuario, generado }) {
  const logoAlto = drawSimantecLogoPdf(doc, MARGEN, 10, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...TEXTO);
  doc.text(titulo, 210 - MARGEN, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRIS);
  doc.text(periodo, 210 - MARGEN, 22, { align: 'right' });
  doc.text(generado, 210 - MARGEN, 27, { align: 'right' });
  doc.text(usuario, 210 - MARGEN, 32, { align: 'right' });
  const y = Math.max(logoAlto + 14, 36);
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(0.8);
  doc.line(MARGEN, y, 210 - MARGEN, y);
  return y + 6;
}

function tabla(doc, { columnas, filas, y, contexto }) {
  let cursor = y;
  const dibujarCabeceraTabla = () => {
    doc.setFillColor(...AZUL);
    doc.rect(MARGEN, cursor, 210 - MARGEN * 2, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let x = MARGEN;
    columnas.forEach((c) => {
      const tx = c.align === 'right' ? x + c.w - 2 : c.align === 'center' ? x + c.w / 2 : x + 2;
      doc.text(c.label, tx, cursor + 4, { align: c.align || 'left' });
      x += c.w;
    });
    cursor += 6;
  };

  dibujarCabeceraTabla();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  filas.forEach((fila, i) => {
    if (cursor > 268) {
      doc.addPage();
      cursor = cabecera(doc, { titulo: 'Control horario (continuación)', ...contexto });
      dibujarCabeceraTabla();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(MARGEN, cursor, 210 - MARGEN * 2, 5.6, 'F');
    }
    doc.setTextColor(...TEXTO);
    let x = MARGEN;
    columnas.forEach((c) => {
      const valor = truncar(fila[c.key], c.max);
      const tx = c.align === 'right' ? x + c.w - 2 : c.align === 'center' ? x + c.w / 2 : x + 2;
      doc.text(String(valor ?? ''), tx, cursor + 3.9, { align: c.align || 'left' });
      x += c.w;
    });
    doc.setDrawColor(...BORDE);
    doc.setLineWidth(0.1);
    doc.line(MARGEN, cursor + 5.6, 210 - MARGEN, cursor + 5.6);
    cursor += 5.6;
  });
  return cursor + 2;
}

function pie(doc, usuario) {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRIS);
    doc.text(truncar(AVISO_OPERATIVO, 130), MARGEN, 289);
    doc.text(`Página ${p} de ${total} · ${usuario}`, 210 - MARGEN, 289, { align: 'right' });
  }
}

/** Genera y descarga el PDF operativo. Devuelve el nombre del archivo. */
export function exportarHorarioPdf({ fichajes, ausencias, desde, hasta, contenido, agrupacion, usuario, operarioNombre }) {
  const filas = contenido === 'ausencias' ? [] : filasFichajes(filtrarFichajes(fichajes, { desde, hasta }));
  const aus = contenido === 'fichajes' ? [] : filasAusencias(filtrarAusencias(ausencias, { desde, hasta }), { desde, hasta });
  const periodo = etiquetaPeriodo({ desde, hasta });
  const generado = `Generado el ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `Control horario · ${periodo}`, creator: 'SMART-GESTION' });
  const contexto = { periodo, usuario, generado };

  let y = cabecera(doc, { titulo: 'Control horario', ...contexto });

  if (filas.length === 0 && aus.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text('Sin registros en el periodo seleccionado.', MARGEN, y + 4);
  }

  if (filas.length > 0) {
    const totalMin = filas.reduce((s, f) => s + f.minutos, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`${filas.length} registros · ${new Set(filas.map((f) => f.trabajador)).size} trabajadores · ${minutosATexto(totalMin)}`, MARGEN, y);
    y += 5;

    if (agrupacion === 'trabajador') {
      agruparPorTrabajador(filas).forEach(([trabajador, regs]) => {
        const mins = regs.reduce((s, f) => s + f.minutos, 0);
        if (y > 258) {
          doc.addPage();
          y = cabecera(doc, { titulo: 'Control horario (continuación)', periodo, usuario, generado });
        }
        doc.setFillColor(243, 244, 248);
        doc.rect(MARGEN, y, 210 - MARGEN * 2, 6.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...TEXTO);
        doc.text(truncar(trabajador || 'Sin asignar', 90), MARGEN + 2, y + 4.4);
        doc.text(`Subtotal ${minutosATexto(mins)}`, 210 - MARGEN - 2, y + 4.4, { align: 'right' });
        y += 6.5;
        y = tabla(doc, { columnas: COLS_PDF, filas: regs, y, contexto });
        y += 3;
      });
    } else {
      y = tabla(doc, { columnas: COLS_PDF, filas, y, contexto });
    }
  }

  if (aus.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = cabecera(doc, { titulo: 'Control horario (continuación)', periodo, usuario, generado });
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...AZUL);
    doc.text('Ausencias del periodo', MARGEN, y + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(`${aus.length} ausencias · ${aus.reduce((s, a) => s + a.dias, 0)} días`, MARGEN, y + 7);
    y = tabla(doc, { columnas: COLS_AUS_PDF, filas: aus, y: y + 10, contexto });
  }

  pie(doc, usuario);
  const filename = nombreArchivo({ desde, hasta, operarioNombre, ext: 'pdf' });
  doc.save(filename);
  return filename;
}

// ── Excel ───────────────────────────────────────────────────────────────────

const COLCHARS = {
  fechaTexto: 11, dia: 7, trabajador: 26, entrada: 9, salida: 9,
  pausaInicio: 10, pausaFin: 10, pausaMin: 9, horasDecimal: 9, horasTexto: 9,
  obra: 34, origen: 18, notas: 34, dias: 7, inicioTexto: 11, finTexto: 11, tipo: 24, estado: 14,
  registros: 10,
};

function hoja(rows, orden, anchos) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: orden });
  ws['!cols'] = orden.map((k) => ({ wch: anchos[k] || COLCHARS[k] || 14 }));
  return ws;
}

/** Genera y descarga el Excel operativo (detalle + resumen + ausencias). */
export function exportarHorarioExcel({ fichajes, ausencias, desde, hasta, contenido, usuario, operarioNombre }) {
  const regs = contenido === 'ausencias' ? [] : filtrarFichajes(fichajes, { desde, hasta });
  const aus = contenido === 'fichajes' ? [] : filtrarAusencias(ausencias, { desde, hasta });
  const filas = filasFichajes(regs);
  const wb = XLSX.utils.book_new();

  if (filas.length > 0) {
    const detalle = filas.map((f) => ({
      Fecha: f.fechaTexto, Día: f.dia, Trabajador: f.trabajador, Entrada: f.entrada, Salida: f.salida,
      'Pausa inicio': f.pausaInicio, 'Pausa fin': f.pausaFin, 'Pausa (min)': f.pausaMin,
      'Horas (decimal)': f.horasDecimal, Horas: f.horasTexto, Obra: f.obra, Origen: f.origen, Notas: f.notas,
    }));
    XLSX.utils.book_append_sheet(wb, hoja(detalle, ['Fecha', 'Día', 'Trabajador', 'Entrada', 'Salida', 'Pausa inicio', 'Pausa fin', 'Pausa (min)', 'Horas (decimal)', 'Horas', 'Obra', 'Origen', 'Notas'], {
      Fecha: 11, Día: 7, Trabajador: 26, Entrada: 9, Salida: 9, 'Pausa inicio': 10, 'Pausa fin': 10, 'Pausa (min)': 9, 'Horas (decimal)': 10, Horas: 9, Obra: 34, Origen: 18, Notas: 34,
    }), 'Detalle');

    const resumen = resumenTrabajadores(regs).map((r) => ({
      Trabajador: r.trabajador, 'Días trabajados': r.dias, Registros: r.registros,
      'Horas (decimal)': r.horasDecimal, Horas: r.horasTexto,
    }));
    XLSX.utils.book_append_sheet(wb, hoja(resumen, ['Trabajador', 'Días trabajados', 'Registros', 'Horas (decimal)', 'Horas'], {
      Trabajador: 26, 'Días trabajados': 14, Registros: 10, 'Horas (decimal)': 12, Horas: 10,
    }), 'ResumenTrabajador');
  }

  if (aus.length > 0) {
    const filasAus = filasAusencias(aus, { desde, hasta }).map((a) => ({
      Trabajador: a.trabajador, Inicio: a.inicioTexto, Fin: a.finTexto, Días: a.dias, Tipo: a.tipo, Estado: a.estado, Notas: a.notas,
    }));
    XLSX.utils.book_append_sheet(wb, hoja(filasAus, ['Trabajador', 'Inicio', 'Fin', 'Días', 'Tipo', 'Estado', 'Notas'], {
      Trabajador: 26, Inicio: 11, Fin: 11, Días: 7, Tipo: 24, Estado: 14, Notas: 34,
    }), 'Ausencias');
  }

  if (!wb.SheetNames.length) throw new Error('Sin registros en el periodo seleccionado.');

  const filename = nombreArchivo({ desde, hasta, operarioNombre, ext: 'xlsx' });
  XLSX.writeFile(wb, filename);
  return filename;
}

// ── CSV ─────────────────────────────────────────────────────────────────────

const csvCampo = (v) => {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Genera y descarga el CSV operativo (separador «;» y decimales con coma). */
export function exportarHorarioCsv({ fichajes, ausencias, desde, hasta, contenido, operarioNombre }) {
  const lineas = [];
  if (contenido === 'ausencias') {
    lineas.push(['Trabajador', 'Inicio', 'Fin', 'Dias', 'Tipo', 'Estado', 'Notas'].join(';'));
    filasAusencias(filtrarAusencias(ausencias, { desde, hasta }), { desde, hasta }).forEach((a) => {
      lineas.push([a.trabajador, a.inicio, a.fin, a.dias, a.tipo, a.estado, a.notas].map(csvCampo).join(';'));
    });
  } else {
    lineas.push(['Fecha', 'Dia', 'Trabajador', 'Entrada', 'Salida', 'Pausa inicio', 'Pausa fin', 'Pausa (min)', 'Horas (decimal)', 'Horas', 'Obra', 'Origen', 'Notas'].join(';'));
    filasFichajes(filtrarFichajes(fichajes, { desde, hasta })).forEach((f) => {
      lineas.push([
        f.fecha, f.dia, f.trabajador, f.entrada, f.salida, f.pausaInicio, f.pausaFin, f.pausaMin,
        String(f.horasDecimal).replace('.', ','), f.horasTexto, f.obra, f.origen, f.notas,
      ].map(csvCampo).join(';'));
    });
  }

  if (lineas.length <= 1) throw new Error('Sin registros en el periodo seleccionado.');

  const blob = new Blob([`\ufeff${lineas.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const filename = nombreArchivo({ desde, hasta, operarioNombre, ext: 'csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}