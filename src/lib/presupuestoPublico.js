export function stripInternalBudgetFields(presupuesto) {
  if (!presupuesto || typeof presupuesto !== 'object') return presupuesto;
  const {
    informe_tecnico,
    informe_tecnico_id,
    informe_tecnico_presupuesto,
    costes_internos,
    coste_interno,
    margen_interno,
    analisis_interno,
    ...publicData
  } = presupuesto;
  return {
    ...publicData,
    conceptos: (publicData.conceptos || []).map(({ coste_interno, coste_total_interno, margen_interno, ...linea }) => linea),
  };
}
