/**
 * Helpers de validación de imágenes capturadas desde dispositivo.
 *
 * Resuelve el bug "foto en blanco": el capture=environment del SO puede entregar
 * un File vacío (0 bytes) o con un frame uniforme si la cámara no terminó de
 * capturar. imagenNoVacia() valida tamaño mínimo + dimensiones + varianza de
 * píxeles, de modo que cualquier path de captura pueda rechazar la foto antes
 * de subirla al CDN y mostrar un aviso claro.
 */

/**
 * Devuelve true si la imagen tiene contenido real (no blanco/uniforme).
 * Comprueba: tamaño >= 2KB, naturalWidth/Height > 0, y varianza ≥ 8 en una
 * miniatura de 32x32 (una foto real tiene contraste).
 */
export async function imagenNoVacia(file) {
  if (!(file instanceof Blob)) return false;
  if (file.size < 2000) return false; // archivo vacío o dañado

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('no-decode'));
      i.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) return false;

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 32, 32);

    let data;
    try {
      // object URLs son same-origin → no taint
      data = ctx.getImageData(0, 0, 32, 32).data;
    } catch {
      // Si la lectura taint falla, asumimos válida y dejamos que el upload continúe
      return true;
    }

    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    return (max - min) >= 8;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}