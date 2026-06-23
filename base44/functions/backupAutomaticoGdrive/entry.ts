import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROOT_FOLDER_NAME = 'SMART-GESTION Backups';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user && user.role !== 'admin' && user.role !== 'gerencia') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    if (!accessToken) return Response.json({ error: 'Google Drive no conectado' }, { status: 503 });

    const hoy = new Date().toISOString().split('T')[0];
    const authHeader = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // 1. Obtener o crear carpeta raíz de backups
    const rootId = await getOrCreateFolder(accessToken, ROOT_FOLDER_NAME, null);
    // 2. Subcarpeta con fecha de hoy
    const fechaId = await getOrCreateFolder(accessToken, hoy, rootId);

    // 3. Exportar cada módulo
    const resultados = {};

    const entidades = [
      { nombre: 'Fichajes', entity: base44.asServiceRole.entities.Fichaje },
      { nombre: 'RegistroGastos', entity: base44.asServiceRole.entities.RegistroGasto },
      { nombre: 'Operarios', entity: base44.asServiceRole.entities.Operario },
      { nombre: 'Obras', entity: base44.asServiceRole.entities.Obra },
      { nombre: 'SolarObras', entity: base44.asServiceRole.entities.SolarObra },
      { nombre: 'WorkOrders', entity: base44.asServiceRole.entities.WorkOrder },
      { nombre: 'Presupuestos', entity: base44.asServiceRole.entities.Presupuesto },
      { nombre: 'Nominas', entity: base44.asServiceRole.entities.Nomina },
      { nombre: 'Vacaciones', entity: base44.asServiceRole.entities.Vacacion },
      { nombre: 'ApuntesHorario', entity: base44.asServiceRole.entities.ApunteHorario },
      { nombre: 'Manuales', entity: base44.asServiceRole.entities.Manual },
      { nombre: 'Planos', entity: base44.asServiceRole.entities.Drawing },
    ];

    for (const { nombre, entity } of entidades) {
      try {
        const datos = await entity.list('-created_date', 5000);
        const json = JSON.stringify(datos, null, 2);
        const fileName = `${nombre}_${hoy}.json`;
        await uploadJsonToDrive(accessToken, fechaId, fileName, json);
        resultados[nombre] = { ok: true, registros: datos.length };
      } catch (e) {
        resultados[nombre] = { ok: false, error: e.message };
      }
    }

    // 4. Registrar en AppBackup
    await base44.asServiceRole.entities.AppBackup.create({
      fecha: hoy,
      tipo: 'automatico_gdrive',
      estado: 'completado',
      detalles: JSON.stringify(resultados),
      gdrive_folder_id: fechaId,
    }).catch(() => {});

    return Response.json({ success: true, fecha: hoy, gdrive_folder_id: fechaId, resultados });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getOrCreateFolder(accessToken, name, parentId) {
  const authH = `Bearer ${accessToken}`;
  const parentQ = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents";
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder'${parentQ} and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: authH },
  });
  const data = await res.json();
  if (data.files && data.files.length > 0) return data.files[0].id;

  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: authH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const created = await createRes.json();
  return created.id;
}

async function uploadJsonToDrive(accessToken, folderId, fileName, jsonContent) {
  const boundary = 'BACKUP_BOUNDARY';
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    jsonContent,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Upload failed');
  }
  return await res.json();
}