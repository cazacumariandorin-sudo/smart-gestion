
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Número único de Parte de Trabajo + código de cliente.
 *
 *   Parte:   AAAA-MM-DD-NNNN-Cxxx     ej. 2026-01-10-0100-C012
 *            · AAAA-MM-DD = fecha del parte
 *            · NNNN       = secuencial del AÑO (4 cifras). 2026 empieza en 0100; el resto de años en 0001
 *            · Cxxx       = código único de cliente
 *   Cliente: C001, C002, C003…  (secuencial, nunca se reutiliza)
 *
 * Llamadas:
 *   { work_order_id }        → asigna número al parte (y código al cliente si no lo tiene). Idempotente.
 *   { client_id }            → asigna código al cliente si no lo tiene.
 *   { modo: 'backfill' }     → (admin/gerencia/administración) asigna códigos y números pendientes, por lotes.
 */

// ---- PURE START (sin dependencias; se prueba aparte)
// Año → primer secuencial. Los años que no figuren empiezan en 1.
const SECUENCIA_INICIAL_POR_ANIO = { 2026: 100 };
const secuenciaInicial = (anio) => SECUENCIA_INICIAL_POR_ANIO[anio] ?? 1;

function partesNumero(numero) {
      const s = String(numero || '');
  let m = /^(\d{2})-(\d{2})-(\d{4})-(\d{4,})-C\d+$/.exec(s); // dd-mm-aaaa (formato actual)
  if (m) return { anio: Number(m[3]), seq: Number(m[4]) };
  m = /^(\d{4})-(\d{2})-(\d{2})-(\d{4,})-C\d+$/.exec(s); // aaaa-mm-dd (formato antiguo)
  return m ? { anio: Number(m[1]), seq: Number(m[4]) } : null;
}

function siguienteSecuencia(partes, anio) {
  let max = 0;
  for (const p of partes) {
    const n = partesNumero(p.numero_parte);
    if (n && n.anio === anio && n.seq > max) max = n.seq;
  }
  return Math.max(max + 1, secuenciaInicial(anio));
}

const formatearCodigoCliente = (n) => 'C' + String(n).padStart(3, '0');

function siguienteCodigoCliente(clientes) {
  let max = 0;
  for (const c of clientes) {
    const m = /^C(\d+)$/.exec(c.codigo_cliente || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return formatearCodigoCliente(max + 1);
}

function formatearNumeroParte(fecha, seq, codigoCliente) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha || ''));
  if (!m) throw new Error('La fecha del parte no es válida');
  return `${m[3]}-${m[2]}-${m[1]}-${String(seq).padStart(4, '0')}-${codigoCliente}`;
}

/** true si `a` se queda con el número y `b` debe reasignarse (el más antiguo gana). */
function ganaDesempate(a, b) {
  const ca = a.created_date || '';
  const cb = b.created_date || '';
  if (ca !== cb) return ca < cb;
  return String(a.id) < String(b.id);
}
// ---- PURE END

const LISTA_MAX = 2000;
const ROLES_BACKFILL = ['admin', 'propietario', 'gerencia', 'administracion'];

async function asegurarCodigoCliente(CL, clientId) {
  const cliente = await CL.get(clientId);
  if (!cliente) throw new Error('Cliente no encontrado');
  if (cliente.codigo_cliente) return cliente.codigo_cliente;

  for (let intento = 0; intento < 4; intento++) {
    const todos = await CL.list('created_date', LISTA_MAX);
    const codigo = siguienteCodigoCliente(todos);
    await CL.update(clientId, { codigo_cliente: codigo });
    const despues = await CL.list('created_date', LISTA_MAX);
    const choque = despues.some((c) => c.id !== clientId && c.codigo_cliente === codigo && ganaDesempate(c, cliente));
    if (!choque) return codigo;
  }
  throw new Error('No se pudo asignar un código de cliente único');
}

