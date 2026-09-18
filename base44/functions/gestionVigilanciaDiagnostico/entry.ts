import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MAX_VIGILANCIAS_ACTIVAS = 5;

function rolEsGerenciaAdmin(user) {
  const r = (user?.role || '').toLowerCase();
  return r === 'admin' || r === 'gerencia';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ─────────────────────────────────────────────────────────
    // VERIFICAR (silencioso, cualquier logged-in)
    // Devuelve si el caller tiene una vigilancia activa apuntándolo.
    // Sin RLS — usa service role para leer el registro sin filtrar.
    // ─────────────────────────────────────────────────────────
    if (action === 'verificar') {
      const ahora = new Date().toISOString();
      let activa = null;
      try {
        const vig = await base44.asServiceRole.entities.VigilanciaDiagnostico.filter({
          user_email: user.email,
          estado: 'activa'
        });
        activa = (vig || []).find(v => new Date(v.fecha_fin_prevista) > new Date(ahora)) || null;

        // Auto-expirar vigilancias caducas (lazy cleanup)
        const caducas = (vig || []).filter(v => v.id !== activa?.id && new Date(v.fecha_fin_prevista) <= new Date(ahora));
        for (const v of caducas) {
          await base44.asServiceRole.entities.VigilanciaDiagnostico.update(v.id, {
            estado: 'expirada',
            fecha_fin_real: ahora
          }).catch(() => {});
        }
      } catch (e) {
        console.error('verificar vigilancia:', e);
      }
      return Response.json({
        activa: !!activa,
        vigilancia_id: activa?.id || null,
        fecha_fin_prevista: activa?.fecha_fin_prevista || null
      });
    }

    // ─────────────────────────────────────────────────────────
    // Resto de acciones requieren gerencia/admin
    // ─────────────────────────────────────────────────────────
    if (!rolEsGerenciaAdmin(user)) {
      return Response.json({ error: 'Solo Gerencia/Admin' }, { status: 403 });
    }

    // ─────────────────────────────────────────────────────────
    // INICIAR
    // ─────────────────────────────────────────────────────────
    if (action === 'iniciar') {
      const { user_email, motivo, duracion_horas = 72, comparativa_con_vigilancia_id = null, es_comparativa = false } = body;
      if (!user_email) {
        return Response.json({ error: 'Falta user_email' }, { status: 400 });
      }
      if (user_email === user.email) {
        return Response.json({ error: 'No puedes vigilarte a ti mismo' }, { status: 400 });
      }

      // Limpiar expiradas antes de contar
      const ahora = new Date();
      const todas = await base44.entities.VigilanciaDiagnostico.filter({ estado: 'activa' });
      const realmenteActivas = todas.filter(v => new Date(v.fecha_fin_prevista) > ahora);
      for (const v of todas) {
        if (new Date(v.fecha_fin_prevista) <= ahora) {
          await base44.entities.VigilanciaDiagnostico.update(v.id, {
            estado: 'expirada',
            fecha_fin_real: ahora.toISOString()
          }).catch(() => {});
        }
      }

      if (realmenteActivas.length >= MAX_VIGILANCIAS_ACTIVAS) {
        return Response.json({
          error: `Límite alcanzado: máximo ${MAX_VIGILANCIAS_ACTIVAS} vigilancias activas simultáneas`
        }, { status: 409 });
      }

      // No duplicar vigilancia para el mismo usuario
      const yaVigilado = realmenteActivas.find(v => v.user_email === user_email);
      if (yaVigilado) {
        return Response.json({
          error: 'Ya existe una vigilancia activa para este usuario',
          vigilancia_id: yaVigilado.id
        }, { status: 409 });
      }

      // Snapshot del rol del usuario objetivo (leer User/Operario)
      let user_role_snapshot = '';
      let user_full_name = '';
      let user_id = '';
      try {
        const u = await base44.asServiceRole.entities.User.filter({ email: user_email });
        if (u && u.length > 0) {
          user_role_snapshot = u[0].role || '';
          user_full_name = u[0].full_name || '';
          user_id = u[0].id || '';
        }
      } catch {}
      if (!user_role_snapshot) {
        try {
          const op = await base44.asServiceRole.entities.Operario.filter({ user_email });
          if (op && op.length > 0) {
            user_role_snapshot = op[0].role || '';
            user_full_name = op[0].name || '';
          }
        } catch {}
      }

      const fechaInicio = ahora.toISOString();
      const fechaFin = new Date(ahora.getTime() + (duracion_horas || 72) * 3600 * 1000).toISOString();

      const nueva = await base44.entities.VigilanciaDiagnostico.create({
        user_email,
        user_id,
        user_full_name,
        user_role_snapshot,
        iniciado_por: user.email,
        fecha_inicio: fechaInicio,
        fecha_fin_prevista: fechaFin,
        duracion_horas: duracion_horas || 72,
        estado: 'activa',
        motivo: motivo || '',
        comparativa_con_vigilancia_id,
        es_comparativa: !!es_comparativa,
        eventos_count: 0
      });

      return Response.json({ success: true, vigilancia: nueva });
    }

    // ─────────────────────────────────────────────────────────
    // FINALIZAR
    // ─────────────────────────────────────────────────────────
    if (action === 'finalizar') {
      const { vigilancia_id, cancelar = false } = body;
      if (!vigilancia_id) return Response.json({ error: 'Falta vigilancia_id' }, { status: 400 });
      const actualizada = await base44.entities.VigilanciaDiagnostico.update(vigilancia_id, {
        estado: cancelar ? 'cancelada' : 'finalizada',
        fecha_fin_real: new Date().toISOString(),
        finalizada_por: user.email
      });
      return Response.json({ success: true, vigilancia: actualizada });
    }

    // ─────────────────────────────────────────────────────────
    // LISTAR (activas)
    // ─────────────────────────────────────────────────────────
    if (action === 'listar') {
      const todas = await base44.entities.VigilanciaDiagnostico.list('-fecha_inicio', 100);
      const ahora = new Date();
      // Autoexpirar + contar
      for (const v of todas) {
        if (v.estado === 'activa' && new Date(v.fecha_fin_prevista) <= ahora) {
          await base44.entities.VigilanciaDiagnostico.update(v.id, {
            estado: 'expirada',
            fecha_fin_real: ahora.toISOString()
          }).catch(() => {});
        }
      }
      const activas = todas.filter(v => v.estado === 'activa');
      const recientes = todas.filter(v => v.estado !== 'activa').slice(0, 20);
      return Response.json({ activas, recientes, limite: MAX_VIGILANCIAS_ACTIVAS });
    }

    // ─────────────────────────────────────────────────────────
    // LISTAR_USUARIOS (para el selector del gerente)
    // ─────────────────────────────────────────────────────────
    if (action === 'listar_usuarios') {
      const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 200);
      return Response.json({
        usuarios: usuarios.map(u => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role
        }))
      });
    }

    // ─────────────────────────────────────────────────────────
    // EVENTOS (de una vigilancia) — para ver el detalle
    // ─────────────────────────────────────────────────────────
    if (action === 'eventos') {
      const { vigilancia_id, limit = 200 } = body;
      if (!vigilancia_id) return Response.json({ error: 'Falta vigilancia_id' }, { status: 400 });
      const eventos = await base44.entities.VigilanciaEvento.filter(
        { vigilancia_id },
        '-timestamp',
        limit
      );
      return Response.json({ eventos });
    }

    // ─────────────────────────────────────────────────────────
    // COMPARAR (2 o 3 vigilancias, mismo o distinto rol)
    // Acepta vigilancia_a_id/b_id (legacy) o vigilancia_ids[] (hasta 3).
    // Devuelve siempre 200; si una vigilancia no existe se omite (no lanza).
    // ─────────────────────────────────────────────────────────
    if (action === 'comparar') {
      let ids = Array.isArray(body.vigilancia_ids) && body.vigilancia_ids.length > 0
        ? body.vigilancia_ids.filter(Boolean).slice(0, 3)
        : [body.vigilancia_a_id, body.vigilancia_b_id].filter(Boolean).slice(0, 3);
      ids = [...new Set(ids)];
      if (ids.length < 2) {
        return Response.json({ error: 'Se necesitan al menos 2 vigilancias para comparar' }, { status: 400 });
      }

      // Fetch resiliente: filter por id (no lanza si alguna no existe)
      let vigilanciasRaw = [];
      try {
        vigilanciasRaw = await base44.entities.VigilanciaDiagnostico.filter({ id: { $in: ids } });
      } catch {
        // fallback: get individual tolerante
        for (const id of ids) {
          try { vigilanciasRaw.push(await base44.entities.VigilanciaDiagnostico.get(id)); }
          catch {}
        }
      }
      // Ordenar según el orden pedido
      const porId = {};
      for (const v of vigilanciasRaw) porId[v.id] = v;
      const vigilancias = ids.map(id => porId[id]).filter(Boolean);

      const etiquetas = ['A', 'B', 'C'];
      const resultados = await Promise.all(vigilancias.map(async (v, i) => {
        let eventos = [];
        try {
          eventos = await base44.entities.VigilanciaEvento.filter({ vigilancia_id: v.id }, '-timestamp', 500);
        } catch { eventos = []; }
        return {
          etiqueta: etiquetas[i],
          vig: v,
          eventos,
          resumen: {
            total: eventos.length,
            errores: eventos.filter(e => e.tipo_evento === 'error').length,
            promise_rejections: eventos.filter(e => e.tipo_evento === 'promise_rejection').length,
            rutas_unicas: new Set(eventos.filter(e => e.tipo_evento === 'nav').map(e => e.ruta)).size,
            cambios_red: eventos.filter(e => e.tipo_evento === 'red').length,
            primera: eventos.length ? eventos[eventos.length - 1]?.timestamp : null,
            ultima: eventos.length ? eventos[0]?.timestamp : null
          }
        };
      }));

      const roles = resultados.map(r => r.vig.user_role_snapshot || '');
      const roles_distintos = new Set(roles.filter(Boolean)).size > 1;

      // Respuesta legacy (vig_a/vig_b/eventos_a/eventos_b) + nueva (usuarios[])
      const out = { roles_distintos, roles, usuarios: resultados };
      if (resultados[0]) {
        out.vig_a = resultados[0].vig; out.eventos_a = resultados[0].eventos; out.resumen_a = resultados[0].resumen;
      }
      if (resultados[1]) {
        out.vig_b = resultados[1].vig; out.eventos_b = resultados[1].eventos; out.resumen_b = resultados[1].resumen;
      }
      if (resultados[2]) {
        out.vig_c = resultados[2].vig; out.eventos_c = resultados[2].eventos; out.resumen_c = resultados[2].resumen;
      }
      return Response.json(out);
    }

    // ─────────────────────────────────────────────────────────
    // RESUMEN (estadísticas de una vigilancia)
    // ─────────────────────────────────────────────────────────
    if (action === 'resumen') {
      const { vigilancia_id } = body;
      if (!vigilancia_id) return Response.json({ error: 'Falta vigilancia_id' }, { status: 400 });
      const vig = await base44.entities.VigilanciaDiagnostico.get(vigilancia_id);
      const eventos = await base44.entities.VigilanciaEvento.filter(
        { vigilancia_id },
        '-timestamp',
        1000
      );
      const porTipo = {};
      for (const e of eventos) {
        porTipo[e.tipo_evento] = (porTipo[e.tipo_evento] || 0) + 1;
      }
      const rutas = {};
      for (const e of eventos) {
        if (e.tipo_evento === 'nav' && e.ruta) {
          rutas[e.ruta] = (rutas[e.ruta] || 0) + 1;
        }
      }
      return Response.json({
        vigilancia: vig,
        total_eventos: eventos.length,
        por_tipo: porTipo,
        rutas_top: Object.entries(rutas)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ruta, count]) => ({ ruta, count })),
        primera: eventos.length ? eventos[eventos.length - 1]?.timestamp : null,
        ultima: eventos.length ? eventos[0]?.timestamp : null
      });
    }

    // ────────────────────────────────────────────
    // INFORME_PERIODO — agrupa en una sola respuesta todas las vigilancias
    // (con sus eventos) cuyo período se solapa con el rango pedido, para que
    // el frontend genere un único documento consolidado. Lo pide el gerente
    // bajo demanda (no es un job programado).
    // ────────────────────────────────────────────
    if (action === 'informe_periodo') {
      const { fecha_desde, fecha_hasta, max_vigilancias = 50, max_eventos_por_vigilancia = 500 } = body;
      if (!fecha_desde || !fecha_hasta) {
        return Response.json({ error: 'Faltan fecha_desde y fecha_hasta' }, { status: 400 });
      }
      const desde = new Date(fecha_desde);
      const hasta = new Date(fecha_hasta);

      const todas = await base44.entities.VigilanciaDiagnostico.list('-fecha_inicio', 500);
      // Se incluye toda vigilancia cuyo intervalo [inicio, fin_real o fin_prevista]
      // se solape con [desde, hasta] — así no se pierden las que empezaron un
      // día y acabaron al siguiente periodo.
      const enRango = todas.filter(v => {
        const inicio = new Date(v.fecha_inicio);
        const fin = new Date(v.fecha_fin_real || v.fecha_fin_prevista);
        return inicio <= hasta && fin >= desde;
      }).slice(0, max_vigilancias);

      const vigilancias = [];
      for (const v of enRango) {
        const eventos = await base44.entities.VigilanciaEvento.filter(
          { vigilancia_id: v.id },
          '-timestamp',
          max_eventos_por_vigilancia
        ).catch(() => []);

        const rutas = {};
        for (const e of eventos) {
          if (e.tipo_evento === 'nav' && e.ruta) rutas[e.ruta] = (rutas[e.ruta] || 0) + 1;
        }

        vigilancias.push({
          vigilancia: v,
          total_eventos: eventos.length,
          rutas_top: Object.entries(rutas).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ruta, count]) => ({ ruta, count })),
          eventos
        });
      }

      return Response.json({
        fecha_desde,
        fecha_hasta,
        total_vigilancias: vigilancias.length,
        vigilancias
      });
    }

    return Response.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('gestionVigilanciaDiagnostico error:', error);
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
});