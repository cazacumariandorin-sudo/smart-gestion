import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  ROLES_GERENCIA,
  ROLES_SOLICITUDES,
  enviarPush,
  limpiarTexto,
  usuariosPorRoles,
} from '../../shared/pushNotificaciones.ts';

/**
 * Notificación push de avisos y solicitudes.
 *
 * Se invoca desde el workflow de AsistenteTarea (create) y desde la app para
 * enviar una notificación de prueba. Los destinatarios SIEMPRE se resuelven aquí,
 * en servidor, a partir del registro: nunca los elige el cliente.
 *
 * Los avisos y solicitudes son registros internos: el texto del push es neutro
 * (no incluye datos de clientes, importes ni datos personales).
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Puede llamarla un workflow (sin usuario) o una persona autorizada.
    const user = await base44.auth.me().catch(() => null);
    if (user && !['admin', 'propietario', 'gerencia', 'administracion'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo Gerencia o Administración' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const tipo = body?.tipo || 'auto';
    const appUrl = req.headers.get('X-Base44-App-Url') || 'https://smart-gestion.base44.app';

    // ── Notificación de prueba: solo a quien la pide ────────────────────────
    if (tipo === 'prueba') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const resumen = await enviarPush(base44, {
        tipo: 'prueba',
        referenciaEtiqueta: 'Notificación de prueba',
        destinatarios: [{ user_id: user.id, user_email: user.email }],
        titulo: 'Notificación de prueba',
        contenido: 'Si ves este aviso, las notificaciones push están activas.',
        urlAccion: `${appUrl}/`,
        appUrl,
      });
      return Response.json({ success: true, ...resumen });
    }

    // ── Aviso o solicitud de una tarea interna ──────────────────────────────
    const referenciaId = body?.referencia_id || body?.tarea_id;
    if (!referenciaId) {
      return Response.json({ error: 'Falta referencia_id' }, { status: 400 });
    }

    const tarea = await base44.asServiceRole.entities.AsistenteTarea
      .get(referenciaId)
      .catch((e: any) => (e?.status === 404 ? null : Promise.reject(e)));
    if (!tarea) return Response.json({ error: 'Tarea no encontrada' }, { status: 404 });

    // Sin usuario solo la llama el workflow del evento: únicamente avisos recién
    // creados, para que nadie pueda reenviar avisos antiguos por su id.
    if (!user) {
      const creada = new Date(tarea.created_date || 0).getTime();
      if (!creada || Date.now() - creada > 15 * 60 * 1000) {
        return Response.json({ success: true, skipped: true, motivo: 'Aviso no reciente' });
      }
    }

    // Notas internas y privadas no generan avisos.
    if (['nota_interna', 'nota_privada'].includes(tarea.tipo)) {
      return Response.json({ success: true, skipped: true, motivo: 'Nota interna sin aviso' });
    }

    const esSolicitud = tipo === 'solicitud' || Boolean(tarea.origen_solicitud);
    const asignada = Boolean(tarea.asignada_a_user_id);

    let destinatarios: { user_id?: string; user_email?: string }[] = [];

    if (asignada) {
      const usuario = await base44.asServiceRole.entities.User
        .filter({ id: tarea.asignada_a_user_id }, '-created_date', 1, 0)
        .then((r: any) => (Array.isArray(r) ? r : r?.items || []))
        .catch(() => []);
      destinatarios = (usuario || []).map((u: any) => ({ user_id: u.id, user_email: u.email }));
    } else {
      const roles = tarea.solo_gerencia ? ROLES_GERENCIA : ROLES_SOLICITUDES;
      const usuarios = await usuariosPorRoles(base44, roles);
      destinatarios = usuarios.map((u: any) => ({ user_id: u.id, user_email: u.email }));
    }

    // Quien crea el aviso no necesita recibirlo.
    destinatarios = destinatarios.filter(
      (d) => d.user_email && d.user_email !== tarea.created_by && d.user_email !== user?.email
    );

    const titulo = esSolicitud
      ? 'Nueva solicitud'
      : asignada
        ? 'Nueva tarea asignada'
        : 'Nuevo aviso';

    const contenido = esSolicitud
      ? 'Pendiente de revisión por Gerencia o Administración.'
      : limpiarTexto(tarea.titulo || 'Tienes un aviso pendiente de revisar', 100);

    const resumen = await enviarPush(base44, {
      tipo: esSolicitud ? 'solicitud' : 'aviso',
      referenciaId,
      referenciaEtiqueta: limpiarTexto(tarea.titulo || '', 80),
      destinatarios,
      titulo,
      contenido,
      urlAccion: `${appUrl}/`,
      appUrl,
    });

    return Response.json({ success: true, esSolicitud, ...resumen });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}