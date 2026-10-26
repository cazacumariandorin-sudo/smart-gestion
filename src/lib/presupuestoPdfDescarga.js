/**
 * presupuestoPdfDescarga — carga empresa, cliente y logo y genera/descarga el PDF de un presupuesto.
 * La construcción del PDF (presupuestoPdf.js) es pura y está probada aparte.
 */
import { base44 } from '@/api/base44Client';
import { getEmpresaPrincipalPdf } from '@/lib/simantecEmpresaPdf';
import { SIMANTEC_LOGO_PNG_BASE64 } from '@/lib/simantecLogoData';
import { construirPresupuestoPdf } from '@/lib/presupuestoPdf';

export async function generarPdfPresupuesto(presupuesto, { tipo = 'presupuesto', marcaAgua } = {}) {
  const [empresa, cliente] = await Promise.all([
    getEmpresaPrincipalPdf(),
    presupuesto.cliente_id ? base44.entities.Client.get(presupuesto.cliente_id).catch(() => null) : null,
  ]);
  return construirPresupuestoPdf({
    presupuesto,
    empresa,
    cliente: cliente || { name: presupuesto.cliente_name },
    logo: SIMANTEC_LOGO_PNG_BASE64,
    tipo,
    marcaAgua,
  });
}

export async function descargarPresupuestoPdf(presupuesto) {
  const doc = await generarPdfPresupuesto(presupuesto);
  doc.save(`Presupuesto_${presupuesto.codigo_registro || 'borrador'}.pdf`);
}
