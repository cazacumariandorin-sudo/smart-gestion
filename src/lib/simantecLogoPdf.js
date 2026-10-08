import { SIMANTEC_LOGO_PNG_BASE64 } from "@/lib/simantecLogoData";

/**
 * Dibuja el logotipo OFICIAL de SIMANTEC (imagen corporativa) en un PDF jsPDF.
 * La imagen ya incluye el nombre, por eso no se añade texto aparte.
 * Devuelve la altura ocupada (con margen inferior) para continuar debajo.
 *
 * Uso:
 *   const h = drawSimantecLogoPdf(doc, margin, 12, 16);   // (doc, x, y, size)
 */
export function drawSimantecLogoPdf(doc, x, y, sz = 14) {
  const lado = sz * 1.6; // el logo lleva texto dentro: se dibuja algo mayor para que se lea
  doc.addImage(SIMANTEC_LOGO_PNG_BASE64, "PNG", x, y, lado, lado);
  return lado + 4;
}
