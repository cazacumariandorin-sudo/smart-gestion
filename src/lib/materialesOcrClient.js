import { base44 } from '@/api/base44Client';

const TIPOS_DOC = ['factura', 'albaran', 'ticket', 'proforma'];

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

function normalizeName(s) {
  if (!s) return '';
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export async function guardarMaterialesOcr(documento, lineas) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (!Array.isArray(lineas) || !lineas.length) {
    throw new Error('No hay líneas a guardar');
  }

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
    nota_gasto_id: documento.nota_gasto_id || '',
    nota_origen_tipo: documento.nota_origen_tipo || '',
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
    const cantidad = Number(linea.cantidad || 1);
    const descripcion = (linea.descripcion || '').trim();
    const referencia = (linea.referencia || '').trim();
    if (!descripcion && !precio_neto) continue;

    const fabricanteRaw = linea.fabricante || documento.proveedor_nombre || '';
    const fab = await resolverFabricante(fabricanteRaw);

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

    try {
      await base44.entities.LineaFactura.create({
        obra_id: documento.obra_id || '',
        documento_origen_id: doc.id,
        numero_factura: documento.numero || '',
        proveedor_nombre: documento.proveedor_nombre || '',
        proveedor_nif: documento.proveedor_nif || '',
        fecha_documento: documento.fecha || hoy,
        linea_id: `${doc.id}-${resultados.length + 1}`,
        referencia,
        fabricante_id: fab?.id || '',
        fabricante_name: fab?.name || fabricanteRaw || '',
        material_id: material?.id || '',
        cantidad_facturada: cantidad,
        unidad: linea.unidad || material?.unit || 'ud',
        precio_unitario_neto: precio_neto,
        importe_neto: Number((cantidad * precio_neto).toFixed(2)),
        estado: 'pendiente_revision',
        confianza: linea.confianza || 'media',
      });
    } catch (e) {
      console.warn('No se pudo crear LineaFactura para la línea OCR:', e?.message || e);
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
      documento_url: documento.archivo_url || documento.archivo_url_original || '',
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
