/**
 * Envío de notificaciones push nativas (app Android/iOS) desde el backend.
 *
 * Reglas:
 *  · Solo se envía desde servidor (Core.SendPushNotification está prohibido en cliente).
 *  · El contenido va en claro en la pantalla bloqueada: nunca datos personales,
 *    económicos ni el texto de un mensaje cifrado. Solo un resumen neutro.
 *  · Un fallo de envío (sin app nativa, sin credenciales Firebase, sin dispositivo)
 *    nunca interrumpe la acción principal: se registra y se sigue.
 *  · Cada envío se anota en NotificacionPushLog para poder diagnosticar.
 */

export const ROLES_GERENCIA = ['admin', 'propietario', 'gerencia', 'administracion', 'director_comercial'];
export const ROLES_SOLICITUDES = ['admin', 'propietario', 'gerencia', 'administracion'];

/** Texto corto y de una línea para la previsualización de la notificación. */
export function limpiarTexto(texto: string, max = 120): string {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

function aLista(resultado: any): any[] {
  if (Array.isArray(resultado)) return resultado;
  return resultado?.items || [];
}

/** Usuarios activos con alguno de los roles indicados. */
export async function usuariosPorRoles(base44: any, roles: string[]): Promise<any[]> {
  // La entidad User solo admite la forma posicional (query, sort, limit, skip).
  const res = await base44.asServiceRole.entities.User.filter(
    { role: { $in: roles } },
    '-created_date',
    100,
    0
  );
  return aLista(res).filter((u) => u?.email && u.estado_cuenta !== 'suspendido');
}

/** Mapa email → usuario para resolver el user_id que exige el push. */
export async function usuariosPorEmails(base44: any, emails: string[]): Promise<Record<string, any>> {
  const lista = [...new Set((emails || []).filter(Boolean))];
  if (lista.length === 0) return {};
  const res = await base44.asServiceRole.entities.User.filter(
    { email: { $in: lista } },
    '-created_date',
    100,
    0
  );
  const mapa: Record<string, any> = {};
  for (const u of aLista(res)) {
    if (u?.email) mapa[u.email] = u;
  }
  return mapa;
}

export interface DestinatarioPush {
  user_id?: string;
  user_email?: string;
}

export interface OpcionesPush {
  tipo: 'mensaje' | 'aviso' | 'solicitud' | 'prueba';
  referenciaId?: string;
  referenciaEtiqueta?: string;
  destinatarios: DestinatarioPush[];
  titulo: string;
  contenido: string;
  urlAccion?: string;
  appUrl?: string;
}

/**
 * Envía la notificación a cada destinatario y deja el rastro en el log.
 * Nunca lanza: devuelve el resumen de enviados/omitidos/errores.
 */
export async function enviarPush(base44: any, opciones: OpcionesPush) {
  const {
    tipo,
    referenciaId,
    referenciaEtiqueta,
    destinatarios = [],
    titulo,
    contenido,
    urlAccion,
    appUrl,
  } = opciones;

  const resumen = { enviados: 0, omitidos: 0, errores: 0 };

  try {
    const lista = destinatarios.filter((d) => d?.user_id || d?.user_email);
    if (lista.length === 0) return resumen;

    // Deduplicado: si el evento ya se notificó a esa persona, no se repite.
    let yaNotificados = new Set<string>();
    if (referenciaId) {
      const previos = await base44.asServiceRole.entities.NotificacionPushLog.filter(
        { tipo, referencia_id: referenciaId, estado: 'enviado' },
        { limit: 200 }
      ).catch(() => []);
      yaNotificados = new Set(aLista(previos).map((r: any) => r.user_email).filter(Boolean));
    }

    const registros: any[] = [];
    const vistos = new Set<string>();

    for (const destinatario of lista) {
      const email = destinatario.user_email || '';
      if (email) {
        if (vistos.has(email)) continue;
        vistos.add(email);
      }

      const base = {
        tipo,
        referencia_id: referenciaId || '',
        referencia_etiqueta: referenciaEtiqueta || '',
        user_id: destinatario.user_id || '',
        user_email: email,
        titulo,
        url_accion: urlAccion || '',
        enviado_en: new Date().toISOString(),
      };

      if (!destinatario.user_id) {
        resumen.omitidos += 1;
        registros.push({ ...base, estado: 'omitido', motivo: 'Usuario sin cuenta de app vinculada' });
        continue;
      }

      if (email && yaNotificados.has(email)) {
        resumen.omitidos += 1;
        registros.push({ ...base, estado: 'omitido', motivo: 'Ya notificado para este evento' });
        continue;
      }

      try {
        await base44.asServiceRole.integrations.Core.SendPushNotification({
          user_id: destinatario.user_id,
          title: titulo,
          content: contenido,
          action_label: 'Abrir',
          action_url: urlAccion || appUrl || '',
        });
        resumen.enviados += 1;
        registros.push({ ...base, estado: 'enviado' });
      } catch (error: any) {
        resumen.errores += 1;
        registros.push({
          ...base,
          estado: 'error',
          motivo: limpiarTexto(error?.message || 'Error desconocido al enviar', 200),
        });
      }
    }

    if (registros.length > 0) {
      await base44.asServiceRole.entities.NotificacionPushLog.bulkCreate(registros).catch(() => {});
    }

    return resumen;
  } catch (error: any) {
    return { ...resumen, errores: resumen.errores + 1, error: limpiarTexto(error?.message || 'Error', 200) };
  }
}