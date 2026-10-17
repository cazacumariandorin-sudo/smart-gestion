/**
 * ivaImport — lectura de ficheros de facturas para el libro de IVA (FacturaIVA).
 * Funciones puras (sin acceso a la base de datos) para poder probarlas aparte.
 *
 * Soporta:
 *  - Codificación: UTF-8 (con o sin BOM), UTF-16 LE/BE (con BOM) y Windows-1252.
 *  - Separador: tabulador, punto y coma o coma (autodetectado).
 *  - Formato A: export de programa de facturación (secciones FACTURAS EMITIDAS /
 *    FACTURAS RECIBIDAS / BIENES INVERSIÓN, líneas Cabecera/Detalle/Cobro).
 *  - Formato B: CSV genérico con cabecera (tipo, fecha_factura, numero_factura, ...).
 *  - Detección de duplicados dentro del fichero y contra el libro existente.
 */

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s) => sinAcentos(s).trim().toUpperCase();
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function decodificar(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
  if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8.subarray(2));
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return new TextDecoder('utf-8').decode(u8.subarray(3));
  const utf8 = new TextDecoder('utf-8').decode(u8);
  return utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(u8) : utf8;
}

export function parseNum(v) {
  if (v == null) return null;
  let s = String(v).trim().replace(/\s/g, '').replace(/€|%/g, '');
  if (s === '' || s === '-') return null;
  const c = s.lastIndexOf(',');
  const p = s.lastIndexOf('.');
  if (c >= 0 && p >= 0) s = c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c >= 0) s = s.replace(',', '.');
  else if (p >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

export function parseFecha(v) {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

/** Elige el separador contando candidatos fuera de comillas en las primeras líneas. */
export function detectarSeparador(texto) {
  const cand = ['\t', ';', ','];
  const cuenta = { '\t': 0, ';': 0, ',': 0 };
  let q = false;
  let lineas = 0;
  for (let i = 0; i < texto.length && lineas < 6; i++) {
    const c = texto[i];
    if (c === '"') q = !q;
    else if (!q && c === '\n') lineas++;
    else if (!q && cand.includes(c)) cuenta[c]++;
  }
  const mejor = cand.reduce((a, b) => (cuenta[b] > cuenta[a] ? b : a), ';');
  return cuenta[mejor] === 0 ? ';' : mejor;
}

/** Tokenizador CSV con comillas y saltos de línea dentro de celdas. */
export function parseFilas(texto, sep) {
  const filas = [];
  let fila = [];
  let cel = '';
  let q = false;
  const t = texto.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cel += '"'; i++; } else q = false; }
      else cel += c;
    } else if (c === '"') q = true;
    else if (c === sep) { fila.push(cel.trim()); cel = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(cel.trim()); cel = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else cel += c;
  }
  fila.push(cel.trim());
  if (fila.some((x) => x !== '')) filas.push(fila);
  return filas;
}

const limpiaNif = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function claveDuplicado(f) {
  const nif = limpiaNif(f.nif_contraparte);
  const num = String(f.numero_factura ?? '').trim().toLowerCase();
  if (num) return [f.tipo, nif, num, Number(f.tipo_iva) || 0].join('|');
  return [f.tipo, nif, f.fecha_factura, r2(f.base_imponible), Number(f.tipo_iva) || 0].join('|');
}

function filaLibro(o) {
  const base = r2(o.base);
  const cuota = o.cuota != null ? r2(o.cuota) : r2((base * o.tipoIva) / 100);
  return {
    tipo: o.tipo,
    fecha_factura: o.fecha,
    numero_factura: o.numero,
    nif_contraparte: String(o.nif || '').trim().toUpperCase(),
    nombre_contraparte: o.nombre || '',
    base_imponible: base,
    tipo_iva: o.tipoIva,
    cuota_iva: cuota,
    total_factura: r2(base + cuota),
    inversion_sujeto_pasivo: !!o.isp,
    deducible_pct: o.deducible ?? 100,
    tipo_justificante: o.justificante || 'completa',
    estado: 'borrador',
    origen: 'csv',
    ...(o.estadoCobro ? { estado_cobro: o.estadoCobro } : {}),
    ...(o.vencimiento ? { fecha_vencimiento: o.vencimiento } : {}),
  };
}

