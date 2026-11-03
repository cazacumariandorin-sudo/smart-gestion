/**
 * URLs de consulta y descarga de una nómina.
 *
 * Los PDF viven en Google Drive. La URL "uc?export=download" NO se puede
 * incrustar (Google manda X-Frame-Options: SAMEORIGIN y el visor queda en
 * blanco): para verla dentro de la app hay que usar /preview. Para descargar
 * se usa la URL de descarga directa, que es la que entrega el archivo.
 */

export function driveIdNomina(nom) {
  if (!nom) return null;
  if (nom.drive_file_id) return nom.drive_file_id;
  const url = nom.file_url || '';
  if (!url.includes('drive.google.com')) return null;
  const porRuta = url.match(/\/d\/([^/?#]+)/);
  if (porRuta) return porRuta[1];
  const porParametro = url.match(/[?&]id=([^&#]+)/);
  return porParametro ? porParametro[1] : null;
}

/** URL incrustable en el visor de la app. */
export function urlVisorNomina(nom) {
  const id = driveIdNomina(nom);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return nom?.file_url || '';
}

/** URL de descarga directa del PDF. */
export function urlDescargaNomina(nom) {
  const id = driveIdNomina(nom);
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  return nom?.file_url || '';
}