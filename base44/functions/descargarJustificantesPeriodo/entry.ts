import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import JSZip from 'npm:jszip@3.10.1';
import * as XLSX from 'npm:xlsx@0.18.5';

// Descarga en bloque de justificantes para la gestoría externa.
// Recopila los archivos de RegistroGasto (estados aprobados/pagados) y
// MaterialDocumentoOrigen (procesado) de un periodo, genera un ZIP por grupo
// (troceando por operario si el volumen supera el límite) y un Excel índice
// con TODAS las columnas del registro (aunque estén vacías).
//
// Acceso: contabilidad, administracion, gerencia, admin, propietario.

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';
const LIMITE_POR_ZIP = 200; // documentos máximos por ZIP antes de trocear por operario
const FETCH_TIMEOUT_MS = 8000;

const COLUMNAS_GASTO = [
  'numero_nota', 'fecha_documento', 'operario_name', 'nombre_comercio', 'nif_comercio',
  'categoria', 'concepto', 'importe', 'obra_name', 'obra_tipo', 'estado', 'origen_pago',
  'metodo_pago', 'numero_factura', 'localidad', 'forma_pago_documento',
  'codigo_validacion_fiscal', 'estado_conciliacion', 'conciliado_por', 'fecha_conciliacion',
  'aprobado_por', 'fecha_aprobacion', 'pagado_por', 'fecha_pago', 'precisa_precision',
  'precision_motivo', 'zip_grupo', 'archivo_nombre', 'archivo_url',
];

