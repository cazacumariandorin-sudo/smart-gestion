import { SIMANTEC_ICON_PNG_BASE64 } from "@/lib/simantecLogoData";

/**
 * Dibuja el logotipo corporativo OFICIAL de SIMANTEC sobre un documento jsPDF.
 * El icono es una imagen PNG generada desde el mismo SVG que usa la app
 * (SimantecLogo.jsx), por lo que es idéntico al de pantalla.
 * Devuelve la altura ocupada (incluye margen inferior) para continuar debajo.
 *
 * Uso:
 *   const h = drawSimantecLogoPdf(doc, margin, 12, 14);   // (doc, x, y, size)
 */
export function drawSimantecLogoPdf(doc, x, y, sz = 14) {
  // Icono oficial (imagen)
  doc.addImage(SIMANTEC_ICON_PNG_BASE64, "PNG", x, y, sz, sz);

  // Wordmark + tagline a la derecha del icono
  const textX = x + sz + 3;
  doc.setTextColor(10, 31, 68);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sz * 0.62);
  doc.text("SIMANTEC", textX, y + sz * 0.5);

  // Tagline con los 3 colores oficiales: INTEGRACIÓN · MANTENIMIENTO · TECNOLOGÍA
  const tagSize = sz * 0.24;
  const ty = y + sz * 0.78;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tagSize);
  let cx = textX;
  const parts = [
    { t: "INTEGRACIÓN", c: [61, 134, 255] },
    { t: " · ", c: [120, 120, 130] },
    { t: "MANTENIMIENTO", c: [10, 31, 68] },
    { t: " · ", c: [120, 120, 130] },
    { t: "TECNOLOGÍA", c: [22, 163, 74] },
  ];
  parts.forEach(({ t, c }) => {
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(t, cx, ty);
    cx += doc.getTextWidth(t);
  });

  doc.setTextColor(0, 0, 0); // restaurar color de texto
  return sz + 4;
}
