// Helpers compartidos para funciones backend que generan ZIPs/Excels
// y los suben a Google Drive (carpeta Contabilidad/...) con fallback a CDN público.
//
// Importar desde una función: import { subirArchivoDrive, ... } from "../../shared/zipDriveHelpers.ts";

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';

/**
 * Sube bytes a Google Drive (carpeta contabilidad) con permiso anyone/reader.
 * Fallback a UploadPublicFile (CDN público permanente) si Drive no está o falla.
 * Devuelve una URL pública de descarga.
 */
export async function subirArchivoDrive(base44, bytes, mime, fileName, folderPath = 'Contabilidad/Justificantes') {
  try {
    const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
    const accessToken = conn?.accessToken;
    if (!accessToken) throw new Error('Drive no conectado');
    const folderId = await getOrCreateFolder(accessToken, folderPath);
    const blob = new Blob([bytes], { type: mime });
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [folderId] })], { type: 'application/json' }));
    formData.append('file', blob, fileName);
    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    if (!uploadRes.ok) throw new Error('Upload Drive failed');
    const driveFile = await uploadRes.json();
    await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }).catch(() => {});
    return `https://drive.google.com/uc?id=${driveFile.id}&export=download`;
  } catch (e) {
    // Fallback CDN público
    const arr = new Uint8Array(bytes);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < arr.length; i += chunk) {
      binary += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file: dataUrl });
    return file_url;
  }
}

export async function getOrCreateFolder(accessToken, folderPath) {
  const folders = folderPath.split('/').filter(Boolean);
  let parentId = ROOT_FOLDER_ID;
  for (const name of folders) {
    const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.files?.length > 0) {
      parentId = data.files[0].id;
    } else {
      const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
      });
      parentId = (await cr.json()).id;
    }
  }
  return parentId;
}

export function guessExt(url, nombre) {
  const ref = (nombre || url || '').toLowerCase();
  const m = ref.match(/\.(pdf|jpg|jpeg|png|gif|webp|heic|tiff?|bmp)$/);
  if (m) return '.' + m[1];
  return '.bin';
}

export function sanitizeName(s) {
  if (!s) return '';
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_\-\. ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
}

export function dedupName(usados, nombre) {
  if (!usados.has(nombre)) { usados.add(nombre); return nombre; }
  const m = nombre.match(/^(.+?)(\.[a-z0-9]+)$/i);
  const base = m ? m[1] : nombre;
  const ext = m ? m[2] : '';
  let n = 1;
  let candidato = `${base}_${n}${ext}`;
  while (usados.has(candidato)) { n++; candidato = `${base}_${n}${ext}`; }
  usados.add(candidato);
  return candidato;
}