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
  try {
    const file_base64 = await fileABase64(file);
    const res = await base44.functions.invoke('subirArchivoConFallback', {
      file_base64,
      nombre: nombre || file.name,
      ruta_drive,
      entidad_tipo,
      entidad_id,
    });
    const data = res?.data ?? res;
    if (!data?.file_url && !data?.cdn_url_para_llm) throw new Error('La función de subida no devolvió ninguna URL');
    return data;
  } catch (err) {
    // Si la función del servidor falla (despliegue, plan, servicio caído...) no se bloquea al usuario:
    // se sube directamente al almacenamiento de Base44, que es lo que usaba la app antes de la función.
    // Aquí no hay copia inmediata en Drive; la sincronización nocturna la recoge después.
    console.warn('[subirArchivo] falló la función de subida, subo directo al almacenamiento de Base44:', err?.message || err);
    const archivo = file instanceof File ? file : new File([file], nombre || file?.name || 'archivo', { type: file?.type || '' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file: archivo });
    if (!file_url) throw err;
    return { file_url, cdn_url_para_llm: file_url, storage: 'cdn_directo', drive_file_id: null };
  }
}