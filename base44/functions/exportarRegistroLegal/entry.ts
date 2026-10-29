import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import ExcelJS from 'npm:exceljs@4.4.0';
import { ESTADOS_OFICIALES, registrarAuditoria } from '../../shared/registroLegal.ts';

/**
 * exportarRegistroLegal
 * Genera el Excel legal de un periodo usando SOLO registros oficiales/validados
 * en las hojas de detalle y resúmenes, e incluye:
 *  - Portada con datos de empresa (Empresa) e imagen corporativa (logo).
 *  - Hoja "HistoricoLegal" con TODO el histórico registrado (todos los periodos).
 * Se construye en servidor y deja rastro en AuditoriaHorario.
 *
 * body: { desde, hasta, trabajadorId? }
 */

const ROLES_ADMIN = ['admin', 'propietario', 'administracion'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const LOGO_POR_DEFECTO = 'https://media.base44.com/images/public/69de8e23b1cd7ac050397c82/93f897666_logoSimantecnew.png';
const AZUL = 'FF1521F9';
const TEXTO = 'FF14181F';
const GRIS = 'FF6A7181';
const BORDE = 'FFE5E7EB';

function trimestreDe(fecha) {
  const m = Number(String(fecha).slice(5, 7));
  return Math.floor((m - 1) / 3) + 1;
}

function diasLaborables(anio, mes) {
  const total = new Date(anio, mes, 0).getDate();
  let n = 0;
  for (let d = 1; d <= total; d++) {
    const dia = new Date(anio, mes - 1, d).getDay();
    if (dia !== 0 && dia !== 6) n++;
  }
  return n;
}

function asArray(res) {
  return Array.isArray(res) ? res : (res?.items || []);
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function descargarLogo(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return null;
    const limpio = url.toLowerCase().split('?')[0];
    const extension = limpio.endsWith('.png') ? 'png' : (limpio.endsWith('.gif') ? 'gif' : 'jpeg');
    return { base64: bytesToBase64(bytes), extension };
  } catch (_e) {
    return null;
  }
}

function cabecera(ws, fila, columnas) {
  const row = ws.getRow(fila);
  row.height = 22;
  columnas.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: BORDE } } };
  });
}

/** Hoja de tabla: título, subtítulo, cabecera fija y autofiltro. */
function hojaTabla(wb, { nombre, titulo, subtitulo, columnas, filas }) {
  const ws = wb.addWorksheet(nombre, { views: [{ state: 'frozen', ySplit: 3 }] });
  ws.columns = columnas.map((c) => ({ key: c.key, width: c.width || 16 }));

  ws.mergeCells(1, 1, 1, columnas.length);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 12, color: { argb: TEXTO } };
  t.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 20;

  ws.mergeCells(2, 1, 2, columnas.length);
  const s = ws.getCell(2, 1);
  s.value = subtitulo;
  s.font = { size: 9, color: { argb: GRIS } };

  cabecera(ws, 3, columnas);

  filas.forEach((f, i) => {
    const row = ws.getRow(4 + i);
    columnas.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      const valor = f[c.key];
      cell.value = valor === undefined || valor === null ? '' : valor;
      cell.font = { size: 9, color: { argb: TEXTO } };
      if (typeof valor === 'number') {
        cell.numFmt = c.fmt || '0.00';
        cell.alignment = { horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'top', wrapText: false };
      }
      cell.border = { bottom: { style: 'hair', color: { argb: BORDE } } };
    });
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: columnas.length } };
  return ws;
}

