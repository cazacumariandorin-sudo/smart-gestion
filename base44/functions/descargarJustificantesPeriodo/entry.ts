import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import JSZip from 'npm:jszip@3.10.1';
import * as XLSX from 'npm:xlsx@0.18.5';
import { subirArchivoDrive, guessExt, sanitizeName, dedupName } from '../../shared/zipDriveHelpers.ts';

// Descarga en bloque de justificantes para la gestoría externa.
// Recopila los archivos de RegistroGasto (estados aprobados/pagados) y
// MaterialDocumentoOrigen (procesado) de un periodo, genera un ZIP por grupo
// (troceando por operario si el volumen supera el límite) con subcarpetas
// facturas/, tickets/, fotos/ y un Excel índice con hoja "Fotos" que vincula
// cada justificante a su registro.
//
// Filtros nuevos:
//   tipo_archivo: todos | factura (numero_factura no vacío) | ticket (sin nº)
//   categoria: material | combustible | peaje | parking | comida | otros
//
// Acceso: contabilidad, administracion, gerencia, admin, propietario.

const LIMITE_POR_ZIP = 200; // documentos máximos por ZIP antes de trocear por operario
const FETCH_TIMEOUT_MS = 8000;

const COLUMNAS_GASTO = [
  'numero_nota', 'fecha_documento', 'operario_name', 'nombre_comercio', 'nif_comercio',
  'categoria', 'tipo_documento', 'concepto', 'importe', 'obra_name', 'obra_tipo', 'estado', 'origen_pago',
  'metodo_pago', 'numero_factura', 'localidad', 'forma_pago_documento',
  'codigo_validacion_fiscal', 'estado_conciliacion', 'conciliado_por', 'fecha_conciliacion',
  'aprobado_por', 'fecha_aprobacion', 'pagado_por', 'fecha_pago', 'precisa_precision',
  'precision_motivo', 'categoria_filtro', 'zip_grupo', 'archivo_nombre', 'archivo_url',
];

const COLUMNAS_DOC = [
  'tipo', 'numero_documento', 'fecha_documento', 'proveedor_nombre', 'proveedor_nif',
  'obra_name', 'estado', 'estado_conciliacion', 'conciliado_por', 'fecha_conciliacion',
  'zip_grupo', 'archivo_nombre', 'archivo_url',
];

