import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { ROLES_PRESUPUESTO, ESTADOS, transicionPermitida, conflictoPartes, conflictoExtras } from '../../shared/presupuestoReglas.ts';

/**
 * cambiarEstadoPresupuesto — cambia el estado respetando las transiciones permitidas y deja registro.
 *  borrador → enviado → aceptado | rechazado | borrador;  rechazado → borrador.
 *  Un presupuesto sin importe no se puede enviar. Al reactivar un rechazado se comprueba que sus partes sigan libres (DOC-04).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_PRESUPUESTO.includes(user.role)) {
      return Response.json({ error: 'Forbidden: no tienes permisos para gestionar presupuestos' }, { status: 403 });
    }

    const { id, estado, motivo } = await req.json();
    if (!id || !estado) return Response.json({ error: 'Faltan id y estado', code: 'FALTAN_CAMPOS' }, { status: 400 });
    if (!(ESTADOS as readonly string[]).includes(estado)) return Response.json({ error: 'Estado no válido', code: 'ESTADO_NO_VALIDO' }, { status: 400 });

    const p = await base44.entities.Presupuesto.get(id).catch(() => null);
    if (!p) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    const de = p.estado || 'borrador';
    if (!transicionPermitida(de, estado)) {
      return Response.json({ error: `No se puede pasar de "${de}" a "${estado}"`, code: 'TRANSICION_NO_PERMITIDA', de, a: estado }, { status: 409 });
    }
    if (estado === 'enviado') {
      const hayImporte = (p.conceptos || []).some((c: any) => c.tipo !== 'texto') && Number(p.importe) > 0;
      if (!hayImporte) return Response.json({ error: 'Un presupuesto sin importe no se puede enviar: pon precio a las líneas', code: 'SIN_IMPORTE' }, { status: 400 });
    }
    if (de === 'rechazado' && estado === 'borrador') {
      const todos = await base44.entities.Presupuesto.list('-created_date', 1000);
      const conflicto = conflictoPartes(p.partes_trabajo_ids || [], todos, id);
      if (conflicto) {
        return Response.json({ error: `Un parte ya está en el presupuesto ${conflicto.codigo_registro || conflicto.id} (${conflicto.estado})`, code: 'PARTE_YA_PRESUPUESTADO', conflicto }, { status: 409 });
      }
      const conflictoExtra = conflictoExtras(p.conceptos || [], todos, id);
      if (conflictoExtra) {
        return Response.json({ error: `Un trabajo extra ya está en el presupuesto ${conflictoExtra.codigo_registro || conflictoExtra.id} (${conflictoExtra.estado})`, code: 'EXTRA_YA_PRESUPUESTADO', conflicto: conflictoExtra }, { status: 409 });
      }
    }

    const entrada: Record<string, any> = { estado, fecha: new Date().toISOString(), por: user.email };
    if (motivo) entrada.motivo = String(motivo).slice(0, 500);
    const historial = [...(p.historial_estados || []), entrada];
    await base44.entities.Presupuesto.update(id, { estado, historial_estados: historial });
    return Response.json({ success: true, data: { ...p, estado, historial_estados: historial }, mensaje: `Estado: ${estado}` });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
