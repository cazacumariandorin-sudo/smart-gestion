import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';

const folderStructure = {
  'Pedidos': [],
  'Obras': ['Materiales'],
  'Notas_Gastos': [],
  'Operarios': ['Documentos'],
  'Partes_Trabajo': ['Fotos'],
  'Planos': [],
  'Manuales': [],
  'Catalogo_Materiales': [],
  'Obras_Solar': ['Legalizacion'],
};

async function createFolder(drive, parentId, folderName) {
  const body = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };

  const res = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${drive.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to create folder "${folderName}": ${data.error?.message}`);
  }
  return data.id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get shared Google Drive connection (authorized connector)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    const created = [];
    const failed = [];

    // Create main folders
    for (const [mainFolder, subFolders] of Object.entries(folderStructure)) {
      try {
        const mainFolderId = await createFolder({ accessToken }, ROOT_FOLDER_ID, mainFolder);
        created.push({ folder: mainFolder, id: mainFolderId, path: `/${mainFolder}` });

        // Create subfolders
        for (const subFolder of subFolders) {
          try {
            const subFolderId = await createFolder({ accessToken }, mainFolderId, subFolder);
            created.push({ folder: subFolder, id: subFolderId, path: `/${mainFolder}/${subFolder}` });
          } catch (e) {
            failed.push({ folder: `${mainFolder}/${subFolder}`, error: e.message });
          }
        }
      } catch (e) {
        failed.push({ folder: mainFolder, error: e.message });
      }
    }

    return Response.json({
      success: true,
      message: `Estructura de carpetas creada en Google Drive (${created.length} carpetas)`,
      created,
      failed: failed.length > 0 ? failed : null,
      root_folder_id: ROOT_FOLDER_ID,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});