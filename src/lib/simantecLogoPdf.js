/**
 * Dibuja el logotipo corporativo de SIMANTEC directamente sobre un documento jsPDF.
 * Devuelve la altura ocupada (incluyendo un pequeño margen inferior) para que el
 * llamador pueda continuar el contenido debajo.
 *
 * Estilo: cuadrado redondeado azul oscuro con 4 cuadros verdes en 2x2 + wordmark
 * SIMANTEC y tagline a la derecha.
 *
 * Uso:
 *   const h = drawSimantecLogoPdf(doc, margin, 12, 14);   // (doc, x, y, size)
 */
export function drawSimantecLogoPdf(doc, x, y, sz = 14) {
  // Fondo redondeado azul oscuro
  doc.setFillColor(10, 31, 68);
  doc.roundedRect(x, y, sz, sz, 2.5, 2.5, "F");

  // 4 cuadros verdes 2x2
  doc.setFillColor(34, 197, 94);
  const g = sz * 0.16;
  const sq = (sz - g * 3) / 2;
  const px2 = x + g * 2 + sq;
  const py2 = y + g * 2 + sq;
  doc.roundedRect(x + g, y + g, sq, sq, 0.6, 0.6, "F");
  doc.roundedRect(px2, y + g, sq, sq, 0.6, 0.6, "F");
  doc.roundedRect(x + g, py2, sq, sq, 0.6, 0.6, "F");
  doc.roundedRect(px2, py2, sq, sq, 0.6, 0.6, "F");

  // S cianúrea (aproximación con bezier) sobre el fondo
  doc.setDrawColor(61, 134, 255);
  doc.setLineWidth(sz * 0.13);
  try { doc.setLineCapStyle && doc.setLineCapStyle("round"); doc.setLineJoinStyle && doc.setLineJoinStyle("round"); } catch (_) {}
  const s = sz;
  // Punto de inicio absoluto
  const sx = x + s * 0.70;
  const sy = y + s * 0.20;
  // Dos curvas bezier (relativas a los puntos de control) usando doc.lines
  // Segmentos bezier: [c1x, c1y, c2x, c2y, ex, ey]
  const segs = [
    [s * 0.00, -s * 0.13, -s * 0.50, -s * 0.13, -s * 0.50, s * 0.15],
    [-s * 0.50, s * 0.18, s * 0.50, s * 0.18, s * 0.50, s * 0.18],
  ];
  try {
    doc.lines(segs, sx, sy, [1, 1], "S", false);
  } catch (_) {}

  // Wordmark + tagline a la derecha del icono
  const textX = x + sz + 3;
  doc.setTextColor(10, 31, 68);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sz * 0.62);
  doc.text("SIMANTEC", textX, y + sz * 0.5);

  doc.setTextColor(120, 120, 130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(sz * 0.24);
  doc.text("INTEGRACION · MANTENIMIENTO · TECNOLOGIA", textX, y + sz * 0.78);

  return sz + 4; // alto útil (icono + margen inferior)
}