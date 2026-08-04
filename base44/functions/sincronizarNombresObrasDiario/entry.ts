import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * sincronizarNombresObrasDiario
 * Comprobación diaria: recorre todas las Obras civiles y solares y, para cada
 * una, sincroniza el nombre actual en los registros desnormalizados que aún
 * tengan un obra_name / project / proyecto_name obsoleto. Solo actualiza
 * cuando el nombre difiere, para minimizar escrituras.
 *
 * Pensada para ejecutarse automáticamente (automatización scheduled diaria).
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole.entities;

    // [entidad, campo que apunta al id de la obra, campo de nombre desnormalizado]
    const entidades = [
      ['Drawing',         'obra_id',     'obra_name'],
      ['Manual',          'obra_id',     'obra_name'],
      ['ParteDiarioObra', 'obra_id',     'obra_name'],
      ['ApunteHorario',   'obra_id',     'obra_name'],
      ['RegistroGasto',   'obra_id',     'obra_name'],
      ['Fichaje',         'obra_id',     'obra_name'],
      ['ObraMaterial',    'obra_id',     'obra_name'],
      ['FotoProyecto',    'proyecto_id', 'proyecto_name'],
      ['Fichaje',         'obra_id',     'project'],  // campo legado de Fichaje (compatibilidad)
      ['WorkOrder',       'obra_id',     'project'],
    ];

    // Listar todas las obras civiles y solares
    const [obras, solarObras] = await Promise.all([
      admin.Obra.list('-updated_date', 1000).catch(() => []),
      admin.SolarObra.list('-updated_date', 1000).catch(() => []),
    ]);

    const todasLasObras = [
      ...obras.map(o => ({ id: o.id, name: (o.name || '').trim(), tipo: 'obra' })),
      ...solarObras.map(o => ({ id: o.id, name: (o.name || '').trim(), tipo: 'solar' })),
    ].filter(o => o.id && o.name);

    const reporte = [];
    let totalActualizados = 0;

    for (const obra of todasLasObras) {
      let porObra = 0;
      for (const [entName, idField, nameField] of entidades) {
        try {
          // Solo actualiza registros donde el campo id coincide pero el nombre difiere
          const r = await admin[entName].updateMany(
            { [idField]: obra.id, [nameField]: { $ne: obra.name } },
            { $set: { [nameField]: obra.name } }
          );
          const mod = r?.modified ?? 0;
          porObra += mod;
        } catch (_) {
          // La entidad puede no tener el campo o estar vacía — saltar
        }
      }
      if (porObra > 0) {
        reporte.push({ obra_id: obra.id, name: obra.name, tipo: obra.tipo, actualizados: porObra });
      }
      totalActualizados += porObra;
    }

    return Response.json({
      success: true,
      obras_revisadas: todasLasObras.length,
      total_registros_actualizados: totalActualizados,
      obras_con_cambios: reporte,
      ejecutado_en: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}