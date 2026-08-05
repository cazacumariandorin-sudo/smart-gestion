import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Registro SILENCIOSO de eventos de telemetría para usuarios bajo vigilancia.
 * El usuario no debe notar diferencia en el funcionamiento.
 *
 * Comportamiento:
 *  - Recibe un array de eventos del cliente (batch).
 *  - Comprueba (con service role) si existe una vigilancia ACTIVA para el email del caller.
 *  - Si no hay vigilancia activa → devuelve 200 sin escribir nada (silencio absoluto).
 *  - Si hay → escribe los eventos como service role (bypass RLS, el user no tiene permisos).
 *  - Cualquier error se traga y devuelve 200: el frontend jamás debe notar fallos.
 *
 * Rate limit defensivo: máximo 100 eventos por llamada.
 */
const MAX_EVENTOS_LOTE = 100;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, ignorado: true }, { status: 200 });
    }

    const body = await req.json().catch(() => ({}));
    const eventos = Array.isArray(body.eventos) ? body.eventos.slice(0, MAX_EVENTOS_LOTE) : [];

    if (eventos.length === 0) {
      return Response.json({ success: true, registrados: 0 });
    }

    // Buscar vigilancia activa para este usuario (service role, bypass RLS)
    const ahora = new Date();
    let vigilancia = null;
    try {
      const vig = await base44.asServiceRole.entities.VigilanciaDiagnostico.filter({
        user_email: user.email,
        estado: 'activa'
      });
      vigilancia = (vig || []).find(v => new Date(v.fecha_fin_prevista) > ahora) || null;
    } catch (e) {
      // Silencioso: no propagamos el error al cliente
      return Response.json({ success: false, ignorado: true }, { status: 200 });
    }

    if (!vigilancia) {
      // No hay vigilancia activa para este usuario → no escribir nada.
      // Devolvemos 200 normal para no despertar sospechas en Network tab.
      return Response.json({ success: true, registrados: 0, vigilancia: false });
    }

    // Validar + normalizar eventos
    const records = eventos
      .filter(e => e && typeof e.tipo_evento === 'string')
      .map(e => ({
        vigilancia_id: vigilancia.id,
        user_email: user.email,
        tipo_evento: e.tipo_evento,
        timestamp: e.timestamp || ahora.toISOString(),
        ruta: typeof e.ruta === 'string' ? e.ruta : '',
        datos: (e.datos && typeof e.datos === 'object') ? e.datos : {}
      }));

    if (records.length === 0) {
      return Response.json({ success: true, registrados: 0 });
    }

    try {
      await base44.asServiceRole.entities.VigilanciaEvento.bulkCreate(records);
    } catch (bulkErr) {
      // Fallback: insertar uno a uno
      for (const r of records) {
        try {
          await base44.asServiceRole.entities.VigilanciaEvento.create(r);
        } catch {}
      }
    }

    // Actualizar contador cache de eventos (best effort, no blocking)
    base44.asServiceRole.entities.VigilanciaDiagnostico.update(vigilancia.id, {
      eventos_count: (vigilancia.eventos_count || 0) + records.length
    }).catch(() => {});

    return Response.json({ success: true, registrados: records.length });
  } catch (error) {
    // Silencio absoluto: cualquier fallo se traga.
    console.error('registrarEventoVigilancia (silenciado):', error?.message || error);
    return Response.json({ success: false, ignorado: true }, { status: 200 });
  }
});