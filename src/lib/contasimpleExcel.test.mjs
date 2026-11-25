/**
 * Pruebas del Excel de importación de Contasimple.
 * Ejecutar desde la raíz del proyecto:   node src/lib/contasimpleExcel.test.mjs
 */
import * as XLSX from 'xlsx';
import { CABECERAS_CONTASIMPLE as C, filasContasimple, construirLibroContasimple, libroABytes, importeCS, numeroCS, nifCS, fechaCS, periodoCS, sugerirNumeroOficial } from './contasimpleExcel.js';
import { calcularDocumento } from './presupuestoCalculo.js';

let ok = 0, fail = 0; const t = (n, c, x = '') => { c ? ok++ : (fail++, console.log('FALLA', n, x)); };
const L = (d, c, p, iva = 21, extra = {}) => ({ tipo: 'linea', descripcion: d, cantidad: c, precio_unitario: p, iva_pct: iva, ...extra });
const T = (d) => ({ tipo: 'texto', descripcion: d });
const factura = (conceptos, extra = {}) => ({ codigo_registro: 'FBR-2026-00001', numero_oficial: '2026-0104', fecha: '2026-10-19', valido_hasta: '2026-11-18', tipo_ingreso: '700', referencia_cliente: 'MAD-P-2607-148', forma_pago: 'Transferencia bancaria', conceptos: calcularDocumento(conceptos).lineas, ...extra });
const cliente = { nif: ' b87772463\t', name: 'REGENERA CONSTRUCCIONES Y CONTRATAS 2022, S.L.', address: 'CALLE CALENDULA MINIPARK 2, S/N PLANTA 1, PUERTA 3', postal_code: '28109', localidad: 'ALCOBENDAS', provincia: 'MADRID' };
const idx = (n) => C.indexOf(n);

// Cabeceras idénticas a la plantilla de Contasimple
const PLANTILLA = ['Serie', 'Número', 'Período', 'Número de factura que rectifica (sólo para facturas rectificativas)', 'Fecha factura', 'Fecha vencimiento', 'Estado', 'Tipo ingreso', 'Notas privadas', 'Notas en la factura', 'Fecha operación', 'Tipo operación', 'Concepto - Inicio servicio', 'Concepto - Fin servicio', 'Concepto - Descripción', 'Concepto - Descripción detallada', 'Concepto - Base imponible unitaria', 'Concepto - Cantidad', 'Concepto - % descuento', 'Concepto - Total base imponible', 'Concepto - % IVA', 'Concepto - Cuota IVA', 'Concepto - % RE', 'Concepto - Cuota RE', 'Concepto - % Retención', 'Concepto - Cuota Retención', 'Cliente - NIF', 'Cliente - Nombre o Razón Social', 'Cliente - Dirección', 'Cliente - Cód. Postal', 'Cliente - Población', 'Cliente - Provincia', 'Cliente - País', 'Cliente - Telf', 'Cliente - Fax', 'Cliente - Email', 'Cobro - Fecha', 'Cobro - Importe', 'Cobro - Método de cobro', 'Cobro - Tipo de método de cobro', 'Cobro - Número de cuenta o tarjeta'];
t('las 41 cabeceras son idénticas a la plantilla de Contasimple', C.length === 41 && JSON.stringify(C) === JSON.stringify(PLANTILLA));

// Formatos como en la plantilla de ejemplo
t('importes: "1250€", "2251,2€", "7,25€", "-1610€", "0€"', importeCS(1250) === '1250€' && importeCS(2251.2) === '2251,2€' && importeCS(7.25) === '7,25€' && importeCS(-1610) === '-1610€' && importeCS(0) === '0€' && importeCS(-0.001) === '0€');
t('cantidades y porcentajes: "70", "4,5", "21", "-1"', numeroCS(70) === '70' && numeroCS(4.5) === '4,5' && numeroCS(21) === '21' && numeroCS(-1) === '-1');
t('fechas dd/mm/aaaa y período AAAA-NT', fechaCS('2026-10-19') === '19/10/2026' && periodoCS('2026-10-19') === '2026-4T' && periodoCS('2026-03-31') === '2026-1T' && periodoCS('2026-04-01') === '2026-2T' && periodoCS('2026-09-30') === '2026-3T' && fechaCS('') === '');
t('NIF normalizado: mayúsculas, sin espacios ni tabuladores (DOC-05)', nifCS(' b87772463\t') === 'B87772463' && nifCS('B-877.72463') === 'B87772463' && nifCS(null) === '');