const COLS_DETALLE = [
  { header: 'Empresa', key: 'empresa_nombre', width: 26 },
  { header: 'CIF empresa', key: 'empresa_cif', width: 14 },
  { header: 'Centro de trabajo', key: 'centro_trabajo_nombre', width: 22 },
  { header: 'DNI/NIE', key: 'trabajador_dni', width: 14 },
  { header: 'Trabajador', key: 'trabajador_nombre', width: 26 },
  { header: 'Fecha', key: 'fecha', width: 11 },
  { header: 'Día', key: 'dia_semana', width: 10 },
  { header: 'Entrada', key: 'hora_entrada', width: 9 },
  { header: 'Salida', key: 'hora_salida', width: 9 },
  { header: 'Pausa ini.', key: 'pausa_inicio', width: 10 },
  { header: 'Pausa fin', key: 'pausa_fin', width: 10 },
  { header: 'Pausa (min)', key: 'pausa_minutos', width: 10, fmt: '0' },
  { header: 'Jornada real (min)', key: 'jornada_real_minutos', width: 12, fmt: '0' },
  { header: 'Horas efectivas', key: 'horas_trabajadas', width: 11 },
  { header: 'H. extra ord.', key: 'horas_extra_ordinarias', width: 10 },
  { header: 'H. extra fest.', key: 'horas_extra_festivas', width: 10 },
  { header: 'H. nocturnas', key: 'horas_nocturnas', width: 10 },
  { header: 'H. festivas', key: 'horas_festivas', width: 10 },
  { header: 'Obra / centro', key: 'obra_nombre', width: 26 },
  { header: 'Tipo obra', key: 'obra_tipo', width: 12 },
  { header: 'Notas', key: 'notas', width: 30 },
  { header: 'Estado legal', key: 'estado_legal', width: 14 },
  { header: 'Origen', key: 'origen', width: 20 },
  { header: 'Versión', key: 'version_legal', width: 8, fmt: '0' },
  { header: 'Generado por', key: 'generado_por', width: 24 },
  { header: 'Validado por', key: 'validado_por', width: 24 },
  { header: 'Fecha validación', key: 'validado_en', width: 20 },
  { header: 'Motivo validación', key: 'motivo_validacion', width: 28 },
  { header: 'Origen del dato', key: 'fuente_registro', width: 20 },
  { header: 'Observaciones', key: 'observaciones_interna', width: 26 },
];

const COLS_MES = [
  { header: 'Empresa', key: 'empresa_nombre', width: 26 },
  { header: 'DNI/NIE', key: 'trabajador_dni', width: 14 },
  { header: 'Trabajador', key: 'trabajador_nombre', width: 26 },
  { header: 'Año', key: 'anio', width: 8, fmt: '0' },
  { header: 'Mes', key: 'mes_label', width: 14 },
  { header: 'Días laborables', key: 'dias_laborables', width: 12, fmt: '0' },
  { header: 'Días trabajados', key: 'dias_trabajados', width: 12, fmt: '0' },
  { header: 'Días sin fichaje', key: 'dias_sin_fichaje', width: 12, fmt: '0' },
  { header: 'Horas efectivas', key: 'horas_totales', width: 12 },
  { header: 'Horas extra', key: 'horas_extra', width: 10 },
  { header: 'H. nocturnas', key: 'horas_nocturnas', width: 10 },
  { header: 'H. festivas', key: 'horas_festivas', width: 10 },
  { header: 'Incidencias', key: 'incidencias', width: 10, fmt: '0' },
  { header: 'Estado legal', key: 'estado_legal', width: 12 },
  { header: 'Validado por', key: 'validado_por', width: 24 },
  { header: 'Fecha validación', key: 'validado_en', width: 20 },
];

const COLS_TRIMESTRE = [
  { header: 'Empresa', key: 'empresa_nombre', width: 26 },
  { header: 'DNI/NIE', key: 'trabajador_dni', width: 14 },
  { header: 'Trabajador', key: 'trabajador_nombre', width: 26 },
  { header: 'Año', key: 'anio', width: 8, fmt: '0' },
  { header: 'Trimestre', key: 'trimestre_label', width: 12 },
  { header: 'Días trabajados', key: 'dias_trabajados', width: 12, fmt: '0' },
  { header: 'Horas efectivas', key: 'horas_totales', width: 12 },
  { header: 'Horas extra', key: 'horas_extra', width: 10 },
  { header: 'H. nocturnas', key: 'horas_nocturnas', width: 10 },
  { header: 'H. festivas', key: 'horas_festivas', width: 10 },
  { header: 'Incidencias', key: 'incidencias', width: 10, fmt: '0' },
  { header: 'Estado legal', key: 'estado_legal', width: 12 },
  { header: 'Validado por', key: 'validado_por', width: 24 },
  { header: 'Fecha validación', key: 'validado_en', width: 20 },
];

