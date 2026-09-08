import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';

/**
 * subirArchivoConFallback — función unificada de subida de archivos.
 * 1. Sube a Base44 CDN (siempre, para OCR/IA inmediato)
 * 2. Intenta subir a Google Drive (primario)
 * 3. Si Drive falla → crea ArchivoSyncPendiente para cron 06:00
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_base64, ruta_drive, nombre, entidad_tipo, entidad_id } = await req.json();
    if (!file_base64) return Response.json({ error: 'file_base64 requerido' }, { status: 400 });
    // file_base64 debe ser un data URL base64 (string). Un File crudo serializado
    // como JSON llega como {} y provocaba un 500 "startsWith is not a function".
    if (typeof file_base64 !== 'string' || !file_base64.startsWith('data:')) {
      return Response.json({ error: 'file_base64 debe ser un data URL base64 (string "data:..."), no un File crudo' }, { status: 400 });
    }

    const mimeType = file_base64.startsWith('data:')
      ? file_base64.split(';')[0].split(':')[1]
      : 'application/octet-stream';
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 6);
    const nombreArchivo = nombre || `archivo_${ts}_${rand}.${ext}`;
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const rutaFinal = ruta_drive || `Archivos/${yyyy}/${mm}`;

    // Siempre subir a CDN de Base44 primero
    let cdnUrl;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: file_base64 });
      cdnUrl = file_url;
    } catch (e) {
      return Response.json({ error: 'No se pudo subir el archivo: ' + e.message }, { status: 500 });
    }

    // Intentar subir a Google Drive
    let driveOk = false;
    let driveFileId = null;
    let driveUrl = null;
    let driveError = '';

    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      const accessToken = conn?.accessToken;
      if (!accessToken) throw new Error('Drive no conectado');

      const folderId = await getOrCreateFolder(accessToken, rutaFinal);
      const [, b64data] = file_base64.split(',');
      const binaryData = atob(b64data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) bytes[i] = binaryData.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType });

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({ name: nombreArchivo, parents: [folderId] })], { type: 'application/json' }));
      formData.append('file', blob, nombreArchivo);

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error?.message || 'Upload failed');
      }
      const driveFile = await uploadRes.json();

      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      driveFileId = driveFile.id;
      driveUrl = `https://drive.google.com/uc?id=${driveFile.id}&export=download`;
      driveOk = true;
    } catch (e) {
      driveError = e.message;
    }

    // Si Drive falló, registrar en cola de sync
    let pendingSyncId = null;
    if (!driveOk) {
      try {
        const syncRecord = await base44.asServiceRole.entities.ArchivoSyncPendiente.create({
          entidad_tipo: entidad_tipo || 'desconocido',
          entidad_id: entidad_id || null,
          campo_archivo: 'file_url',
          base44_url: cdnUrl,
          ruta_drive: rutaFinal,
          nombre_archivo: nombreArchivo,
          mime_type: mimeType,
          estado: 'pendiente',
          intentos: 0,
          subido_por_email: user.email,
          error_mensaje: driveError,
        });
        pendingSyncId = syncRecord.id;
      } catch (_) {}
    }

    return Response.json({
      success: true,
      file_url: driveOk ? driveUrl : cdnUrl,
      cdn_url_para_llm: cdnUrl,
      storage: driveOk ? 'googledrive' : 'pending_drive_sync',
      drive_file_id: driveFileId,
      drive_url: driveUrl,
      pending_sync_id: pendingSyncId,
      gdrive_error: driveOk ? null : driveError,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getOrCreateFolder(accessToken, folderPath) {
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