import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { calcularDocumento } from '../../shared/presupuestoCalculo.ts';
import {
  ROLES_FACTURA_BORRADOR, ESTADOS_ACTIVOS, ESTADOS_ACTIVOS_FACTURA, validarConceptos, sumarDias,
  conflictoPartes, conflictoExtras, soloCamposEditablesFactura,
} from '../../shared/presupuestoReglas.ts';

/**
 * guardarFacturaBorrador — crea o edita una FACTURA BORRADOR NO OFICIAL (DOC-01).
 *  - Crear: sin `id`; o con `desde_presupuesto_id` (copia un presupuesto ACEPTADO).
 *  - Editar: con `id`, solo en estado "borrador".
 *  - Importes siempre calculados aquí (DOC-07). El número FBR-AAAA-NNNNN lo asigna el servidor (DOC-03);
 *    nunca es el número oficial: ese lo da Contasimple (DOC-02).
 *  - Acceso: propietario, gerencia, administración y dirección comercial (+ admin) (DOC-08).
 *  - Un parte o un trabajo extra solo puede estar en un documento activo (presupuesto o factura borrador) (DOC-04).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_FACTURA_BORRADOR.includes(user.role)) {
      return Response.json({ error: 'Forbidden: no tienes permisos para gestionar facturas borrador' }, { status: 403 });
    }

    const body = await req.json();
    const { id, desde_presupuesto_id, es_duplicado_confirmado = false } = body;
    let datos: Record<string, any> = soloCamposEditablesFactura(body);
    const db = base44.asServiceRole.entities;
    let origen: any = null;

    // ── Desde un presupuesto aceptado: se copian sus datos y líneas ─────────────
    if (!id && desde_presupuesto_id) {
      origen = await db.Presupuesto.get(desde_presupuesto_id).catch(() => null);
      if (!origen) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
      if ((origen.estado || 'borrador') !== 'aceptado') {
        return Response.json({ error: 'Solo se puede crear una factura borrador desde un presupuesto aceptado', code: 'PRESUPUESTO_NO_ACEPTADO' }, { status: 409 });
      }
      const todas = await db.FacturaBorrador.list('-created_date', 1000);
      const yaTiene = todas.find((f: any) => f.presupuesto_id === desde_presupuesto_id && ESTADOS_ACTIVOS_FACTURA.includes(f.estado));
      if (yaTiene) {
        return Response.json({ error: `Este presupuesto ya tiene la factura borrador ${yaTiene.codigo_registro || yaTiene.id}`, code: 'YA_TIENE_FACTURA_BORRADOR', existente: { id: yaTiene.id, codigo_registro: yaTiene.codigo_registro, estado: yaTiene.estado } }, { status: 409 });
      }
      datos = {
        cliente_id: origen.cliente_id, cliente_name: origen.cliente_name, titulo: origen.titulo,
        referencia_cliente: origen.referencia_cliente, obra_id: origen.obra_id, obra_name: origen.obra_name,
        forma_pago: origen.forma_pago, notas: origen.notas, partes_trabajo_ids: origen.partes_trabajo_ids || [],
        conceptos: origen.conceptos || [], fecha: new Date().toISOString().slice(0, 10),
        ...datos,
      };
    }

    // ── Líneas: se descartan las vacías, se validan y se recalculan ─────────────
    const conceptosEntrada = (Array.isArray(datos.conceptos) ? datos.conceptos : []).filter((c: any) =>
      c && (String(c.descripcion ?? '').trim() || Number(c.cantidad) || Number(c.precio_unitario)));
    if (conceptosEntrada.length === 0) return Response.json({ error: 'Añade al menos una línea a la factura', code: 'SIN_LINEAS' }, { status: 400 });
    const errores = validarConceptos(conceptosEntrada);
    if (errores.length) return Response.json({ error: errores[0], errores, code: 'LINEAS_NO_VALIDAS' }, { status: 400 });
    const calculo = calcularDocumento(conceptosEntrada);
    const totales = {
      conceptos: calculo.lineas, importe: calculo.base_imponible, base_imponible: calculo.base_imponible,
      iva_total: calculo.iva_total, total_con_iva: calculo.total_con_iva, desglose_iva: calculo.desglose_iva,
    };

    // ── DOC-04: partes y extras frente a otras facturas borrador y a los presupuestos activos ──
    const verConflictos = async (partes: string[], excluirFactura?: string, presupuestoOrigenId?: string) => {
      const facturas = await db.FacturaBorrador.list('-created_date', 1000);
      const presupuestos = await db.Presupuesto.list('-created_date', 1000);
      const p = conflictoPartes(partes, facturas, excluirFactura, ESTADOS_ACTIVOS_FACTURA) || conflictoPartes(partes, presupuestos, presupuestoOrigenId, ESTADOS_ACTIVOS);
      if (p) return { error: `Un parte ya está en ${p.codigo_registro || p.id} (${p.estado})`, code: 'PARTE_YA_EN_DOCUMENTO', conflicto: p };
      const e = conflictoExtras(conceptosEntrada, facturas, excluirFactura, ESTADOS_ACTIVOS_FACTURA) || conflictoExtras(conceptosEntrada, presupuestos, presupuestoOrigenId, ESTADOS_ACTIVOS);
      if (e) return { error: `Un trabajo extra ya está en ${e.codigo_registro || e.id} (${e.estado})`, code: 'EXTRA_YA_EN_DOCUMENTO', conflicto: e };
      return null;
    };

    // ── EDITAR ─────────────────────────────────────────────────────────────────
    if (id) {
      const actual = await base44.entities.FacturaBorrador.get(id).catch(() => null);
      if (!actual) return Response.json({ error: 'Factura borrador no encontrada' }, { status: 404 });
      if ((actual.estado || 'borrador') !== 'borrador') {
        return Response.json({ error: 'Solo se puede editar una factura en borrador. Devuélvela a borrador para modificarla.', code: 'NO_EDITABLE' }, { status: 409 });
      }
      const cliente_id = datos.cliente_id ?? actual.cliente_id;
      const fecha = datos.fecha ?? actual.fecha;
      if (!cliente_id || !fecha) return Response.json({ error: 'Faltan campos obligatorios: cliente y fecha', code: 'FALTAN_CAMPOS' }, { status: 400 });
      const partes = datos.partes_trabajo_ids ?? actual.partes_trabajo_ids ?? [];
      const conflicto = await verConflictos(partes, id, actual.presupuesto_id);
      if (conflicto) return Response.json(conflicto, { status: 409 });
      const cambios = { ...datos, ...totales, cliente_id, fecha, valido_hasta: datos.valido_hasta || actual.valido_hasta || sumarDias(fecha, 30) };
      const actualizado = await base44.entities.FacturaBorrador.update(id, cambios);
      return Response.json({ success: true, data: { ...actual, ...cambios, ...(actualizado || {}) }, codigo_registro: actual.codigo_registro, mensaje: 'Factura borrador actualizada' });
    }

    // ── CREAR ──────────────────────────────────────────────────────────────────
    const { cliente_id, fecha } = datos;
    if (!cliente_id || !fecha) return Response.json({ error: 'Faltan campos obligatorios: cliente y fecha', code: 'FALTAN_CAMPOS' }, { status: 400 });
    const partes = datos.partes_trabajo_ids || [];
    const conflicto = await verConflictos(partes, undefined, origen?.id);
    if (conflicto) return Response.json(conflicto, { status: 409 });

    // Duplicado (mismo cliente, fecha, base y alguna línea igual), salvo confirmación manual; no aplica al crear desde presupuesto
    if (!es_duplicado_confirmado && !origen) {
      const existentes = await db.FacturaBorrador.list('-created_date', 1000);
      const dup = existentes.find((f: any) => {
        if (!ESTADOS_ACTIVOS_FACTURA.includes(f.estado) || f.cliente_id !== cliente_id || f.fecha !== fecha) return false;
        if (Math.abs((f.importe || 0) - totales.importe) >= 0.01) return false;
        return (f.conceptos || []).some((c2: any) => conceptosEntrada.some((c1: any) => String(c1.descripcion || '').toLowerCase() === String(c2.descripcion || '').toLowerCase()));
      });
      if (dup) {
        return Response.json({ error: 'Duplicado detectado', code: 'DUPLICATE_INVOICE_DRAFT', duplicado: { id: dup.id, codigo_registro: dup.codigo_registro, titulo: dup.titulo, fecha: dup.fecha, importe: dup.importe } }, { status: 409 });
      }
    }

    const nueva = await base44.entities.FacturaBorrador.create({
      ...datos, ...totales,
      tipo_ingreso: datos.tipo_ingreso || '705',
      partes_trabajo_ids: partes,
      valido_hasta: datos.valido_hasta || sumarDias(fecha, 30),
      estado: 'borrador',
      ...(origen ? { presupuesto_id: origen.id, presupuesto_codigo: origen.codigo_registro } : {}),
      historial_estados: [{ estado: 'borrador', fecha: new Date().toISOString(), por: user.email }],
    });

    // Número propio FBR-AAAA-NNNNN (nunca el oficial). Si no se puede asignar, no se deja un borrador huérfano.
    let codigo = '';
    try {
      const r = await base44.functions.invoke('generarIdUnico', {
        entidad: 'FacturaBorrador', record_id: nueva.id, campo_id: 'codigo_registro', anio_override: Number(String(fecha).slice(0, 4)),
      });
      codigo = r?.data?.id_generado || '';
    } catch (error) {
      console.error('Error generando el número del borrador:', error);
    }
    if (!codigo) {
      await base44.entities.FacturaBorrador.delete(nueva.id).catch(() => null);
      return Response.json({ error: 'No se pudo asignar el número del borrador. Inténtalo de nuevo.', code: 'SIN_NUMERO' }, { status: 500 });
    }
    return Response.json({ success: true, data: { ...nueva, codigo_registro: codigo }, codigo_registro: codigo, mensaje: origen ? 'Factura borrador creada desde el presupuesto' : 'Factura borrador creada' });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
