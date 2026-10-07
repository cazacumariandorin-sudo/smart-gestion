// ═══════════════════════════════════════════════════════════
// MEJORA DE IMAGEN PARA OCR — Nitidez (unsharp mask) + auto-contraste
// ═══════════════════════════════════════════════════════════
// Sin dependencias externas: canvas + convolución 3x3.
// Aplica un filtro de nitidez y estiramiento de histograma para
// mejorar la legibilidad del texto antes del OCR.
// ═══════════════════════════════════════════════════════════

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(img.src); reject(e); };
    img.src = URL.createObjectURL(file);
  });
}

// Kernel de nitidez 3x3 (unsharp mask estándar)
const SHARPEN_KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0];

function sharpenConvolution(srcData, w, h) {
  const src = srcData;
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const oi = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0, ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.min(w - 1, Math.max(0, x + kx));
            const sy = Math.min(h - 1, Math.max(0, y + ky));
            sum += src[(sy * w + sx) * 4 + ch] * SHARPEN_KERNEL[ki++];
          }
        }
        out[oi + ch] = Math.max(0, Math.min(255, sum));
      }
      out[oi + 3] = src[oi + 3];
    }
  }
  return out;
}

function autoContrast(data) {
  let min = 255, max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const range = max - min;
  // Si ya tiene buen contraste, no alterar
  if (range < 10 || range > 240) return data;
  const scale = 255 / range;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, (data[i] - min) * scale));
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - min) * scale));
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - min) * scale));
  }
  return data;
}

/**
 * Aplica nitidez + auto-contraste a un archivo de imagen.
 * Devuelve un nuevo File (JPEG). Si no es imagen o falla, devuelve el original.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function sharpenAndEnhance(file, { upscaleMax = 0 } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  try {
    const img = await loadImage(file);
    // Limitar tamaño para que la convolución sea rápida en móvil
    const MAX = 1400;
    const lado = Math.max(img.width, img.height);
    // upscaleMax > 0: amplía (máx. x2) las imágenes pequeñas hasta ese lado antes de afinar
    const scale = upscaleMax > 0 && lado < upscaleMax
      ? Math.min(2, upscaleMax / lado)
      : Math.min(1, MAX / lado);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    // 1. Auto-contraste (estira el histograma de luminancia)
    autoContrast(imageData.data);
    // 2. Nitidez (convolución 3x3)
    const sharpened = sharpenConvolution(imageData.data, w, h);
    ctx.putImageData(new ImageData(sharpened, w, h), 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    const name = file.name.replace(/\.(jpe?g|png|gif|webp)$/i, '') + '_nitido.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch (e) {
    console.warn('Mejora de imagen falló, usando original', e);
    return file;
  }
}
