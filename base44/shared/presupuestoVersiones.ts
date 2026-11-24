/**
 * presupuestoVersiones — comparación pura entre dos estados de un presupuesto.
 *  - Se usa al guardar una edición: archiva la versión anterior y describe QUÉ cambió
 *    (cabecera, líneas añadidas/eliminadas/modificadas, precios y totales).
 *  - Nunca decide permisos ni escribe: solo calcula el diff.
 */
export type CambioCampo = { campo: string; etiqueta: string; antes: string; despues: string };
export type LineaVersion = {
  indice: number;
  tipo: 'anadida' | 'eliminada' | 'modificada';
  descripcion: string;
  antes: any | null;
  despues: any | null;
  campos: string[];
};
export type TotalesVersion = { base_imponible: number; iva_total: number; total_con_iva: number };
export type DiffPresupuesto = {
  campos_modificados: CambioCampo[];
  lineas_modificadas: LineaVersion[];
  totales_antes: TotalesVersion;
  totales_despues: TotalesVersion;
  resumen: string[];
};

const CAMPOS_CABECERA: { campo: string; etiqueta: string }[] = [
  { campo: 'titulo', etiqueta: 'Título' },
  { campo: 'cliente_name', etiqueta: 'Cliente' },
  { campo: 'fecha', etiqueta: 'Fecha' },
  { campo: 'valido_hasta', etiqueta: 'Válido hasta' },
  { campo: 'referencia_cliente', etiqueta: 'Referencia del cliente' },
  { campo: 'obra_name', etiqueta: 'Obra' },
  { campo: 'forma_pago', etiqueta: 'Forma de pago' },
  { campo: 'descripcion', etiqueta: 'Descripción' },
  { campo: 'notas', etiqueta: 'Notas' },
];

const CAMPOS_LINEA = ['descripcion', 'detalle', 'cantidad', 'unidad', 'precio_unitario', 'iva_pct'];

const texto = (v: any) => (v === undefined || v === null ? '' : String(v).trim());
const norm = (v: any) => texto(v).toLowerCase().replace(/\s+/g, ' ');
const esNumero = (campo: string) => campo === 'cantidad' || campo === 'precio_unitario' || campo === 'iva_pct';

/** Identidad de una línea: su origen (parte/extra) o, si no lo tiene, su descripción. */
const claveLinea = (l: any) => (l?.parte_id ? `p:${l.parte_id}` : l?.extra_id ? `e:${l.extra_id}` : `d:${norm(l?.descripcion)}`);

const eur = (n: any) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const recortar = (s: string, max = 70) => (s.length > max ? `${s.slice(0, max)}…` : s);

export function totalesDe(p: any): TotalesVersion {
  return {
    base_imponible: Number(p?.base_imponible ?? p?.importe ?? 0),
    iva_total: Number(p?.iva_total ?? 0),
    total_con_iva: Number(p?.total_con_iva ?? 0),
  };
}

export function compararPresupuesto(anterior: any, siguiente: any): DiffPresupuesto {
  // ── Cabecera ───────────────────────────────────────────────────────────────
  const campos_modificados: CambioCampo[] = [];
  for (const c of CAMPOS_CABECERA) {
    const a = texto(anterior?.[c.campo]);
    const b = texto(siguiente?.[c.campo]);
    if (a !== b) campos_modificados.push({ campo: c.campo, etiqueta: c.etiqueta, antes: a, despues: b });
  }

  // ── Líneas ─────────────────────────────────────────────────────────────────
  const lineasAntes: any[] = Array.isArray(anterior?.conceptos) ? anterior.conceptos : [];
  const lineasDespues: any[] = Array.isArray(siguiente?.conceptos) ? siguiente.conceptos : [];
  const usadas = new Set<number>();
  const lineas_modificadas: LineaVersion[] = [];

  lineasDespues.forEach((nueva, i) => {
    const clave = claveLinea(nueva);
    let match = -1;
    for (let j = 0; j < lineasAntes.length; j++) {
      if (usadas.has(j)) continue;
      if (claveLinea(lineasAntes[j]) === clave) { match = j; break; }
    }
    if (match === -1) {
      lineas_modificadas.push({ indice: i, tipo: 'anadida', descripcion: texto(nueva?.descripcion), antes: null, despues: nueva, campos: [] });
      return;
    }
    usadas.add(match);
    const vieja = lineasAntes[match];
    const campos = CAMPOS_LINEA.filter((campo) => (esNumero(campo)
      ? Math.abs(Number(vieja?.[campo] || 0) - Number(nueva?.[campo] || 0)) > 1e-9
      : texto(vieja?.[campo]) !== texto(nueva?.[campo])));
    if (Math.abs(Number(vieja?.total || 0) - Number(nueva?.total || 0)) > 0.005) campos.push('total');
    if (campos.length) {
      lineas_modificadas.push({ indice: i, tipo: 'modificada', descripcion: texto(nueva?.descripcion), antes: vieja, despues: nueva, campos });
    }
  });

  lineasAntes.forEach((vieja, j) => {
    if (usadas.has(j)) return;
    lineas_modificadas.push({ indice: j, tipo: 'eliminada', descripcion: texto(vieja?.descripcion), antes: vieja, despues: null, campos: [] });
  });

  // ── Totales y resumen legible ──────────────────────────────────────────────
  const totales_antes = totalesDe(anterior);
  const totales_despues = totalesDe(siguiente);
  const resumen: string[] = [];

  const anadidas = lineas_modificadas.filter((l) => l.tipo === 'anadida').length;
  const eliminadas = lineas_modificadas.filter((l) => l.tipo === 'eliminada').length;
  const modificadas = lineas_modificadas.filter((l) => l.tipo === 'modificada');
  const conPrecio = modificadas.filter((l) => l.campos.includes('precio_unitario') || l.campos.includes('total')).length;

  if (anadidas) resumen.push(`${anadidas} línea(s) añadida(s)`);
  if (eliminadas) resumen.push(`${eliminadas} línea(s) eliminada(s)`);
  if (modificadas.length) resumen.push(`${modificadas.length} línea(s) modificada(s)`);
  if (conPrecio) resumen.push(`${conPrecio} línea(s) con cambio de precio`);

  if (Math.abs(totales_antes.base_imponible - totales_despues.base_imponible) >= 0.005) {
    resumen.push(`Base imponible: ${eur(totales_antes.base_imponible)} → ${eur(totales_despues.base_imponible)}`);
  }
  if (Math.abs(totales_antes.total_con_iva - totales_despues.total_con_iva) >= 0.005) {
    resumen.push(`Total: ${eur(totales_antes.total_con_iva)} → ${eur(totales_despues.total_con_iva)}`);
  }
  for (const c of campos_modificados) {
    resumen.push(`${c.etiqueta}: ${recortar(c.antes || '—')} → ${recortar(c.despues || '—')}`);
  }
  if (!resumen.length) resumen.push('Sin cambios en los datos del presupuesto');

  return { campos_modificados, lineas_modificadas, totales_antes, totales_despues, resumen };
}