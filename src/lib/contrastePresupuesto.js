/**
 * Contraste orientativo entre un material pendiente y las líneas del presupuesto
 * de la obra. No certifica nada: solo señala si hay una línea parecida.
 */

const STOPWORDS = new Set([
  'para', 'con', 'del', 'los', 'las', 'por', 'una', 'uno', 'desde', 'hasta',
  'tipo', 'segun', 'instalacion', 'suministro', 'metro', 'metros', 'unidad',
  'colocacion', 'montaje', 'puesta', 'marcha', 'obra', 'material', 'incluso',
]);

export function normalizarTexto(texto) {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9, ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(texto) {
  return normalizarTexto(texto)
    .split(' ')
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

/**
 * @returns {{ estado: 'sin_presupuesto'|'coincide'|'dudoso'|'sin_partida'|'sin_datos',
 *             referencia: string, detalle: string, score: number }}
 */
export function buscarPartidaPresupuesto(descripcionMaterial, presupuestos = []) {
  if (!presupuestos.length) {
    return { estado: 'sin_presupuesto', referencia: '', detalle: 'No hay presupuesto cargado para esta obra.', score: 0 };
  }
  const objetivo = tokens(descripcionMaterial);
  if (!objetivo.length) {
    return { estado: 'sin_datos', referencia: '', detalle: 'Descripción insuficiente para contrastar.', score: 0 };
  }

  let mejor = null;
  presupuestos.forEach((p) => {
    const lineas = Array.isArray(p.conceptos) ? p.conceptos : [];
    lineas.forEach((linea) => {
      const propios = tokens(linea?.descripcion);
      if (!propios.length) return;
      const coincidencias = objetivo.filter((t) => propios.includes(t)).length;
      const score = coincidencias / objetivo.length;
      if (!mejor || score > mejor.score) {
        mejor = {
          score,
          descripcion: linea.descripcion,
          referencia: p.codigo_registro || p.titulo || 'Presupuesto',
          estadoPresupuesto: p.estado || '',
        };
      }
    });
  });

  if (!mejor || mejor.score === 0) {
    return { estado: 'sin_partida', referencia: '', detalle: 'Sin partida identificada en el presupuesto cargado.', score: 0 };
  }
  if (mejor.score >= 0.6) {
    return {
      estado: 'coincide',
      referencia: mejor.referencia,
      detalle: mejor.descripcion,
      score: mejor.score,
    };
  }
  if (mejor.score >= 0.3) {
    return {
      estado: 'dudoso',
      referencia: mejor.referencia,
      detalle: mejor.descripcion,
      score: mejor.score,
    };
  }
  return { estado: 'sin_partida', referencia: '', detalle: 'Sin partida identificada en el presupuesto cargado.', score: mejor.score };
}

export const CONTRASTE_PRESUPUESTO_LABEL = {
  coincide: 'Coincide',
  dudoso: 'A confirmar',
  sin_partida: 'Sin partida',
  sin_presupuesto: 'Sin presupuesto',
  sin_datos: 'Sin datos',
};

export const CONTRASTE_PRESUPUESTO_STYLE = {
  coincide: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  dudoso: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  sin_partida: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
  sin_presupuesto: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400',
  sin_datos: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400',
};