// ═══ Borrador BOR-2026-0001: cabecera de texto + 3 líneas ═══════════════════════════════════════
const f1 = factura([T('INSTALACIÓN SOLAR CAMINO VIEJO, 36 LA MORALEJA'), T('PEDIDO Nº MAD-P-2607-148, de fecha 10-7-26. CÓDIGO DE OBRA: 26.09'), L('pos 01.- FIJACIÓN SALVATEJA SUNFER S02', 70, 7.25), L('pos 02.- TACO X5 8X170/100 TORX', 140, 0.9), L('pos 03.- BOTE ESPUMA SELLADORA', 2, 12)]);
let r = filasContasimple({ factura: f1, cliente });
const [a, b, c] = r.filas;
t('una fila por línea con importe (3); el texto de cabecera va a las notas', r.filas.length === 3);
t('totales del resumen = 657,50 + 138,08 = 795,58', r.resumen.base === 657.5 && r.resumen.iva === 138.08 && r.resumen.total === 795.58 && r.resumen.lineas === 3, JSON.stringify(r.resumen));
t('primera fila: serie, número oficial, período, fechas, estado Pendiente, tipo de ingreso, tipo de operación', a[idx('Serie')] === 'Facturas normales' && a[idx('Número')] === '2026-0104' && a[idx('Período')] === '2026-4T' && a[idx('Fecha factura')] === '19/10/2026' && a[idx('Fecha vencimiento')] === '18/11/2026' && a[idx('Estado')] === 'Pendiente' && a[idx('Tipo ingreso')] === '700' && a[idx('Tipo operación')] === 'Nacional' && a[idx('Fecha operación')] === '19/10/2026');
t('primera fila: importes de la línea como en la plantilla (7,25€ · 70 · 507,5€ · 21 · 106,58€)', a[idx('Concepto - Base imponible unitaria')] === '7,25€' && a[idx('Concepto - Cantidad')] === '70' && a[idx('Concepto - Total base imponible')] === '507,5€' && a[idx('Concepto - % IVA')] === '21' && a[idx('Concepto - Cuota IVA')] === '106,58€' && a[idx('Concepto - % descuento')] === '0');
t('primera fila: el cliente va con el NIF normalizado y su dirección', a[idx('Cliente - NIF')] === 'B87772463' && a[idx('Cliente - Cód. Postal')] === '28109' && a[idx('Cliente - Población')] === 'ALCOBENDAS' && a[idx('Cliente - Provincia')] === 'MADRID' && a[idx('Cliente - País')] === 'España');
t('el resto de filas solo repiten serie, número y fecha (cabecera y cliente solo en la primera)', [b, c].every((f) => f[idx('Serie')] === 'Facturas normales' && f[idx('Número')] === '2026-0104' && f[idx('Fecha factura')] === '19/10/2026' && f[idx('Cliente - NIF')] === '' && f[idx('Período')] === '' && f[idx('Estado')] === '' && f[idx('Notas en la factura')] === ''));
t('las notas llevan el texto de cabecera, el pedido y la forma de pago', /INSTALACIÓN SOLAR CAMINO VIEJO/.test(a[idx('Notas en la factura')]) && /MAD-P-2607-148/.test(a[idx('Notas en la factura')]) && /Forma de pago: Transferencia bancaria/.test(a[idx('Notas en la factura')]), a[idx('Notas en la factura')]);
t('DOC-06: las 5 columnas de cobro están vacías en todas las filas', r.filas.every((f) => C.map((n, i) => (n.startsWith('Cobro') ? f[i] : '')).every((v) => v === '')));
t('notas privadas: solo el código del borrador, sin datos personales', a[idx('Notas privadas')] === 'Generada desde Smart Gestión (FBR-2026-00001). Revisar antes de emitir.');
t('aviso informando de dónde van las líneas de texto', r.avisos.some((x) => /Notas en la factura/.test(x)));

// ═══ Certificación con línea negativa (factura 2026-0103) ═════════════════════════════════════
const f2 = factura([T('2ª CERTIFICACIÓN'), L('Punto 1.-\nTrabajos de desmontaje y almacenamiento\n\nPunto 2.- Planificación nuevo emplazamiento', 1, 4600), L('A DESCONTAR LA CERTIFICACIÓN ANTERIOR, nuestra factura SIMANTEC 2026-0070', -1, 1610)], { numero_oficial: '2026-0105', tipo_ingreso: '705' });
r = filasContasimple({ factura: f2, cliente });
t('certificación: 2.990,00 + 627,90 = 3.617,90', r.resumen.base === 2990 && r.resumen.iva === 627.9 && r.resumen.total === 3617.9, JSON.stringify(r.resumen));
t('línea negativa como en la plantilla: -1 · -1610€ · -338,1€', r.filas[1][idx('Concepto - Cantidad')] === '-1' && r.filas[1][idx('Concepto - Total base imponible')] === '-1610€' && r.filas[1][idx('Concepto - Cuota IVA')] === '-338,1€' && r.filas[1][idx('Concepto - Base imponible unitaria')] === '1610€');
t('descripción larga: primera línea en "Descripción" y el resto en "Descripción detallada"', r.filas[0][idx('Concepto - Descripción')] === 'Punto 1.-' && r.filas[0][idx('Concepto - Descripción detallada')] === 'Trabajos de desmontaje y almacenamiento Punto 2.- Planificación nuevo emplazamiento', r.filas[0][idx('Concepto - Descripción detallada')]);
t('tipo de ingreso 705 (servicios) se respeta', r.filas[0][idx('Tipo ingreso')] === '705');

