/**
 * lineasDesdeObra — Fase 2A: líneas ASISTIDAS para presupuestos y facturas borrador a partir de los datos de la obra
 * (partes de trabajo, desplazamientos, trabajos extra) y de las condiciones económicas del cliente.
 * Funciones puras. Las líneas se devuelven SIN precio salvo que el dato exista (desplazamiento, importe de un extra):
 * una persona las valora antes de guardar. Los importes y el IVA los calcula siempre el servidor (DOC-07).
 */
export const TARIFA_POR_DEFECTO = { precio_hora: 40, alojamiento_dia_trabajador: 100, iva_pct: 21 };

/** Condición de la obra > condición del cliente > valores por defecto. Las condiciones inactivas se ignoran. */
export function resolverTarifa(condiciones = [], clienteId, obraId) {
  const activas = (condiciones || []).filter((c) => c && c.activa !== false);
  const deObra = obraId ? activas.find((c) => c.client_id === clienteId && c.obra_id === obraId) : null;
  const deCliente = activas.find((c) => c.client_id === clienteId && !c.obra_id);
  const elegir = (campo) => {
    for (const c of [deObra, deCliente]) if (c && c[campo] !== undefined && c[campo] !== null && c[campo] !== '') return Number(c[campo]);
    return TARIFA_POR_DEFECTO[campo];
  };
  return {
    precio_hora: elegir('precio_hora'),
    alojamiento_dia_trabajador: elegir('alojamiento_dia_trabajador'),
    iva_pct: elegir('iva_pct'),
    desplazamiento_importe: deObra?.desplazamiento_importe ?? deCliente?.desplazamiento_importe,
    origen: deObra ? 'obra' : deCliente ? 'cliente' : 'por_defecto',
  };
}

/** Un párrafo por línea de texto; sin vacíos ni espacios sobrantes. */
export function partirPorParrafos(texto) {
  return String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

const base = (extra) => ({ tipo: 'linea', cantidad: 1, unidad: 'ud', precio_unitario: 0, iva_pct: 21, ...extra });

/**
 * Líneas de un parte de trabajo.
 *  modo 'una_linea'  → una sola línea "Según Parte SIMANTEC <nº>" + descripción (estilo BOR-2026-0003).
 *  modo 'por_parrafo' → una línea de texto con el parte + una posición "Pos NN.-" por párrafo (estilo BOR-2026-0002).
 * Si el parte trae importe de desplazamiento, se añade su línea con ese precio.
 */
export function lineasDeParte(parte, { modo = 'una_linea', iva_pct = 21 } = {}) {
  const numero = parte.numero_parte || parte.titulo || '';
  const descripcion = parte.descripcion_auto ?? parte.description ?? '';
  const parte_id = parte.id;
  const lineas = [];
  if (modo === 'por_parrafo') {
    lineas.push({ tipo: 'texto', descripcion: `(SEGÚN PARTE SIMANTEC ${numero})`, parte_id });
    partirPorParrafos(descripcion).forEach((p, i) => {
      lineas.push(base({ descripcion: `Pos ${String(i + 1).padStart(2, '0')}.-\n${p}`, parte_id, iva_pct }));
    });
  } else {
    const texto = partirPorParrafos(descripcion).join('\n');
    lineas.push(base({ descripcion: `Según Parte SIMANTEC ${numero}${texto ? `\n\n${texto}` : ''}`, parte_id, iva_pct }));
  }
  const importe = Number(parte.desplazamiento_importe_eur);
  if (importe > 0) {
    lineas.push(base({ descripcion: parte.desplazamiento_concepto || 'Desplazamiento', precio_unitario: importe, parte_id, iva_pct }));
  }
  return lineas;
}

/** Mano de obra: horas × precio/hora (el precio sale de la condición del cliente). */
export function lineaManoDeObra({ horas, precio_hora = TARIFA_POR_DEFECTO.precio_hora, iva_pct = 21, descripcion = 'Mano de obra', detalle }) {
  return base({ descripcion, cantidad: Number(horas) || 0, unidad: 'h', precio_unitario: Number(precio_hora) || 0, iva_pct, ...(detalle ? { detalle } : {}) });
}

/** Alojamiento y manutención por trabajador y día. Admite el total de unidades o trabajadores × días. */
export function lineaAlojamiento({ unidades, trabajadores, dias, precio = TARIFA_POR_DEFTO_PLACEHOLDER, iva_pct = 21, detalle }) {
  const uds = unidades !== undefined ? Number(unidades) : (Number(trabajadores) || 0) * (Number(dias) || 0);
  return base({ descripcion: 'Alojamiento y manutención por trabajador y día', cantidad: uds, unidad: 'ud', precio_unitario: Number(precio) || 0, iva_pct, ...(detalle ? { detalle } : {}) });
}

/** Trabajos extra: una línea por extra, con su importe estimado si lo tiene. */
export function lineasDeExtras(extras = [], { iva_pct = 21 } = {}) {
  return extras.map((e) => base({
    descripcion: [e.descripcion, e.obra_name && `(${e.obra_name})`].filter(Boolean).join(' '),
    precio_unitario: Number(e.importe_estimado) > 0 ? Number(e.importe_estimado) : 0,
    extra_id: e.id, iva_pct,
  }));
}

/** Al desmarcar un parte o un extra se retiran sus líneas (y solo las suyas). */
export function quitarLineasDeOrigen(conceptos = [], { parte_id, extra_id } = {}) {
  return conceptos.filter((c) => !((parte_id && c.parte_id === parte_id) || (extra_id && c.extra_id === extra_id)));
}

const ESTADOS_ACTIVOS = ['borrador', 'enviado', 'aceptado', 'facturado'];
/** Trabajo extra que ya está en otro presupuesto activo (DOC-04). Un rechazado libera sus extras. */
export function conflictoExtras(extraIds = [], presupuestos = [], excluirId) {
  const pedidos = new Set((extraIds || []).filter(Boolean));
  if (!pedidos.size) return null;
  for (const p of presupuestos || []) {
    if (!p || p.id === excluirId || !ESTADOS_ACTIVOS.includes(p.estado || 'borrador')) continue;
    for (const c of p.conceptos || []) if (c.extra_id && pedidos.has(c.extra_id)) return { id: p.id, codigo_registro: p.codigo_registro, estado: p.estado, extra_id: c.extra_id };
  }
  return null;
}
