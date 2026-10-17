/**
 * ivaCompras — estimación del IVA soportado a partir de los gastos registrados en la app
 * (RegistroGasto). Lógica pura, server-side, usada por calcularIVAPeriodo.
 *
 * Limitaciones asumidas (el 303 es solo control interno):
 *  - RegistroGasto guarda el IMPORTE CON IVA, no la base ni el tipo: el IVA se ESTIMA
 *    aplicando un tipo por categoría (configurable).
 *  - El NIF viene del OCR (nif_comercio) y puede ser erróneo: se clasifica y se avisa.
 *  - Solo cuentan los gastos ya aprobados/contabilizados (por defecto no: borrador,
 *    pendiente ni rechazada).
 */

export const ESTADOS_GASTO_CONTABLES = ['aprobado_gerencia', 'registrado', 'en_administracion', 'pagada'];
export const TIPO_IVA_CATEGORIA: Record<string, number> = {
  material: 21, combustible: 21, parking: 21, peaje: 10, comida: 10, otros: 21,
};
export const DEDUCIBLE_CATEGORIA: Record<string, number> = {
  material: 100, combustible: 100, parking: 100, peaje: 100, otros: 100, comida: 0,
};

const RANGO_ESTADO: Record<string, number> = { pagada: 4, en_administracion: 3, registrado: 2, aprobado_gerencia: 1 };
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const limpia = (s: any) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Valida formato y dígito de control de NIF, NIE y CIF. */
export function nifValido(raw: any): boolean {
  const s = limpia(raw);
  if (s.length !== 9) return false;
  if (/^\d{8}[A-Z]$/.test(s)) return LETRAS_NIF[parseInt(s.slice(0, 8), 10) % 23] === s[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) {
    const n = parseInt('XYZ'.indexOf(s[0]) + s.slice(1, 8), 10);
    return LETRAS_NIF[n % 23] === s[8];
  }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s)) {
    let suma = 0;
    s.slice(1, 8).split('').map(Number).forEach((x, i) => {
      if (i % 2 === 0) { const y = x * 2; suma += Math.floor(y / 10) + (y % 10); } else suma += x;
    });
    const c = (10 - (suma % 10)) % 10;
    const letra = 'JABCDEFGHI'[c];
    if ('PQRSNW'.includes(s[0])) return s[8] === letra;
    if ('ABEH'.includes(s[0])) return s[8] === String(c);
    return s[8] === String(c) || s[8] === letra;
  }
  if (/^[KLM]\d{7}[A-Z]$/.test(s)) return true; // NIF especiales: solo formato
  return false;
}

export type ClaseNif = 'ok' | 'sin_nif' | 'invalido' | 'propio';

export function clasificarNif(raw: any, propios: Set<string>): ClaseNif {
  const s = limpia(raw);
  if (!s || s === 'NULL' || s === 'NONE' || /0{6,}/.test(s)) return 'sin_nif';
  if (propios.has(s)) return 'propio';
  return nifValido(s) ? 'ok' : 'invalido';
}

export type FilaCompra = {
  origen: 'gasto'; id: string; tipo: 'recibida'; numero: string; fecha: string; nif: string; nombre: string;
  base: number; tipoIva: number; cuota: number; total: number; isp: boolean; deduciblePct: number;
  justificante: string; estado: string; categoria: string; claseNif: ClaseNif;
};