async function asignarNumeroParte(WO, CL, wo) {
  if (wo.numero_parte) return wo.numero_parte; // idempotente
  const codigo = wo.client_id ? await asegurarCodigoCliente(CL, wo.client_id) : 'C000';
  const anio = Number(String(wo.date || '').slice(0, 4));
  if (!anio) throw new Error('El parte no tiene fecha');

  for (let intento = 0; intento < 5; intento++) {
    const todos = await WO.list('-created_date', LISTA_MAX);
    const seq = siguienteSecuencia(todos, anio);
    const numero = formatearNumeroParte(wo.date, seq, codigo);
    await WO.update(wo.id, { numero_parte: numero });

    const despues = await WO.list('-created_date', LISTA_MAX);
    const choque = despues.some((r) => {
      const n = partesNumero(r.numero_parte);
      return r.id !== wo.id && n && n.anio === anio && n.seq === seq && ganaDesempate(r, wo);
    });
    if (!choque) return numero;
  }
  throw new Error('No se pudo asignar un número único tras varios intentos');
}

async function backfill(WO, CL, limite) {
  let hechos = 0;
  let asignadosClientes = 0;
  let asignadosPartes = 0;

  // 1) Clientes sin código (por antigüedad)
  const clientes = await CL.list('created_date', LISTA_MAX);
  let maxCod = 0;
  for (const c of clientes) {
    const m = /^C(\d+)$/.exec(c.codigo_cliente || '');
    if (m) maxCod = Math.max(maxCod, Number(m[1]));
  }
  const codigos = new Map(clientes.filter((c) => c.codigo_cliente).map((c) => [c.id, c.codigo_cliente]));
  for (const c of clientes.filter((c) => !c.codigo_cliente)) {
    if (hechos >= limite) break;
    maxCod++;
    const codigo = formatearCodigoCliente(maxCod);
    await CL.update(c.id, { codigo_cliente: codigo });
    codigos.set(c.id, codigo);
    hechos++; asignadosClientes++;
  }

  // 2) Partes sin número, en orden cronológico
  const partes = await WO.list('date', LISTA_MAX);
  const siguiente = new Map(); // anio → próximo secuencial
  const pendientes = partes
    .filter((p) => !p.numero_parte)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_date).localeCompare(String(b.created_date)));

  for (const p of pendientes) {
    if (hechos >= limite) break;
    const anio = Number(String(p.date || '').slice(0, 4));
    if (!anio) continue;
    let codigo = 'C000';
    if (p.client_id) {
      codigo = codigos.get(p.client_id);
      if (!codigo) continue; // cliente aún sin código (límite del lote): se hará en la siguiente llamada
    }
    if (!siguiente.has(anio)) siguiente.set(anio, siguienteSecuencia(partes, anio));
    const seq = siguiente.get(anio);
    await WO.update(p.id, { numero_parte: formatearNumeroParte(p.date, seq, codigo) });
    siguiente.set(anio, seq + 1);
    hechos++; asignadosPartes++;
  }

  const clientesPend = clientes.filter((c) => !codigos.has(c.id)).length;
  const partesPend = pendientes.filter((p) => String(p.date || '').length >= 4).length - asignadosPartes;
  return {
    success: true,
    asignados_clientes: asignadosClientes,
    asignados_partes: asignadosPartes,
    pendientes: Math.max(0, clientesPend + partesPend),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const WO = base44.asServiceRole.entities.WorkOrder;
    const CL = base44.asServiceRole.entities.Client;

    if (body.modo === 'backfill') {
      if (!ROLES_BACKFILL.includes(user.role)) {
        return Response.json({ error: 'Forbidden: requiere admin, gerencia o administración' }, { status: 403 });
      }
      return Response.json(await backfill(WO, CL, Number(body.limite) || 60));
    }

    if (body.client_id && !body.work_order_id) {
      const codigo = await asegurarCodigoCliente(CL, body.client_id);
      return Response.json({ success: true, codigo_cliente: codigo });
    }

    if (!body.work_order_id) {
      return Response.json({ error: 'work_order_id, client_id o modo=backfill requerido' }, { status: 400 });
    }
    const wo = await WO.get(body.work_order_id);
    if (!wo) return Response.json({ error: 'Parte no encontrado' }, { status: 404 });
    const numero = await asignarNumeroParte(WO, CL, wo);
    return Response.json({ success: true, numero_parte: numero, work_order_id: wo.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
