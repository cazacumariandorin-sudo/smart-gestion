import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

// Exporta un ciclo mensual de gastos (NotaMensualGasto) a contabilidad:
// 1. Recopila todos los RegistroGasto del ciclo.
// 2. Genera un PDF índice (resumen por categoría + tabla detalle) con cabecera SIMANTEC.
// 3. Sube el PDF a Google Drive en /Contabilidad/Gastos/<ciclo_mes>/ (o Base44 CDN si Drive no está disponible).
// 4. Marca el ciclo como 'en_contabilidad' y guarda export_contabilidad_url + fecha_export_contabilidad.
//
// Solo gerencia/admin.

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Unauthorized: solo gerencia/admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { nota_mensual_id } = body;
    if (!nota_mensual_id) return Response.json({ error: 'nota_mensual_id requerido' }, { status: 400 });

    const nota = await base44.asServiceRole.entities.NotaMensualGasto.get(nota_mensual_id).catch(() => null);
    if (!nota) return Response.json({ error: 'Ciclo no encontrado' }, { status: 404 });

    // Recopilar registros del ciclo
    let registros = [];
    if (Array.isArray(nota.registros_ids) && nota.registros_ids.length > 0) {
      const got = await Promise.all((nota.registros_ids || []).map(id => base44.asServiceRole.entities.RegistroGasto.get(id).catch(() => null)));
      registros = got.filter(Boolean);
    }
    if (registros.length === 0) {
      // Fallback: buscar por nota_mensual_id y, si no, por ciclo_mes + operario_id
      registros = await base44.asServiceRole.entities.RegistroGasto.filter({ nota_mensual_id: nota.id });
      if (!registros || registros.length === 0) {
        registros = await base44.asServiceRole.entities.RegistroGasto.filter({ ciclo_mes: nota.ciclo_mes, operario_id: nota.operario_id });
      }
    }
    registros = (registros || []).filter(Boolean);
    if (registros.length === 0) {
      return Response.json({ success: false, error: 'El ciclo no tiene registros para exportar' }, { status: 400 });
    }

    registros.sort((a, b) => (a.orden_en_ciclo ?? 0) - (b.orden_en_ciclo ?? 0) || (a.fecha_documento || '').localeCompare(b.fecha_documento || ''));

    // Generar PDF índice
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(234, 88, 12);
    doc.rect(0, 0, pageW, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SIMANTEC - Nota Mensual de Gastos', 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Operario: ${nota.operario_name || '-'}`, 14, 24);
    doc.text(`Ciclo: ${nota.numero_ciclo || nota.ciclo_mes || '-'}`, 14, 30);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} (export contabilidad)`, pageW - 90, 24);

    doc.setTextColor(0, 0, 0);

    // Totales por categoría
    const categorias = ['material', 'combustible', 'peaje', 'parking', 'comida', 'otros'];
    const totalesCat = {};
    categorias.forEach(c => { totalesCat[c] = registros.filter(r => r.categoria === c).reduce((s, r) => s + (r.importe || 0), 0); });
    const totalGeneral = registros.reduce((s, r) => s + (r.importe || 0), 0);

    let y = 45;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen por categoría', 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(248, 248, 248);
    doc.rect(14, y, pageW - 28, 8 * categorias.length + 10, 'F');
    y += 5;
    categorias.forEach(cat => {
      doc.text(cat.charAt(0).toUpperCase() + cat.slice(1), 20, y);
      doc.text(`${totalesCat[cat].toFixed(2)} €`, pageW - 30, y, { align: 'right' });
      y += 8;
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', 20, y + 3);
    doc.text(`${totalGeneral.toFixed(2)} €`, pageW - 30, y + 3, { align: 'right' });
    y += 15;

    // Resumen administrativo del ciclo
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Datos del ciclo', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const adelanto = nota.importe_adelanto || 0;
    const saldo = nota.saldo_pendiente != null ? nota.saldo_pendiente : Math.max(0, totalGeneral - adelanto);
    const filasCiclo = [
      ['Apertura', nota.fecha_apertura || '-'],
      ['Cierre', nota.fecha_cierre || '-'],
      ['Total registros', String(registros.length)],
      ['Importe total', `${totalGeneral.toFixed(2)} €`],
      ['Adelanto', `${(adelanto || 0).toFixed(2)} €`],
      ['Saldo pendiente', `${(saldo || 0).toFixed(2)} €`],
      ['Estado', nota.estado || '-'],
    ];
    filasCiclo.forEach(([k, v]) => {
      doc.setTextColor(110, 110, 110);
      doc.text(String(k), 20, y);
      doc.setTextColor(0, 0, 0);
      doc.text(String(v), 80, y);
      y += 6;
    });
    y += 4;

    // Tabla detalle
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Detalle de registros (${registros.length})`, 14, y);
    y += 8;

    doc.setFillColor(234, 88, 12);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 5, pageW - 28, 8, 'F');
    doc.setFontSize(8);
    doc.text('#', 16, y);
    doc.text('Fecha', 24, y);
    doc.text('Comercio', 50, y);
    doc.text('Categoría', 110, y);
    doc.text('Estado', 142, y);
    doc.text('Ticket', 170, y);
    doc.text('Importe', pageW - 20, y, { align: 'right' });
    y += 6;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    registros.forEach((r, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        doc.setFillColor(249, 249, 249);
        doc.rect(14, y - 4, pageW - 28, 7, 'F');
      }
      if (r.es_gasto_tardio) doc.setTextColor(200, 0, 0);
      doc.text(String(r.orden_en_ciclo ?? idx + 1), 16, y);
      doc.text(r.fecha_documento || '-', 24, y);
      doc.text((r.nombre_comercio || '-').substring(0, 30), 50, y);
      doc.text(r.categoria || '-', 110, y);
      doc.text(r.estado || '-', 142, y);
      const tieneTicket = (r.archivos && r.archivos.length > 0) ? 'Sí' : '-';
      doc.text(tieneTicket, 170, y);
      doc.setTextColor(0, 0, 0);
      doc.text(`${(r.importe || 0).toFixed(2)} €`, pageW - 20, y, { align: 'right' });
      y += 7;
    });

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${totalPages} - SIMANTEC Gestión Empresarial - Export contabilidad`, pageW / 2, 290, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');

    // Subir a Google Drive (primario) o CDN de Base44 (fallback)
    let fileUrl = null;
    let driveFileId = null;
    let storage = 'local';
    let driveError = null;

    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      const accessToken = conn?.accessToken;
      if (!accessToken) throw new Error('Google Drive no conectado');

      const folderPath = `Contabilidad/Gastos/${nota.ciclo_mes || 'sin_ciclo'}`;
      const folderId = await getOrCreateFolder(accessToken, folderPath);
      const fileName = `INDICE-${nota.numero_ciclo || nota.ciclo_mes || nota.id}.pdf`;
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [folderId] })], { type: 'application/json' }));
      formData.append('file', blob, fileName);

      const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Upload Drive failed');
      }
      const driveFile = await uploadRes.json();
      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      }).catch(() => {});
      fileUrl = `https://drive.google.com/uc?id=${driveFile.id}&export=download`;
      driveFileId = driveFile.id;
      storage = 'googledrive';
    } catch (e) {
      driveError = e.message;
    }

    if (!fileUrl) {
      // Fallback Base44 CDN
      const bytes = new Uint8Array(pdfBytes);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      const dataUrl = `data:application/pdf;base64,${btoa(binary)}`;
      const { file_url } = await base44.integrations.Core.UploadFile({ file: dataUrl });
      fileUrl = file_url;
      storage = 'local';
    }

    // Marcar el ciclo como exportado a contabilidad
    await base44.asServiceRole.entities.NotaMensualGasto.update(nota.id, {
      export_contabilidad_url: fileUrl,
      fecha_export_contabilidad: new Date().toISOString(),
      estado: 'en_contabilidad',
    });

    return Response.json({
      success: true,
      file_url: fileUrl,
      drive_file_id: driveFileId,
      storage,
      drive_error: driveError,
      registros: registros.length,
      ciclo_mes: nota.ciclo_mes,
      operario: nota.operario_name,
      total: Math.round(totalGeneral * 100) / 100,
      nota_id: nota.id,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});

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