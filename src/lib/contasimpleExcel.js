/**
 * contasimpleExcel — convierte una FACTURA BORRADOR en el Excel de importación de facturas emitidas de Contasimple.
 *
 * Reglas (Reglas de Oro DOC-01 a DOC-07):
 *  - El número de la factura es SIEMPRE el número oficial que una persona ha confirmado (DOC-02). Aquí nunca se inventa.
 *  - El cliente se vincula en Contasimple por NIF: se exporta normalizado, sin espacios ni tabuladores (DOC-05).
 *  - Las columnas de cobro van VACÍAS siempre: ni cuentas, ni tarjetas, ni cobros (DOC-06). Estado = Pendiente.
 *  - Importes y cuotas son los que calculó el servidor (DOC-07); aquí solo se formatean como en la plantilla de ejemplo
 *    ("1250€", "2251,2€": coma decimal, símbolo € y sin ceros sobrantes).
 *  - Formato verificado con una importación real (PRB-2026-0001): cabecera y cliente solo en la primera fila de cada
 *    factura; las demás filas repiten serie, número y fecha. El texto de cabecera (obra, pedido…) va en "Notas en la
 *    factura". Las líneas de solo texto como filas de 0 € son opcionales (`lineasDeTexto: 'lineas'`) y están sin verificar.
 */
import * as XLSX from 'xlsx';

export const CABECERAS_CONTASIMPLE = [
  'Serie', 'Número', 'Período', 'Número de factura que rectifica (sólo para facturas rectificativas)', 'Fecha factura',
  'Fecha vencimiento', 'Estado', 'Tipo ingreso', 'Notas privadas', 'Notas en la factura', 'Fecha operación', 'Tipo operación',
  'Concepto - Inicio servicio', 'Concepto - Fin servicio', 'Concepto - Descripción', 'Concepto - Descripción detallada',
  'Concepto - Base imponible unitaria', 'Concepto - Cantidad', 'Concepto - % descuento', 'Concepto - Total base imponible',
  'Concepto - % IVA', 'Concepto - Cuota IVA', 'Concepto - % RE', 'Concepto - Cuota RE', 'Concepto - % Retención', 'Concepto - Cuota Retención',
  'Cliente - NIF', 'Cliente - Nombre o Razón Social', 'Cliente - Dirección', 'Cliente - Cód. Postal', 'Cliente - Población',
  'Cliente - Provincia', 'Cliente - País', 'Cliente - Telf', 'Cliente - Fax', 'Cliente - Email',
  'Cobro - Fecha', 'Cobro - Importe', 'Cobro - Método de cobro', 'Cobro - Tipo de método de cobro', 'Cobro - Número de cuenta o tarjeta',
];
const COL = Object.fromEntries(CABECERAS_CONTASIMPLE.map((n, i) => [n, i]));

