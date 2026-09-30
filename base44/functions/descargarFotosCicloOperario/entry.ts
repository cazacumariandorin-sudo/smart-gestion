import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import JSZip from 'npm:jszip@3.10.1';
import * as XLSX from 'npm:xlsx@0.18.5';
import { subirArchivoDrive, guessExt, sanitizeName, dedupName } from '../../shared/zipDriveHelpers.ts';

// Descarga SOLO las fotos (justificantes) de un ciclo + operario.
// Rescate de fotos cuando un registro se hizo mal pero las fotos se reutilizan.
// No filtra por estado, no marca descargado_contabilidad.
//
// Permisos:
//   - técnico/operario: descarga SOLO sus propias fotos (operario_id se
//     ignora y se resuelve al Operario vinculado a user.email).
//   - gerencia/administracion/contabilidad/admin/propietario: pueden pasar
//     operario_id (opcional) para cualquier operario del ciclo.
//
// Entrada: { ciclo_mes: "2026-08", operario_id?: "..." }
// Salida: { success, zip_url, indice_excel_url, total_fotos, total_archivos, errores, mensaje? }

const FETCH_TIMEOUT_MS = 8000;
const ROLES_PRIVILEGIADOS = ['admin', 'propietario', 'gerencia', 'administracion', 'contabilidad'];

const COLUMNAS_INDICE = [
  'numero_nota', 'fecha_documento', 'operario_name', 'categoria', 'nombre_comercio',
  'importe', 'numero_factura', 'codigo_validacion_fiscal', 'nombre_foto',
  'ruta_en_zip', 'registro_id', 'archivo_url',
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { ciclo_mes, operario_id } = body;
    if (!ciclo_mes || !/^\d{4}-\d{2}$/.test(ciclo_mes)) {
      return Response.json({ error: 'ciclo_mes requerido (YYYY-MM)' }, { status: 400 });
    }

    // Resolver operario_id efectivo según rol
    let operarioIdEfectivo = operario_id || null;
    const esPrivilegiado = ROLES_PRIVILEGIADOS.includes(user.role);
    if (!esPrivilegiado) {
      const ops = await base44.asServiceRole.entities.Operario.filter(
        { user_email: user.email }, undefined, 5,
      );
      const arr = Array.isArray(ops) ? ops : (ops?.items || []);
      const miOp = arr[0];
      if (!miOp) {
        return Response.json({ error: 'No tienes un perfil de operario vinculado' }, { status: 403 });
      }
      operarioIdEfectivo = miOp.id;
    }

    // Recopilar registros del ciclo (sin filtro de estado, sin excluir descargados)
    const filtro = { ciclo_mes };
    if (operarioIdEfectivo) filtro.operario_id = operarioIdEfectivo;
    const gastos = await base44.asServiceRole.entities.RegistroGasto.filter(
      filtro, '-fecha_documento', 500,
    );

    // Construir lista plana de fotos
    const fotos = [];
    for (const g of gastos) {
      const archivos = Array.isArray(g.archivos) ? g.archivos : [];
      archivos.forEach((a, i) => {
        if (!a?.url) return;
        fotos.push({
          registro_id: g.id,
          numero_nota: g.numero_nota || '',
          operario_id: g.operario_id || '',
          operario_name: g.operario_name || '',
          categoria: g.categoria || '',
          nombre_comercio: g.nombre_comercio || '',
          fecha_documento: g.fecha_documento || '',
          importe: g.importe ?? null,
          numero_factura: g.numero_factura || '',
          codigo_validacion_fiscal: g.codigo_validacion_fiscal || '',
          nombre_foto: a.nombre || `foto_${g.id}_${i + 1}`,
          archivo_url: a.url,
          archivo_index: i,
        });
      });
    }

    if (fotos.length === 0) {
      return Response.json({
        success: true, zip_url: null, indice_excel_url: null,
        total_fotos: 0, total_archivos: 0, errores: 0,
        mensaje: 'No hay fotos de justificantes para el ciclo/operario seleccionado.',
      });
    }

    // Generar ZIP con subcarpeta fotos/
    const zip = new JSZip();
    const usados = new Set();
    let okCount = 0;
    let errCount = 0;

    for (let i = 0; i < fotos.length; i += 5) {
      const chunk = fotos.slice(i, i + 5);
      await Promise.all(chunk.map(async (f, j) => {
        const idxGlobal = i + j;
        try {
          const ctrl = AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : null;
          const resp = await fetch(f.archivo_url, { signal: ctrl });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const buf = await resp.arrayBuffer();
          const ext = guessExt(f.archivo_url, f.nombre_foto);
          let base = sanitizeName(f.nombre_foto) || `foto_${f.registro_id}_${f.archivo_index + 1}`;
          base = base.replace(/\.[a-z0-9]+$/i, '');
          const prefijo = String(idxGlobal + 1).padStart(3, '0');
          const sufijo = f.numero_nota ? `_${f.numero_nota}` : '';
          let nombre = `fotos/${prefijo}${sufijo}_${base}${ext}`;
          nombre = dedupName(usados, nombre);
          zip.file(nombre, buf);
          f._zip_nombre = nombre;
          okCount++;
        } catch (e) {
          errCount++;
          f._zip_nombre = null;
        }
      }));
    }

    if (okCount === 0) {
      return Response.json({ success: false, error: 'No se pudo descargar ninguna foto (¿URLs inaccesibles?).' });
    }

    const zipBytes = await zip.generateAsync({ type: 'arraybuffer' });
    const opLabel = operarioIdEfectivo
      ? sanitizeName(gastos[0]?.operario_name || 'operario')
      : 'TODOS';
    const fileName = `FOTOS_${ciclo_mes}_${opLabel}.zip`;
    const zipUrl = await subirArchivoDrive(base44, zipBytes, 'application/zip', fileName, 'Contabilidad/Fotos-Rescate');

    // Excel índice
    const wb = XLSX.utils.book_new();
    const filas = fotos.map(f => {
      const fila = {};
      COLUMNAS_INDICE.forEach(c => {
        if (c === 'nombre_foto') fila[c] = f.nombre_foto || '';
        else if (c === 'ruta_en_zip') fila[c] = f._zip_nombre || '';
        else if (c === 'archivo_url') fila[c] = f.archivo_url || '';
        else if (c === 'importe') fila[c] = f.importe ?? '';
        else fila[c] = f[c] ?? '';
      });
      return fila;
    });
    const ws = XLSX.utils.json_to_sheet(filas, { header: COLUMNAS_INDICE });
    XLSX.utils.book_append_sheet(wb, ws, 'Fotos');
    const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const indiceUrl = await subirArchivoDrive(
      base44, xlsxBuf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      `INDICE_FOTOS_${ciclo_mes}_${opLabel}.xlsx`,
      'Contabilidad/Fotos-Rescate',
    );

    return Response.json({
      success: true,
      zip_url: zipUrl,
      indice_excel_url: indiceUrl,
      total_fotos: fotos.length,
      total_archivos: okCount,
      errores: errCount,
      ciclo_mes,
      operario_id: operarioIdEfectivo,
      operario_name: operarioIdEfectivo ? (gastos[0]?.operario_name || '') : '',
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}