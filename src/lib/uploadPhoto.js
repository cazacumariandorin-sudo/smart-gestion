import { base44 } from '@/api/base44Client';

/**
 * Sube una imagen (File/Blob) al CDN de Base44 usando la integración Core
 * UploadFile, que siempre está disponible y NO depende de funciones backend
 * (que pueden estar bloqueadas por el plan actual).
 * Devuelve { file_url, storage, drive_file_id } compatible con los esquemas
 * usados por WorkPhoto / FotoProyecto / ParteDiarioObra.fotos.
 *
 * Si en el futuro se reactiva subirArchivoConFallback (con respaldo en Drive),
 * se puede volver aInvocar aquí sin tocar los componentes.
 */
export async function subirImagen(file) {
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  return { file_url, storage: 'cdn', drive_file_id: null };
}