export function prepararComprasApp(gastos: any[], opts: {
  inicio: string; fin: string; estados?: string[];
  tiposIva?: Record<string, number>; deducible?: Record<string, number>; nifsPropios?: string[];
}) {
  const estados = opts.estados ?? ESTADOS_GASTO_CONTABLES;
  const tipos = { ...TIPO_IVA_CATEGORIA, ...(opts.tiposIva || {}) };
  const deduc = { ...DEDUCIBLE_CATEGORIA, ...(opts.deducible || {}) };
  const propios = new Set((opts.nifsPropios || []).map(limpia).filter(Boolean));

  const excluidosPorEstado: Record<string, { n: number; importe: number }> = {};
  let sinImporte = 0;
  const candidatos: any[] = [];
  for (const g of gastos) {
    const f = String(g.fecha_documento || '').slice(0, 10);
    if (!f || f < opts.inicio || f > opts.fin) continue;
    const est = String(g.estado || '');
    if (!estados.includes(est)) {
      const x = excluidosPorEstado[est || 'sin_estado'] || { n: 0, importe: 0 };
      x.n++; x.importe = r2(x.importe + (Number(g.importe) || 0));
      excluidosPorEstado[est || 'sin_estado'] = x;
      continue;
    }
    if (!Number(g.importe)) { sinImporte++; continue; }
    candidatos.push(g);
  }

  // Duplicados: mismo nº de factura + misma fecha + mismo importe (se conserva el más avanzado)
  const grupos = new Map<string, any[]>();
  const sinClave: any[] = [];
  for (const g of candidatos) {
    const num = limpia(g.numero_factura);
    if (num.length >= 3 && num !== 'NULL') {
      const k = `${num}|${String(g.fecha_documento).slice(0, 10)}|${r2(g.importe)}`;
      grupos.set(k, [...(grupos.get(k) || []), g]);
    } else sinClave.push(g);
  }
  let dupN = 0, dupImporte = 0;
  const unicos: any[] = [...sinClave];
  for (const arr of grupos.values()) {
    arr.sort((a, b) => (RANGO_ESTADO[b.estado] || 0) - (RANGO_ESTADO[a.estado] || 0));
    unicos.push(arr[0]);
    for (const x of arr.slice(1)) { dupN++; dupImporte = r2(dupImporte + Number(x.importe)); }
  }
  // Mismo nº (≥6 caracteres) y fecha pero importes distintos: posible lectura OCR errónea
  const porNumFecha = new Map<string, Set<number>>();
  for (const g of unicos) {
    const num = limpia(g.numero_factura);
    if (num.length < 6 || num === 'NULL') continue;
    const k = `${num}|${String(g.fecha_documento).slice(0, 10)}`;
    porNumFecha.set(k, (porNumFecha.get(k) || new Set()).add(r2(g.importe)));
  }
  const mismoNumeroImporteDistinto = [...porNumFecha.values()].filter((s) => s.size > 1).length;

  const filas: FilaCompra[] = [];
  const porCategoria: Record<string, { n: number; importe: number; base: number; cuota: number; deducible: number; tipoIva: number; deduciblePct: number }> = {};
  const riesgo: Record<ClaseNif, { n: number; cuota: number }> = {
    ok: { n: 0, cuota: 0 }, sin_nif: { n: 0, cuota: 0 }, invalido: { n: 0, cuota: 0 }, propio: { n: 0, cuota: 0 },
  };
  for (const g of unicos) {
    const cat = tipos[g.categoria] != null ? String(g.categoria) : 'otros';
    const tipoIva = tipos[cat];
    const importe = Number(g.importe);
    const base = r2(importe / (1 + tipoIva / 100));
    const cuota = r2(importe - base);
    const pct = deduc[cat] ?? 100;
    const nifRaw = g.proveedor_nif || g.nif_comercio || '';
    const clase = clasificarNif(nifRaw, propios);
    const num = String(g.numero_factura ?? '').trim();
    const tieneNum = limpia(num).length >= 3 && limpia(num) !== 'NULL';
    filas.push({
      origen: 'gasto', id: g.id, tipo: 'recibida', numero: tieneNum ? num : '', fecha: String(g.fecha_documento).slice(0, 10),
      nif: limpia(nifRaw), nombre: g.nombre_comercio || '', base, tipoIva, cuota, total: r2(importe),
      isp: false, deduciblePct: pct, justificante: clase === 'ok' && tieneNum ? 'completa' : 'simplificada',
      estado: 'revisada', categoria: cat, claseNif: clase,
    });
    const pc = porCategoria[cat] || { n: 0, importe: 0, base: 0, cuota: 0, deducible: 0, tipoIva, deduciblePct: pct };
    pc.n++; pc.importe = r2(pc.importe + importe); pc.base = r2(pc.base + base); pc.cuota = r2(pc.cuota + cuota);
    pc.deducible = r2(pc.deducible + (cuota * pct) / 100);
    porCategoria[cat] = pc;
    riesgo[clase].n++; riesgo[clase].cuota = r2(riesgo[clase].cuota + (cuota * pct) / 100);
  }

  return {
    filas,
    resumen: {
      incluidos: filas.length,
      importe_total: r2(filas.reduce((s, f) => s + f.total, 0)),
      cuota_estimada: r2(filas.reduce((s, f) => s + f.cuota, 0)),
      cuota_deducible: r2(filas.reduce((s, f) => s + (f.cuota * f.deduciblePct) / 100, 0)),
      por_categoria: porCategoria,
      excluidos_por_estado: excluidosPorEstado,
      sin_importe: sinImporte,
      duplicados_eliminados: { n: dupN, importe: dupImporte },
      mismo_numero_importe_distinto: mismoNumeroImporteDistinto,
      nif: riesgo,
      estados_incluidos: estados,
    },
  };
}
