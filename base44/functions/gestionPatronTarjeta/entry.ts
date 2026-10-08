import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * gestionPatronTarjeta — aprendizaje de patrones de tarjeta (solo los 4 últimos
 * dígitos visibles en el justificante, NUNCA el número completo) para sugerir si
 * un gasto es medio de empresa o medio propio de un técnico.
 *
 * Acciones:
 * - sugerir:   { digitos } -> propuesta de origen_pago basada en patrones ya vistos.
 *              Solo roles privilegiados; nunca asume automáticamente (el frontend
 *              la muestra como sugerencia editable).
 * - registrar: { digitos, origen_pago, operario_id?, operario_name?, confirmar? }
 *              -> anota una nueva observación del patrón (incrementa veces_visto).
 *              `confirmar: true` (solo roles privilegiados) marca el patrón como
 *              confirmado = fiable para sugerencias.
 *
 * Protección contra "envenenamiento" de patrones: un usuario NO privilegiado solo
 * puede registrar observaciones como tarjeta de técnico asociada a SU PROPIO
 * Operario (derivado en servidor del usuario autenticado, no del cuerpo de la
 * petición) — nunca puede declarar una tarjeta como "de empresa", ni confirmar.
 */

const ROLES_PRIVILEGIADOS = ['admin', 'propietario', 'gerencia', 'administracion'];

function limpiarDigitos(raw) {
  const soloDigitos = String(raw || '').replace(/\D/g, '');
  // Solo los 4 últimos dígitos, siempre — aunque el cliente enviara más.
  return soloDigitos.length >= 4 ? soloDigitos.slice(-4) : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const esPrivilegiado = ROLES_PRIVILEGIADOS.includes(user.role);
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const digitos = limpiarDigitos(body.digitos);

    if (!digitos) {
      return Response.json({ success: true, sin_datos: true, motivo: 'Sin 4 dígitos válidos' });
    }

    // ── SUGERIR ────────────────────────────────────────────────────────────
    if (action === 'sugerir') {
      if (!esPrivilegiado) {
        // Un técnico crea siempre medios_propios (RLS); no hay nada que sugerirle.
        return Response.json({ success: true, sugerencia: null });
      }
      const patrones = await base44.asServiceRole.entities.PatronTarjeta.filter({ digitos_finales: digitos });
      if (!patrones || patrones.length === 0) {
        return Response.json({ success: true, sugerencia: null });
      }
      // El patrón más fiable: confirmado primero, luego el más visto.
      patrones.sort((a, b) => {
        if (!!b.confirmado !== !!a.confirmado) return b.confirmado ? 1 : -1;
        return (b.veces_visto || 0) - (a.veces_visto || 0);
      });
      const mejor = patrones[0];
      const hayConflicto = patrones.some(p => p.titular_tipo !== mejor.titular_tipo);
      return Response.json({
        success: true,
        sugerencia: {
          digitos_finales: digitos,
          titular_tipo: mejor.titular_tipo,
          origen_pago_sugerido: mejor.titular_tipo === 'empresa' ? 'medio_empresa' : 'medios_propios',
          operario_id: mejor.operario_id || null,
          operario_name: mejor.operario_name || null,
          confirmado: !!mejor.confirmado,
          veces_visto: mejor.veces_visto || 1,
          // Si la misma tarjeta se ha visto clasificada de dos formas distintas, avisar
          // en vez de dar una sugerencia aparentemente firme.
          hay_conflicto: hayConflicto,
        },
      });
    }

    // ── REGISTRAR ──────────────────────────────────────────────────────────
    if (action === 'registrar') {
      const { origen_pago, confirmar } = body;
      let titular_tipo;
      let operario_id = null;
      let operario_name = null;

      if (esPrivilegiado) {
        if (origen_pago === 'medio_empresa') {
          titular_tipo = 'empresa';
        } else if (origen_pago === 'medios_propios') {
          titular_tipo = 'tecnico';
          operario_id = body.operario_id || null;
          operario_name = body.operario_name || null;
        } else {
          // credito_proveedor u otros: no hay tarjeta propia que aprender.
          return Response.json({ success: true, ignorado: true, motivo: 'origen_pago sin tarjeta asociada' });
        }
      } else {
        // No privilegiado: solo su propia tarjeta, asociada a SU Operario real.
        const propios = await base44.asServiceRole.entities.Operario.filter({ user_email: user.email });
        const op = propios?.[0];
        if (!op) return Response.json({ success: true, ignorado: true, motivo: 'Usuario sin Operario vinculado' });
        titular_tipo = 'tecnico';
        operario_id = op.id;
        operario_name = op.name || null;
      }

      const filtro = { digitos_finales: digitos, titular_tipo };
      if (titular_tipo === 'tecnico' && operario_id) filtro.operario_id = operario_id;
      const existentes = await base44.asServiceRole.entities.PatronTarjeta.filter(filtro);
      const ahora = new Date().toISOString();

      let patron;
      if (existentes && existentes.length > 0) {
        const p = existentes[0];
        const update = {
          veces_visto: (p.veces_visto || 1) + 1,
          ultima_vez_vista: ahora,
        };
        if (confirmar === true && esPrivilegiado) {
          update.confirmado = true;
          update.confirmado_por = user.email;
          update.fecha_confirmacion = ahora;
        }
        patron = await base44.asServiceRole.entities.PatronTarjeta.update(p.id, update);
      } else {
        const nuevo = {
          digitos_finales: digitos,
          titular_tipo,
          veces_visto: 1,
          ultima_vez_vista: ahora,
          confirmado: false,
        };
        if (operario_id) { nuevo.operario_id = operario_id; nuevo.operario_name = operario_name; }
        if (confirmar === true && esPrivilegiado) {
          nuevo.confirmado = true;
          nuevo.confirmado_por = user.email;
          nuevo.fecha_confirmacion = ahora;
        }
        patron = await base44.asServiceRole.entities.PatronTarjeta.create(nuevo);
      }
      return Response.json({ success: true, patron_id: patron?.id, titular_tipo, confirmado: !!(patron?.confirmado) });
    }

    return Response.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
