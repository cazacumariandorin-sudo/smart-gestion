import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { construirRegistroLegal, cargarOperarios, ESTADOS_OFICIALES } from '../../shared/registroLegal.ts';

/**
 * gestionRegistroHorarioLegal — administración/admin gestionan la capa legal.
 *
 * body.action:
 *  - 'generar'  { desde, hasta, trabajadorId? } → crea/actualiza registros PROVISIONALES desde fichajes.
 *  - 'validar'  { ids[], motivo }               → estado_legal = 'oficial'.
 *  - 'rechazar' { ids[], motivo }               → estado_legal = 'corregido'.
 *  - 'anular'   { ids[], motivo }               → estado_legal = 'anulado'.
 *
 * Trabaja por LOTES (bulkCreate/bulkUpdate) para respetar el rate limit de entidades.
 */

const ROLES_ADMIN = ['admin', 'propietario', 'administracion'];

function asArray(res) {
  return Array.isArray(res) ? res : (res?.items || []);
}

function chunks(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_ADMIN.includes(user.role)) {
      return Response.json(
        { error: 'Solo administración o admin pueden gestionar el registro legal' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const ahora = new Date().toISOString();

    if (action === 'generar') {
      const { desde, hasta, trabajadorId } = body;
      if (!desde || !hasta) {
        return Response.json({ error: 'desde y hasta son obligatorios' }, { status: 400 });
      }

      const operariosMap = await cargarOperarios(base44);

      const fq = { date: { $gte: desde, $lte: hasta } };
      if (trabajadorId) fq.operario_id = trabajadorId;
      const fichajes = asArray(await base44.asServiceRole.entities.Fichaje.filter(fq));

      const lq = { fecha: { $gte: desde, $lte: hasta } };
      if (trabajadorId) lq.operario_id = trabajadorId;
      const legales = asArray(await base44.asServiceRole.entities.RegistroHorarioLegal.filter(lq));

      // Estado actual por fichaje (nunca se toca una versión oficial).
      const porFichaje = {};
      for (const r of legales) {
        if (!r.fichaje_id) continue;
        const cur = porFichaje[r.fichaje_id] || { hasOficial: false, maxVersion: 0, provisionalId: null, provisionalVersion: 0 };
        if (ESTADOS_OFICIALES.includes(r.estado_legal)) cur.hasOficial = true;
        const v = Number(r.version_legal) || 1;
        if (v > cur.maxVersion) cur.maxVersion = v;
        if (r.estado_legal === 'provisional' && v >= cur.provisionalVersion) {
          cur.provisionalId = r.id;
          cur.provisionalVersion = v;
        }
        porFichaje[r.fichaje_id] = cur;
      }

      const nuevos = [];
      const updates = [];
      let omitidos = 0;

      for (const f of fichajes) {
        if (!f.hora_salida) { omitidos++; continue; }
        const ex = porFichaje[f.id];
        if (ex?.hasOficial) { omitidos++; continue; }

        const operario = operariosMap[f.operario_id];
        const origen = f.origen || 'trabajador';

        if (ex?.provisionalId) {
          updates.push({
            id: ex.provisionalId,
            ...construirRegistroLegal({
              fichaje: f, operario, estadoLegal: 'provisional', origen, usuario: user,
              versionLegal: ex.provisionalVersion || 1,
            }),
          });
        } else {
          nuevos.push(construirRegistroLegal({
            fichaje: f, operario, estadoLegal: 'provisional', origen, usuario: user,
            versionLegal: (ex?.maxVersion || 0) + 1,
          }));
        }
      }

      let creados = 0;
      let actualizados = 0;
      const eventos = [];

      for (const lote of chunks(nuevos, 200)) {
        const res = await base44.asServiceRole.entities.RegistroHorarioLegal.bulkCreate(lote);
        const arr = asArray(res);
        creados += arr.length || lote.length;
        arr.forEach((r) => eventos.push({
          entidad: 'RegistroHorarioLegal',
          registro_id: r.id,
          accion: 'registro_legal_provisional_generado',
          usuario: user.email,
          rol: user.role,
          fecha_hora: ahora,
          motivo: 'Generación de registro legal',
          origen: r.origen || 'app',
          version_legal: r.version_legal,
        }));
      }

      for (const lote of chunks(updates, 200)) {
        await base44.asServiceRole.entities.RegistroHorarioLegal.bulkUpdate(lote);
        actualizados += lote.length;
        lote.forEach((u) => eventos.push({
          entidad: 'RegistroHorarioLegal',
          registro_id: u.id,
          accion: 'registro_legal_provisional_actualizado',
          usuario: user.email,
          rol: user.role,
          fecha_hora: ahora,
          motivo: 'Generación de registro legal',
          origen: 'app',
          version_legal: u.version_legal,
        }));
      }

      for (const lote of chunks(eventos, 200)) {
        await base44.asServiceRole.entities.AuditoriaHorario.bulkCreate(lote);
      }

      return Response.json({ success: true, creados, actualizados, omitidos, errores: 0 });
    }

    if (action === 'validar' || action === 'rechazar' || action === 'anular') {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const motivo = body.motivo || '';
      if (!ids.length) return Response.json({ error: 'No hay registros seleccionados' }, { status: 400 });
      if (action !== 'validar' && !motivo.trim()) {
        return Response.json({ error: 'El motivo es obligatorio para rechazar o anular' }, { status: 400 });
      }

      const estadoLegal = action === 'validar' ? 'oficial' : action === 'rechazar' ? 'corregido' : 'anulado';
      const accion = action === 'validar'
        ? 'fichaje_validado_admin'
        : action === 'rechazar' ? 'fichaje_rechazado_admin' : 'fichaje_anulado';

      const registros = asArray(
        await base44.asServiceRole.entities.RegistroHorarioLegal.filter({ id: { $in: ids } }),
      );

      const updates = registros.map((r) => ({
        id: r.id,
        estado_legal: estadoLegal,
        ...(action === 'validar'
          ? { validado_por: user.email, validado_en: ahora, motivo_validacion: motivo }
          : { observaciones_interna: motivo }),
      }));

      let procesados = 0;
      for (const lote of chunks(updates, 200)) {
        await base44.asServiceRole.entities.RegistroHorarioLegal.bulkUpdate(lote);
        procesados += lote.length;
      }

      const eventos = registros.map((r) => ({
        entidad: 'RegistroHorarioLegal',
        registro_id: r.id,
        accion,
        usuario: user.email,
        rol: user.role,
        fecha_hora: ahora,
        campo: 'estado_legal',
        valor_anterior: r.estado_legal,
        valor_nuevo: estadoLegal,
        motivo,
        origen: 'administracion',
        version_legal: r.version_legal,
      }));
      for (const lote of chunks(eventos, 200)) {
        await base44.asServiceRole.entities.AuditoriaHorario.bulkCreate(lote);
      }

      return Response.json({ success: true, estado: estadoLegal, procesados, errores: 0 });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}