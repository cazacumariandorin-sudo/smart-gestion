import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONNECTOR_ID = '69fbade5fb0e753c143167f3'; // SIMANTEC OneDrive

// Folder structure mapping
const folderStructure = {
  'Operarios': 'Documentos',
  'Notas_Gastos': null,
  'Partes_Trabajo': 'Fotos',
  'Planos': null,
  'Manuales': null,
};

async function uploadToOneDrive(accessToken, fileName, fileContent, folderPath) {
  const encodedPath = encodeURIComponent(folderPath);
  const encodedFileName = encodeURIComponent(fileName);
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}/${encodedFileName}:/content`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: fileContent,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to upload ${fileName}: ${error}`);
  }

  const data = await res.json();
  return data['webUrl'] || data['@microsoft.graph.downloadUrl'];
}

async function downloadFile(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download file from ${url}`);
  return await res.arrayBuffer();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get OneDrive connection
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);

    const migrated = [];
    const failed = [];

    // Migrate OperarioDoc
    try {
      const docs = await base44.asServiceRole.entities.OperarioDoc.list();
      for (const doc of docs) {
        if (!doc.file_url) continue;
        try {
          const fileContent = await downloadFile(doc.file_url);
          const fileName = doc.file_url.split('/').pop().split('?')[0] || `${doc.title}.pdf`;
          const folderPath = `Operarios/Documentos`;
          const newUrl = await uploadToOneDrive(accessToken, fileName, fileContent, folderPath);
          
          // Update entity with new URL
          await base44.asServiceRole.entities.OperarioDoc.update(doc.id, { file_url: newUrl });
          migrated.push({ type: 'OperarioDoc', id: doc.id, path: folderPath });
        } catch (e) {
          failed.push({ type: 'OperarioDoc', id: doc.id, error: e.message });
        }
      }
    } catch (e) {
      failed.push({ type: 'OperarioDoc bulk', error: e.message });
    }

    // Migrate NotaGasto files
    try {
      const notas = await base44.asServiceRole.entities.NotaGasto.list();
      for (const nota of notas) {
        if (!nota.archivos || nota.archivos.length === 0) continue;
        try {
          const newArchivos = [];
          for (const archivo of nota.archivos) {
            try {
              const fileContent = await downloadFile(archivo.url);
              const fileName = archivo.nombre || archivo.url.split('/').pop().split('?')[0];
              const folderPath = `Notas_Gastos`;
              const newUrl = await uploadToOneDrive(accessToken, fileName, fileContent, folderPath);
              newArchivos.push({ ...archivo, url: newUrl });
            } catch (e) {
              newArchivos.push(archivo); // Keep original if upload fails
            }
          }
          await base44.asServiceRole.entities.NotaGasto.update(nota.id, { archivos: newArchivos });
          migrated.push({ type: 'NotaGasto', id: nota.id, files: newArchivos.length });
        } catch (e) {
          failed.push({ type: 'NotaGasto', id: nota.id, error: e.message });
        }
      }
    } catch (e) {
      failed.push({ type: 'NotaGasto bulk', error: e.message });
    }

    // Migrate WorkPhoto
    try {
      const photos = await base44.asServiceRole.entities.WorkPhoto.list();
      for (const photo of photos) {
        if (!photo.file_url) continue;
        try {
          const fileContent = await downloadFile(photo.file_url);
          const fileName = photo.file_url.split('/').pop().split('?')[0] || `photo-${photo.id}.jpg`;
          const folderPath = `Partes_Trabajo/Fotos`;
          const newUrl = await uploadToOneDrive(accessToken, fileName, fileContent, folderPath);
          
          await base44.asServiceRole.entities.WorkPhoto.update(photo.id, { file_url: newUrl });
          migrated.push({ type: 'WorkPhoto', id: photo.id, path: folderPath });
        } catch (e) {
          failed.push({ type: 'WorkPhoto', id: photo.id, error: e.message });
        }
      }
    } catch (e) {
      failed.push({ type: 'WorkPhoto bulk', error: e.message });
    }

    return Response.json({
      success: true,
      message: `Migración completada: ${migrated.length} archivos movidos a OneDrive`,
      migrated,
      failed: failed.length > 0 ? failed : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});