// ═══ Líneas de texto como filas (opción sin verificar) ════════════════════════════════════════
r = filasContasimple({ factura: f1, cliente, opciones: { lineasDeTexto: 'lineas' } });
t('modo "lineas": 5 filas (2 de texto + 3 de importe) y el texto ya no se duplica en las notas', r.filas.length === 5 && r.filas[0][idx('Concepto - Cantidad')] === '0' && r.filas[0][idx('Concepto - Total base imponible')] === '0€' && r.filas[0][idx('Concepto - % IVA')] === '0' && !/INSTALACIÓN SOLAR/.test(r.filas[0][idx('Notas en la factura')]));
t('modo "lineas": la cabecera de la factura sigue en la primera fila y el resumen no cambia', r.filas[0][idx('Número')] === '2026-0104' && r.filas[0][idx('Cliente - NIF')] === 'B87772463' && r.filas[0][idx('Estado')] === 'Pendiente' && r.resumen.total === 795.58);

// ═══ Protecciones ═════════════════════════════════════════════════════════════════════════════
for (const n of [undefined, null, '', '   ']) { let err = null; try { filasContasimple({ factura: factura([L('x', 1, 1)], { numero_oficial: n }), cliente }); } catch (e) { err = e; } t(`sin número oficial (${JSON.stringify(n)}) no se genera nada`, !!err && /número oficial/i.test(err.message)); }
{ let err = null; try { filasContasimple({ factura: factura([T('solo texto')]), cliente }); } catch (e) { err = e; } t('sin líneas con importe no se genera nada', !!err); }
r = filasContasimple({ factura: factura([L('x', 1, 1)]), cliente: { name: 'Sin NIF' } });
t('cliente sin NIF: se avisa de que Contasimple creará uno nuevo', r.avisos.some((x) => /sin NIF|no tiene NIF/i.test(x)) && r.filas[0][idx('Cliente - NIF')] === '');
t('el país por defecto es España', r.filas[0][idx('Cliente - País')] === 'España');

// ═══ Libro de Excel ═══════════════════════════════════════════════════════════════════════════
r = filasContasimple({ factura: f1, cliente });
const bytes = libroABytes(construirLibroContasimple(r.filas));
const wb = XLSX.read(bytes, { type: 'array' });
const ws = wb.Sheets[wb.SheetNames[0]];
const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
t('el libro tiene una sola hoja "Sheet1" como la plantilla', wb.SheetNames.length === 1 && wb.SheetNames[0] === 'Sheet1');
t('la primera fila del libro son las 41 cabeceras', JSON.stringify(matriz[0]) === JSON.stringify(C));
t('1 cabecera + 3 filas de datos', matriz.length === 4, String(matriz.length));
t('los datos del libro leídos de vuelta son los mismos', matriz.slice(1).every((fila, i) => C.every((_, k) => String(fila[k] ?? '') === r.filas[i][k])));
t('todas las celdas son texto (como los importes con "€" de la plantilla)', Object.keys(ws).filter((k) => k[0] !== '!').every((k) => ws[k].t === 's'));

// ═══ Número oficial sugerido ══════════════════════════════════════════════════════════════════
const libro = [{ numero_factura: '2026-0096' }, { numero_factura: '2026-0103' }, { numero_factura: '2025-0450' }, { numero_factura: 'ES-2026-39586' }, { numero_factura: ' 2026-0098 ' }, { numero_factura: null }];
t('siguiente número tras 2026-0103 → 2026-0104 (ignora otros años y otros formatos)', sugerirNumeroOficial(libro, 2026) === '2026-0104');
t('sin facturas del año no se sugiere nada', sugerirNumeroOficial(libro, 2027) === '' && sugerirNumeroOficial([], 2026) === '');
t('conserva el ancho del número (0999 → 1000, 0009 → 0010)', sugerirNumeroOficial([{ numero_factura: '2026-0999' }], 2026) === '2026-1000' && sugerirNumeroOficial([{ numero_factura: '2026-0009' }], 2026) === '2026-0010');
console.log(`contasimpleExcel: ${ok} OK, ${fail} fallos`); process.exit(fail ? 1 : 0);
