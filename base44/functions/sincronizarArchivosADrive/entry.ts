import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';
const MAX_POR_EJECUCION = 50;

/**
 * sincronizarArchivosADrive — cron diario 06:00
 * Sube a Drive los archivos que quedaron en Base44 CDN por fallo temporal.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let accessToken = null;
  try {
    const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
    accessToken = conn?.accessToken || null;
  } catch (_) {}

  if (!accessToken) {
    return Response.json({ success: false, error: 'Google Drive no conectado. Se reintentará mañana.' });
  }

  const pendientes = await base44.asServiceRole.entities.ArchivoSyncPendiente.filter(
    { estado: 'pendiente', intentos: { $lt: 5 } },
    'created_date',
    MAX_POR_EJECUCION
  );

  if (pendientes.length === 0) {
    return Response.json({ success: true, sincronizados: 0, mensaje: 'Sin archivos pendientes.' });
  }

  let sincronizados = 0;
  let errores = 0;
  const detalles = [];

  for (const pendiente of pendientes) {
    try {
      await base44.asServiceRole.entities.ArchivoSyncPendiente.update(pendiente.id, { estado: 'subiendo' });

      const fetchRes = await fetch(pendiente.base44_url);
      if (!fetchRes.ok) throw new Error(`No se pudo descargar desde CDN: ${fetchRes.status}`);

      const arrayBuffer = await fetchRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);

      const folderId = await getOrCreateFolder(accessToken, pendiente.ruta_drive || 'Archivos');
      const mimeType = pendiente.mime_type || 'application/octet-stream';
      const binaryData = atob(b64);
      const uploadBytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) uploadBytes[i] = binaryData.charCodeAt(i);
      const uploadBlob = new Blob([uploadBytes], { type: mimeType });

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({ name: pendiente.nombre_archivo, parents: [folderId] })], { type: 'application/json' }));
      formData.append('file', uploadBlob, pendiente.nombre_archivo);

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error?.message || 'Upload a Drive falló');
      }
      const driveFile = await uploadRes.json();

      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      const driveUrl = `https://drive.google.com/uc?id=${driveFile.id}&export=download`;

      // Actualizar entidad propietaria si conocemos tipo e ID
      if (pendiente.entidad_tipo && pendiente.entidad_id) {
        try {
          const entityRef = base44.asServiceRole.entities[pendiente.entidad_tipo];
          if (entityRef) {
            const campo = pendiente.campo_archivo || 'file_url';
            await entityRef.update(pendiente.entidad_id, { [campo]: driveUrl, drive_file_id: driveFile.id, storage: 'googledrive' });
          }
        } catch (_) {}
      }

      await base44.asServiceRole.entities.ArchivoSyncPendiente.update(pendiente.id, {
        estado: 'completado',
        drive_file_id: driveFile.id,
        drive_url: driveUrl,
        error_mensaje: null,
      });

      sincronizados++;
      detalles.push({ id: pendiente.id, entidad: pendiente.entidad_tipo, estado: 'ok' });

    } catch (e) {
      errores++;
      await base44.asServiceRole.entities.ArchivoSyncPendiente.update(pendiente.id, {
        estado: (pendiente.intentos || 0) >= 4 ? 'error' : 'pendiente',
        intentos: (pendiente.intentos || 0) + 1,
        error_mensaje: e.message,
      });
      detalles.push({ id: pendiente.id, entidad: pendiente.entidad_tipo, estado: 'error', error: e.message });
    }
  }

  try {
    await base44.asServiceRole.entities.GdriveSyncState.create({
      recurso_tipo: 'sync_cron',
      recurso_nombre: `Cron 06:00 — ${new Date().toISOString().split('T')[0]}`,
      ruta_completa: '/sync/archivos',
      ultima_sync: new Date().toISOString(),
      estado: errores > 0 && sincronizados === 0 ? 'error' : 'activo',
      errores: errores > 0 ? `${errores} errores de ${pendientes.length} archivos` : null,
    });
  } catch (_) {}

  return Response.json({
    success: true,
    sincronizados,
    errores,
    total_procesados: pendientes.length,
    detalles,
    mensaje: errores === 0
      ? `✓ ${sincronizados} archivos sincronizados con Drive`
      : `${sincronizados} OK, ${errores} con errores. Se reintentarán mañana.`,
  });
});

async function getOrCreateFolder(accessToken, folderPath) {
  const folders = folderPath.split('/').filter(Boolean);
  let parentId = ROOT_FOLDER_ID;
  for (const name of folders) {
    const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, { headers: { Authorization: `Bearer ${accessToken}` } });
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