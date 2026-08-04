import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * propagarRenameObra
 * Cuando un admin/gerencia renombra una Obra (civil o solar), sincroniza el
 * nuevo nombre en todos los registros desnormalizados que guardan obra_name:
 *   - Documentos : Drawing, Manual
 *   - Partes     : ParteDiarioObra, ApunteHorario, RegistroGasto, Fichaje
 *   - Materiales : ObraMaterial
 *   - Fotos      : FotoProyecto (proyecto_id / proyecto_name)
 *
 * Solo admin/gerencia pueden invocar (coincide con quién renombra la obra).
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Forbidden — solo admin/gerencia' }, { status: 403 });
    }

    const { obra_id, obra_tipo, nuevo_nombre } = await req.json();
    if (!obra_id || !nuevo_nombre || typeof nuevo_nombre !== 'string') {
      return Response.json({ error: 'obra_id y nuevo_nombre requeridos' }, { status: 400 });
    }
    const nombre = nuevo_nombre.trim();
    if (!nombre) return Response.json({ error: 'nuevo_nombre vacío' }, { status: 400 });

    const admin = base44.asServiceRole.entities;
    // [entityName, filtro por, campo a actualizar]
    const entidades = [
      ['Drawing',         'obra_id',     'obra_name'],
      ['Manual',          'obra_id',     'obra_name'],
      ['ParteDiarioObra', 'obra_id',     'obra_name'],
      ['ApunteHorario',   'obra_id',     'obra_name'],
      ['RegistroGasto',   'obra_id',     'obra_name'],
      ['Fichaje',         'obra_id',     'obra_name'],
      ['ObraMaterial',    'obra_id',     'obra_name'],
      ['FotoProyecto',    'proyecto_id', 'proyecto_name'],
    ];

    const resultados = {};
    let totalModificados = 0;

    for (const [entName, filterField, nameField] of entidades) {
      try {
        const r = await admin[entName].updateMany(
          { [filterField]: obra_id },
          { $set: { [nameField]: nombre } }
        );
        const mod = r?.modified ?? 0;
        resultados[entName] = { ok: true, modified: mod, has_more: !!r?.has_more };
        totalModificados += mod;
      } catch (e) {
        resultados[entName] = { ok: false, error: String(e?.message || e).slice(0, 120) };
      }
    }

    return Response.json({
      success: true,
      obra_id,
      obra_tipo,
      nuevo_nombre: nombre,
      total_modificados: totalModificados,
      resultados,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}