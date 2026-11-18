import { stripInternalBudgetFields } from '@/lib/presupuestoPublico';

/**
 * Exportación PDF pública: elimina expresamente cualquier dato interno.
 * No debe contener costes, márgenes, análisis ni información técnica interna.
 */
export async function generarPresupuestoPublicoPreservandoPrivacidad(presupuesto) {
  const presupuestoPublico = stripInternalBudgetFields(presupuesto);
  const mod = await import('@/lib/presupuestoPdf');
  return mod.construirPresupuestoPdf({ presupuesto: presupuestoPublico });
}
