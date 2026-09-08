import { base44 } from '@/api/base44Client';

/**
 * subirArchivo — wrapper cliente de `subirArchivoConFallback`.
 *
 * La función backend espera `file_base64` como un string (data URL base64),
 * NO un objeto File crudo (al serializar a JSON un File se convierte en {} y
 * provoca un 500 "startsWith is not a function"). Este helper normaliza la
 * conversión para que todos los módulos suban igual.
 *
 * Devuelve { file_url, cdn_url_para_llm, storage, ... }.
 */
export function fileABase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(file);
  });
}

export async function subirArchivo(file, { ruta_drive, nombre, entidad_tipo, entidad_id } = {}) {
  const file_base64 = await fileABase64(file);
  const res = await base44.functions.invoke('subirArchivoConFallback', {
    file_base64,
    nombre: nombre || file.name,
    ruta_drive,
    entidad_tipo,
    entidad_id,
  });
  return res?.data ?? res;
}