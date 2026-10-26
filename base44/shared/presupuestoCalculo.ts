/**
 * presupuestoCalculo — cálculo de importes de presupuestos y facturas borrador (DOC-07).
 *  - IVA POR LÍNEA (nunca un tipo fijo).
 *  - Cada línea se redondea a céntimos (mitad hacia fuera de cero): base = cantidad × precio,
 *    cuota = base × IVA %. Los totales son la SUMA de las líneas, igual que Contasimple.
 *  - Las líneas de solo texto (tipo 'texto') no suman nada.
 * Se trabaja en céntimos enteros para evitar errores de coma flotante.
 * Hay una copia idéntica en src/lib/presupuestoCalculo.js (el frontend no puede importar de base44/shared).
 */
export type LineaPresupuesto = {
  tipo?: 'linea' | 'texto';
  descripcion?: string;
  detalle?: string;
  cantidad?: number;
  unidad?: string;
  precio_unitario?: number;
  iva_pct?: number;
  parte_id?: string;
  fecha?: string;
  total?: number;       // base de la línea (calculado)
  cuota_iva?: number;   // cuota de la línea (calculado)
};
export type DesgloseIva = { tipo: number; base: number; cuota: number };
export type ResultadoCalculo = {
  lineas: LineaPresupuesto[];
  base_imponible: number;
  iva_total: number;
  total_con_iva: number;
  desglose_iva: DesgloseIva[];
};

export const IVA_POR_DEFECTO = 21;

const aCentimos = (n: number) => {
  const x = Number(n) || 0;
  const v = Math.abs(x) * 100;
  const r = Math.round(v + 1e-9);          // mitad hacia fuera de cero; 1e-9 absorbe 1,005*100 = 100,49999…
  return x < 0 ? -r : r;
};
const deCentimos = (c: number) => c / 100;

/** Redondeo de una cantidad de céntimos multiplicada por un porcentaje (mitad hacia fuera de cero). */
const porcentaje = (centimos: number, pct: number) => {
  const v = Math.abs(centimos) * pct / 100;
  const r = Math.round(v + 1e-9);
  return centimos < 0 ? -r : r;
};

export function calcularLinea(l: LineaPresupuesto): { base: number; cuota: number } {
  if (l.tipo === 'texto') return { base: 0, cuota: 0 };
  const iva = l.iva_pct === undefined || l.iva_pct === null || Number.isNaN(Number(l.iva_pct)) ? IVA_POR_DEFECTO : Number(l.iva_pct);
  const baseC = aCentimos((Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0));
  const cuotaC = porcentaje(baseC, iva);
  return { base: deCentimos(baseC), cuota: deCentimos(cuotaC) };
}

export function calcularDocumento(lineas: LineaPresupuesto[]): ResultadoCalculo {
  let baseC = 0, cuotaC = 0;
  const grupos = new Map<number, { base: number; cuota: number }>();
  const salida: LineaPresupuesto[] = (lineas || []).map((l) => {
    const tipo = l.tipo === 'texto' ? 'texto' : 'linea';
    if (tipo === 'texto') return { ...l, tipo, cantidad: 0, precio_unitario: 0, iva_pct: 0, total: 0, cuota_iva: 0 };
    const iva = l.iva_pct === undefined || l.iva_pct === null || Number.isNaN(Number(l.iva_pct)) ? IVA_POR_DEFECTO : Number(l.iva_pct);
    const { base, cuota } = calcularLinea({ ...l, iva_pct: iva });
    const bC = aCentimos(base), cC = aCentimos(cuota);
    baseC += bC; cuotaC += cC;
    const g = grupos.get(iva) || { base: 0, cuota: 0 };
    g.base += bC; g.cuota += cC; grupos.set(iva, g);
    return { ...l, tipo, iva_pct: iva, total: base, cuota_iva: cuota };
  });
  const desglose = [...grupos.entries()].sort((a, b) => b[0] - a[0]).map(([tipo, g]) => ({ tipo, base: deCentimos(g.base), cuota: deCentimos(g.cuota) }));
  return {
    lineas: salida,
    base_imponible: deCentimos(baseC),
    iva_total: deCentimos(cuotaC),
    total_con_iva: deCentimos(baseC + cuotaC),
    desglose_iva: desglose,
  };
}