/** "2026-10-19" → "19/10/2026" */
export const fechaCS = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
/** "2026-10-19" → "2026-4T" */
export const periodoCS = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-/);
  return m ? `${m[1]}-${Math.ceil(Number(m[2]) / 3)}T` : '';
};
const trimDecimales = (n) => {
  const s = (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return (s === '-0' ? '0' : s).replace('.', ',');
};
/** 1250 → "1250€"; 2251.2 → "2251,2€"; -1610 → "-1610€" */
export const importeCS = (n) => `${trimDecimales(n)}€`;
/** Cantidades y porcentajes: sin símbolo */
export const numeroCS = (n) => trimDecimales(n);
/** NIF/CIF tal como lo necesita Contasimple para vincular al cliente: mayúsculas, sin espacios ni tabuladores */
export const nifCS = (nif) => String(nif ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const lineasDeTexto = (texto) => String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/**
 * @param {object} p
 * @param {object} p.factura  FacturaBorrador (conceptos ya calculados) con `numero_oficial`
 * @param {object} p.cliente  Client
 * @param {{lineasDeTexto?: 'notas'|'lineas'}} [p.opciones]
 * @returns {{ filas: string[][], resumen: {base:number, iva:number, total:number, lineas:number}, avisos: string[] }}
 */
export function filasContasimple({ factura, cliente = {}, opciones = {} }) {
  const numero = String(factura?.numero_oficial ?? '').trim();
  if (!numero) throw new Error('Falta el número oficial de la factura: lo confirma una persona, la app no lo inventa.');
  const modoTexto = opciones.lineasDeTexto === 'lineas' ? 'lineas' : 'notas';
  const avisos = [];

  const conceptos = factura.conceptos || [];
  const textos = conceptos.filter((c) => c.tipo === 'texto');
  const lineas = conceptos.filter((c) => c.tipo !== 'texto');
  if (lineas.length === 0) throw new Error('La factura no tiene líneas con importe.');

  // Notas en la factura: texto de cabecera, referencia del cliente y forma de pago
  const partesNota = [];
  if (modoTexto === 'notas') textos.forEach((t) => partesNota.push([...lineasDeTexto(t.descripcion), ...lineasDeTexto(t.detalle)].join(' ')));
  if (factura.referencia_cliente) partesNota.push(`Pedido / referencia del cliente: ${factura.referencia_cliente}`);
  if (factura.forma_pago) partesNota.push(`Forma de pago: ${factura.forma_pago}`);
  if (factura.notas) partesNota.push(String(factura.notas).trim());
  const notasFactura = partesNota.filter(Boolean).join('. ').replace(/\.\.+/g, '.');
  if (modoTexto === 'notas' && textos.length) avisos.push('Las líneas de texto (obra, pedido…) van en "Notas en la factura".');

  const nif = nifCS(cliente.nif);
  if (!nif) avisos.push('El cliente no tiene NIF: Contasimple no podrá vincularlo y creará uno nuevo.');

  const filas = [];
  const fila = () => new Array(CABECERAS_CONTASIMPLE.length).fill('');
  const repetir = (f) => { f[COL['Serie']] = 'Facturas normales'; f[COL['Número']] = numero; f[COL['Fecha factura']] = fechaCS(factura.fecha); };
  const primeraFila = () => {
    const f = fila(); repetir(f);
    f[COL['Período']] = periodoCS(factura.fecha);
    f[COL['Fecha vencimiento']] = fechaCS(factura.valido_hasta);
    f[COL['Estado']] = 'Pendiente';
    f[COL['Tipo ingreso']] = String(factura.tipo_ingreso || '705');
    f[COL['Notas privadas']] = `Generada desde Smart Gestión (${factura.codigo_registro || 'borrador'}). Revisar antes de emitir.`;
    f[COL['Notas en la factura']] = notasFactura;
    f[COL['Fecha operación']] = fechaCS(factura.fecha);
    f[COL['Tipo operación']] = 'Nacional';
    f[COL['Cliente - NIF']] = nif;
    f[COL['Cliente - Nombre o Razón Social']] = cliente.name || factura.cliente_name || '';
    f[COL['Cliente - Dirección']] = cliente.address || '';
    f[COL['Cliente - Cód. Postal']] = cliente.postal_code || '';
    f[COL['Cliente - Población']] = cliente.localidad || '';
    f[COL['Cliente - Provincia']] = cliente.provincia || '';
    f[COL['Cliente - País']] = cliente.pais || 'España';
    f[COL['Cliente - Telf']] = cliente.telefono || '';
    f[COL['Cliente - Email']] = cliente.email || '';
    return f;                       // Las columnas de cobro quedan vacías (DOC-06)
  };

  const lineaTexto = (c) => {
    const f = fila(); repetir(f);
    const [primera, ...resto] = [...lineasDeTexto(c.descripcion)];
    f[COL['Concepto - Descripción']] = primera || '';
    if (resto.length) f[COL['Concepto - Descripción detallada']] = resto.join(' ');
    f[COL['Concepto - Base imponible unitaria']] = importeCS(0); f[COL['Concepto - Cantidad']] = '0'; f[COL['Concepto - % descuento']] = '0';
    f[COL['Concepto - Total base imponible']] = importeCS(0); f[COL['Concepto - % IVA']] = '0'; f[COL['Concepto - Cuota IVA']] = importeCS(0);
    f[COL['Concepto - % RE']] = '0'; f[COL['Concepto - Cuota RE']] = '0'; f[COL['Concepto - % Retención']] = '0'; f[COL['Concepto - Cuota Retención']] = '0';
    return f;
  };
  const lineaImporte = (c) => {
    const f = fila(); repetir(f);
    const partes = lineasDeTexto(c.descripcion);
    f[COL['Concepto - Descripción']] = partes[0] || '';
    const detalle = [...partes.slice(1), ...lineasDeTexto(c.detalle)].join(' ');
    if (detalle) f[COL['Concepto - Descripción detallada']] = detalle;
    f[COL['Concepto - Base imponible unitaria']] = importeCS(c.precio_unitario);
    f[COL['Concepto - Cantidad']] = numeroCS(c.cantidad);
    f[COL['Concepto - % descuento']] = '0';
    f[COL['Concepto - Total base imponible']] = importeCS(c.total);
    f[COL['Concepto - % IVA']] = numeroCS(c.iva_pct);
    f[COL['Concepto - Cuota IVA']] = importeCS(c.cuota_iva);
    f[COL['Concepto - % RE']] = '0'; f[COL['Concepto - Cuota RE']] = '0'; f[COL['Concepto - % Retención']] = '0'; f[COL['Concepto - Cuota Retención']] = '0';
    return f;
  };

  // Orden del documento; la primera fila lleva la cabecera de la factura y el cliente
  const ordenadas = modoTexto === 'lineas' ? conceptos : lineas;
  ordenadas.forEach((c, i) => {
    const f = c.tipo === 'texto' ? lineaTexto(c) : lineaImporte(c);
    if (i === 0) { const cab = primeraFila(); cab.forEach((v, k) => { if (v !== '' && f[k] === '') f[k] = v; }); }
    filas.push(f);
  });

  let base = 0, iva = 0;
  lineas.forEach((c) => { base += Math.round((c.total || 0) * 100); iva += Math.round((c.cuota_iva || 0) * 100); });
  return { filas, resumen: { base: base / 100, iva: iva / 100, total: (base + iva) / 100, lineas: lineas.length }, avisos };
}

/** Libro de Excel con una sola hoja "Sheet1" (como la plantilla de ejemplo) y todas las celdas como texto. */
export function construirLibroContasimple(filas) {
  const ws = XLSX.utils.aoa_to_sheet([CABECERAS_CONTASIMPLE, ...filas.map((f) => f.map((v) => String(v ?? '')))]);
  Object.keys(ws).filter((k) => k[0] !== '!').forEach((k) => { ws[k].t = 's'; });
  ws['!cols'] = CABECERAS_CONTASIMPLE.map((h) => ({ wch: Math.max(14, Math.min(40, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}
export const libroABytes = (wb) => XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

/**
 * Sugiere el siguiente número oficial a partir de las facturas emitidas ya registradas (libro de IVA).
 * Solo mira números tipo "AAAA-NNNN" del año indicado; si no hay ninguno, no sugiere nada. Es una SUGERENCIA:
 * la persona la confirma y el servidor la rechaza si ya existe (DOC-02).
 */
export function sugerirNumeroOficial(libro = [], anio) {
  let max = -1, ancho = 4;
  for (const f of libro || []) {
    const m = String(f?.numero_factura ?? '').trim().match(/^(\d{4})-(\d{1,6})$/);
    if (!m || Number(m[1]) !== Number(anio)) continue;
    const n = Number(m[2]);
    if (n > max) { max = n; ancho = Math.max(ancho, m[2].length); }
  }
  return max < 0 ? '' : `${anio}-${String(max + 1).padStart(ancho, '0')}`;
}
