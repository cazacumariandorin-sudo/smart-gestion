/**
 * presupuestoReglas — reglas de negocio de presupuestos (puras, probadas aparte).
 *  - DOC-08: roles con acceso a importes.
 *  - DOC-04: un parte de trabajo solo puede estar en un presupuesto activo a la vez.
 *  - Estados y transiciones permitidas.
 */
export const ROLES_PRESUPUESTO = ['admin', 'propietario', 'gerencia', 'administracion', 'director_comercial', 'ingeniero'];
export const IVA_PERMITIDOS = [0, 4, 10, 21];
export const ESTADOS = ['borrador', 'enviado', 'aceptado', 'rechazado', 'facturado'] as const;
export type Estado = typeof ESTADOS[number];

// aceptado → facturado se habilitará al vincular la factura oficial (fase posterior)
export const TRANSICIONES: Record<string, string[]> = {
  borrador: ['enviado'],
  enviado: ['aceptado', 'rechazado', 'borrador'],
  aceptado: [],
  rechazado: ['borrador'],
  facturado: [],
};
export const transicionPermitida = (de: string, a: string): boolean => (TRANSICIONES[de] || []).includes(a);

/** Estados en los que un presupuesto "ocupa" sus partes (DOC-04). Rechazado los libera. */
export const ESTADOS_ACTIVOS = ['borrador', 'enviado', 'aceptado', 'facturado'];

export function validarConceptos(conceptos: any): string[] {
  const errores: string[] = [];
  if (!Array.isArray(conceptos)) return ['Las líneas deben ser una lista.'];
  if (conceptos.length > 200) errores.push('Demasiadas líneas (máximo 200).');
  conceptos.forEach((c, i) => {
    const n = i + 1;
    if (!c || typeof c !== 'object') { errores.push(`Línea ${n}: formato no válido.`); return; }
    const tipo = c.tipo === 'texto' ? 'texto' : 'linea';
    const desc = String(c.descripcion ?? '').trim();
    if (!desc) errores.push(`Línea ${n}: falta la descripción.`);
    if (desc.length > 4000 || String(c.detalle ?? '').length > 4000) errores.push(`Línea ${n}: texto demasiado largo.`);
    if (tipo === 'linea') {
      const cant = Number(c.cantidad), prec = Number(c.precio_unitario);
      if (!Number.isFinite(cant)) errores.push(`Línea ${n}: cantidad no válida.`);
      else if (Math.abs(cant) > 1e7) errores.push(`Línea ${n}: cantidad fuera de rango.`);
      if (!Number.isFinite(prec)) errores.push(`Línea ${n}: precio no válido.`);
      else if (Math.abs(prec) > 1e8) errores.push(`Línea ${n}: importe fuera de rango.`);
      if (c.iva_pct !== undefined && c.iva_pct !== null && !IVA_PERMITIDOS.includes(Number(c.iva_pct))) errores.push(`Línea ${n}: IVA ${c.iva_pct}% no permitido (usa 0, 4, 10 o 21).`);
    }
  });
  return errores;
}

/** fecha 'AAAA-MM-DD' + días, sin depender de la zona horaria. */
export function sumarDias(fecha: string, dias: number): string {
  const m = String(fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Si un presupuesto ya contiene alguno de los partes pedidos, devuelve el presupuesto en conflicto (DOC-04). */
export function conflictoPartes(partesNuevos: string[], existentes: any[], excluirId?: string): { id: string; codigo_registro?: string; estado: string; parte_id: string } | null {
  const pedidos = new Set((partesNuevos || []).filter(Boolean));
  if (pedidos.size === 0) return null;
  for (const p of existentes || []) {
    if (!p || p.id === excluirId || !ESTADOS_ACTIVOS.includes(p.estado)) continue;
    for (const id of p.partes_trabajo_ids || []) {
      if (pedidos.has(id)) return { id: p.id, codigo_registro: p.codigo_registro, estado: p.estado, parte_id: id };
    }
  }
  return null;
}

/** Trabajo extra que ya está en otro presupuesto activo (DOC-04). `conceptos` son las líneas del presupuesto que se guarda. */
export function conflictoExtras(conceptos: any[], existentes: any[], excluirId?: string): { id: string; codigo_registro?: string; estado: string; extra_id: string } | null {
  const pedidos = new Set((conceptos || []).map((c: any) => c && c.extra_id).filter(Boolean));
  if (pedidos.size === 0) return null;
  for (const p of existentes || []) {
    if (!p || p.id === excluirId || !ESTADOS_ACTIVOS.includes(p.estado || 'borrador')) continue;
    for (const c of p.conceptos || []) {
      if (c && c.extra_id && pedidos.has(c.extra_id)) return { id: p.id, codigo_registro: p.codigo_registro, estado: p.estado, extra_id: c.extra_id };
    }
  }
  return null;
}

/** Solo estos campos pueden venir del cliente (nunca estado, código, historial ni importes calculados). */
export const CAMPOS_EDITABLES = ['titulo', 'cliente_id', 'cliente_name', 'fecha', 'descripcion', 'notas', 'forma_pago', 'referencia_cliente',
  'valido_hasta', 'obra_id', 'obra_name', 'conceptos', 'partes_trabajo_ids', 'file_url', 'documentos_origen'];
export function soloCamposEditables(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of CAMPOS_EDITABLES) if (body && body[k] !== undefined) out[k] = body[k];
  return out;
}