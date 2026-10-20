import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';

// UploadFile exige un File real (multipart); un data URL en texto se rechaza.
function dataUrlAFile(dataUrl: string): File {
  const [header, b64] = dataUrl.split(',');
  const mime = header.split(':')[1]?.split(';')[0] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  return new File([bytes], `archivo_${Date.now()}.${ext}`, { type: mime });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file, folder_path } = await req.json();

    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 });
    }

    // Check if Google Drive connector is available
    let useGdrive = false;
    let accessToken = null;

    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      if (conn.accessToken) {
        useGdrive = true;
        accessToken = conn.accessToken;
      }
    } catch {
      // Google Drive not connected, will use local storage
      useGdrive = false;
    }

    if (useGdrive && accessToken) {
      try {
        // Upload to Google Drive
        const folderId = await getOrCreateFolder(accessToken, folder_path || 'Archivos');
        
        // Decode base64 file
        const [header, base64Data] = file.split(',');
        const mimeType = header.split(':')[1].split(';')[0];
        const fileName = generateFileName(mimeType);
        
        // Convert base64 to blob
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: mimeType });
        
        // Create form data for upload
        const formData = new FormData();
        const metadata = {
          name: fileName,
          parents: [folderId],
        };
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', blob, fileName);
        
        // Upload to Google Drive
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });
        
        if (!res.ok) {
          const error = await res.json();
          console.error('Google Drive upload error:', error);
          throw new Error(`Google Drive upload failed: ${error.error?.message}`);
        }
        
        const driveFile = await res.json();
        
        // Make file publicly viewable (for app access)
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
        
        // Return Google Drive file URL
        const file_url = `https://drive.google.com/uc?id=${driveFile.id}&export=download`;
        
        return Response.json({
          success: true,
          file_url,
          storage: 'googledrive',
          drive_file_id: driveFile.id,
          drive_folder_id: folderId,
        });
      } catch (gdriveError) {
        console.warn('Google Drive upload failed, falling back to local storage:', gdriveError.message);
        // Fallback to local Base44 storage
        const { file_url } = await base44.integrations.Core.UploadFile({ file: dataUrlAFile(file) });
        
        return Response.json({
          success: true,
          file_url,
          storage: 'local',
          gdrive_error: gdriveError.message,
        });
      }
    } else {
      // Fallback to local Base44 storage
      const { file_url } = await base44.integrations.Core.UploadFile({ file: dataUrlAFile(file) });
      
      return Response.json({
        success: true,
        file_url,
        storage: 'local',
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getOrCreateFolder(accessToken, folderPath) {
  const folders = folderPath.split('/').filter(Boolean);
  let parentId = ROOT_FOLDER_ID;
  
  for (const folderName of folders) {
    // Search for existing folder
    const searchQuery = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${searchQuery}&fields=files(id,name)`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    const searchData = await searchRes.json();
    
    if (searchData.files && searchData.files.length > 0) {
      parentId = searchData.files[0].id;
    } else {
      // Create new folder
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      });
      
      const createData = await createRes.json();
      parentId = createData.id;
    }
  }
  
  return parentId;
}

function generateFileName(mimeType) {
  const ext = mimeType.split('/')[1] || 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `file_${timestamp}_${random}.${ext}`;
}