/* ───────────── Formato A: export del programa de facturación ───────────── */
function analizarExport(rows, opciones) {
  const filas = [];
  const errores = [];
  const omitidas = {};
  const omite = (m) => { omitidas[m] = (omitidas[m] || 0) + 1; };

  let seccion = null; // 'emitida' | 'recibida' | 'bienes'
  let cols = null;
  const bloques = { emitida: { cab: new Map(), det: [] }, recibida: { cab: new Map(), det: [] } };

  const idxAll = (name) => cols.reduce((a, h, i) => (h === name ? [...a, i] : a), []);
  const idx = (name) => { const r = idxAll(name); return r.length ? r[0] : -1; };
  const get = (r, name, n = 0) => { const a = idxAll(name); return a[n] != null ? r[a[n]] : ''; };

  for (const r of rows) {
    const primera = norm(r[0]);
    if (primera === 'FACTURAS EMITIDAS') { seccion = 'emitida'; cols = null; continue; }
    if (primera === 'FACTURAS RECIBIDAS') { seccion = 'recibida'; cols = null; continue; }
    if (primera.startsWith('BIENES INVERSION')) { seccion = 'bienes'; cols = null; continue; }
    if (primera === 'NUM. REG.') { cols = r.map(norm); continue; }
    if (primera === 'TOTAL' || !seccion || !cols) continue;
    if (seccion === 'bienes') { omite('bienes de inversión (no soportados todavía)'); continue; }
    const tl = norm(r[idx('TIPO LINEA')]);
    const numero = r[idx('NUMERO')] || '';
    if (tl === 'CABECERA') bloques[seccion].cab.set(numero, { r, cols: [...cols] });
    else if (tl === 'DETALLE') bloques[seccion].det.push({ r, cols: [...cols] });
  }

  for (const sec of ['emitida', 'recibida']) {
    if (sec === 'recibida' && !opciones.incluirRecibidas) {
      if (bloques.recibida.cab.size) omite(`${bloques.recibida.cab.size} factura(s) recibida(s) del export no importadas (las compras se toman de la app)`);
      continue;
    }
    const { cab, det } = bloques[sec];
    const contra = sec === 'emitida' ? 1 : 0; // emitida: receptor = 2º bloque; recibida: emisor = 1º
    const lee = (reg, name, n = 0) => {
      cols = reg.cols;
      return get(reg.r, name, n);
    };
    const detPorNum = new Map();
    for (const d of det) {
      const n = lee(d, 'NUMERO');
      if (!detPorNum.has(n)) detPorNum.set(n, []);
      detPorNum.get(n).push(d);
    }
    for (const [numero, reg] of cab) {
      const estado = norm(lee(reg, 'ESTADO'));
      if (/ANULAD|BORRADOR/.test(estado)) { omite(`factura(s) ${estado.toLowerCase()}`); continue; }
      const fecha = parseFecha(lee(reg, 'FECHA'));
      if (!fecha) { errores.push(`Factura ${numero}: fecha inválida.`); continue; }
      const estadoCobro = /PAGAD|COBRAD/.test(estado) ? 'pagado' : /PENDIENT/.test(estado) ? 'pendiente' : '';
      const vencimiento = parseFecha(lee(reg, 'FECHA VENCIMIENTO'));
      cols = reg.cols;
      const nifs = idxAll('NIF');
      const noms = idxAll('NOMBRE O RAZON SOCIAL');
      const nif = reg.r[nifs[Math.min(contra, nifs.length - 1)]] || '';
      const nombre = reg.r[noms[Math.min(contra, noms.length - 1)]] || '';
      const pct = sec === 'recibida' ? (parseNum(lee(reg, '% IMPUTACION A IVA')) ?? 100) : 100;
      const baseCab = parseNum(lee(reg, 'BASE IMPONIBLE'));

      // Agrupar líneas de detalle por tipo de IVA (ignora líneas de texto sin importe)
      const grupos = new Map();
      for (const d of detPorNum.get(numero) || []) {
        const base = parseNum(lee(d, 'B.I. TOTAL LINEA')) || 0;
        const iva = parseNum(lee(d, 'TOTAL IVA LINEA')) || 0;
        const tipo = parseNum(lee(d, 'TIPO IVA')) || 0;
        if (base === 0 && iva === 0) continue;
        const g = grupos.get(tipo) || { base: 0, cuota: 0 };
        g.base += base; g.cuota += iva;
        grupos.set(tipo, g);
      }
      if (grupos.size === 0) {
        // Sin detalle: usar la cabecera si solo hay un tipo con cuota
        const tipos = cols
          .map((h, i) => ({ m: h.match(/^TOTAL (\d+)% IVA$/), i }))
          .filter((x) => x.m)
          .map((x) => ({ tipo: Number(x.m[1]), cuota: parseNum(reg.r[x.i]) || 0 }))
          .filter((x) => x.cuota !== 0);
        if (tipos.length === 1 && baseCab != null) grupos.set(tipos[0].tipo, { base: baseCab, cuota: tipos[0].cuota });
        else if (baseCab === 0 || baseCab == null) { omite('factura(s) sin importes'); continue; }
        else { errores.push(`Factura ${numero}: sin detalle y con varios tipos de IVA; no se puede repartir la base.`); continue; }
      }
      const sumaBase = [...grupos.values()].reduce((s, g) => s + g.base, 0);
      if (baseCab != null && Math.abs(r2(sumaBase) - r2(baseCab)) > 0.02) {
        errores.push(`Factura ${numero}: el detalle (${r2(sumaBase)}) no suma la base de cabecera (${r2(baseCab)}).`);
        continue;
      }
      for (const [tipoIva, g] of grupos) {
        filas.push(filaLibro({ tipo: sec, fecha, numero, nif, nombre, base: g.base, cuota: g.cuota, tipoIva, deducible: pct, estadoCobro, vencimiento }));
      }
    }
  }
  return { filas, errores, omitidas };
}

