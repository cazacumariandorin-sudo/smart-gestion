import { base44 } from "@/api/base44Client";

// Datos de respaldo: se usan si no se pueden leer de Sistema > Empresas.
const EMPRESA_POR_DEFECTO = {
  nombre: "SIMANTEC S.L.",
  cif: "B02662823",
  domicilio: "C/ Comunidad de Madrid 41, Local 102",
  codigo_postal: "28231",
  localidad: "Las Rozas de Madrid",
  provincia: "Madrid",
  telefono: "658588740",
  email: "comercial.simantec@gmail.com",
  web: "www.simantec.es",
};

/**
 * Lee la empresa principal (la marcada como principal en Sistema > Empresas).
 * Si falla o faltan campos, completa con los datos de respaldo.
 */
export async function getEmpresaPrincipalPdf() {
  try {
    const lista = await base44.entities.Empresa.filter({ es_principal: true });
    const e = lista && lista[0];
    if (e) {
      const conValor = Object.fromEntries(Object.entries(e).filter(([, v]) => v));
      return { ...EMPRESA_POR_DEFECTO, ...conValor };
    }
  } catch (_) {
    // sin permisos o sin conexión: se usan los datos de respaldo
  }
  return EMPRESA_POR_DEFECTO;
}

/**
 * Dibuja los datos de la empresa arriba a la derecha del PDF (texto alineado a la derecha).
 * Uso: drawEmpresaDatosPdf(doc, empresa, 196, 16);
 */
export function drawEmpresaDatosPdf(doc, empresa, xRight = 196, y = 16) {
  const cp = [empresa.codigo_postal, empresa.localidad].filter(Boolean).join(" ");
  const poblacion = empresa.provincia && empresa.provincia !== empresa.localidad
    ? `${cp} (${empresa.provincia})`
    : cp;
  const contacto = [empresa.telefono && `Tel. ${empresa.telefono}`, empresa.email]
    .filter(Boolean)
    .join("  ·  ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(10, 31, 68);
  doc.text(empresa.nombre, xRight, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 100);
  const lineas = [
    empresa.cif && `CIF ${empresa.cif}`,
    empresa.domicilio,
    poblacion,
    contacto,
    empresa.web,
  ].filter(Boolean);
  lineas.forEach((t, i) => doc.text(t, xRight, y + 4.5 * (i + 1), { align: "right" }));

  doc.setTextColor(0, 0, 0);
  return y + 4.5 * (lineas.length + 1);
}
