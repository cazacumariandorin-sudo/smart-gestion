import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ROLES_FACTURA_BORRADOR, ESTADOS_FACTURA, ESTADOS_ACTIVOS, ESTADOS_ACTIVOS_FACTURA, transicionFacturaPermitida,
  validarNumeroOficial, numeroOcupado, nifProvisional, conflictoPartes, conflictoExtras,
} from '../../shared/presupuestoReglas.ts';
import { nifValido } from '../../shared/ivaCompras.ts';

/**
 * cambiarEstadoFacturaBorrador — borrador → preparada (Excel para Contasimple) → borrador | anulada.
 * Para PREPARAR se exige (DOC-02, DOC-05):
 *   - importe > 0;
 *   - número oficial confirmado por una persona: no vacío, sin prefijo de borrador/prueba y que NO exista ya en el libro de IVA
 *     ni en otra factura borrador;
 *   - cliente con NIF: válido, o provisional (permitido con aviso solo si es único entre los clientes).
 * "emitida" no se puede poner a mano: llegará al vincular la factura oficial (fase posterior).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_FACTURA_BORRADOR.includes(user.role)) {
      return Response.json({ error: 'Forbidden: no tienes permisos para gestionar facturas borrador' }, { status: 403 });
    }

    const { id, estado, motivo, numero_oficial, tipo_ingreso } = await req.json();
    if (!id || !estado) return Response.json({ error: 'Faltan id y estado', code: 'FALTAN_CAMPOS' }, { status: 400 });
    if (!(ESTADOS_FACTURA as readonly string[]).includes(estado)) return Response.json({ error: 'Estado no válido', code: 'ESTADO_NO_VALIDO' }, { status: 400 });

    const db = base44.asServiceRole.entities;
    const f = await base44.entities.FacturaBorrador.get(id).catch(() => null);
    if (!f) return Response.json({ error: 'Factura borrador no encontrada' }, { status: 404 });
    const de = f.estado || 'borrador';
    if (!transicionFacturaPermitida(de, estado)) {
      return Response.json({ error: `No se puede pasar de "${de}" a "${estado}"`, code: 'TRANSICION_NO_PERMITIDA', de, a: estado }, { status: 409 });
    }

    const cambios: Record<string, any> = { estado };
    const avisos: string[] = [];

    if (estado === 'preparada') {
      const hayImporte = (f.conceptos || []).some((c: any) => c.tipo !== 'texto') && Number(f.importe) > 0;
      if (!hayImporte) return Response.json({ error: 'Una factura sin importe no se puede preparar: pon precio a las líneas', code: 'SIN_IMPORTE' }, { status: 400 });

      const errNumero = validarNumeroOficial(numero_oficial);
      if (errNumero) return Response.json({ error: errNumero, code: 'NUMERO_OFICIAL_NO_VALIDO' }, { status: 400 });
      const numero = String(numero_oficial).trim();

      const libro = await db.FacturaIVA.filter({ tipo: 'emitida' }, '-fecha_factura', 5000);
      const enLibro = numeroOcupado(numero, libro, 'numero_factura');
      if (enLibro) {
        return Response.json({ error: `El número ${numero} ya existe en el libro de IVA (factura del ${enLibro.fecha_factura || 's/f'})`, code: 'NUMERO_OFICIAL_EXISTENTE', factura: { numero_factura: enLibro.numero_factura, fecha_factura: enLibro.fecha_factura } }, { status: 409 });
      }
      const otras = await db.FacturaBorrador.list('-created_date', 1000);
      const repetido = numeroOcupado(numero, otras.filter((o: any) => o.estado !== 'anulada'), 'numero_oficial', id);
      if (repetido) {
        return Response.json({ error: `El número ${numero} ya está asignado a la factura borrador ${repetido.codigo_registro || repetido.id}`, code: 'NUMERO_OFICIAL_REPETIDO' }, { status: 409 });
      }

      // DOC-05: el cliente se vincula en Contasimple por NIF
      const cliente = await db.Client.get(f.cliente_id).catch(() => null);
      const nif = String(cliente?.nif ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!cliente) return Response.json({ error: 'El cliente de la factura no existe', code: 'CLIENTE_NO_ENCONTRADO' }, { status: 404 });
      if (!nif) return Response.json({ error: 'El cliente no tiene NIF: sin él Contasimple no puede vincularlo y crearía uno nuevo', code: 'CLIENTE_SIN_NIF' }, { status: 400 });
      if (!nifValido(nif)) {
        if (!nifProvisional(nif)) return Response.json({ error: `El NIF del cliente (${nif}) no es válido ni provisional: corrígelo antes de preparar la factura`, code: 'NIF_NO_VALIDO' }, { status: 400 });
        const clientes = await db.Client.list('name', 1000);
        const mismos = clientes.filter((c: any) => String(c.nif ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') === nif);
        if (mismos.length > 1) return Response.json({ error: `El NIF provisional ${nif} lo comparten ${mismos.length} clientes: debe ser único`, code: 'NIF_PROVISIONAL_REPETIDO' }, { status: 409 });
        avisos.push(`El cliente tiene un NIF provisional (${nif}). Si luego se cambia por el real, hay que cambiarlo también en Contasimple o se creará un cliente nuevo.`);
      }

      cambios.numero_oficial = numero;
      cambios.preparada_fecha = new Date().toISOString();
      if (tipo_ingreso !== undefined && ['705', '700'].includes(String(tipo_ingreso))) cambios.tipo_ingreso = String(tipo_ingreso);
    }

    if (de === 'preparada' && estado === 'borrador') { cambios.numero_oficial = ''; cambios.preparada_fecha = ''; }

    if (de === 'anulada' && estado === 'borrador') {
      const facturas = await db.FacturaBorrador.list('-created_date', 1000);
      const presupuestos = await db.Presupuesto.list('-created_date', 1000);
      const p = conflictoPartes(f.partes_trabajo_ids || [], facturas, id, ESTADOS_ACTIVOS_FACTURA) || conflictoPartes(f.partes_trabajo_ids || [], presupuestos, f.presupuesto_id, ESTADOS_ACTIVOS);
      const e = conflictoExtras(f.conceptos || [], facturas, id, ESTADOS_ACTIVOS_FACTURA) || conflictoExtras(f.conceptos || [], presupuestos, f.presupuesto_id, ESTADOS_ACTIVOS);
      const c = p || e;
      if (c) return Response.json({ error: `Un parte o trabajo extra ya está en ${c.codigo_registro || c.id} (${c.estado})`, code: p ? 'PARTE_YA_EN_DOCUMENTO' : 'EXTRA_YA_EN_DOCUMENTO', conflicto: c }, { status: 409 });
    }

    const entrada: Record<string, any> = { estado, fecha: new Date().toISOString(), por: user.email };
    if (motivo) entrada.motivo = String(motivo).slice(0, 500);
    if (cambios.numero_oficial) entrada.motivo = [entrada.motivo, `Nº oficial confirmado: ${cambios.numero_oficial}`].filter(Boolean).join(' · ');
    const historial = [...(f.historial_estados || []), entrada];
    await base44.entities.FacturaBorrador.update(id, { ...cambios, historial_estados: historial });
    return Response.json({ success: true, data: { ...f, ...cambios, historial_estados: historial }, avisos, mensaje: `Estado: ${estado}` });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
