// Detección automática de metadatos desde el nombre de archivo para el módulo Ingeniería.
// Evita errores de archivos mal nombrados sugiriendo tipo, revisión y proyecto.

// Revisiones tipo: R0, R3B, R2.0, R717, P-2026-0034, PR10978-25, PE176J-26
const REV_RE = /\b(R\d+[A-Za-z]?|R\d+\.\d+|P-?\d{4}-?\d+|PR\d{4,}-\d+|PE\d+[A-Z]?-?\d+)\b/i;

export function detectRevision(name = '') {
  if (!name) return '';
  const base = name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ');
  const m = base.match(REV_RE);
  return m ? m[1].toUpperCase() : '';
}

export function matchObra(name = '', obras = []) {
  if (!name || !obras.length) return null;
  const base = name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').toLowerCase();
  let best = null, bestScore = 0;
  for (const o of obras) {
    let score = 0;
    const tokens = [o.name, o.numero_proyecto, o.code].filter(Boolean).map(t => t.toLowerCase());
    for (const t of tokens) {
      if (!t || t.length < 3) continue;
      if (base.includes(t)) score += t.length > 6 ? 3 : 2;
    }
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return bestScore >= 2 ? best : null;
}

const TIPO_KEYS = [
  ['listado_puntos', /listado\s*puntos|listado\s*de\s*puntos|puntos\s*bms/i],
  ['lista_material', /lista\s*material|material\s*r717|lista\s*de\s*material/i],
  ['esquema_conexion', /esquema\s*conexion|unifilar|conexion\s*elect/i],
  ['pid_proceso', /p&?id|pid\s*proceso/i],
  ['ficha_tecnica_equipo', /ficha\s*tecnica|datasheet|data\s*sheet/i],
  ['plano_planta', /plano\s*planta|\bplanta\b/i],
  ['presupuesto', /presupuesto|pre-?\d/i],
  ['pedido', /pedido|orden\s*compra|\boc\s*\d/i],
  ['factura', /factura|fac-?\d/i],
  ['albaran', /albaran|alb-?\d/i],
  ['proforma', /proforma/i],
];

export function detectTipo(name = '') {
  if (!name) return null;
  const base = name.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').toLowerCase();
  for (const [k, re] of TIPO_KEYS) if (re.test(base)) return k;
  return null;
}