import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verificar que sea admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Obtener conexión de Google Drive
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    
    if (!accessToken) {
      return Response.json({ 
        success: false, 
        error: 'Google Drive no está conectado' 
      });
    }

    let migratedCount = 0;
    const errors = [];

    // 1. Migrar fotos de partes de trabajo (WorkPhoto)
    const workPhotos = await base44.asServiceRole.entities.WorkPhoto.filter({
      storage: 'local'
    });
    
    for (const photo of workPhotos) {
      try {
        if (photo.file_url) {
          // Descargar archivo local
          const fileRes = await fetch(photo.file_url);
          const blob = await fileRes.blob();
          const base64 = await blobToBase64(blob);
          
          // Subir a Google Drive
          const folderPath = `Partes_Trabajo/Fotos/${photo.project || 'Sin_Obra'}`;
          const uploadRes = await uploadToGdrive(accessToken, base64, folderPath);
          
          // Actualizar entidad
          await base44.asServiceRole.entities.WorkPhoto.update(photo.id, {
            file_url: uploadRes.file_url,
            storage: 'googledrive',
            drive_file_id: uploadRes.drive_file_id,
            drive_folder_id: uploadRes.drive_folder_id
          });
          
          migratedCount++;
        }
      } catch (e) {
        errors.push(`WorkPhoto ${photo.id}: ${e.message}`);
      }
    }

    // 2. Migrar fotos de proyectos (FotoProyecto)
    const fotoProyectos = await base44.asServiceRole.entities.FotoProyecto.filter({
      storage: 'local'
    });
    
    for (const foto of fotoProyectos) {
      try {
        if (foto.file_url) {
          const fileRes = await fetch(foto.file_url);
          const blob = await fileRes.blob();
          const base64 = await blobToBase64(blob);
          
          const folderPath = `Obras/${foto.obra_nombre || 'Sin_Obra'}`;
          const uploadRes = await uploadToGdrive(accessToken, base64, folderPath);
          
          await base44.asServiceRole.entities.FotoProyecto.update(foto.id, {
            file_url: uploadRes.file_url,
            storage: 'googledrive',
            drive_file_id: uploadRes.drive_file_id
          });
          
          migratedCount++;
        }
      } catch (e) {
        errors.push(`FotoProyecto ${foto.id}: ${e.message}`);
      }
    }

    // 3. Migrar documentos de operarios (OperarioDoc)
    const operarioDocs = await base44.asServiceRole.entities.OperarioDoc.filter({
      firma_status: 'firmado',
      $or: [
        { storage: 'local' },
        { storage: { $exists: false } }
      ]
    });
    
    for (const doc of operarioDocs) {
      try {
        if (doc.file_url || doc.firma_url) {
          // Migrar file_url
          if (doc.file_url && doc.file_url.startsWith('http') && !doc.file_url.includes('drive.google.com')) {
            const fileRes = await fetch(doc.file_url);
            const blob = await fileRes.blob();
            const base64 = await blobToBase64(blob);
            
            const folderPath = `Operarios/Documentos`;
            const uploadRes = await uploadToGdrive(accessToken, base64, folderPath);
            
            await base44.asServiceRole.entities.OperarioDoc.update(doc.id, {
              file_url: uploadRes.file_url,
              storage: 'googledrive',
              drive_file_id: uploadRes.drive_file_id
            });
            
            migratedCount++;
          }
          
          // Migrar firma_url
          if (doc.firma_url && doc.firma_url.startsWith('http') && !doc.firma_url.includes('drive.google.com')) {
            const fileRes = await fetch(doc.firma_url);
            const blob = await fileRes.blob();
            const base64 = await blobToBase64(blob);
            
            const folderPath = `Operarios/Documentos/Firmas`;
            const uploadRes = await uploadToGdrive(accessToken, base64, folderPath);
            
            await base44.asServiceRole.entities.OperarioDoc.update(doc.id, {
              firma_url: uploadRes.file_url,
              storage: 'googledrive'
            });
            
            migratedCount++;
          }
        }
      } catch (e) {
        errors.push(`OperarioDoc ${doc.id}: ${e.message}`);
      }
    }

    // 4. Migrar tickets de gastos (RegistroGasto)
    const registroGastos = await base44.asServiceRole.entities.RegistroGasto.filter({
      estado: { $nin: ['borrador'] },
      $or: [
        { storage: 'local' },
        { storage: { $exists: false } }
      ]
    });
    
    for (const gasto of registroGastos) {
      try {
        if (gasto.archivos && gasto.archivos.length > 0) {
          for (const archivo of gasto.archivos) {
            if (archivo.url && archivo.url.startsWith('http') && !archivo.url.includes('drive.google.com')) {
              const fileRes = await fetch(archivo.url);
              const blob = await fileRes.blob();
              const base64 = await blobToBase64(blob);
              
              const folderPath = `Notas_Gastos/${gasto.operario_name || 'Sin_Operario'}`;
              const uploadRes = await uploadToGdrive(accessToken, base64, folderPath);
              
              // Actualizar URL del archivo
              archivo.url = uploadRes.file_url;
            }
          }
          
          await base44.asServiceRole.entities.RegistroGasto.update(gasto.id, {
            archivos: gasto.archivos,
            storage: 'googledrive'
          });
          
          migratedCount++;
        }
      } catch (e) {
        errors.push(`RegistroGasto ${gasto.id}: ${e.message}`);
      }
    }

    // Registrar en GdriveSyncState
    await base44.asServiceRole.entities.GdriveSyncState.create({
      recurso_tipo: 'sync_batch',
      recurso_id: `batch_${new Date().toISOString()}`,
      recurso_nombre: 'Migración automática de archivos',
      ruta_completa: '/',
      ultima_sync: new Date().toISOString(),
      estado: 'activo',
      errores: errors.length > 0 ? errors.join('; ') : null
    });

    return Response.json({
      success: true,
      migrated_count: migratedCount,
      errors: errors.length > 0 ? errors : null,
      message: `Se migraron ${migratedCount} archivos a Google Drive`
    });
    
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});

