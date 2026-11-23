/**
 * Pruebas de presupuestos: cálculo, reglas y funciones del servidor (con base de datos y usuarios simulados).
 * Ejecutar desde la raíz del proyecto:   node --experimental-strip-types base44/shared/presupuesto.test.mjs
 * Casos reales de Contasimple: P-2026-0055, factura 2026-0103 y borradores BOR-2026-0001, 0002 y 0003.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FUNCIONES = path.resolve(AQUI, '../functions');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'presupuesto-test-'));
fs.mkdirSync(path.join(tmp, 'shared'));
for (const f of ['presupuestoCalculo.ts', 'presupuestoReglas.ts']) fs.copyFileSync(path.join(AQUI, f), path.join(tmp, 'shared', f));
fs.writeFileSync(path.join(tmp, 'mock-sdk.mjs'), `
export function createClientFromRequest(_req) {
  const ctx = globalThis.__ctx; const rec = (v) => JSON.parse(JSON.stringify(v));
  const ent = {
    list: async () => ctx.db.map(rec).reverse(),
    get: async (id) => { const r = ctx.db.find((x) => x.id === id); if (!r) throw new Error('not found'); return rec(r); },
    create: async (o) => { const r = { id: 'id' + (ctx.db.length + 1), ...rec(o) }; ctx.db.push(r); return rec(r); },
    update: async (id, patch) => { const r = ctx.db.find((x) => x.id === id); Object.assign(r, rec(patch)); return rec(r); },
  };
  const facturas = { list: async () => [] };   // las facturas borrador se prueban en facturaBorrador.test.mjs
  return { auth: { me: async () => ctx.user }, entities: { Presupuesto: ent }, asServiceRole: { entities: { FacturaBorrador: facturas } },
    functions: { invoke: async (_n, p) => { const n = ctx.db.filter((x) => x.codigo_registro).length + 1; const cod = 'PRE-' + p.anio_override + '-' + String(n).padStart(5, '0'); ctx.db.find((x) => x.id === p.record_id).codigo_registro = cod; return { data: { id_generado: cod } }; } } };
}`);
for (const n of ['guardarPresupuesto', 'cambiarEstadoPresupuesto']) {
  fs.mkdirSync(path.join(tmp, 'functions', n), { recursive: true });
  const src = fs.readFileSync(path.join(FUNCIONES, n, 'entry.ts'), 'utf8').replace('npm:@base44/sdk@0.8.31', '../../mock-sdk.mjs');
  fs.writeFileSync(path.join(tmp, 'functions', n, 'entry.ts'), src);
}
const cargar = async (rel) => import(pathToFileURL(path.join(tmp, rel)).href);
const handlers = {};
globalThis.Deno = { serve: (h) => { globalThis.__ultimo = h; } };
await cargar('functions/guardarPresupuesto/entry.ts'); handlers.guardar = globalThis.__ultimo;
await cargar('functions/cambiarEstadoPresupuesto/entry.ts'); handlers.estado = globalThis.__ultimo;
const Calc = await cargar('shared/presupuestoCalculo.ts');
const R = await cargar('shared/presupuestoReglas.ts');

let ok = 0, fail = 0;
const t = (n, c, x = '') => { c ? ok++ : (fail++, console.log('FALLA', n, x)); };
const L = (d, c, p, iva = 21, extra = {}) => ({ descripcion: d, cantidad: c, precio_unitario: p, iva_pct: iva, ...extra });
const T = (d) => ({ tipo: 'texto', descripcion: d });

// ═══ 1) CÁLCULO: documentos reales ═══════════════════════════════════════════
const caso = (n, ls, b, i, tot, cuotas) => { const r = Calc.calcularDocumento(ls); t(`${n}: base, IVA y total`, r.base_imponible === b && r.iva_total === i && r.total_con_iva === tot, JSON.stringify([r.base_imponible, r.iva_total, r.total_con_iva])); if (cuotas) t(`${n}: cuota de cada línea`, JSON.stringify(r.lineas.filter((l) => l.tipo === 'linea').map((l) => l.cuota_iva)) === JSON.stringify(cuotas)); };
caso('P-2026-0055', [T('GENERAL OPTICA'), L('1', 1, 600), L('2', 9, 40), L('3', 1, 600), L('4', 28, 40), L('5', 12, 40), L('6', 48, 40), L('7', 46, 40), L('8', 56, 40), L('9', 24, 40), L('10', 28, 40), L('11', 12, 40), L('12', 22, 40), L('13', 1, 900), L('14', 26, 100)], 16100, 3381, 19481, [126, 75.6, 126, 235.2, 100.8, 403.2, 386.4, 470.4, 201.6, 235.2, 100.8, 184.8, 189, 546]);
caso('Factura 2026-0103 (línea negativa)', [T('x'), L('a', 1, 4600), L('b', -1, 1610), T('pago')], 2990, 627.9, 3617.9, [966, -338.1]);
caso('BOR-2026-0001', [T('c'), L('a', 70, 7.25), L('b', 140, 0.9), L('c', 2, 12)], 657.5, 138.08, 795.58, [106.58, 26.46, 5.04]);
caso('BOR-2026-0002', [T('c'), L('a', 17, 12), L('b', 1, 120), L('c', 1, 660.92), L('d', 1, 220)], 1204.92, 253.03, 1457.95, [42.84, 25.2, 138.79, 46.2]);
caso('BOR-2026-0003', [T('c'), L('a', 90, 6.92), L('b', 20, 6.92)], 761.2, 159.85, 921.05, [130.79, 29.06]);
let r = Calc.calcularDocumento([L('x', 100, 1, 21), L('y', 100, 1, 10), L('z', 100, 1, 0), L('w', 50, 1, 21)]);
t('desglose por tipo (21, 10, 0) y totales', JSON.stringify(r.desglose_iva.map((d) => d.tipo)) === '[21,10,0]' && r.base_imponible === 350 && r.iva_total === 41.5 && r.total_con_iva === 391.5);
t('redondeo: 1,005 → 1,01; 0,1×3 → 0,30; 0,50 al 1 % → 0,01; −0,50 → −0,01', Calc.calcularLinea(L('', 1, 1.005, 0)).base === 1.01 && Calc.calcularLinea(L('', 3, 0.1, 0)).base === 0.3 && Calc.calcularLinea(L('', 1, 0.5, 1)).cuota === 0.01 && Calc.calcularLinea(L('', 1, -0.5, 1)).cuota === -0.01);
t('las líneas de texto no suman aunque traigan importes', Calc.calcularDocumento([{ tipo: 'texto', descripcion: 'x', cantidad: 5, precio_unitario: 99 }]).base_imponible === 0);
let seed = 123456789; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const redond = (num, den) => { const neg = num < 0n; const n = neg ? -num : num; let q = n / den; if ((n % den) * 2n >= den) q += 1n; return neg ? -q : q; };
let dif = 0;
for (let i = 0; i < 5000; i++) { const n = ri(1, 8); const ls = []; let bC = 0n, cC = 0n; for (let k = 0; k < n; k++) { const c = ri(-5000, 50000), p = ri(0, 2000000), iva = [0, 4, 10, 21][ri(0, 3)]; ls.push(L('x', c / 1000, p / 1000, iva)); const b = redond(BigInt(c) * BigInt(p), 10000n); bC += b; cC += redond(b * BigInt(iva), 100n); } const rr = Calc.calcularDocumento(ls); if (Math.round(rr.base_imponible * 100) !== Number(bC) || Math.round(rr.iva_total * 100) !== Number(cC)) dif++; }
t('5.000 documentos aleatorios = cálculo exacto con BigInt', dif === 0, `${dif} difieren`);

// ═══ 2) REGLAS ═══════════════════════════════════════════════════════════════
t('transiciones: borrador→enviado; enviado→aceptado/rechazado/borrador; rechazado→borrador', R.transicionPermitida('borrador', 'enviado') && ['aceptado', 'rechazado', 'borrador'].every((e) => R.transicionPermitida('enviado', e)) && R.transicionPermitida('rechazado', 'borrador'));
t('transiciones prohibidas: borrador→aceptado, aceptado→cualquiera', !R.transicionPermitida('borrador', 'aceptado') && !['borrador', 'enviado', 'rechazado', 'facturado'].some((e) => R.transicionPermitida('aceptado', e)));
t('roles con acceso a presupuestos (DOC-08)', JSON.stringify(R.ROLES_PRESUPUESTO) === JSON.stringify(['admin', 'propietario', 'gerencia', 'administracion', 'director_comercial', 'ingeniero']));
t('validación: IVA 7 %, precio Infinity y línea sin descripción rechazados', R.validarConceptos([L('x', 1, 1, 7)]).length === 1 && R.validarConceptos([L('x', 1, Infinity)]).length === 1 && R.validarConceptos([{ cantidad: 1, precio_unitario: 1 }]).length === 1);
t('fechas: +30 días (09/10→08/11, 19/10→18/11, año nuevo y bisiesto)', R.sumarDias('2026-10-09', 30) === '2026-11-08' && R.sumarDias('2026-10-19', 30) === '2026-11-18' && R.sumarDias('2027-12-15', 30) === '2028-01-14' && R.sumarDias('2028-02-15', 30) === '2028-03-16');
const ex = [{ id: 'a', estado: 'borrador', partes_trabajo_ids: ['p1'], conceptos: [{ extra_id: 'e1' }] }, { id: 'b', estado: 'rechazado', partes_trabajo_ids: ['p3'], conceptos: [{ extra_id: 'e3' }] }];
t('partes: ocupado en borrador, libre si rechazado, el propio no cuenta', R.conflictoPartes(['p1'], ex)?.id === 'a' && R.conflictoPartes(['p3'], ex) === null && R.conflictoPartes(['p1'], ex, 'a') === null);
t('extras: ocupado en borrador, libre si rechazado, el propio no cuenta', R.conflictoExtras([{ extra_id: 'e1' }], ex)?.id === 'a' && R.conflictoExtras([{ extra_id: 'e3' }], ex) === null && R.conflictoExtras([{ extra_id: 'e1' }], ex, 'a') === null);
t('solo campos editables (no estado, código, importe ni historial)', JSON.stringify(Object.keys(R.soloCamposEditables({ cliente_id: 'c', estado: 'aceptado', codigo_registro: 'X', importe: 1, notas: 'n', conceptos: [] })).sort()) === JSON.stringify(['cliente_id', 'conceptos', 'notas']));

// ═══ 3) FUNCIONES con base de datos simulada ═════════════════════════════════
const llamar = async (fn, user, body) => { globalThis.__ctx.user = user; const rs = await handlers[fn](new Request('http://x/', { method: 'POST', body: JSON.stringify(body) })); return { s: rs.status, j: await rs.json() }; };
const U = (role) => ({ role, email: role + '@simantec.es' });
globalThis.__ctx = { db: [], user: null };
const base = (extra = {}) => ({ cliente_id: 'c1', cliente_name: 'Regenera', fecha: '2026-10-19', conceptos: [T('INSTALACIÓN SOLAR'), L('pos 01', 70, 7.25), L('pos 02', 140, 0.9), L('pos 03', 2, 12)], ...extra });
for (const rol of ['técnico', 'operario', 'contabilidad', 'jefe_obra', 'control_horario', 'cliente_obra', 'usuario_demo']) t(`${rol} no puede guardar (403)`, (await llamar('guardar', U(rol), base())).s === 403);
t('sin usuario → 401', (await llamar('guardar', null, base())).s === 401);
t('técnico no cambia estados (403)', (await llamar('estado', U('técnico'), { id: 'x', estado: 'enviado' })).s === 403);
t('con los roles sin acceso no se creó nada', globalThis.__ctx.db.length === 0);
r = await llamar('guardar', U('gerencia'), base({ importe: 999999, estado: 'aceptado', codigo_registro: 'FALSO', total_con_iva: 1 }));
const p1 = globalThis.__ctx.db[0];
t('crear: totales del servidor (657,50 / 138,08 / 795,58), ignora importe, estado y código del cliente', r.s === 200 && p1.importe === 657.5 && p1.iva_total === 138.08 && p1.total_con_iva === 795.58 && p1.estado === 'borrador' && p1.codigo_registro === 'PRE-2026-00001', JSON.stringify(r.j));
t('crear: válido hasta +30 días, historial con el autor, cuota por línea y desglose', p1.valido_hasta === '2026-11-18' && p1.historial_estados[0].por === 'gerencia@simantec.es' && p1.conceptos.find((c) => c.descripcion === 'pos 01').cuota_iva === 106.58 && JSON.stringify(p1.desglose_iva) === JSON.stringify([{ tipo: 21, base: 657.5, cuota: 138.08 }]));
for (const rol of ['admin', 'propietario', 'administracion', 'director_comercial', 'ingeniero']) t(`${rol} puede guardar`, (await llamar('guardar', U(rol), base({ cliente_id: 'cx-' + rol }))).s === 200);
t('sin líneas / IVA 7 % / sin cliente → 400', (await llamar('guardar', U('gerencia'), base({ conceptos: [] }))).j.code === 'SIN_LINEAS' && (await llamar('guardar', U('gerencia'), base({ cliente_id: 'c9', conceptos: [L('x', 1, 1, 7)] }))).j.code === 'LINEAS_NO_VALIDAS' && (await llamar('guardar', U('gerencia'), base({ cliente_id: '' }))).j.code === 'FALTAN_CAMPOS');
r = await llamar('guardar', U('gerencia'), base());
t('duplicado exacto → 409 DUPLICATE_BUDGET', r.s === 409 && r.j.code === 'DUPLICATE_BUDGET');
r = await llamar('guardar', U('gerencia'), base({ es_duplicado_confirmado: true, titulo: 'Copia' }));
t('duplicado confirmado → 200 con sufijo _01', r.s === 200 && r.j.data.titulo === 'Copia_01');
// partes
r = await llamar('guardar', U('gerencia'), base({ cliente_id: 'c2', partes_trabajo_ids: ['pA'] })); const idA = r.j.data.id;
t('un parte en otro presupuesto activo → 409', (await llamar('guardar', U('gerencia'), base({ cliente_id: 'c3', partes_trabajo_ids: ['pA'] }))).j.code === 'PARTE_YA_PRESUPUESTADO');
// extras (Fase 2A)
r = await llamar('guardar', U('gerencia'), base({ cliente_id: 'c4', conceptos: [L('Cambio de luminarias', 1, 350, 21, { extra_id: 'x1' })] })); const idE = r.j.data.id;
t('extra: el id de origen se conserva en la línea guardada', r.s === 200 && globalThis.__ctx.db.find((x) => x.id === idE).conceptos[0].extra_id === 'x1');
r = await llamar('guardar', U('gerencia'), base({ cliente_id: 'c5', conceptos: [L('El mismo extra', 1, 100, 21, { extra_id: 'x1' })] }));
t('extra ya en otro presupuesto activo → 409 EXTRA_YA_PRESUPUESTADO', r.s === 409 && r.j.code === 'EXTRA_YA_PRESUPUESTADO', JSON.stringify(r.j));
r = await llamar('guardar', U('gerencia'), { id: idE, conceptos: [L('Cambio de luminarias', 1, 400, 21, { extra_id: 'x1' })] });
t('extra: editar el propio presupuesto con su extra no es conflicto', r.s === 200 && globalThis.__ctx.db.find((x) => x.id === idE).importe === 400);
// editar
const idEd = globalThis.__ctx.db[0].id;
r = await llamar('guardar', U('gerencia'), { id: idEd, conceptos: [L('nuevo', 10, 100, 10)], estado: 'aceptado', codigo_registro: 'OTRO' });
t('editar borrador recalcula y no cambia estado ni código', r.s === 200 && globalThis.__ctx.db[0].total_con_iva === 1100 && globalThis.__ctx.db[0].estado === 'borrador' && globalThis.__ctx.db[0].codigo_registro === 'PRE-2026-00001');
t('editar id inexistente → 404', (await llamar('guardar', U('gerencia'), { id: 'nope', conceptos: [L('x', 1, 1)] })).s === 404);
// estados
const cero = await llamar('guardar', U('gerencia'), base({ cliente_id: 'c-cero', conceptos: [T('solo texto'), L('sin precio', 3, 0)] }));
r = await llamar('estado', U('gerencia'), { id: cero.j.data.id, estado: 'enviado' });
t('sin importe no se puede enviar (400 SIN_IMPORTE)', r.s === 400 && r.j.code === 'SIN_IMPORTE');
t('borrador → aceptado no permitido (409)', (await llamar('estado', U('gerencia'), { id: idEd, estado: 'aceptado' })).j.code === 'TRANSICION_NO_PERMITIDA');
r = await llamar('estado', U('gerencia'), { id: idEd, estado: 'enviado' });
t('borrador → enviado y queda registrado con autor', r.s === 200 && globalThis.__ctx.db[0].historial_estados.length === 2 && globalThis.__ctx.db[0].historial_estados[1].por === 'gerencia@simantec.es');
t('editar un enviado → 409 NO_EDITABLE', (await llamar('guardar', U('gerencia'), { id: idEd, conceptos: [L('x', 1, 1)] })).j.code === 'NO_EDITABLE');
t('estado inventado → 400; id inexistente → 404', (await llamar('estado', U('gerencia'), { id: idEd, estado: 'volando' })).s === 400 && (await llamar('estado', U('gerencia'), { id: 'nope', estado: 'enviado' })).s === 404);
r = await llamar('estado', U('gerencia'), { id: idEd, estado: 'aceptado', motivo: 'Aceptado por correo' });
t('enviado → aceptado con motivo guardado', r.s === 200 && globalThis.__ctx.db[0].historial_estados[2].motivo === 'Aceptado por correo');
t('aceptado → facturado / borrador no permitidos (409)', (await llamar('estado', U('gerencia'), { id: idEd, estado: 'facturado' })).s === 409 && (await llamar('estado', U('gerencia'), { id: idEd, estado: 'borrador' })).s === 409);
// rechazar libera partes y extras; reactivar con conflicto se bloquea
await llamar('estado', U('gerencia'), { id: idA, estado: 'enviado' });
t('enviado → rechazado', (await llamar('estado', U('gerencia'), { id: idA, estado: 'rechazado' })).s === 200);
t('rechazado libera el parte para otro presupuesto', (await llamar('guardar', U('gerencia'), base({ cliente_id: 'c6', partes_trabajo_ids: ['pA'] }))).s === 200);
t('reactivar el rechazado con el parte ya ocupado → 409', (await llamar('estado', U('gerencia'), { id: idA, estado: 'borrador' })).j.code === 'PARTE_YA_PRESUPUESTADO');
await llamar('estado', U('gerencia'), { id: idE, estado: 'enviado' });
t('extra: rechazar libera el extra', (await llamar('estado', U('gerencia'), { id: idE, estado: 'rechazado' })).s === 200 && (await llamar('guardar', U('gerencia'), base({ cliente_id: 'c7', conceptos: [L('Reutiliza el extra', 1, 100, 21, { extra_id: 'x1' })] }))).s === 200);
t('extra: reactivar el rechazado con el extra ocupado → 409 EXTRA_YA_PRESUPUESTADO', (await llamar('estado', U('gerencia'), { id: idE, estado: 'borrador' })).j.code === 'EXTRA_YA_PRESUPUESTADO');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`presupuestos: ${ok} OK, ${fail} fallos`); process.exit(fail ? 1 : 0);