const COLS_ANUAL = [
  { header: 'Empresa', key: 'empresa_nombre', width: 26 },
  { header: 'DNI/NIE', key: 'trabajador_dni', width: 14 },
  { header: 'Trabajador', key: 'trabajador_nombre', width: 26 },
  { header: 'Año', key: 'anio', width: 8, fmt: '0' },
  { header: 'Días laborables', key: 'dias_laborables', width: 12, fmt: '0' },
  { header: 'Días trabajados', key: 'dias_trabajados', width: 12, fmt: '0' },
  { header: 'Días sin fichaje', key: 'dias_sin_fichaje', width: 12, fmt: '0' },
  { header: 'Horas efectivas', key: 'horas_totales', width: 12 },
  { header: 'Horas extra', key: 'horas_extra', width: 10 },
  { header: 'H. nocturnas', key: 'horas_nocturnas', width: 10 },
  { header: 'H. festivas', key: 'horas_festivas', width: 10 },
  { header: 'Incidencias', key: 'incidencias', width: 10, fmt: '0' },
  { header: 'Estado legal', key: 'estado_legal', width: 12 },
  { header: 'Validado por', key: 'validado_por', width: 24 },
  { header: 'Fecha validación', key: 'validado_en', width: 20 },
];

const COLS_HISTORICO = [
  { header: 'Empresa', key: 'empresa_nombre', width: 26 },
  { header: 'DNI/NIE', key: 'trabajador_dni', width: 14 },
  { header: 'Trabajador', key: 'trabajador_nombre', width: 26 },
  { header: 'Periodo', key: 'periodo', width: 10 },
  { header: 'Mes', key: 'mes_label', width: 14 },
  { header: 'Registros', key: 'registros', width: 10, fmt: '0' },
  { header: 'Días trabajados', key: 'dias_trabajados', width: 12, fmt: '0' },
  { header: 'Horas efectivas', key: 'horas_totales', width: 12 },
  { header: 'Horas extra', key: 'horas_extra', width: 10 },
  { header: 'H. nocturnas', key: 'horas_nocturnas', width: 10 },
  { header: 'H. festivas', key: 'horas_festivas', width: 10 },
  { header: 'Incidencias', key: 'incidencias', width: 10, fmt: '0' },
  { header: 'Estados', key: 'estados', width: 24 },
  { header: 'En periodo exportado', key: 'en_periodo', width: 12 },
  { header: 'Última validación', key: 'validado_en', width: 20 },
];

