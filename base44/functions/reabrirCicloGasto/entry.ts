/**
 * reabrirCicloGasto — Reabre un ciclo de gastos cerrado (pendiente_pago / pagada /
 * en_contabilidad) para auditoría, bajo DOBLE AUTENTICACIÓN:
 *   1) El usuario debe tener rol gerencia / administración / admin / propietario.
 *   2) Debe introducir un PIN que se verifica contra el secret REAPERTURA_CICLO_PIN.
 *
 * Al reabrir:
 *  - estado vuelve a 'enviada' (operario puede seguir añadiendo / corrigiendo).
 *  - Se limpia fecha_cierre, pagado_por, fecha_pago.
 *  - Se registra auditoría: reabierto_por, fecha_reapertura, motivo_reapertura.
 *
 * El operario NO puede reabrir por sí mismo: la reapertura es exclusiva de
 * gerencia/administración con PIN.
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const cors = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const user = await base44.auth.me();
    if (!user) return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: cors });

    const role = user.role || "";
    const rolesPermitidos = ["admin", "propietario", "gerencia", "administracion"];
    if (!rolesPermitidos.includes(role)) {
      return new Response(JSON.stringify({ error: "Solo gerencia o administración pueden reabrir un ciclo" }), { status: 403, headers: cors });
    }

    const body = await req.json();
    const { nota_id, pin, motivo } = body || {};
    if (!nota_id) return new Response(JSON.stringify({ error: "Falta nota_id" }), { status: 400, headers: cors });
    if (!pin) return new Response(JSON.stringify({ error: "Debe introducir el PIN de reapertura" }), { status: 400, headers: cors });
    if (!motivo || !motivo.trim()) return new Response(JSON.stringify({ error: "Debe indicar el motivo de auditoría" }), { status: 400, headers: cors });

    // Verificar el PIN contra el secret
    const pinConfigurado = process.env.REAPERTURA_CICLO_PIN;
    if (!pinConfigurado) {
      return new Response(JSON.stringify({ error: "PIN de reapertura no configurado. Defina el secret REAPERTURA_CICLO_PIN en el panel de Secrets de la app." }), { status: 500, headers: cors });
    }
    if (String(pin).trim() !== String(pinConfigurado).trim()) {
      return new Response(JSON.stringify({ error: "PIN incorrecto. Reapertura denegada." }), { status: 403, headers: cors });
    }

    // Solo se pueden reabrir ciclos en estados cerrados
    const nota = await base44.entities.NotaMensualGasto.get(nota_id);
    const estadosCerrados = ["pendiente_pago", "pagada", "en_contabilidad"];
    if (!estadosCerrados.includes(nota.estado)) {
      return new Response(JSON.stringify({ error: `El ciclo no está cerrado (estado actual: ${nota.estado}). Solo se reabren ciclos cerrados.` }), { status: 400, headers: cors });
    }

    await base44.entities.NotaMensualGasto.update(nota_id, {
      estado: "enviada",
      fecha_cierre: null,
      pagado_por: null,
      fecha_pago: null,
      reabierto_por: user.email,
      fecha_reapertura: new Date().toISOString(),
      motivo_reapertura: motivo.trim(),
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Ciclo ${nota.numero_ciclo || nota.ciclo_mes} reabierto por ${user.email}`,
      reabierto_por: user.email,
    }), { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Error al reabrir el ciclo" }), { status: 500, headers: cors });
  }
});