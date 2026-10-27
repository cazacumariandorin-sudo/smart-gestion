/**
 * materialesOcrClient — Lógica de OCR + guardado de materiales en el cliente
 * (compatible con plan Starter: usa Core.InvokeLLM en vez de funciones backend).
 *
 * Funciones:
 *   ocrDocumentoMateriales(base44, file_url)        → { datos, modelo }
 *   guardarMaterialesOcr(base44, documento, lineas)  → { documento_id, lineas_guardadas, resultados }
 */
import { base44 } from '@/api/base44Client';

const TIPOS_DOC = ['factura', 'albaran', 'ticket', 'proforma'];

const PROMPT_OCR = `Eres un sistema OCR especializado en facturas, albaranes, proformas y tickets de proveedores en España.
Analiza el documento (probablemente pre-procesado tipo CamScanner: recortado, enderezado y con contraste mejorado).
Extrae TODAS las líneas de producto/material del cuerpo del documento.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "proveedor": "nombre del emisor del documento",
  "nif_proveedor": "CIF/NIF del emisor",
  "numero_documento": "nº de factura/albarán/proforma impreso; cadena vacía si no aparece",
  "fecha_documento": "YYYY-MM-DD (no la fecha de hoy)",
  "tipo_documento_inferido": "factura|albaran|ticket|proforma",
  "lineas": [
    {
      "fabricante": "marca/fabricante del producto; cadena vacía si no aparece",
      "referencia": "referencia/código de catálogo del producto; cadena vacía si no aparece",
      "descripcion": "descripción del producto",
      "cantidad": 1,
      "unidad": "ud|m²|m³|kg|ml|h|...",
      "pvp": null|número (precio público de venta si aparece por separado; null si NO figura),
      "descuento_empresa": null|número (% descuento aplicado al comprador, si aparece o se deduce; null si NO figura),
      "iva": null|número (% IVA de la línea),
      "precio_neto": número (precio por unidad realmente facturado, CON descuento incluido, SIN IVA)
    }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible, línea por línea"
}

Instrucciones estrictas:
- Extrae TODAS las líneas de producto, aunque sean muchas.
- NUNCA inventes PVP ni descuento si el documento NO los muestra por separado: si solo aparece el precio neto, deja pvp=null y descuento_empresa=null.
- precio_neto es OBLIGATORIO. Si el documento solo da el importe total de la línea, divídelo entre cantidad.
- La referencia es clave para cruzar con la base de datos de Materiales. Cadena vacía si no aparece.
- No incluyas en "lineas" totales, subtotales, bases imponibles, IVA global ni portes.
- Si no puedes extraer un dato, usa null (numéricos) o cadena vacía (textos).`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    proveedor: { type: 'string' },
    nif_proveedor: { type: 'string' },
    numero_documento: { type: 'string' },
    fecha_documento: { type: 'string' },
    tipo_documento_inferido: { type: 'string', enum: TIPOS_DOC },
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fabricante: { type: 'string' },
          referencia: { type: 'string' },
          descripcion: { type: 'string' },
          cantidad: { type: 'number' },
          unidad: { type: 'string' },
          pvp: { type: ['number', 'null'] },
          descuento_empresa: { type: ['number', 'null'] },
          iva: { type: ['number', 'null'] },
          precio_neto: { type: 'number' },
        },
        required: ['descripcion', 'precio_neto'],
      },
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    ocr_raw: { type: 'string' },
  },
  required: ['lineas'],
};

/** OCR de un documento de materiales vía función backend (orquestador primario + respaldo Anthropic).
 *  Reintenta hasta 2 veces: la llamada de IA tarda 3-8 s y puede fallar
 *  intermitentemente (timeout transitorio, modelo sin respuesta). */
export async function ocrDocumentoMateriales(file_url, file_tipo = 'image/jpeg') {
  let lastErr = '';
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const res = await base44.functions.invoke('procesarFacturaMateriales', { file_url, file_tipo });
      if (res?.success && res?.datos && Array.isArray(res.datos.lineas)) {
        return { datos: res.datos, modelo: res.modelo || 'backend', fallback: !!res.fallback };
      }
      lastErr = res?.error || (res?.datos && !Array.isArray(res.datos.lineas) ? 'El modelo no devolvió lista de líneas' : 'OCR sin respuesta');
    } catch (e) {
      lastErr = String(e?.message || e).slice(0, 200);
    }
    if (intento < 2) await new Promise(r => setTimeout(r, 800));
  }
  throw new Error(lastErr || 'OCR no devolvió líneas válidas');
}

