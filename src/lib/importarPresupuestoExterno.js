// ═══════════════════════════════════════════════════════════
// IMPORTAR PRESUPUESTOS EXTERNOS
// Lee presupuestos y facturas creados con programas externos
// (Excel o PDF) y propone cabecera + líneas para crear el
// presupuesto dentro de la app. Nunca inventa importes: lo que
// el documento no indica queda a 0 para que se revise.
// ═══════════════════════════════════════════════════════════

import { base44 } from '@/api/base44Client';

export const NUEVO_CLIENTE = '__nuevo__';
const IVAS = [0, 4, 10, 21];

export const PROPUESTA_SCHEMA = {
  type: 'object',
  properties: {
    tipo_documento: { type: 'string', enum: ['presupuesto', 'factura', 'otro'] },
    numero_documento: { type: 'string', description: 'Número o referencia del documento (vacío si no figura)' },
    fecha: { type: 'string', description: 'Fecha del documento en formato AAAA-MM-DD. Vacío si no figura.' },
    cliente_nombre: { type: 'string', description: 'Nombre del cliente destinatario tal como figura' },
    cliente_nif: { type: 'string', description: 'NIF/CIF del cliente si figura' },
    titulo: { type: 'string', description: 'Objeto del documento en una línea (máximo 120 caracteres)' },
    notas: { type: 'string', description: 'Condiciones, forma de pago u observaciones que figuran en el documento' },
    resumen: { type: 'string', description: 'Resumen breve del contenido' },
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['linea', 'texto'], description: 'texto solo para encabezados de capítulo o comentarios sin importe' },
          descripcion: { type: 'string', description: 'Texto literal de la línea' },
          cantidad: { type: 'number', description: 'Cantidad. 1 si no figura' },
          unidad: { type: 'string', description: 'ud, m, m2, m3, ml, kg, h, PA… "ud" si no figura' },
          precio_unitario: { type: 'number', description: 'Precio unitario sin símbolo de moneda. 0 si no figura' },
          iva_pct: { type: 'number', description: 'IVA de la línea (0, 4, 10 o 21)' },
          importe: { type: 'number', description: 'Importe de la línea si figura; si no, cantidad × precio' },
        },
      },
    },
    total: { type: 'number', description: 'Total del documento con IVA. 0 si no figura' },
    datos_no_disponibles: { type: 'array', items: { type: 'string' }, description: 'Datos que el documento no permite determinar' },
  },
};

const PROMPT = `Digitaliza el documento adjunto: es un presupuesto o una factura de obra creados con un programa externo (Excel o PDF).

Reglas obligatorias:
- Extrae LITERALMENTE lo que figura en el documento. No inventes partidas, importes ni datos del cliente.
- Si el archivo es un Excel, lee todas las hojas visibles.
- tipo_documento: "presupuesto" si es presupuesto u oferta, "factura" si es factura, "otro" en caso contrario.
- lineas: una por cada línea del documento, en el mismo orden y con su descripción literal.
  · tipo "texto" SOLO para encabezados de capítulo o comentarios sin importe.
  · cantidad 1 si no figura; unidad "ud" si no figura; precio_unitario 0 si no figura.
  · iva_pct: el que indique el documento para esa línea; si solo hay un IVA global, aplícalo a todas; si no indica ninguno, usa 21.
  · importe: el del documento; si no figura, cantidad × precio_unitario.
- NO incluyas como partidas las filas de subtotal, base imponible, IVA o total.
- total: el total con IVA del documento (0 si no figura).
- En datos_no_disponibles lista lo que no se puede determinar (por ejemplo "No consta la fecha").`;

const aNumero = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const limpio = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
};

const norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

/** Busca el cliente del documento entre los clientes de la app (primero por NIF, luego por nombre). */
export function emparejarCliente(datos, clientes = []) {
  const nif = norm(datos?.cliente_nif);
  if (nif.length >= 8) {
    const porNif = clientes.find((c) => norm(c.nif) === nif);
    if (porNif) return porNif;
  }
  const nombre = norm(datos?.cliente_nombre);
  if (nombre.length < 4) return null;
  return clientes.find((c) => {
    const n = norm(c.name);
    return n && (n === nombre || n.includes(nombre) || nombre.includes(n));
  }) || null;
}

/** Convierte la respuesta de la IA en una propuesta editable. */
export function normalizarPropuesta(datos, archivo, clientes = []) {
  const lineas = (Array.isArray(datos?.lineas) ? datos.lineas : [])
    .map((l) => {
      const tipo = l?.tipo === 'texto' ? 'texto' : 'linea';
      const iva = IVAS.includes(Number(l?.iva_pct)) ? Number(l.iva_pct) : 21;
      return {
        tipo,
        descripcion: String(l?.descripcion ?? '').trim(),
        cantidad: tipo === 'texto' ? 0 : (aNumero(l?.cantidad) || 1),
        unidad: String(l?.unidad ?? '').trim() || 'ud',
        precio_unitario: tipo === 'texto' ? 0 : aNumero(l?.precio_unitario),
        iva_pct: iva,
      };
    })
    .filter((l) => l.descripcion);

  const match = emparejarCliente(datos, clientes);
  return {
    archivo,
    tipo_documento: ['presupuesto', 'factura'].includes(datos?.tipo_documento) ? datos.tipo_documento : 'otro',
    numero_documento: String(datos?.numero_documento ?? '').trim(),
    titulo: String(datos?.titulo ?? '').trim(),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(datos?.fecha || '')) ? datos.fecha : new Date().toISOString().slice(0, 10),
    cliente_nombre: String(datos?.cliente_nombre ?? '').trim(),
    cliente_nif: String(datos?.cliente_nif ?? '').trim(),
    cliente_id: match?.id || '',
    notas: String(datos?.notas ?? '').trim(),
    resumen: String(datos?.resumen ?? '').trim(),
    datos_no_disponibles: Array.isArray(datos?.datos_no_disponibles) ? datos.datos_no_disponibles : [],
    total_documento: aNumero(datos?.total),
    lineas,
  };
}

/** Lee un documento externo y devuelve { datos, error }. */
export async function analizarPresupuestoExterno({ file_url, file_name }) {
  if (!file_url) return { datos: null, error: 'Sin documento que analizar' };
  try {
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `${PROMPT}\n\nArchivo: ${file_name || 'documento'}`,
      file_urls: [file_url],
      response_json_schema: PROPUESTA_SCHEMA,
    });
    let datos = res;
    if (typeof datos === 'string') {
      try { datos = JSON.parse(datos); } catch { datos = null; }
    }
    if (datos?.output && typeof datos.output === 'object') datos = datos.output;
    if (!datos || typeof datos !== 'object') return { datos: null, error: 'La IA no devolvió datos del documento' };
    return { datos, error: null };
  } catch (e) {
    return { datos: null, error: e?.message || 'No se pudo leer el documento' };
  }
}