const COLUMNAS_DOC = [
  'tipo', 'numero_documento', 'fecha_documento', 'proveedor_nombre', 'proveedor_nif',
  'obra_name', 'estado', 'estado_conciliacion', 'conciliado_por', 'fecha_conciliacion',
  'zip_grupo', 'archivo_nombre', 'archivo_url',
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
    const { inicio, fin, tipo_doc = 'ambos', operario_id, etiqueta, incluir_descargados = false } = body;
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
      gastos = await base44.asServiceRole.entities.RegistroGasto.filter(f, '-fecha_documento', 500);
    }
    if (quiereDoc) {
      const f = { estado: 'procesado', fecha_documento: { $gte: inicio, $lte: fin }, ...noDescargados };
      if (operario_id) f.operario_id = operario_id;
      documentos = await base44.asServiceRole.entities.MaterialDocumentoOrigen.filter(f, '-fecha_documento', 500);
    }

    // 2. Construir lista plana de "items" con su archivo y metadatos
    const items = [];
    for (const g of gastos) {
      const archivos = Array.isArray(g.archivos) ? g.archivos : [];
      const archivo = archivos[0] || null;
      items.push({
        tipo: 'gasto',
        id: g.id,
        operario_id: g.operario_id || '_sin_operario',
        operario_name: g.operario_name || 'Sin operario',
        archivo_url: archivo?.url || null,
        archivo_nombre: archivo?.nombre || null,
        data: g,
      });
    }
    for (const d of documentos) {
      const url = d.archivo_url_mejorado || d.archivo_url_original || null;
      items.push({
        tipo: 'documento',
        id: d.id,
        operario_id: d.operario_id || '_sin_operario',
        operario_name: 'Material',
        archivo_url: url,
        archivo_nombre: null,
        data: d,
      });
    }

    if (items.length === 0) {
      return Response.json({ success: true, zips: [], indice_excel_url: null, total_docs: 0, troceado: false, mensaje: 'No hay documentos con archivo en el periodo seleccionado.' });
    }

    // 3. Decidir troceo: agrupar por operario si > LIMITE y no se filtró un solo operario
    const conArchivo = items.filter(it => it.archivo_url);
    const troceado = !operario_id && conArchivo.length > LIMITE_POR_ZIP;
    const grupos = {};
    if (troceado) {
      for (const it of conArchivo) {
        const k = it.operario_id || '_sin_operario';
        (grupos[k] ||= { operario_name: it.operario_name, items: [] }).items.push(it);
      }
    } else {
      grupos['_todo'] = { operario_name: operario_id ? (gastos[0]?.operario_name || 'Operario') : 'Todos', items: conArchivo };
    }

    // 4. Generar un ZIP por grupo
    const zips = [];
    const etiquetaSafe = (etiqueta || `${inicio}_${fin}`).replace(/[^\w-]/g, '_');
    let grupoIdx = 0;
    for (const [key, grp] of Object.entries(grupos)) {
      grupoIdx++;
      const zip = new JSZip();
      const usados = new Set();
      let okCount = 0;
      let errCount = 0;
      // fetch en lotes de 5
      const lote = [...grp.items];
      for (let i = 0; i < lote.length; i += 5) {
        const chunk = lote.slice(i, i + 5);
        const resultados = await Promise.all(chunk.map(async (it, j) => {
          const idxGlobal = i + j;
          try {
            const ctrl = AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : null;
            const resp = await fetch(it.archivo_url, { signal: ctrl });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const buf = await resp.arrayBuffer();
            const ext = guessExt(it.archivo_url, it.archivo_nombre);
            let base = sanitizeName(it.archivo_nombre) || `${it.tipo}_${it.id}`;
            base = base.replace(/\.[a-z0-9]+$/i, '');
            let nombre = `${String(idxGlobal + 1).padStart(3, '0')}_${base}${ext}`;
            let n = 1;
            while (usados.has(nombre)) { nombre = `${String(idxGlobal + 1).padStart(3, '0')}_${base}_${n}${ext}`; n++; }
            usados.add(nombre);
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
      if (okCount === 0) continue;
      const zipBytes = await zip.generateAsync({ type: 'arraybuffer' });
      const grupoLabel = troceado ? sanitizeName(grp.operario_name) : 'TODOS';
      const fileName = `JUSTIFICANTES_${etiquetaSafe}_${grupoLabel}.zip`;
      const uploadUrl = await subirArchivo(base44, zipBytes, 'application/zip', fileName);
      zips.push({ operario_name: grp.operario_name, url: uploadUrl, count: okCount, errores: errCount, grupo_idx: grupoIdx });
    }

    // 5. Excel índice (todas las columnas, aunque vacías) — incluye TODOS los items (con o sin archivo)
    const wb = XLSX.utils.book_new();
    const filasGasto = items.filter(it => it.tipo === 'gasto').map((it, i) => {
      const g = it.data;
      const fila = {};
      COLUMNAS_GASTO.forEach(c => { fila[c] = g[c] ?? ''; });
      fila.zip_grupo = it._zip_nombre ? (troceado ? sanitizeName(it.operario_name) : 'TODOS') : '';
      fila.archivo_nombre = it._zip_nombre || '';
      fila.archivo_url = it.archivo_url || '';
      return fila;
    });
    const filasDoc = items.filter(it => it.tipo === 'documento').map((it) => {
      const d = it.data;
      const fila = {};
      COLUMNAS_DOC.forEach(c => { fila[c] = d[c] ?? ''; });
      fila.zip_grupo = it._zip_nombre ? (troceado ? sanitizeName(it.operario_name) : 'TODOS') : '';
      fila.archivo_nombre = it._zip_nombre || '';
      fila.archivo_url = it.archivo_url || '';
      return fila;
    });
    if (filasGasto.length) {
      const ws = XLSX.utils.json_to_sheet(filasGasto, { header: COLUMNAS_GASTO });
      XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    }
    if (filasDoc.length) {
      const ws = XLSX.utils.json_to_sheet(filasDoc, { header: COLUMNAS_DOC });
      XLSX.utils.book_append_sheet(wb, ws, 'Documentos materiales');
    }
    // Resumen
    const resumen = [
      ['Periodo', etiqueta || `${inicio} - ${fin}`],
      ['Fecha generación', new Date().toLocaleString('es-ES')],
      ['Generado por', user.email],
      ['Total documentos', items.length],
      ['Con archivo', conArchivo.length],
      ['Troceado por operario', troceado ? 'Sí' : 'No'],
      ['ZIPs generados', zips.length],
      ...zips.map((z, i) => [`ZIP ${i + 1} - ${z.operario_name}`, `${z.count} archivos (${z.errores} fallos) - ${z.url}`]),
    ];
    const wsRes = XLSX.utils.aoa_to_sheet(resumen);
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

    const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const indiceUrl = await subirArchivo(base44, xlsxBuf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `INDICE_${etiquetaSafe}.xlsx`);

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
      troceado,
      mensaje: zips.length ? 'ZIPs generados correctamente.' : 'No se pudo descargar ningún archivo (¿URLs caducadas?).',
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function subirArchivo(base44, bytes, mime, fileName) {
  // Primario: Google Drive
  try {
    const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
    const accessToken = conn?.accessToken;
    if (!accessToken) throw new Error('Drive no conectado');
    const folderId = await getOrCreateFolder(accessToken, 'Contabilidad/Justificantes');
    const blob = new Blob([bytes], { type: mime });
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [folderId] })], { type: 'application/json' }));
    formData.append('file', blob, fileName);
    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    if (!uploadRes.ok) throw new Error('Upload Drive failed');
    const driveFile = await uploadRes.json();
    await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }).catch(() => {});
    return `https://drive.google.com/uc?id=${driveFile.id}&export=download`;
  } catch (e) {
    // Fallback CDN
    const arr = new Uint8Array(bytes);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < arr.length; i += chunk) {
      binary += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file: dataUrl });
    return file_url;
  }
}

async function getOrCreateFolder(accessToken, folderPath) {
  const folders = folderPath.split('/').filter(Boolean);
  let parentId = ROOT_FOLDER_ID;
  for (const name of folders) {
    const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.files?.length > 0) {
      parentId = data.files[0].id;
    } else {
      const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
      });
      parentId = (await cr.json()).id;
    }
  }
  return parentId;
}

function guessExt(url, nombre) {
  const ref = (nombre || url || '').toLowerCase();
  const m = ref.match(/\.(pdf|jpg|jpeg|png|gif|webp|heic|tiff?|bmp)$/);
  if (m) return '.' + m[1];
  return '.bin';
}

function sanitizeName(s) {
  if (!s) return '';
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_\-\. ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
}