/**
 * presupuestoPdfDescarga — carga empresa, cliente y logo y genera/descarga el PDF de un presupuesto.
 * La construcción del PDF (presupuestoPdf.js) es pura y está probada aparte.
 * - Se sanea el presupuesto (lista blanca): el PDF nunca lleva datos internos.
 * - El logo es el elegido al guardar el presupuesto (`logo_id`).
 */
import { base44 } from '@/api/base44Client';
import { getEmpresaPrincipalPdf } from '@/lib/simantecEmpresaPdf';
import { construirPresupuestoPdf } from '@/lib/presupuestoPdf';
import { stripInternalBudgetFields } from '@/lib/presupuestoPublico';
import { logoParaPdf } from '@/lib/presupuestoLogos';

export async function generarPdfPresupuesto(presupuestoOriginal, { tipo = 'presupuesto', marcaAgua } = {}) {
  const presupuesto = stripInternalBudgetFields(presupuestoOriginal);
  const empresa = await getEmpresaPrincipalPdf();
  const [cliente, logo] = await Promise.all([
    presupuesto.cliente_id ? base44.entities.Client.get(presupuesto.cliente_id).catch(() => null) : null,
    logoParaPdf(presupuesto.logo_id, empresa),
  ]);
  return construirPresupuestoPdf({
    presupuesto,
    empresa,
    cliente: cliente || { name: presupuesto.cliente_name },
    logo,
    tipo,
    marcaAgua,
  });
}

export async function descargarPresupuestoPdf(presupuesto) {
  const doc = await generarPdfPresupuesto(presupuesto);
  doc.save(`Presupuesto_${presupuesto.codigo_registro || 'borrador'}.pdf`);
}