/* ───────────── Formato B: CSV genérico ───────────── */
const SINONIMOS = {
  tipo: ['TIPO'],
  fecha: ['FECHA_FACTURA', 'FECHA'],
  numero: ['NUMERO_FACTURA', 'NUMERO', 'N_FACTURA', 'NUM_FACTURA'],
  nif: ['NIF_CONTRAPARTE', 'NIF', 'CIF'],
  nombre: ['NOMBRE_CONTRAPARTE', 'NOMBRE', 'CLIENTE', 'PROVEEDOR'],
  base: ['BASE_IMPONIBLE', 'BASE'],
  tipoIva: ['TIPO_IVA', 'IVA_PCT', 'PORCENTAJE_IVA'],
  cuota: ['CUOTA_IVA', 'CUOTA', 'IVA'],
  isp: ['INVERSION_SUJETO_PASIVO', 'ISP'],
  deducible: ['DEDUCIBLE_PCT', 'DEDUCIBLE'],
  just: ['TIPO_JUSTIFICANTE', 'JUSTIFICANTE'],
  cobro: ['ESTADO_COBRO', 'ESTADO_PAGO', 'COBRO'],
  venc: ['FECHA_VENCIMIENTO', 'VENCIMIENTO'],
};

function analizarGenerico(rows) {
  const filas = [];
  const errores = [];
  const cab = rows[0].map((h) => norm(h).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''));
  const col = (k) => { for (const s of SINONIMOS[k]) { const i = cab.indexOf(s); if (i >= 0) return i; } return -1; };
  const ix = Object.fromEntries(Object.keys(SINONIMOS).map((k) => [k, col(k)]));
  if (ix.fecha < 0 || ix.base < 0) {
    return { filas, errores: ['No reconozco las columnas: se necesitan al menos fecha_factura y base_imponible.'], omitidas: {} };
  }
  rows.slice(1).forEach((r, i) => {
    const g = (k) => (ix[k] >= 0 ? r[ix[k]] ?? '' : '');
    const fecha = parseFecha(g('fecha'));
    const base = parseNum(g('base'));
    if (!fecha || base == null) { errores.push(`Fila ${i + 2}: fecha o base inválida.`); return; }
    const tipoIva = parseNum(g('tipoIva')) ?? 21;
    const justif = String(g('just')).toLowerCase();
    filas.push(filaLibro({
      tipo: norm(g('tipo')).startsWith('E') ? 'emitida' : 'recibida',
      fecha, numero: g('numero'), nif: g('nif'), nombre: g('nombre'), base, tipoIva,
      cuota: parseNum(g('cuota')),
      isp: /^(1|S|SI|TRUE|X)$/.test(norm(g('isp'))),
      deducible: parseNum(g('deducible')) ?? 100,
      justificante: ['completa', 'simplificada', 'otro'].includes(justif) ? justif : 'completa',
      estadoCobro: /^(PAGAD|COBRAD)/.test(norm(g('cobro'))) ? 'pagado' : /^PENDIENT/.test(norm(g('cobro'))) ? 'pendiente' : '',
      vencimiento: parseFecha(g('venc')),
    }));
  });
  return { filas, errores, omitidas: {} };
}

