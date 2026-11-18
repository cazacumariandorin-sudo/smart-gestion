// ═══════════════════════════════════════════════════════════
// COMPARACIÓN DE PARTIDAS
// Red de seguridad al completar un presupuesto desde su documento:
// evita añadir dos veces la misma partida aunque cambie la redacción.
// ═══════════════════════════════════════════════════════════

const normalizar = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const palabrasClave = (s) => normalizar(s).split(' ').filter(w => w.length > 3);

export function esMismaPartida(a, b) {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const pa = palabrasClave(a);
  const pb = palabrasClave(b);
  if (!pa.length || !pb.length) return false;
  const comunes = pa.filter(w => pb.includes(w)).length;
  return comunes / Math.min(pa.length, pb.length) >= 0.75;
}

/** Devuelve las propuestas que no están ya representadas en las líneas existentes. */
export function partidasNoIncluidas(propuestas = [], existentes = []) {
  const ya = existentes.map(c => `${c.descripcion || ''} ${c.detalle || ''}`);
  return propuestas.filter(p => !ya.some(d => esMismaPartida(p.descripcion, d)));
}