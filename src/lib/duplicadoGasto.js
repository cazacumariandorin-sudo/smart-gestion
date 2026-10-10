import { base44 } from '@/api/base44Client';

/**
 * Huella visual de la imagen (dHash de 64 bits, 16 caracteres hex).
 * Dos fotos del MISMO ticket (aunque estén recomprimidas o recortadas un poco distinto)
 * dan huellas casi idénticas; el servidor las compara para detectar duplicados.
 */
export async function calcularDHash(file) {
  try {
    if (!file?.type?.startsWith('image/')) return '';
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = 9; canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, 9, 8);
    const d = ctx.getImageData(0, 0, 9, 8).data;
    const gris = (x, y) => { const i = (y * 9 + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gris(x, y) > gris(x + 1, y) ? '1' : '0';
    let hex = '';
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return '';
  }
}

/**
 * Cruza un gasto candidato con TODOS los registros existentes (de cualquier usuario).
 * Nunca lanza error: si el servidor falla o tarda, devuelve [] y el guardado continúa.
 */
export async function verificarDuplicado(candidato, { timeoutMs = 9000 } = {}) {
  try {
    const res = await Promise.race([
      base44.functions.invoke('verificarDuplicadoGasto', { candidato }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
    ]);
    return Array.isArray(res?.data?.coincidencias) ? res.data.coincidencias : [];
  } catch (e) {
    console.error('[Duplicado] No se pudo verificar en el servidor', e);
    return [];
  }
}
