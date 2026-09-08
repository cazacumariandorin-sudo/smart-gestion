import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Backfill de obra_id en registros históricos que solo tienen obra_name.
// Rellena obra_id en RegistroGasto y MaterialPrecioHistorico cruzando el
// obra_name con Obra/SolarObra (normalizando: MAYÚSCULAS, sin tildes, sin signos).
// No sobrescribe obra_id ya existente. Solo gerencia / admin / propietario.
//
// Uso: invocar manualmente una vez antes de fiarse del margen por obra.
// No se ejecuta automáticamente (muta datos de producción).

function normalize(s) {
  if (!s) return '';
  return String(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'propietario', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // por defecto dry-run (no escribe)

    // Mapa nombre normalizado -> obra_id (civiles + solares)
    const [obrasCivil, obrasSolar] = await Promise.all([
      sr.entities.Obra.list('name', 2000).catch(() => []),
      sr.entities.SolarObra.list('name', 2000).catch(() => []),
    ]);
    const nameToId = new Map();
    const duplicates = [];
    for (const o of [...obrasCivil, ...obrasSolar]) {
      const k = normalize(o.name);
      if (!k) continue;
      if (nameToId.has(k)) duplicates.push(k);
      else nameToId.set(k, o.id);
    }

    async function backfillEntity(entityName, opts) {
      const all = await sr.entities[entityName].list(opts.sort, 10000).catch(() => []);
      const pending = all.filter(r => !r.obra_id && r.obra_name);
      const updates = [];
      const matched = [];
      const unmatched = [];
      for (const r of pending) {
        const k = normalize(r.obra_name);
        const id = nameToId.get(k);
        if (id) { updates.push({ id: r.id, obra_id: id }); matched.push(r.obra_name); }
        else unmatched.push(r.obra_name);
      }
      let updated = 0;
      if (!dryRun && updates.length) {
        const res = await sr.entities[entityName].bulkUpdate(updates).catch(e => { throw e; });
        updated = updates.length;
      }
      return { pendientes: pending.length, matched: matched.length, actualizados: updated, unmatchedMuestras: unmatched.slice(0, 20) };
    }

    const registroGasto = await backfillEntity('RegistroGasto', { sort: '-updated_date' });
    const materialHistorico = await backfillEntity('MaterialPrecioHistorico', { sort: '-fecha_documento' });

    return Response.json({
      dry_run: dryRun,
      obras_indexadas: nameToId.size,
      nombres_duplicados: duplicates.length,
      registro_gasto: registroGasto,
      material_precio_historico: materialHistorico,
      nota: dryRun
        ? 'Dry-run: no se escribieron cambios. Vuelve a invocar con { "dry_run": false } para aplicar.'
        : 'Backfill aplicado.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}