/**
 * @param texto      contenido ya decodificado
 * @param opciones   { incluirRecibidas?: boolean }
 * @param existentes filas del libro ya guardadas (para detectar duplicados)
 */
export function analizarImportacion(texto, opciones = {}, existentes = []) {
  const separador = detectarSeparador(texto);
  const rows = parseFilas(texto, separador);
  if (rows.length < 2) return { formato: 'desconocido', separador, filas: [], duplicadasArchivo: [], duplicadasLibro: [], errores: ['El archivo está vacío o no tiene filas.'], omitidas: {}, resumen: null };

  const esExport = rows.some((r) => norm(r[0]) === 'NUM. REG.') && rows.some((r) => /^FACTURAS (EMITIDAS|RECIBIDAS)$/.test(norm(r[0])));
  const { filas, errores, omitidas } = esExport ? analizarExport(rows, opciones) : analizarGenerico(rows);

  const enLibro = new Set(existentes.filter((f) => f.estado !== 'anulada').map(claveDuplicado));
  const vistas = new Set();
  const nuevas = [];
  const duplicadasArchivo = [];
  const duplicadasLibro = [];
  for (const f of filas) {
    const k = claveDuplicado(f);
    if (enLibro.has(k)) duplicadasLibro.push(f);
    else if (vistas.has(k)) duplicadasArchivo.push(f);
    else { vistas.add(k); nuevas.push(f); }
  }
  const suma = (arr, t) => {
    const x = arr.filter((f) => f.tipo === t);
    return { n: new Set(x.map((f) => f.numero_factura)).size, filas: x.length, base: r2(x.reduce((s, f) => s + f.base_imponible, 0)), cuota: r2(x.reduce((s, f) => s + f.cuota_iva, 0)) };
  };
  const fechas = nuevas.map((f) => f.fecha_factura).sort();
  return {
    formato: esExport ? 'export_facturacion' : 'generico',
    separador: separador === '\t' ? 'tabulador' : separador === ';' ? 'punto y coma' : 'coma',
    filas: nuevas,
    duplicadasArchivo,
    duplicadasLibro,
    errores,
    omitidas,
    resumen: { emitidas: suma(nuevas, 'emitida'), recibidas: suma(nuevas, 'recibida'), fechaMin: fechas[0] || null, fechaMax: fechas[fechas.length - 1] || null },
  };
}
