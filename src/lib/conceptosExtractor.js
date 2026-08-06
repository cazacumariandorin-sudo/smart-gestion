/**
 * Extrae líneas de concepto (conceptos + unidades, sin precio) a partir de un
 * texto descriptivo de materiales (ej: materiales_necesarios de un parte diario).
 *
 * Formatos soportados por ítem:
 *  - "2 Ud de Diferencial 2X40A/30mA"  → cantidad 2, "Diferencial 2X40A/30mA"
 *  - "5 ud de Automatico 2x16 A"       → cantidad 5, "Automatico 2x16 A"
 *  - "4x Diferencial 2X25A/30mA"        → cantidad 4, "Diferencial 2X25A/30mA"
 *  - "Diferencial 2X25A/30mA"           → cantidad 1, "Diferencial 2X25A/30mA"
 *
 * El precio siempre queda en 0 — la valoración económica la puede hacer otro usuario.
 */

const PREFIJOS_DESCARTABLES = /^(materiales|pendientes?|trabajos|prevision trabajos y material)\s*[:.]?\s*$/i;

function parseItem(itemRaw) {
  const s = String(itemRaw || "").trim();
  if (!s || PREFIJOS_DESCARTABLES.test(s)) return null;

  let cantidad = 1;
  let descripcion = s;

  // Patrón A: "N Ud [de] DESCRIPCION"  (uds, unidad, unidades, u.)
  let m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:uds?|unidades?|unidad|u\.)\b\.?\s*(?:de\s+)?/i);
  if (m) {
    cantidad = parseFloat(m[1].replace(",", "."));
    descripcion = s.slice(m[0].length).trim();
  } else {
    // Patrón B: "Nx DESCRIPCION" con un espacio tras la x (no "4x63A" que es modelo)
    m = s.match(/^(\d+(?:[.,]\d+)?)\s*[xX]\s+(?![\d])/);
    if (m) {
      cantidad = parseFloat(m[1].replace(",", "."));
      descripcion = s.slice(m[0].length).trim();
    } else {
      // Patrón C: "N DESCRIPCION" con número seguido de palabra
      m = s.match(/^(\d+)\s+(?=[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ])/);
      if (m) {
        cantidad = parseFloat(m[1].replace(",", "."));
        descripcion = s.slice(m[0].length).trim();
      }
    }
  }

  // Limpieza final de la descripción
  descripcion = descripcion
    .replace(/^[-•*·]\s*/, "")
    .replace(/^(de\s+)+/i, "")
    .replace(/\s*\.?\s*$/, "")
    .trim();

  if (!descripcion || PREFIJOS_DESCARTABLES.test(descripcion)) return null;

  return {
    descripcion,
    cantidad,
    unidad: "ud",
    precio_unitario: 0,
    total: 0,
  };
}

export function extraerConceptosDesdeTexto(texto) {
  if (!texto || typeof texto !== "string") return [];

  // Separar por líneas primero; cada línea puede contener 1 o varios ítems
  const lineas = texto
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];
  for (const linea of lineas) {
    // Quitar prefijo "Materiales:" si la línea lo tiene
    const limpia = linea.replace(/^\s*materiales\s*:\s*/i, "").trim();
    if (!limpia) continue;

    // Si la línea contiene comas separadoras, dividir; pero respetar que cada
    // ítem potencialmente inicia con cantidad o letra capital.
    if (/\s*,\s*/.test(limpia)) {
      limpia
        .split(/\s*,\s*/)
        .forEach((p) => {
          if (p.trim()) items.push(p.trim());
        });
    } else {
      items.push(limpia);
    }
  }

  const conceptos = [];
  const vistos = new Set();
  for (const item of items) {
    const c = parseItem(item);
    if (!c) continue;
    const clave = `${c.cantidad}|${c.descripcion.toLowerCase()}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    conceptos.push(c);
  }
  return conceptos;
}