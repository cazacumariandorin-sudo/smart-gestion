// Decide si el recorte automático de bordes es lo bastante fiable para aplicarse
// solo, o si hace falta pedir al técnico que ajuste las esquinas a mano.
//
// Antes, la pantalla de "ajustar bordes" aparecía SIEMPRE, incluso cuando la
// detección automática acertaba. Ahora solo se muestra cuando hace falta.

/**
 * corners: 4 puntos {x,y} en píxeles de la imagen original (orden: sup-izq, sup-der,
 *          inf-der, inf-izq), tal como los da la detección automática.
 * natural: { w, h } tamaño de la imagen.
 * autoOk: si la detección automática encontró un contenido claro (ver DocumentEdgeCrop).
 */
export function debeAjustarManualmente(corners, natural, autoOk) {
  if (!autoOk || !corners || corners.length !== 4 || !natural?.w || !natural?.h) return true;

  const anchoSup = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const anchoInf = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
  const altoIzq = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
  const altoDer = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

  // 1) El recorte debe cubrir una parte sustancial de la foto (si es minúsculo, la
  //    detección probablemente se ha equivocado).
  const areaAprox = ((anchoSup + anchoInf) / 2) * ((altoIzq + altoDer) / 2);
  const areaImagen = natural.w * natural.h;
  if (areaAprox < areaImagen * 0.15) return true;

  // 2) Los lados opuestos deben medir casi lo mismo (un trapecio muy torcido
  //    sugiere que no se ha encontrado el papel real, sino un recorte al azar).
  const simetriaAncho = Math.min(anchoSup, anchoInf) / Math.max(anchoSup, anchoInf, 1);
  const simetriaAlto = Math.min(altoIzq, altoDer) / Math.max(altoIzq, altoDer, 1);
  if (simetriaAncho < 0.75 || simetriaAlto < 0.75) return true;

  return false;
}
