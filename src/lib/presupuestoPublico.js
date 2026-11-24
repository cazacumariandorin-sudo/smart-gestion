/**
 * presupuestoPublico — deja solo los campos que pueden salir al cliente (PDF, envío).
 * LISTA BLANCA: un campo interno nuevo (costes, márgenes, informes, horas…) no se cuela aunque se añada al presupuesto.
 * Si el PDF necesita un campo nuevo, hay que añadirlo aquí.
 */
const CAMPOS_PUBLICOS = ['id', 'codigo_registro', 'titulo', 'cliente_id', 'cliente_name', 'fecha', 'valido_hasta',
  'referencia_cliente', 'forma_pago', 'descripcion', 'notas', 'obra_name', 'logo_id', 'conceptos'];
const CAMPOS_LINEA_PUBLICOS = ['tipo', 'descripcion', 'detalle', 'cantidad', 'unidad', 'precio_unitario', 'iva_pct'];

export function stripInternalBudgetFields(presupuesto) {
  if (!presupuesto || typeof presupuesto !== 'object') return presupuesto;
  const out = {};
  for (const k of CAMPOS_PUBLICOS) if (presupuesto[k] !== undefined) out[k] = presupuesto[k];
  out.conceptos = (presupuesto.conceptos || []).map((l) =>
    Object.fromEntries(CAMPOS_LINEA_PUBLICOS.filter((k) => l && l[k] !== undefined).map((k) => [k, l[k]])));
  return out;
}