const COLUMNAS_FOTO = [
  'registro_id', 'numero_nota', 'operario_name', 'categoria', 'fecha_documento',
  'nombre_foto', 'ruta_en_zip', 'archivo_url',
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const rolesOk = ['admin', 'propietario', 'gerencia', 'administracion', 'contabilidad'];
    if (!rolesOk.includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo contabilidad/administracion/gerencia/admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      inicio, fin, tipo_doc = 'ambos', tipo_archivo = 'todos', categoria,
      operario_id, etiqueta, incluir_descargados = false,
    } = body;
    if (!inicio || !fin) return Response.json({ error: 'inicio y fin requeridos (YYYY-MM-DD)' }, { status: 400 });

    const quiereGasto = tipo_doc === 'registro' || tipo_doc === 'ambos';
    const quiereDoc = tipo_doc === 'documento' || tipo_doc === 'ambos';

    // 1. Recopilar registros
    let gastos = [];
    let documentos = [];
    const noDescargados = incluir_descargados ? {} : { descargado_contabilidad: { $ne: true } };
    if (quiereGasto) {
      const f = { estado: { $in: ['aprobado_gerencia', 'registrado', 'en_administracion', 'pagada'] }, fecha_documento: { $gte: inicio, $lte: fin }, ...noDescargados };
      if (operario_id) f.operario_id = operario_id;
      if (categoria) f.categoria = categoria;
      gastos = await base44.asServiceRole.entities.RegistroGasto.filter(f, '-fecha_documento', 500);
      // Filtro tipo_archivo: factura = numero_factura no vacío; ticket = vacío
      if (tipo_archivo === 'factura') {
        gastos = gastos.filter(g => g.numero_factura && String(g.numero_factura).trim() !== '');
      } else if (tipo_archivo === 'ticket') {
        gastos = gastos.filter(g => !g.numero_factura || String(g.numero_factura).trim() === '');
      }
    }
    if (quiereDoc) {
      const f = { estado: 'procesado', fecha_documento: { $gte: inicio, $lte: fin }, ...noDescargados };
      if (operario_id) f.operario_id = operario_id;
      documentos = await base44.asServiceRole.entities.MaterialDocumentoOrigen.filter(f, '-fecha_documento', 500);
    }

    // 2. Construir lista plana de "items" con su archivo y metadatos
    //    tipo_subcarpeta: 'factura' | 'ticket'  → dónde va el archivo en el ZIP
    //    fotos: copia de cada justificante de RegistroGasto va a fotos/
    const items = [];
    const fotosItems = []; // un item por cada archivo de RegistroGasto.archivos (para hoja Fotos)
    for (const g of gastos) {
      const archivos = Array.isArray(g.archivos) ? g.archivos : [];
      const esFactura = g.numero_factura && String(g.numero_factura).trim() !== '';
      const tipoSub = esFactura ? 'factura' : 'ticket';
      const archivo = archivos[0] || null;
      items.push({
        tipo: 'gasto',
        id: g.id,
        operario_id: g.operario_id || '_sin_operario',
        operario_name: g.operario_name || 'Sin operario',
        tipo_sub: tipoSub,
        archivo_url: archivo?.url || null,
        archivo_nombre: archivo?.nombre || null,
        data: g,
      });
      // Fotos: una entrada por cada archivo (copia en fotos/)
      for (let i = 0; i < archivos.length; i++) {
        const a = archivos[i];
        if (!a?.url) continue;
        fotosItems.push({
          registro_id: g.id,
          numero_nota: g.numero_nota || '',
          operario_id: g.operario_id || '_sin_operario',
          operario_name: g.operario_name || 'Sin operario',
          categoria: g.categoria || '',
          fecha_documento: g.fecha_documento || '',
          nombre_foto: a.nombre || `foto_${g.id}_${i + 1}`,
          archivo_url: a.url,
          archivo_index: i,
        });
      }
    }
    for (const d of documentos) {
      const url = d.archivo_url_mejorado || d.archivo_url_original || null;
      const tipoDocSub = ['factura', 'presupuesto', 'pedido'].includes(d.tipo) ? 'factura' : 'ticket';
      items.push({
        tipo: 'documento',
        id: d.id,
        operario_id: d.operario_id || '_sin_operario',
        operario_name: 'Material',
        tipo_sub: tipoDocSub,
        archivo_url: url,
        archivo_nombre: null,
        data: d,
      });
    }

    if (items.length === 0 && fotosItems.length === 0) {
      return Response.json({ success: true, zips: [], indice_excel_url: null, total_docs: 0, troceado: false, mensaje: 'No hay documentos con archivo en el periodo seleccionado.' });
    }

    // 3. Decidir troceo: agrupar por operario si > LIMITE y no se filtró un solo operario
    const conArchivo = items.filter(it => it.archivo_url);
    const fotosConArchivo = fotosItems.filter(f => f.archivo_url);
    const troceado = !operario_id && (conArchivo.length + fotosConArchivo.length) > LIMITE_POR_ZIP;

    // Función para construir la ruta dentro del ZIP de un item principal (factura/ticket)
    function rutaPrincipal(it, idx, grupoLabel) {
      const sub = it.tipo_sub === 'factura' ? 'facturas' : 'tickets';
      const ext = guessExt(it.archivo_url, it.archivo_nombre);
      let base = sanitizeName(it.archivo_nombre) || `${it.tipo}_${it.id}`;
      base = base.replace(/\.[a-z0-9]+$/i, '');
      return `${sub}/${String(idx + 1).padStart(3, '0')}_${base}${ext}`;
    }

    // Función para construir la ruta de una foto dentro de fotos/
    // Si categoria filter activo → fotos/{categoria}/; si troceado (ZIP por operario) → fotos/ plano;
    // si no troceado (ZIP único "TODOS") → fotos/{operario}/
    function rutaFoto(f, idx, troceadoActivo, categoriaActiva) {
      const ext = guessExt(f.archivo_url, f.nombre_foto);
      let base = sanitizeName(f.nombre_foto) || `foto_${f.registro_id}_${f.archivo_index + 1}`;
      base = base.replace(/\.[a-z0-9]+$/i, '');
      let carpeta = 'fotos';
      if (categoriaActiva) {
        carpeta = `fotos/${sanitizeName(f.categoria || 'sin_categoria')}`;
      } else if (!troceadoActivo) {
        carpeta = `fotos/${sanitizeName(f.operario_name)}`;
      }
      return `${carpeta}/${String(idx + 1).padStart(3, '0')}_${base}${ext}`;
    }

    // 4. Generar un ZIP por grupo (operario si troceado, sino uno solo "TODOS")
    const zips = [];
    const etiquetaSafe = (etiqueta || `${inicio}_${fin}`).replace(/[^\w-]/g, '_');

    // Agrupar items principales y fotos por operario
    const grupos = {};
    if (troceado) {
      for (const it of conArchivo) {
        const k = it.operario_id || '_sin_operario';
        (grupos[k] ||= { operario_name: it.operario_name, items: [], fotos: [] }).items.push(it);
      }
      for (const f of fotosConArchivo) {
        const k = f.operario_id || '_sin_operario';
        if (!grupos[k]) grupos[k] = { operario_name: f.operario_name, items: [], fotos: [] };
        grupos[k].fotos.push(f);
      }
    } else {
      const opName = operario_id ? (gastos[0]?.operario_name || 'Operario') : 'Todos';
      grupos['_todo'] = { operario_name: opName, items: conArchivo, fotos: fotosConArchivo };
    }

    let grupoIdx = 0;
    for (const [key, grp] of Object.entries(grupos)) {
      grupoIdx++;
      const zip = new JSZip();
      const usados = new Set();
      let okCount = 0;
      let errCount = 0;

      // Descargar archivos principales (facturas/ y tickets/) en lotes de 5
      const lote = [...grp.items];
      for (let i = 0; i < lote.length; i += 5) {
        const chunk = lote.slice(i, i + 5);
        await Promise.all(chunk.map(async (it, j) => {
          const idxGlobal = i + j;
          try {
            const ctrl = AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : null;
            const resp = await fetch(it.archivo_url, { signal: ctrl });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const buf = await resp.arrayBuffer();
            let nombre = rutaPrincipal(it, idxGlobal, grp.operario_name);
            nombre = dedupName(usados, nombre);
            zip.file(nombre, buf);
            it._zip_nombre = nombre;
            okCount++;
            return true;
          } catch (e) {
            errCount++;
            it._zip_nombre = null;
            return false;
          }
        }));
      }

      // Descargar fotos (fotos/) en lotes de 5
      let fotoOkCount = 0;
      let fotoErrCount = 0;
      const loteFotos = [...grp.fotos];
      for (let i = 0; i < loteFotos.length; i += 5) {
        const chunk = loteFotos.slice(i, i + 5);
        await Promise.all(chunk.map(async (f, j) => {
          const idxGlobal = i + j;
          try {
            const ctrl = AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : null;
            const resp = await fetch(f.archivo_url, { signal: ctrl });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const buf = await resp.arrayBuffer();
            let nombre = rutaFoto(f, idxGlobal, troceado, !!categoria);
            nombre = dedupName(usados, nombre);
            zip.file(nombre, buf);
            f._zip_nombre = nombre;
            fotoOkCount++;
            return true;
          } catch (e) {
            fotoErrCount++;
            f._zip_nombre = null;
            return false;
          }
        }));
      }

      if (okCount === 0 && fotoOkCount === 0) continue;
      const zipBytes = await zip.generateAsync({ type: 'arraybuffer' });
      const grupoLabel = troceado ? sanitizeName(grp.operario_name) : 'TODOS';
      const fileName = `JUSTIFICANTES_${etiquetaSafe}_${grupoLabel}.zip`;
      const uploadUrl = await subirArchivoDrive(base44, zipBytes, 'application/zip', fileName);
      zips.push({
        operario_name: grp.operario_name,
        url: uploadUrl,
        count: okCount + fotoOkCount,
        archivos_doc: okCount,
        fotos: fotoOkCount,
        errores: errCount + fotoErrCount,
        grupo_idx: grupoIdx,
      });
    }

    // 5. Excel índice — hojas: Gastos, Documentos materiales, Fotos, Resumen
    const wb = XLSX.utils.book_new();

    // Hoja Gastos
    const filasGasto = items.filter(it => it.tipo === 'gasto').map((it) => {
      const g = it.data;
      const fila = {};
      COLUMNAS_GASTO.forEach(c => {
        if (c === 'tipo_documento') fila[c] = it.tipo_sub === 'factura' ? 'factura' : 'ticket';
        else if (c === 'categoria_filtro') fila[c] = categoria || '';
        else if (c === 'zip_grupo') fila[c] = it._zip_nombre ? (troceado ? sanitizeName(it.operario_name) : 'TODOS') : '';
        else if (c === 'archivo_nombre') fila[c] = it._zip_nombre || '';
        else if (c === 'archivo_url') fila[c] = it.archivo_url || '';
        else fila[c] = g[c] ?? '';
      });
      return fila;
    });
    if (filasGasto.length) {
      const ws = XLSX.utils.json_to_sheet(filasGasto, { header: COLUMNAS_GASTO });
      XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    }

    // Hoja Documentos materiales
    const filasDoc = items.filter(it => it.tipo === 'documento').map((it) => {
      const d = it.data;
      const fila = {};
      COLUMNAS_DOC.forEach(c => {
        if (c === 'zip_grupo') fila[c] = it._zip_nombre ? (troceado ? sanitizeName(it.operario_name) : 'TODOS') : '';
        else if (c === 'archivo_nombre') fila[c] = it._zip_nombre || '';
        else if (c === 'archivo_url') fila[c] = it.archivo_url || '';
        else fila[c] = d[c] ?? '';
      });
      return fila;
    });
    if (filasDoc.length) {
      const ws = XLSX.utils.json_to_sheet(filasDoc, { header: COLUMNAS_DOC });
      XLSX.utils.book_append_sheet(wb, ws, 'Documentos materiales');
    }

    // Hoja Fotos — una fila por cada archivo de RegistroGasto.archivos
    const filasFoto = fotosItems.map((f) => {
      const fila = {};
      COLUMNAS_FOTO.forEach(c => {
        if (c === 'nombre_foto') fila[c] = f.nombre_foto || '';
        else if (c === 'ruta_en_zip') fila[c] = f._zip_nombre || '';
        else if (c === 'archivo_url') fila[c] = f.archivo_url || '';
        else fila[c] = f[c] ?? '';
      });
      return fila;
    });
    if (filasFoto.length) {
      const ws = XLSX.utils.json_to_sheet(filasFoto, { header: COLUMNAS_FOTO });
      XLSX.utils.book_append_sheet(wb, ws, 'Fotos');
    }

    // Hoja Resumen
    const resumen = [
      ['Periodo', etiqueta || `${inicio} - ${fin}`],
      ['Fecha generación', new Date().toLocaleString('es-ES')],
      ['Generado por', user.email],
      ['Filtros', `tipo_doc=${tipo_doc} · tipo_archivo=${tipo_archivo} · categoria=${categoria || 'todas'} · operario=${operario_id || 'todos'}`],
      ['Total documentos', items.length],
      ['Con archivo', conArchivo.length],
      ['Fotos (justificantes)', fotosItems.length],
      ['Fotos con archivo', fotosConArchivo.length],
      ['Troceado por operario', troceado ? 'Sí' : 'No'],
      ['ZIPs generados', zips.length],
      ...zips.map((z, i) => [`ZIP ${i + 1} - ${z.operario_name}`, `${z.count} archivos (${z.archivos_doc} docs + ${z.fotos} fotos, ${z.errores} fallos) - ${z.url}`]),
    ];
    const wsRes = XLSX.utils.aoa_to_sheet(resumen);
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

    const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const indiceUrl = await subirArchivoDrive(base44, xlsxBuf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `INDICE_${etiquetaSafe}.xlsx`);

    // 6. Marcar documentos incluidos en un ZIP como descargados (evita reenvíos)
    if (!incluir_descargados) {
      const now = new Date().toISOString();
      const gastoIds = items.filter(it => it.tipo === 'gasto' && it._zip_nombre).map(it => it.id);
      const docIds = items.filter(it => it.tipo === 'documento' && it._zip_nombre).map(it => it.id);
      if (gastoIds.length) await base44.asServiceRole.entities.RegistroGasto.updateMany({ id: { $in: gastoIds } }, { $set: { descargado_contabilidad: true, fecha_descarga: now, descargado_por: user.email } }).catch(() => {});
      if (docIds.length) await base44.asServiceRole.entities.MaterialDocumentoOrigen.updateMany({ id: { $in: docIds } }, { $set: { descargado_contabilidad: true, fecha_descarga: now, descargado_por: user.email } }).catch(() => {});
    }

    return Response.json({
      success: true,
      zips,
      indice_excel_url: indiceUrl,
      total_docs: items.length,
      con_archivo: conArchivo.length,
      fotos: fotosItems.length,
      fotos_con_archivo: fotosConArchivo.length,
      troceado,
      mensaje: zips.length ? 'ZIPs generados correctamente.' : 'No se pudo descargar ningún archivo (¿URLs caducadas?).',
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}