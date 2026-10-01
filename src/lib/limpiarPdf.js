/**
 * limpiarPdfSiNecesario — algunos escáneres/apps generan PDFs con bytes
 * basura (saltos de línea, BOM) ANTES de la firma "%PDF-". El PDF sigue
 * siendo válido para visores normales, pero los motores de IA (InvokeLLM,
 * Anthropic Vision) no lo abren y devuelven "archivo no legible" sin lanzar
 * error. Esta función recorta cualquier byte previo a la firma real.
 */
export async function limpiarPdfSiNecesario(file) {
  if (!file || file.type !== 'application/pdf') return file;
  const buf = new Uint8Array(await file.arrayBuffer());
  const marker = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
  let idx = -1;
  const limite = Math.min(buf.length - marker.length, 1024); // la firma siempre está al inicio
  for (let i = 0; i <= limite; i++) {
    let match = true;
    for (let j = 0; j < marker.length; j++) {
      if (buf[i + j] !== marker[j]) { match = false; break; }
    }
    if (match) { idx = i; break; }
  }
  if (idx <= 0) return file; // ya está limpio o no se encontró la firma
  return new File([buf.slice(idx)], file.name, { type: 'application/pdf' });
}