/**
 * Pruebas de la factura borrador (Fase 3): funciones del servidor con base de datos y usuarios simulados.
 * Ejecutar desde la raíz del proyecto:   node --experimental-strip-types base44/shared/facturaBorrador.test.mjs
 * Cubre DOC-01 a DOC-08: no oficial, número oficial confirmado por una persona, series propias, partes y extras
 * en un solo documento, NIF del cliente, importes calculados en el servidor y acceso por rol.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FUNCIONES = path.resolve(AQUI, '../functions');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factura-borrador-test-'));
fs.mkdirSync(path.join(tmp, 'shared'));
for (const f of fs.readdirSync(AQUI).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) fs.copyFileSync(path.join(AQUI, f), path.join(tmp, 'shared', f));
fs.writeFileSync(path.join(tmp, 'mock-sdk.mjs'), `
const PREF = { Presupuesto: 'PRE', FacturaBorrador: 'FBR' };
function entidad(nombre) {
  const ctx = globalThis.__ctx; const rec = (v) => JSON.parse(JSON.stringify(v));
  const tabla = () => (ctx.db[nombre] ||= []);
  return {
    list: async () => tabla().map(rec).reverse(),
    filter: async (q = {}) => tabla().filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).map(rec),
    get: async (id) => { const r = tabla().find((x) => x.id === id); if (!r) throw new Error('not found'); return rec(r); },
    create: async (o) => { const r = { id: nombre[0] + (tabla().length + 1), ...rec(o) }; tabla().push(r); return rec(r); },
    update: async (id, patch) => { const r = tabla().find((x) => x.id === id); Object.assign(r, rec(patch)); return rec(r); },
    delete: async (id) => { const i = tabla().findIndex((x) => x.id === id); if (i < 0) throw new Error('not found'); tabla().splice(i, 1); return {}; },
  };
}
export function createClientFromRequest(_req) {
  const ctx = globalThis.__ctx;
  const entities = new Proxy({}, { get: (_t, n) => entidad(n) });
  return { auth: { me: async () => ctx.user }, entities, asServiceRole: { entities },
    functions: { invoke: async (_n, p) => {
      if (ctx.fallarNumeracion) throw new Error('sin numeración');
      const t = (ctx.db[p.entidad] ||= []); const n = t.filter((x) => x.codigo_registro).length + 1;
      const cod = PREF[p.entidad] + '-' + p.anio_override + '-' + String(n).padStart(5, '0'); t.find((x) => x.id === p.record_id).codigo_registro = cod; return { data: { id_generado: cod } }; } } };
}`);
for (const n of ['guardarFacturaBorrador', 'cambiarEstadoFacturaBorrador', 'guardarPresupuesto', 'cambiarEstadoPresupuesto']) {
  fs.mkdirSync(path.join(tmp, 'functions', n), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'functions', n, 'entry.ts'), fs.readFileSync(path.join(FUNCIONES, n, 'entry.ts'), 'utf8').replace('npm:@base44/sdk@0.8.31', '../../mock-sdk.mjs'));
}
const H = {};
globalThis.Deno = { serve: (h) => { globalThis.__ultimo = h; } };
for (const [k, n] of [['guardar', 'guardarFacturaBorrador'], ['estado', 'cambiarEstadoFacturaBorrador'], ['guardarP', 'guardarPresupuesto'], ['estadoP', 'cambiarEstadoPresupuesto']]) {
  await import(pathToFileURL(path.join(tmp, 'functions', n, 'entry.ts')).href); H[k] = globalThis.__ultimo;
}

let ok = 0, fail = 0;
const t = (n, c, x = '') => { c ? ok++ : (fail++, console.log('FALLA', n, x)); };
const llamar = async (fn, user, body) => { globalThis.__ctx.user = user; const rs = await H[fn](new Request('http://x/', { method: 'POST', body: JSON.stringify(body) })); return { s: rs.status, j: await rs.json() }; };
const U = (role) => ({ role, email: role + '@simantec.es' });
const L = (d, c, p, iva = 21, extra = {}) => ({ descripcion: d, cantidad: c, precio_unitario: p, iva_pct: iva, ...extra });
const T = (d) => ({ tipo: 'texto', descripcion: d });
const nuevoCtx = () => { globalThis.__ctx = { db: { Client: [{ id: 'cl1', name: 'REGENERA', nif: 'B02662823' }], FacturaIVA: [{ id: 'iva1', tipo: 'emitida', numero_factura: '2026-0103', fecha_factura: '2026-10-19' }] }, user: null }; };
nuevoCtx();
const fb = () => globalThis.__ctx.db.FacturaBorrador;
const base = (extra = {}) => ({ cliente_id: 'cl1', cliente_name: 'REGENERA', fecha: '2026-10-19', conceptos: [T('INSTALACIÓN SOLAR'), L('pos 01 salvateja', 70, 7.25), L('pos 02 taco', 140, 0.9), L('pos 03 espuma', 2, 12)], ...extra });

// ═══ Permisos (DOC-08): propietario, gerencia, administración, dirección comercial (+ admin). Ingeniero NO. ═══
for (const rol of ['técnico', 'operario', 'ingeniero', 'contabilidad', 'jefe_obra', 'control_horario', 'cliente_obra', 'usuario_demo']) {
  t(`${rol} no puede guardar facturas borrador (403)`, (await llamar('guardar', U(rol), base())).s === 403);
  t(`${rol} no puede cambiar su estado (403)`, (await llamar('estado', U(rol), { id: 'x', estado: 'preparada' })).s === 403);
}
t('sin usuario → 401', (await llamar('guardar', null, base())).s === 401);
t('con los roles sin acceso no se creó nada', (fb() || []).length === 0);

// ═══ Crear ═══════════════════════════════════════════════════════════════════
let r = await llamar('guardar', U('gerencia'), base({ importe: 999, estado: 'emitida', codigo_registro: 'FALSO', numero_oficial: '2026-0104', presupuesto_id: 'pX', tipo_ingreso: '999' }));
const f1 = fb()[0];
t('crear: totales del servidor (657,50 / 138,08 / 795,58) e ignora importe, estado, código, nº oficial y presupuesto del cliente', r.s === 200 && f1.importe === 657.5 && f1.iva_total === 138.08 && f1.total_con_iva === 795.58 && f1.estado === 'borrador' && f1.codigo_registro === 'FBR-2026-00001' && !f1.numero_oficial && !f1.presupuesto_id, JSON.stringify(r.j));
t('crear: tipo de ingreso inválido se ignora (705 por defecto), vencimiento +30 días y autor en el historial', f1.tipo_ingreso === '705' && f1.valido_hasta === '2026-11-18' && f1.historial_estados[0].por === 'gerencia@simantec.es');
for (const rol of ['admin', 'propietario', 'administracion', 'director_comercial']) t(`${rol} puede guardar`, (await llamar('guardar', U(rol), base({ cliente_id: 'c-' + rol }))).s === 200);
t('tipo de ingreso 700 (mercaderías) se respeta', (await llamar('guardar', U('gerencia'), base({ cliente_id: 'c700', tipo_ingreso: '700' }))).s === 200 && fb().find((x) => x.cliente_id === 'c700').tipo_ingreso === '700');
t('sin líneas / IVA 7 % / sin cliente → 400', (await llamar('guardar', U('gerencia'), base({ conceptos: [] }))).j.code === 'SIN_LINEAS' && (await llamar('guardar', U('gerencia'), base({ cliente_id: 'c9', conceptos: [L('x', 1, 1, 7)] }))).j.code === 'LINEAS_NO_VALIDAS' && (await llamar('guardar', U('gerencia'), base({ cliente_id: '' }))).j.code === 'FALTAN_CAMPOS');
r = await llamar('guardar', U('gerencia'), base());
t('duplicado exacto → 409 DUPLICATE_INVOICE_DRAFT', r.s === 409 && r.j.code === 'DUPLICATE_INVOICE_DRAFT' && r.j.duplicado.codigo_registro === 'FBR-2026-00001');
t('duplicado confirmado → 200', (await llamar('guardar', U('gerencia'), base({ es_duplicado_confirmado: true }))).s === 200);
const antes = fb().length; globalThis.__ctx.fallarNumeracion = true;
r = await llamar('guardar', U('gerencia'), base({ cliente_id: 'c-sin-numero' }));
t('si no se puede numerar, error y no queda un borrador huérfano', r.s === 500 && r.j.code === 'SIN_NUMERO' && fb().length === antes);
globalThis.__ctx.fallarNumeracion = false;

// ═══ Desde un presupuesto ACEPTADO ═══════════════════════════════════════════
nuevoCtx();
const pres = (o) => { globalThis.__ctx.db.Presupuesto ||= []; const p = { id: 'P' + (globalThis.__ctx.db.Presupuesto.length + 1), codigo_registro: 'PRE-2026-0000' + (globalThis.__ctx.db.Presupuesto.length + 1), cliente_id: 'cl1', cliente_name: 'REGENERA', titulo: 'Camino Viejo', fecha: '2026-10-10', obra_id: 'o1', obra_name: 'Camino Viejo', forma_pago: 'Transferencia', referencia_cliente: 'MAD-P-2607-148', partes_trabajo_ids: ['pt1'], conceptos: [L('Salvateja', 70, 7.25, 21, { parte_id: 'pt1' }), L('Cambio luminarias', 1, 350, 21, { extra_id: 'x1' })], estado: 'aceptado', ...o }; globalThis.__ctx.db.Presupuesto.push(p); return p; };
const pAcept = pres({}), pEnviado = pres({ estado: 'enviado', partes_trabajo_ids: ['pt2'], conceptos: [L('otro', 1, 10)] });
t('desde un presupuesto que NO está aceptado → 409', (await llamar('guardar', U('gerencia'), { desde_presupuesto_id: pEnviado.id })).j.code === 'PRESUPUESTO_NO_ACEPTADO');
t('desde un presupuesto inexistente → 404', (await llamar('guardar', U('gerencia'), { desde_presupuesto_id: 'nope' })).s === 404);
r = await llamar('guardar', U('gerencia'), { desde_presupuesto_id: pAcept.id, fecha: '2026-11-03' });
const fp = fb()[0];
t('desde presupuesto aceptado: copia cliente, obra, pedido y líneas (con su parte y extra de origen)', r.s === 200 && fp.cliente_id === 'cl1' && fp.obra_id === 'o1' && fp.referencia_cliente === 'MAD-P-2607-148' && fp.conceptos.some((c) => c.parte_id === 'pt1') && fp.conceptos.some((c) => c.extra_id === 'x1'), JSON.stringify(r.j));
t('desde presupuesto: enlaza con su origen, fecha pedida y totales del servidor (507,50 + 350 = 857,50 + IVA 180,08 = 1.037,58)', fp.presupuesto_id === pAcept.id && fp.presupuesto_codigo === pAcept.codigo_registro && fp.fecha === '2026-11-03' && fp.importe === 857.5 && fp.iva_total === 180.08 && fp.total_con_iva === 1037.58, JSON.stringify([fp.importe, fp.iva_total, fp.total_con_iva]));
t('el presupuesto de origen NO se marca facturado (eso llega con la factura oficial)', globalThis.__ctx.db.Presupuesto[0].estado === 'aceptado');
r = await llamar('guardar', U('gerencia'), { desde_presupuesto_id: pAcept.id });
t('un presupuesto no genera dos facturas borrador activas → 409 YA_TIENE_FACTURA_BORRADOR', r.s === 409 && r.j.code === 'YA_TIENE_FACTURA_BORRADOR' && r.j.existente.codigo_registro === fp.codigo_registro);
// Cruce con presupuestos y facturas (DOC-04)
r = await llamar('guardar', U('gerencia'), base({ cliente_id: 'cx', partes_trabajo_ids: ['pt2'] }));
t('un parte que está en OTRO presupuesto activo no se puede facturar → 409', r.s === 409 && r.j.code === 'PARTE_YA_EN_DOCUMENTO', JSON.stringify(r.j));
r = await llamar('guardar', U('gerencia'), base({ cliente_id: 'cx', partes_trabajo_ids: ['pt1'] }));
t('un parte que ya está en una factura borrador no se repite → 409', r.s === 409 && r.j.code === 'PARTE_YA_EN_DOCUMENTO');
r = await llamar('guardar', U('gerencia'), base({ cliente_id: 'cy', conceptos: [L('mismo extra', 1, 5, 21, { extra_id: 'x1' })] }));
t('un extra que ya está en una factura borrador no se repite → 409', r.s === 409 && r.j.code === 'EXTRA_YA_EN_DOCUMENTO');
// Al revés: un parte y un extra que SOLO están en una factura borrador (sin presupuesto) tampoco pueden usarse en un presupuesto
await llamar('guardar', U('gerencia'), base({ cliente_id: 'cF', partes_trabajo_ids: ['ptF'], conceptos: [L('trabajo F', 1, 100, 21, { extra_id: 'xF' })] }));
r = await llamar('guardarP', U('gerencia'), { cliente_id: 'cz', fecha: '2026-11-04', partes_trabajo_ids: ['ptF'], conceptos: [L('x', 1, 100)] });
t('y al revés: un presupuesto no puede usar un parte que ya está en una factura borrador → 409', r.s === 409 && r.j.code === 'YA_EN_FACTURA_BORRADOR', JSON.stringify(r.j));
r = await llamar('guardarP', U('gerencia'), { cliente_id: 'cz', fecha: '2026-11-04', conceptos: [L('x', 1, 100, 21, { extra_id: 'xF' })] });
t('ni un extra que ya está en una factura borrador → 409', r.s === 409 && r.j.code === 'YA_EN_FACTURA_BORRADOR', JSON.stringify(r.j));
t('un parte libre sí se puede presupuestar', (await llamar('guardarP', U('gerencia'), { cliente_id: 'cz', fecha: '2026-11-04', partes_trabajo_ids: ['ptLibre'], conceptos: [L('x', 1, 100)] })).s === 200);

// ═══ Editar ══════════════════════════════════════════════════════════════════
nuevoCtx();
r = await llamar('guardar', U('gerencia'), base()); const id = r.j.data.id;
r = await llamar('guardar', U('gerencia'), { id, conceptos: [L('nuevo', 10, 100, 10)], estado: 'emitida', codigo_registro: 'OTRO', numero_oficial: 'X-1' });
t('editar borrador recalcula (1.000 + 100 = 1.100) sin tocar estado, código ni nº oficial', r.s === 200 && fb()[0].total_con_iva === 1100 && fb()[0].estado === 'borrador' && fb()[0].codigo_registro === 'FBR-2026-00001' && !fb()[0].numero_oficial);
t('editar un id inexistente → 404', (await llamar('guardar', U('gerencia'), { id: 'nope', conceptos: [L('x', 1, 1)] })).s === 404);

// ═══ Preparar para Contasimple (DOC-02 y DOC-05) ═════════════════════════════
const sinImporte = (await llamar('guardar', U('gerencia'), base({ cliente_id: 'cl1', fecha: '2026-10-20', conceptos: [T('solo texto'), L('sin precio', 3, 0)] }))).j.data.id;
t('sin importe no se puede preparar → 400 SIN_IMPORTE', (await llamar('estado', U('gerencia'), { id: sinImporte, estado: 'preparada', numero_oficial: '2026-0104' })).j.code === 'SIN_IMPORTE');
for (const n of ['', '  ', 'ab', 'BOR-2026-0001', 'FBR-2026-00001', 'PRB-2026-0001', 'PRE-2026-00001', 'prueba 1', 'x'.repeat(41), '2026#0104!']) t(`número oficial no válido "${n.slice(0, 14)}" → 400`, (await llamar('estado', U('gerencia'), { id, estado: 'preparada', numero_oficial: n })).j.code === 'NUMERO_OFICIAL_NO_VALIDO');
for (const n of ['2026-0103', '2026 0103', ' 2026-0103 ']) t(`el número ${JSON.stringify(n)} ya existe en el libro de IVA → 409`, (await llamar('estado', U('gerencia'), { id, estado: 'preparada', numero_oficial: n })).j.code === 'NUMERO_OFICIAL_EXISTENTE');
t('"emitida" no se puede poner a mano → 409', (await llamar('estado', U('gerencia'), { id, estado: 'emitida' })).s === 409);
t('estado inventado → 400; id inexistente → 404', (await llamar('estado', U('gerencia'), { id, estado: 'volando' })).s === 400 && (await llamar('estado', U('gerencia'), { id: 'nope', estado: 'preparada' })).s === 404);

// Cliente y NIF
const cliente = (nif, id = 'clN') => { const c = globalThis.__ctx.db.Client; const i = c.findIndex((x) => x.id === id); const o = { id, name: 'Cliente ' + id, nif }; if (i >= 0) c[i] = o; else c.push(o); };
const factura = async (cid) => (await llamar('guardar', U('gerencia'), base({ cliente_id: cid, fecha: '2026-10-21', conceptos: [L('trabajo ' + cid, 1, 100)] }))).j.data.id;
cliente('', 'sinNif'); let fid = await factura('sinNif');
t('cliente sin NIF → 400 CLIENTE_SIN_NIF', (await llamar('estado', U('gerencia'), { id: fid, estado: 'preparada', numero_oficial: '2026-0104' })).j.code === 'CLIENTE_SIN_NIF');
cliente('B84408289', 'ocr'); fid = await factura('ocr');
t('NIF mal leído por el OCR (ni válido ni provisional) → 400 NIF_NO_VALIDO', (await llamar('estado', U('gerencia'), { id: fid, estado: 'preparada', numero_oficial: '2026-0104' })).j.code === 'NIF_NO_VALIDO');
cliente('00000001M', 'prov1'); fid = await factura('prov1');
r = await llamar('estado', U('gerencia'), { id: fid, estado: 'preparada', numero_oficial: '2026-0104' });
t('NIF provisional único → permitido con aviso', r.s === 200 && r.j.avisos.length === 1 && /provisional/i.test(r.j.avisos[0]), JSON.stringify(r.j));
cliente('00000002Z', 'provA'); cliente('00000002Z', 'provB'); fid = await factura('provA');
t('NIF provisional compartido por dos clientes → 409', (await llamar('estado', U('gerencia'), { id: fid, estado: 'preparada', numero_oficial: '2026-0105' })).j.code === 'NIF_PROVISIONAL_REPETIDO');
t('el mismo número oficial no se puede dar a otra factura borrador → 409 NUMERO_OFICIAL_REPETIDO', (await llamar('estado', U('gerencia'), { id: id, estado: 'preparada', numero_oficial: '2026 0104' })).j.code === 'NUMERO_OFICIAL_REPETIDO');
// Preparar bien
r = await llamar('estado', U('gerencia'), { id, estado: 'preparada', numero_oficial: '  2026-0106 ', tipo_ingreso: '700' });
const fprep = fb().find((x) => x.id === id);
t('preparar con NIF válido: sin avisos, nº oficial recortado, fecha de preparación y tipo de ingreso', r.s === 200 && r.j.avisos.length === 0 && fprep.estado === 'preparada' && fprep.numero_oficial === '2026-0106' && !!fprep.preparada_fecha && fprep.tipo_ingreso === '700', JSON.stringify(r.j));
t('el historial deja quién lo preparó y con qué número oficial', fprep.historial_estados[1].por === 'gerencia@simantec.es' && fprep.historial_estados[1].motivo.includes('2026-0106'));
t('una factura preparada ya no se edita → 409 NO_EDITABLE', (await llamar('guardar', U('gerencia'), { id, conceptos: [L('x', 1, 1)] })).j.code === 'NO_EDITABLE');
r = await llamar('estado', U('gerencia'), { id, estado: 'borrador' });
t('preparada → borrador libera el número oficial', r.s === 200 && fb().find((x) => x.id === id).numero_oficial === '' && fb().find((x) => x.id === id).preparada_fecha === '');
// Anular libera partes; reactivar con conflicto se bloquea
nuevoCtx();
r = await llamar('guardar', U('gerencia'), base({ partes_trabajo_ids: ['pA'] })); const idA = r.j.data.id;
t('anular una factura borrador (borrador → anulada)', (await llamar('estado', U('gerencia'), { id: idA, estado: 'anulada' })).s === 200);
t('anulada libera el parte para otra factura', (await llamar('guardar', U('gerencia'), base({ cliente_id: 'c2', partes_trabajo_ids: ['pA'] }))).s === 200);
r = await llamar('estado', U('gerencia'), { id: idA, estado: 'borrador' });
t('reactivar la anulada con el parte ya ocupado → 409', r.s === 409 && r.j.code === 'PARTE_YA_EN_DOCUMENTO', JSON.stringify(r.j));
// El número oficial de una factura anulada queda libre
nuevoCtx();
const mk = async (cid, n) => (await llamar('guardar', U('gerencia'), base({ cliente_id: cid, conceptos: [L('trabajo ' + n, 1, 100 + n)] }))).j.data.id;
const nA = await mk('cl1', 1); await llamar('estado', U('gerencia'), { id: nA, estado: 'preparada', numero_oficial: '2026-0200' });
const nB = await mk('cl1', 2);
t('con la factura A preparada, B no puede usar su número oficial', (await llamar('estado', U('gerencia'), { id: nB, estado: 'preparada', numero_oficial: '2026-0200' })).j.code === 'NUMERO_OFICIAL_REPETIDO');
await llamar('estado', U('gerencia'), { id: nA, estado: 'anulada' });
t('el número oficial de una factura anulada queda libre para otra', (await llamar('estado', U('gerencia'), { id: nB, estado: 'preparada', numero_oficial: '2026-0200' })).s === 200);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`facturas borrador: ${ok} OK, ${fail} fallos`); process.exit(fail ? 1 : 0);