// Helper: Convert blob to base64
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper: Upload to Google Drive
async function uploadToGdrive(accessToken, base64File, folderPath) {
  // Decodificar archivo
  const [header, base64Data] = base64File.split(',');
  const mimeType = header.split(':')[1].split(';')[0];
  const fileName = `file_${Date.now()}.${mimeType.split('/')[1] || 'bin'}`;
  
  // Convertir a blob
  const binaryData = atob(base64Data);
  const bytes = new Uint8Array(binaryData.length);
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  
  // Obtener o crear carpeta
  const folderId = await getOrCreateFolder(accessToken, folderPath);
  
  // Crear FormData
  const formData = new FormData();
  const metadata = {
    name: fileName,
    parents: [folderId],
  };
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', blob, fileName);
  
  // Subir a Google Drive
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Google Drive upload failed: ${error.error?.message}`);
  }
  
  const driveFile = await res.json();
  
  // Hacer público
  await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });
  
  return {
    file_url: `https://drive.google.com/uc?id=${driveFile.id}&export=download`,
    drive_file_id: driveFile.id,
    drive_folder_id: folderId
  };
}

// Helper: Get or create folder
async function getOrCreateFolder(accessToken, folderPath) {
  const parts = folderPath.split('/').filter(p => p.trim());
  let currentParentId = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1'; // Root folder SIMANTEC
  
  for (const part of parts) {
    // Buscar carpeta existente
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(part)}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    
    const searchData = await searchRes.json();
    
    if (searchData.files && searchData.files.length > 0) {
      currentParentId = searchData.files[0].id;
    } else {
      // Crear nueva carpeta
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [currentParentId],
        }),
      });
      
      const newFolder = await createRes.json();
      currentParentId = newFolder.id;
    }
  }
  
  return currentParentId;
}