/** Normaliza nombre: UPPERCASE, sin tildes ni signos. */
function normalizeName(s) {
  if (!s) return '';
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Persiste las líneas confirmadas (réplica cliente de guardarMaterialesOcr).
 *   1. Crea MaterialDocumentoOrigen
 *   2. Por línea: resuelve/crea Fabricante, upsert MaterialCatalog,
 *      crea MaterialPrecioHistorico, snapshot en MaterialCatalog.
 */
export async function guardarMaterialesOcr(documento, lineas) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (!Array.isArray(lineas) || !lineas.length) {
    throw new Error('No hay líneas a guardar');
  }

  // 1. MaterialDocumentoOrigen
  const doc = await base44.entities.MaterialDocumentoOrigen.create({
    tipo: documento.tipo || 'factura',
    numero_documento: documento.numero || '',
    fecha_documento: documento.fecha || hoy,
    proveedor_nombre: documento.proveedor_nombre || '',
    proveedor_nif: documento.proveedor_nif || '',
    archivo_url_mejorado: documento.archivo_url || '',
    archivo_url_original: documento.archivo_url_original || '',
    obra_id: documento.obra_id || '',
    obra_name: documento.obra_name || '',
    operario_id: documento.operario_id || '',
    estado: 'procesado',
    lineas_count: lineas.length,
  });

  const fabricanteCache = new Map();
  async function resolverFabricante(nombreRaw) {
    const nombre = (nombreRaw || '').trim();
    if (!nombre) return null;
    const normalizado = normalizeName(nombre);
    if (fabricanteCache.has(normalizado)) return fabricanteCache.get(normalizado);
    let fab = null;
    try {
      const found = await base44.entities.Fabricante.filter({ nombre_normalizado: normalizado });
      if (found && found.length) fab = found[0];
    } catch {}
    if (!fab) {
      try {
        fab = await base44.entities.Fabricante.create({ name: nombre, nombre_normalizado: normalizado });
      } catch { fab = null; }
    }
    fabricanteCache.set(normalizado, fab);
    return fab;
  }

  const resultados = [];
  for (const linea of lineas) {
    const precio_neto = Number(linea.precio_neto || 0);
    const descripcion = (linea.descripcion || '').trim();
    const referencia = (linea.referencia || '').trim();
    if (!descripcion && !precio_neto) continue;

    const fabricanteRaw = linea.fabricante || documento.proveedor_nombre || '';
    const fab = await resolverFabricante(fabricanteRaw);

    // Buscar material existente por referencia + fabricante_id
    let material = null;
    if (referencia) {
      if (fab) {
        try {
          const exists = await base44.entities.MaterialCatalog.filter({ referencia, fabricante_id: fab.id });
          if (exists && exists.length) material = exists[0];
        } catch {}
      }
      if (!material) {
        try {
          const byCode = await base44.entities.MaterialCatalog.filter({ code: referencia });
          if (byCode && byCode.length) material = byCode[0];
        } catch {}
      }
    }

    // Último precio histórico
    let precio_anterior = null;
    let pvp_ant = null, desc_ant = null;
    if (material) {
      try {
        const hist = await base44.entities.MaterialPrecioHistorico.filter({ material_id: material.id }, '-fecha_documento', 1);
        if (hist && hist.length) {
          precio_anterior = Number(hist[0].precio_neto || 0);
          pvp_ant = hist[0].pvp != null ? Number(hist[0].pvp) : null;
          desc_ant = hist[0].descuento_empresa != null ? Number(hist[0].descuento_empresa) : null;
        }
      } catch {}
    }

    // Variación y origen
    let variacion_pct = null;
    let origen_cambio = 'primer_registro';
    if (precio_anterior != null && precio_anterior > 0) {
      variacion_pct = ((precio_neto - precio_anterior) / precio_anterior) * 100;
      const pvp_new = linea.pvp != null && linea.pvp !== '' ? Number(linea.pvp) : null;
      const desc_new = linea.descuento_empresa != null && linea.descuento_empresa !== '' ? Number(linea.descuento_empresa) : null;
      const cambio_pvp = pvp_new != null && pvp_ant != null && Math.abs(pvp_new - pvp_ant) > 0.001;
      const cambio_desc = desc_new != null && desc_ant != null && Math.abs(desc_new - desc_ant) > 0.001;
      if (cambio_pvp && cambio_desc) origen_cambio = 'ambos';
      else if (cambio_pvp) origen_cambio = 'subida_pvp';
      else if (cambio_desc) origen_cambio = 'cambio_descuento';
      else origen_cambio = 'cambio_valoracion_no_deducible';
    }

    const historico = await base44.entities.MaterialPrecioHistorico.create({
      material_id: material?.id || '',
      material_referencia: referencia,
      fabricante_id: fab?.id || '',
      fabricante_name: fab?.name || fabricanteRaw || '',
      fecha_documento: documento.fecha || hoy,
      pvp: linea.pvp != null && linea.pvp !== '' ? Number(linea.pvp) : null,
      descuento_empresa: linea.descuento_empresa != null && linea.descuento_empresa !== '' ? Number(linea.descuento_empresa) : null,
      iva: linea.iva != null && linea.iva !== '' ? Number(linea.iva) : null,
      precio_neto,
      precio_anterior,
      variacion_pct,
      origen_cambio,
      documento_origen_id: doc.id,
      documento_tipo: documento.tipo || 'factura',
      documento_numero: documento.numero || '',
      documento_url: documento.archivo_url || '',
      proveedor_nombre: documento.proveedor_nombre || '',
      proveedor_nif: documento.proveedor_nif || '',
      obra_id: documento.obra_id || '',
      obra_name: documento.obra_name || '',
      linea_ocr_raw: descripcion,
      confianza: linea.confianza || 'media',
      activo: true,
    });

    const fecha_snapshot = documento.fecha || hoy;
    const pvp_snapshot = linea.pvp != null && linea.pvp !== '' ? Number(linea.pvp) : (material?.pvp ?? null);
    const desc_snapshot = linea.descuento_empresa != null && linea.descuento_empresa !== '' ? Number(linea.descuento_empresa) : (material?.descuento_empresa ?? null);
    const iva_snapshot = linea.iva != null && linea.iva !== '' ? Number(linea.iva) : (material?.iva ?? null);

    if (material) {
      await base44.entities.MaterialCatalog.update(material.id, {
        name: descripcion || material.name,
        referencia: referencia || material.referencia || '',
        code: referencia || material.code || material.referencia || '',
        fabricante_id: fab?.id || material.fabricante_id || '',
        fabricante_name: fab?.name || material.fabricante_name || '',
        unit: linea.unidad || material.unit || 'ud',
        pvp: pvp_snapshot,
        descuento_empresa: desc_snapshot,
        iva: iva_snapshot,
        precio_neto,
        unit_price: precio_neto,
        fecha_ultimo_precio: fecha_snapshot,
        supplier: documento.proveedor_nombre || material.supplier || '',
      });
    } else {
      material = await base44.entities.MaterialCatalog.create({
        name: descripcion || '(sin descripción)',
        referencia,
        code: referencia,
        fabricante_id: fab?.id || '',
        fabricante_name: fab?.name || '',
        category: '',
        unit: linea.unidad || 'ud',
        pvp: pvp_snapshot,
        descuento_empresa: desc_snapshot,
        iva: iva_snapshot,
        precio_neto,
        unit_price: precio_neto,
        fecha_ultimo_precio: fecha_snapshot,
        supplier: documento.proveedor_nombre || '',
        description: '',
        active: true,
      });
      try {
        await base44.entities.MaterialPrecioHistorico.update(historico.id, { material_id: material.id });
      } catch {}
    }

    resultados.push({
      descripcion,
      referencia,
      material_id: material.id,
      material_existia: precio_anterior != null,
      variacion_pct: variacion_pct != null ? Number(variacion_pct.toFixed(2)) : null,
      origen_cambio,
    });
  }

  return {
    success: true,
    documento_id: doc.id,
    lineas_guardadas: resultados.length,
    resultados,
  };
}