const COLS_AUDITORIA = [
  { header: 'Registro', key: 'registro_id', width: 26 },
  { header: 'Entidad', key: 'entidad', width: 22 },
  { header: 'Acción', key: 'accion', width: 30 },
  { header: 'Usuario', key: 'usuario', width: 26 },
  { header: 'Rol', key: 'rol', width: 14 },
  { header: 'Fecha y hora', key: 'fecha_hora', width: 22 },
  { header: 'Campo', key: 'campo', width: 16 },
  { header: 'Valor anterior', key: 'valor_anterior', width: 24 },
  { header: 'Valor nuevo', key: 'valor_nuevo', width: 24 },
  { header: 'Motivo', key: 'motivo', width: 28 },
  { header: 'Origen', key: 'origen', width: 16 },
  { header: 'Versión', key: 'version_legal', width: 8 },
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_ADMIN.includes(user.role)) {
      return Response.json({ error: 'Solo administración o admin pueden exportar el registro legal' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { desde, hasta, trabajadorId } = body;
    if (!desde || !hasta) {
      return Response.json({ error: 'desde y hasta son obligatorios' }, { status: 400 });
    }

    // ── Datos de empresa (portada) ─────────────────────────────────────────
    const empresas = asArray(await base44.asServiceRole.entities.Empresa.list().catch(() => []));
    const empresa = empresas.find((e) => e.es_principal) || empresas.find((e) => e.activa !== false) || empresas[0] || null;

    const query = {
      fecha: { $gte: desde, $lte: hasta },
      estado_legal: { $in: ESTADOS_OFICIALES },
    };
    if (trabajadorId) query.operario_id = trabajadorId;

    const registros = asArray(await base44.asServiceRole.entities.RegistroHorarioLegal.filter(query));

    if (!registros.length) {
      return Response.json(
        { error: 'No hay registros oficiales en el periodo seleccionado. Valida antes de exportar.' },
        { status: 400 },
      );
    }

    // ── Histórico completo (todos los periodos, sin filtro de estado) ──────
    const historicoRaw = asArray(await base44.asServiceRole.entities.RegistroHorarioLegal.filter(
      trabajadorId ? { operario_id: trabajadorId } : {},
    ));

    // ── Hoja 1: Detalle legal ──────────────────────────────────────────────
    const detalle = registros.map((r) => ({
      empresa_nombre: r.empresa_nombre || empresa?.nombre || '',
      empresa_cif: r.empresa_cif || empresa?.cif || '',
      centro_trabajo_nombre: r.centro_trabajo_nombre || '',
      trabajador_id: r.operario_id,
      trabajador_nombre: r.operario_name || '',
      trabajador_dni: r.operario_dni || '',
      fecha: r.fecha,
      dia_semana: r.dia_semana || '',
      hora_entrada: r.hora_entrada || '',
      hora_salida: r.hora_salida || '',
      pausa_inicio: r.pausa_inicio || '',
      pausa_fin: r.pausa_fin || '',
      pausa_minutos: Number(r.pausa_minutos) || 0,
      jornada_real_minutos: Number(r.jornada_real_minutos) || 0,
      horas_trabajadas: Number(r.horas_trabajadas) || 0,
      horas_extra_ordinarias: Number(r.horas_extra_ordinarias) || 0,
      horas_extra_festivas: Number(r.horas_extra_festivas) || 0,
      horas_nocturnas: Number(r.horas_nocturnas) || 0,
      horas_festivas: Number(r.horas_festivas) || 0,
      obra_nombre: r.obra_nombre || '',
      obra_tipo: r.obra_tipo || '',
      notas: r.notas || '',
      estado_legal: r.estado_legal,
      origen: r.origen || '',
      version_legal: Number(r.version_legal) || 1,
      generado_por: r.generado_por || '',
      validado_por: r.validado_por || '',
      validado_en: r.validado_en || '',
      motivo_validacion: r.motivo_validacion || '',
      fuente_registro: r.fuente_registro || '',
      observaciones_interna: r.observaciones_interna || '',
    }));

    // ── Agregados del periodo ─────────────────────────────────────────────
    const mesMap = {};
    const triMap = {};
    const anioMap = {};

    for (const r of registros) {
      const anio = String(r.fecha).slice(0, 4);
      const mes = String(r.fecha).slice(5, 7);
      const tri = trimestreDe(r.fecha);
      const esIncidencia = String(r.origen || '').startsWith('cierre_') ? 1 : 0;

      const base = {
        empresa_nombre: r.empresa_nombre || empresa?.nombre || '',
        trabajador_id: r.operario_id,
        trabajador_nombre: r.operario_name || '',
        trabajador_dni: r.operario_dni || '',
      };

      const accum = (obj, key, extra) => {
        if (!obj[key]) {
          obj[key] = { ...base, ...extra, horas_totales: 0, horas_extra: 0, horas_nocturnas: 0, horas_festivas: 0, incidencias: 0, fechas: new Set(), validado_por: '', validado_en: '' };
        }
        const b = obj[key];
        b.horas_totales += Number(r.horas_trabajadas) || 0;
        b.horas_extra += (Number(r.horas_extra_ordinarias) || 0) + (Number(r.horas_extra_festivas) || 0);
        b.horas_nocturnas += Number(r.horas_nocturnas) || 0;
        b.horas_festivas += Number(r.horas_festivas) || 0;
        b.incidencias += esIncidencia;
        b.fechas.add(r.fecha);
        if (r.validado_en && r.validado_en > (b.validado_en || '')) {
          b.validado_en = r.validado_en;
          b.validado_por = r.validado_por || '';
        }
      };

      accum(mesMap, `${r.operario_id}|${anio}|${mes}`, { anio: Number(anio), mes, mes_label: `${MESES[Number(mes) - 1]} ${anio}` });
      accum(triMap, `${r.operario_id}|${anio}|Q${tri}`, { anio: Number(anio), trimestre: `T${tri}`, trimestre_label: `T${tri} ${anio}` });
      accum(anioMap, `${r.operario_id}|${anio}`, { anio: Number(anio) });
    }

    const resumenMes = Object.values(mesMap)
      .sort((a, b) => `${a.anio}${a.mes}${a.trabajador_nombre}`.localeCompare(`${b.anio}${b.mes}${b.trabajador_nombre}`))
      .map((b) => {
        const laborables = diasLaborables(Number(b.anio), Number(b.mes));
        const trabajados = b.fechas.size;
        return {
          ...b,
          dias_laborables: laborables,
          dias_trabajados: trabajados,
          dias_sin_fichaje: Math.max(0, laborables - trabajados),
          estado_legal: 'oficial',
          fechas: undefined,
        };
      });

    const resumenTrimestre = Object.values(triMap)
      .sort((a, b) => `${a.anio}${a.trimestre}${a.trabajador_nombre}`.localeCompare(`${b.anio}${b.trimestre}${b.trabajador_nombre}`))
      .map((b) => ({
        ...b,
        dias_trabajados: b.fechas.size,
        estado_legal: 'oficial',
        fechas: undefined,
      }));

    const resumenAnual = Object.values(anioMap)
      .sort((a, b) => `${a.anio}${a.trabajador_nombre}`.localeCompare(`${b.anio}${b.trabajador_nombre}`))
      .map((b) => {
        let laborables = 0;
        for (let m = 1; m <= 12; m++) laborables += diasLaborables(Number(b.anio), m);
        const trabajados = b.fechas.size;
        return {
          ...b,
          dias_laborables: laborables,
          dias_trabajados: trabajados,
          dias_sin_fichaje: Math.max(0, laborables - trabajados),
          estado_legal: 'oficial',
          fechas: undefined,
        };
      });

    // ── Histórico agregado por trabajador y mes ───────────────────────────
    const histMap = {};
    for (const r of historicoRaw) {
      const anio = String(r.fecha || '').slice(0, 4);
      const mes = String(r.fecha || '').slice(5, 7);
      if (!anio || !mes) continue;
      const key = `${r.operario_id}|${anio}|${mes}`;
      if (!histMap[key]) {
        histMap[key] = {
          empresa_nombre: r.empresa_nombre || empresa?.nombre || '',
          trabajador_nombre: r.operario_name || '',
          trabajador_dni: r.operario_dni || '',
          periodo: `${anio}-${mes}`,
          orden: `${anio}${mes}`,
          mes_label: `${MESES[Number(mes) - 1]} ${anio}`,
          registros: 0,
          horas_totales: 0,
          horas_extra: 0,
          horas_nocturnas: 0,
          horas_festivas: 0,
          incidencias: 0,
          fechas: new Set(),
          estados: new Set(),
          en_periodo: false,
          validado_en: '',
        };
      }
      const h = histMap[key];
      h.registros += 1;
      h.horas_totales += Number(r.horas_trabajadas) || 0;
      h.horas_extra += (Number(r.horas_extra_ordinarias) || 0) + (Number(r.horas_extra_festivas) || 0);
      h.horas_nocturnas += Number(r.horas_nocturnas) || 0;
      h.horas_festivas += Number(r.horas_festivas) || 0;
      if (String(r.origen || '').startsWith('cierre_')) h.incidencias += 1;
      h.fechas.add(r.fecha);
      if (r.estado_legal) h.estados.add(r.estado_legal);
      if (r.fecha >= desde && r.fecha <= hasta) h.en_periodo = true;
      if (r.validado_en && r.validado_en > (h.validado_en || '')) h.validado_en = r.validado_en;
    }

    const historico = Object.values(histMap)
      .sort((a, b) => `${a.trabajador_nombre}${a.orden}`.localeCompare(`${b.trabajador_nombre}${b.orden}`))
      .map((h) => ({
        empresa_nombre: h.empresa_nombre,
        trabajador_dni: h.trabajador_dni,
        trabajador_nombre: h.trabajador_nombre,
        periodo: h.periodo,
        mes_label: h.mes_label,
        registros: h.registros,
        dias_trabajados: h.fechas.size,
        horas_totales: h.horas_totales,
        horas_extra: h.horas_extra,
        horas_nocturnas: h.horas_nocturnas,
        horas_festivas: h.horas_festivas,
        incidencias: h.incidencias,
        estados: [...h.estados].join(' / '),
        en_periodo: h.en_periodo ? 'Sí' : 'No',
        validado_en: h.validado_en,
      }));

    // ── Hoja: Auditoría legal ─────────────────────────────────────────────
    const auditoriaRaw = asArray(await base44.asServiceRole.entities.AuditoriaHorario.filter(
      { fecha_hora: { $gte: `${desde}T00:00:00.000Z`, $lte: `${hasta}T23:59:59.999Z` } },
    ));

    const auditoriaLegal = auditoriaRaw.map((a) => ({
      registro_id: a.registro_id || '',
      entidad: a.entidad || '',
      accion: a.accion || '',
      usuario: a.usuario || '',
      rol: a.rol || '',
      fecha_hora: a.fecha_hora || '',
      campo: a.campo || '',
      valor_anterior: a.valor_anterior || '',
      valor_nuevo: a.valor_nuevo || '',
      motivo: a.motivo || '',
      origen: a.origen || '',
      version_legal: a.version_legal ?? '',
    }));

    // ── Nombre del archivo ────────────────────────────────────────────────
    const nombreTrab = String(detalle[0]?.trabajador_nombre || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-');
    const suffix = trabajadorId ? `TRAB-${nombreTrab || 'trabajador'}` : 'Resumen-General';
    const filename = `${desde}_${hasta}-LEGAL-${suffix}.xlsx`;

    // ── Auditoría de la exportación ───────────────────────────────────────
    const ahora = new Date().toISOString();
    await registrarAuditoria(base44, {
      entidad: 'RegistroHorarioLegal',
      accion: 'exportacion_legal_generada',
      usuario: user.email,
      rol: user.role,
      motivo: `Exportación legal ${desde} a ${hasta}`,
      origen: 'exportacion',
      valor_nuevo: filename,
    });
    auditoriaLegal.push({
      registro_id: '',
      entidad: 'RegistroHorarioLegal',
      accion: 'exportacion_legal_generada',
      usuario: user.email,
      rol: user.role,
      fecha_hora: ahora,
      campo: '',
      valor_anterior: '',
      valor_nuevo: filename,
      motivo: `Exportación legal ${desde} a ${hasta}`,
      origen: 'exportacion',
      version_legal: '',
    });

    // Marca de exportación (best-effort, no debe romper la descarga).
    try {
      for (let i = 0; i < registros.length; i += 200) {
        const ids = registros.slice(i, i + 200).map((r) => r.id);
        await base44.asServiceRole.entities.RegistroHorarioLegal.updateMany(
          { id: { $in: ids } },
          { $set: { exportado_en: ahora } },
        );
      }
    } catch (_e) { /* ignore */ }

    // ── Libro Excel ───────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = empresa?.nombre || 'SMART-GESTION';
    wb.lastModifiedBy = user.email;
    wb.created = new Date();

    // Portada corporativa
    const portada = wb.addWorksheet('Portada', { views: [{ showGridLines: false }] });
    portada.columns = [{ width: 3 }, { width: 30 }, { width: 52 }, { width: 22 }];

    const logo = await descargarLogo(empresa?.logo_url || LOGO_POR_DEFECTO);
    if (logo) {
      try {
        const imgId = wb.addImage({ base64: logo.base64, extension: logo.extension });
        portada.addImage(imgId, { tl: { col: 1.1, row: 1.2 }, ext: { width: 190, height: 58 } });
      } catch (_e) { /* la portada sigue sin logo */ }
    }

    let fila = 6;
    const escribeLinea = (etiqueta, valor, opciones = {}) => {
      const celdaEtiqueta = portada.getCell(fila, 2);
      celdaEtiqueta.value = etiqueta;
      celdaEtiqueta.font = { bold: true, size: 9, color: { argb: GRIS } };
      const celdaValor = portada.getCell(fila, 3);
      celdaValor.value = valor || '';
      celdaValor.font = { size: opciones.tamano || 10, bold: !!opciones.negrita, color: { argb: TEXTO } };
      celdaValor.alignment = { wrapText: true, vertical: 'top' };
      fila += opciones.salto || 1;
    };

    portada.mergeCells(fila, 2, fila, 3);
    const titular = portada.getCell(fila, 2);
    titular.value = empresa?.nombre || 'Registro de jornada laboral';
    titular.font = { bold: true, size: 16, color: { argb: TEXTO } };
    fila += 1;

    portada.mergeCells(fila, 2, fila, 3);
    const subtitular = portada.getCell(fila, 2);
    subtitular.value = 'REGISTRO DE JORNADA LABORAL · DOCUMENTO LEGAL';
    subtitular.font = { bold: true, size: 10, color: { argb: AZUL } };
    fila += 2;

    if (empresa) {
      const domicilio = [empresa.domicilio, empresa.codigo_postal, empresa.localidad, empresa.provincia].filter(Boolean).join(', ');
      if (empresa.cif) escribeLinea('CIF', empresa.cif);
      if (domicilio) escribeLinea('Domicilio fiscal', domicilio);
      if (empresa.telefono) escribeLinea('Teléfono', empresa.telefono);
      if (empresa.email) escribeLinea('Email', empresa.email);
      if (empresa.web) escribeLinea('Web', empresa.web);
      if (empresa.actividad_principal) escribeLinea('Actividad', empresa.actividad_principal);
      if (empresa.registro_mercantil) escribeLinea('Registro Mercantil', empresa.registro_mercantil);
      fila += 1;
    }

    escribeLinea('Periodo exportado', `${desde} a ${hasta}`);
    escribeLinea('Generado por', `${user.full_name || user.email} (${user.role})`);
    escribeLinea('Fecha de generación', new Date(ahora).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }));
    escribeLinea('Registros oficiales incluidos', String(detalle.length));
    escribeLinea('Trabajadores incluidos', String(new Set(detalle.map((d) => d.trabajador_nombre)).size));
    escribeLinea('Meses con histórico', String(historico.length));
    escribeLinea('Eventos de auditoría', String(auditoriaLegal.length));
    fila += 1;

    portada.mergeCells(fila, 2, fila + 2, 3);
    const nota = portada.getCell(fila, 2);
    nota.value = 'Detalle y resúmenes construidos únicamente con registros en estado OFICIAL o VALIDADO ADMIN. La hoja «HistoricoLegal» incluye además todo el histórico registrado (con su estado) para trazabilidad. Conservar este documento 4 años (art. 34.9 del Estatuto de los Trabajadores y art. 20 del Real Decreto Legislativo 5/2000).';
    nota.font = { size: 8, italic: true, color: { argb: GRIS } };
    nota.alignment = { wrapText: true, vertical: 'top' };
    portada.getRow(fila).height = 60;

    const subtitulo = (extra) => `${empresa?.nombre || ''}${empresa?.cif ? ` · CIF ${empresa.cif}` : ''} · ${extra}`;

    hojaTabla(wb, {
      nombre: 'DetalleLegal',
      titulo: 'DETALLE DIARIO DEL REGISTRO DE JORNADA',
      subtitulo: subtitulo(`Periodo ${desde} a ${hasta} · Solo registros oficiales`),
      columnas: COLS_DETALLE,
      filas: detalle,
    });

    hojaTabla(wb, {
      nombre: 'ResumenMesLegal',
      titulo: 'RESUMEN MENSUAL POR TRABAJADOR',
      subtitulo: subtitulo(`Periodo ${desde} a ${hasta}`),
      columnas: COLS_MES,
      filas: resumenMes,
    });

    hojaTabla(wb, {
      nombre: 'ResumenTrimestreLegal',
      titulo: 'RESUMEN TRIMESTRAL POR TRABAJADOR',
      subtitulo: subtitulo(`Periodo ${desde} a ${hasta}`),
      columnas: COLS_TRIMESTRE,
      filas: resumenTrimestre,
    });

    hojaTabla(wb, {
      nombre: 'ResumenAnualLegal',
      titulo: 'RESUMEN ANUAL POR TRABAJADOR',
      subtitulo: subtitulo(`Periodo ${desde} a ${hasta}`),
      columnas: COLS_ANUAL,
      filas: resumenAnual,
    });

    hojaTabla(wb, {
      nombre: 'HistoricoLegal',
      titulo: 'HISTÓRICO COMPLETO DEL REGISTRO DE JORNADA',
      subtitulo: subtitulo('Todos los periodos registrados · incluye estados distintos de oficial (trazabilidad)'),
      columnas: COLS_HISTORICO,
      filas: historico,
    });

    hojaTabla(wb, {
      nombre: 'AuditoriaLegal',
      titulo: 'AUDITORÍA DEL REGISTRO LEGAL',
      subtitulo: subtitulo(`Eventos del ${desde} al ${hasta}`),
      columnas: COLS_AUDITORIA,
      filas: auditoriaLegal,
    });

    const buffer = await wb.xlsx.writeBuffer();
    const base64 = bytesToBase64(new Uint8Array(buffer));

    return Response.json({
      success: true,
      filename,
      base64,
      registros: detalle.length,
      historico: historico.length,
      auditoria: auditoriaLegal.length,
      empresa: empresa?.nombre || '',
      desde,
      hasta,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}