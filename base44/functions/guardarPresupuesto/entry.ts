import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { calcularDocumento } from '../../shared/presupuestoCalculo.ts';
import { ROLES_PRESUPUESTO, validarConceptos, sumarDias, conflictoPartes, conflictoExtras, soloCamposEditables } from '../../shared/presupuestoReglas.ts';

/**
 * guardarPresupuesto — crea o edita un presupuesto.
 *  - Crear: sin `id`. Edita: con `id` (solo si está en borrador).
 *  - Los importes se calculan SIEMPRE aquí (IVA por línea, redondeo por línea); lo que mande el cliente se ignora (DOC-07).
 *  - Acceso: admin, propietario, gerencia, administracion, director_comercial, ingeniero (DOC-08).
 *  - Un parte de trabajo solo puede estar en un presupuesto activo a la vez (DOC-04).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_PRESUPUESTO.includes(user.role)) {
      return Response.json({ error: 'Forbidden: no tienes permisos para gestionar presupuestos' }, { status: 403 });
    }

    const body = await req.json();
    const { id, es_duplicado_confirmado = false } = body;
    const datos: Record<string, any> = soloCamposEditables(body);

    // Líneas: se descartan las completamente vacías, se validan y se recalculan
    const conceptosEntrada = (Array.isArray(datos.conceptos) ? datos.conceptos : []).filter((c: any) =>
      c && (String(c.descripcion ?? '').trim() || Number(c.cantidad) || Number(c.precio_unitario)));
    if (conceptosEntrada.length === 0) {
      return Response.json({ error: 'Añade al menos una línea al presupuesto', code: 'SIN_LINEAS' }, { status: 400 });
    }
    const errores = validarConceptos(conceptosEntrada);
    if (errores.length) return Response.json({ error: errores[0], errores, code: 'LINEAS_NO_VALIDAS' }, { status: 400 });
    const calculo = calcularDocumento(conceptosEntrada);

    const totales = {
      conceptos: calculo.lineas,
      importe: calculo.base_imponible,
      base_imponible: calculo.base_imponible,
      iva_total: calculo.iva_total,
      total_con_iva: calculo.total_con_iva,
      desglose_iva: calculo.desglose_iva,
    };

    // ── EDITAR ───────────────────────────────────────────────────────────────
    if (id) {
      const actual = await base44.entities.Presupuesto.get(id).catch(() => null);
      if (!actual) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
      if ((actual.estado || 'borrador') !== 'borrador') {
        return Response.json({ error: 'Solo se puede editar un presupuesto en borrador. Devuélvelo a borrador para modificarlo.', code: 'NO_EDITABLE' }, { status: 409 });
      }
      const cliente_id = datos.cliente_id ?? actual.cliente_id;
      const fecha = datos.fecha ?? actual.fecha;
      if (!cliente_id || !fecha) return Response.json({ error: 'Faltan campos obligatorios: cliente y fecha', code: 'FALTAN_CAMPOS' }, { status: 400 });
      const partes = datos.partes_trabajo_ids ?? actual.partes_trabajo_ids ?? [];
      const todos = await base44.entities.Presupuesto.list('-created_date', 1000);
      const conflicto = conflictoPartes(partes, todos, id);
      if (conflicto) {
        return Response.json({ error: `Un parte ya está en el presupuesto ${conflicto.codigo_registro || conflicto.id} (${conflicto.estado})`, code: 'PARTE_YA_PRESUPUESTADO', conflicto }, { status: 409 });
      }
      const conflictoExtra = conflictoExtras(conceptosEntrada, todos, id);
      if (conflictoExtra) {
        return Response.json({ error: `Un trabajo extra ya está en el presupuesto ${conflictoExtra.codigo_registro || conflictoExtra.id} (${conflictoExtra.estado})`, code: 'EXTRA_YA_PRESUPUESTADO', conflicto: conflictoExtra }, { status: 409 });
      }
      const cambios = { ...datos, ...totales, cliente_id, fecha, valido_hasta: datos.valido_hasta || actual.valido_hasta || sumarDias(fecha, 30) };
      const actualizado = await base44.entities.Presupuesto.update(id, cambios);
      return Response.json({ success: true, data: { ...actual, ...cambios, ...(actualizado || {}) }, codigo_registro: actual.codigo_registro, mensaje: 'Presupuesto actualizado' });
    }

    // ── CREAR ────────────────────────────────────────────────────────────────
    const { cliente_id, fecha } = datos;
    if (!cliente_id || !fecha) return Response.json({ error: 'Faltan campos obligatorios: cliente y fecha', code: 'FALTAN_CAMPOS' }, { status: 400 });

    const existentes = await base44.entities.Presupuesto.list('-created_date', 1000);

    // DOC-04: un parte, un presupuesto activo
    const conflicto = conflictoPartes(datos.partes_trabajo_ids || [], existentes);
    if (conflicto) {
      return Response.json({ error: `Un parte ya está en el presupuesto ${conflicto.codigo_registro || conflicto.id} (${conflicto.estado})`, code: 'PARTE_YA_PRESUPUESTADO', conflicto }, { status: 409 });
    }

    // DOC-04: un trabajo extra, un presupuesto activo
    const conflictoExtra = conflictoExtras(conceptosEntrada, existentes);
    if (conflictoExtra) {
      return Response.json({ error: `Un trabajo extra ya está en el presupuesto ${conflictoExtra.codigo_registro || conflictoExtra.id} (${conflictoExtra.estado})`, code: 'EXTRA_YA_PRESUPUESTADO', conflicto: conflictoExtra }, { status: 409 });
    }

    // Detección de duplicados (mismo cliente, fecha, importe y al menos una línea igual), salvo confirmación manual
    if (!es_duplicado_confirmado) {
      const duplicado = existentes.find((p: any) => {
        if (p.cliente_id !== cliente_id || p.fecha !== fecha) return false;
        if (Math.abs((p.importe || 0) - totales.importe) >= 0.01) return false;
        return (p.conceptos || []).some((c2: any) => conceptosEntrada.some((c1: any) =>
          String(c1.descripcion || '').toLowerCase() === String(c2.descripcion || '').toLowerCase()));
      });
      if (duplicado) {
        return Response.json({
          error: 'Duplicado detectado', code: 'DUPLICATE_BUDGET',
          duplicado: { id: duplicado.id, titulo: duplicado.titulo, codigo_registro: duplicado.codigo_registro, fecha: duplicado.fecha, importe: duplicado.importe },
        }, { status: 409 });
      }
    }

    const tituloBase = datos.titulo || '';
    const tituloDefinitivo = es_duplicado_confirmado ? `${tituloBase}_01` : tituloBase;
    const nuevo = await base44.entities.Presupuesto.create({
      ...datos,
      ...totales,
      titulo: tituloDefinitivo || `PRES-SG-${String(fecha).split('-')[0]}-BORRADOR`,
      partes_trabajo_ids: datos.partes_trabajo_ids || [],
      valido_hasta: datos.valido_hasta || sumarDias(fecha, 30),
      es_duplicado_confirmado,
      estado: 'borrador',
      historial_estados: [{ estado: 'borrador', fecha: new Date().toISOString(), por: user.email }],
    });

    // Código de registro estandarizado (PRE-AAAA-NNNNN)
    try {
      const idResponse = await base44.functions.invoke('generarIdUnico', {
        entidad: 'Presupuesto', record_id: nuevo.id, campo_id: 'codigo_registro', anio_override: new Date(fecha).getFullYear(),
      });
      if (idResponse.data && idResponse.data.id_generado) {
        const tituloConCodigo = tituloDefinitivo || idResponse.data.id_generado;
        await base44.entities.Presupuesto.update(nuevo.id, { titulo: tituloConCodigo });
        return Response.json({
          success: true,
          data: { ...nuevo, titulo: tituloConCodigo, codigo_registro: idResponse.data.id_generado },
          codigo_registro: idResponse.data.id_generado,
          mensaje: es_duplicado_confirmado ? 'Presupuesto duplicado creado con sufijo _01' : 'Presupuesto creado correctamente',
        });
      }
    } catch (error) {
      console.error('Error generando código de registro:', error);
    }
    return Response.json({ success: true, data: nuevo, mensaje: es_duplicado_confirmado ? 'Presupuesto duplicado creado con sufijo _01' : 'Presupuesto creado correctamente' });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
