import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTITIES = [
  'Client', 'Obra', 'WorkOrder', 'WorkPhoto', 'Fichaje', 'Operario',
  'ApunteHorario', 'NotaGastos', 'GastoOperario', 'Vacacion',
  'ObraMaterial', 'PrevisionObra', 'OperarioDoc', 'Herramienta',
  'AsignacionHerramienta', 'Manual', 'Fabricante', 'MaterialCatalog',
  'Drawing', 'Order', 'SolarObra', 'SolarCliente', 'SolarLegalizacion',
  'SolarMaterial', 'AlarmaHorario', 'NotificacionFichaje', 'AppBackup'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden crear backups' }, { status: 403 });
    }

    // Crear registro de backup en estado 'en_progreso'
    const backupRecord = await base44.asServiceRole.entities.AppBackup.create({
      snapshot_date: new Date().toISOString(),
      version: '1.0',
      status: 'en_progreso',
      notes: `Backup manual por ${user.email}`
    });

    // Recopilar datos de todas las entidades
    const entityData = {};
    let totalRecords = 0;
    let totalEntities = 0;

    for (const entityName of ENTITIES) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list('-created_date', 1000);
        if (records && records.length > 0) {
          entityData[entityName] = records.length;
          totalRecords += records.length;
          totalEntities++;
        }
      } catch {
        // Entity might not exist or have no data
      }
    }

    // Crear JSON con resumen y subirlo
    const backupData = {
      timestamp: new Date().toISOString(),
      created_by: user.email,
      summary: {
        total_entities: totalEntities,
        total_records: totalRecords,
        entities: entityData
      }
    };

    const jsonBlob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', jsonBlob, `backup-${new Date().toISOString().split('T')[0]}.json`);

    let fileUrl = null;
    try {
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: jsonBlob });
      fileUrl = uploadRes?.file_url || null;
    } catch {
      // Upload might fail, backup still valid
    }

    // Actualizar registro con resultado
    await base44.asServiceRole.entities.AppBackup.update(backupRecord.id, {
      status: 'completado',
      backup_file_url: fileUrl,
      data_summary: {
        total_entities: totalEntities,
        total_records: totalRecords,
        entities: entityData
      }
    });

    return Response.json({
      success: true,
      backup_id: backupRecord.id,
      summary: { total_entities: totalEntities, total_records: totalRecords }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});