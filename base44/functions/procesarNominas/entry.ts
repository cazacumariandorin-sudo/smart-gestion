import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const body = await req.json();
    let { pdf_base64, pdf_url, mes, anio, nombre_archivo } = body;

    if (!pdf_base64 && pdf_url) {
      const pdfRes = await fetch(pdf_url);
      if (!pdfRes.ok) return Response.json({ error: 'No se pudo descargar el PDF' }, { status: 400 });
      const arrayBuffer = await pdfRes.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      pdf_base64 = btoa(binary);
    }

    if (!pdf_base64 || !mes || !anio) {
      return Response.json({ error: 'Faltan parámetros: pdf_base64 (o pdf_url), mes, anio' }, { status: 400 });
    }

    // InvokeLLM necesita una URL pública; si no hay pdf_url, subimos el PDF a Base44.
    if (!pdf_url) {
      try {
        const pdfBase64Clean = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
        const pdfBytes = Uint8Array.from(atob(pdfBase64Clean), c => c.charCodeAt(0));
        const pdfFile = new File([pdfBytes], 'nominas.pdf', { type: 'application/pdf' });
        const upload = await base44.integrations.Core.UploadPublicFile({ file: pdfFile });
        pdf_url = upload.file_url;
      } catch (e) {
        return Response.json({ error: 'No se pudo subir el PDF para análisis IA', detalle: e.message }, { status: 500 });
      }
    }

    const loteId = `NOMINAS_${anio}_${String(mes).padStart(2, '0')}_${Date.now()}`;
    const operarios = await base44.asServiceRole.entities.Operario.list();

    let accessToken = null;
    let useGdrive = false;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      if (conn?.accessToken) { accessToken = conn.accessToken; useGdrive = true; }
    } catch { /* sin Drive */ }

    // ── PASO 1: detectar el tipo de documento (via Base44 InvokeLLM) ──────────
    const deteccionResp = await base44.integrations.Core.InvokeLLM({
      prompt: `¿Este PDF es (A) un resumen estadístico de costes de nómina con todos los trabajadores en formato tabla (tipo GEFISCAL "Resumen estadístico de costes"), o (B) un conjunto de nóminas individuales una por página?
Responde SOLO con el valor "resumen_costes" (opción A) o "nomina_individual" (opción B).`,
      file_urls: [pdf_url],
      response_json_schema: {
        type: 'object',
        properties: { tipo: { type: 'string', enum: ['resumen_costes', 'nomina_individual'] } },
        required: ['tipo'],
      },
    });

    const tipoDetectado = deteccionResp?.tipo === 'resumen_costes' ? 'resumen_costes' : 'nomina_individual';
    console.log('Tipo documento detectado:', tipoDetectado);

    const schemaTrabajadores = {
      type: 'object',
      properties: {
        trabajadores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pagina: { type: 'integer' },
              dni: { type: 'string' },
              nombre: { type: 'string' },
              anticipos_deducciones: { type: 'number' },
              tipo_anticipo: { type: 'string' },
              liquido_percibir: { type: 'number' },
              total_devengado: { type: 'number' },
              prorrata_pagas_extra: { type: 'number' },
              cuotas_obreras: { type: 'number' },
              retencion_irpf: { type: 'number' },
              coste_ss_empresa: { type: 'number' },
              coste_empresa: { type: 'number' },
              mes_documento: { type: 'integer' },
              anio_documento: { type: 'integer' },
            },
          },
        },
      },
      required: ['trabajadores'],
    };

    let trabajadoresPDF: any[] = [];

    if (tipoDetectado === 'resumen_costes') {
      // ── FORMATO GEFISCAL: resumen estadístico de costes ──────────────────
      const promptResumen = `Este PDF es un "Resumen estadístico de costes" de nóminas generado por GEFISCAL.
Contiene una tabla con filas por trabajador. Extrae TODOS los trabajadores (ignora las filas de totales/subtotales).

Para cada trabajador extrae los campos del esquema JSON.
Notas:
- "anticipos_deducciones" es la columna "Anticipos y deducción" (puede ser ANTICIPO, DTO ESPECIE, etc.)
- "tipo_anticipo": extrae la etiqueta si aparece en la fila (ANTICIPO / DTO ESPECIE / vacío)
- "cuotas_obreras": columna "Cuotas obreras"
- "retencion_irpf": columna "Retención I.R.P.F."
- "coste_ss_empresa": columna "Coste S.S. empresa"
- "coste_empresa": columna "Coste total" (la última columna)
- "mes_documento" y "anio_documento": extráelos del título/encabezado del documento
- Ignora filas que empiecen por "Total para", "DTO ESPECIE", "ANTICIPO" (son subtotales)
- "pagina" no aplica en este formato (omítelo)`;

      const extractResp = await base44.integrations.Core.InvokeLLM({
        prompt: promptResumen,
        file_urls: [pdf_url],
        response_json_schema: schemaTrabajadores,
        model: 'claude_opus_4_8',
      });

      try {
        trabajadoresPDF = (extractResp?.trabajadores) || [];
        if (!Array.isArray(trabajadoresPDF) || trabajadoresPDF.length === 0) {
          throw new Error('IA no devolvió trabajadores');
        }
      } catch (e) {
        console.error('Error parse resumen costes:', e.message);
        return Response.json({ error: 'Error al parsear resumen de costes', detalle: e.message }, { status: 500 });
      }
    } else {
      // ── FORMATO NÓMINAS INDIVIDUALES (una por página) ────────────────────
      const promptIndividual = `Analiza este PDF de nóminas con múltiples trabajadores (una nómina por página).

Para CADA trabajador extrae los campos del esquema JSON:
- "pagina": número de página dentro del PDF donde está esa nómina
- "nombre": APELLIDO1 APELLIDO2 NOMBRE
- "dni": DNI/NIF del trabajador
- "mes_documento" y "anio_documento": del documento
- "liquido_percibir", "total_devengado", "cuotas_obreras", "retencion_irpf", "coste_ss_empresa", "coste_empresa"
- "anticipos_deducciones" y "tipo_anticipo" si aparecen`;

      const extractResp = await base44.integrations.Core.InvokeLLM({
        prompt: promptIndividual,
        file_urls: [pdf_url],
        response_json_schema: schemaTrabajadores,
        model: 'claude_opus_4_8',
      });

      try {
        trabajadoresPDF = (extractResp?.trabajadores) || [];
        if (!Array.isArray(trabajadoresPDF) || trabajadoresPDF.length === 0) {
          throw new Error('IA no devolvió trabajadores');
        }
      } catch (e) {
        return Response.json({ error: 'Error al procesar el PDF con IA', detalle: e.message }, { status: 500 });
      }
    }

    // ── PASO 2: cargar PDF completo para extraer páginas (solo en nóminas individuales) ──
    let pdfDoc: any = null;
    let totalPaginas = 0;
    if (tipoDetectado === 'nomina_individual') {
      const pdfBase64Clean = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
      const pdfBytes = Uint8Array.from(atob(pdfBase64Clean), c => c.charCodeAt(0));
      pdfDoc = await PDFDocument.load(pdfBytes);
      totalPaginas = pdfDoc.getPageCount();
    }

    // (El PDF del resumen completo ya no se usa — cada trabajador recibe su PDF individual generado)

    const resultados: any[] = [];
    const sinAsignar: any[] = [];

    for (const trab of trabajadoresPDF) {
      const dniLimpio = (trab.dni || '').trim().toUpperCase();
      const nombreLimpio = (trab.nombre || '').trim().toUpperCase();

      // Matching por DNI primero, luego por nombre
      let operarioMatch = null;
      if (dniLimpio) {
        operarioMatch = operarios.find(op => (op.dni || '').trim().toUpperCase() === dniLimpio);
      }
      if (!operarioMatch && nombreLimpio) {
        operarioMatch = operarios.find(op => {
          const opNombre = (op.name || '').trim().toUpperCase();
          // Comparación flexible: coincide si nombre del doc está en el del operario o viceversa
          return opNombre === nombreLimpio
            || opNombre.split(' ').filter(Boolean).every(p => nombreLimpio.includes(p))
            || nombreLimpio.split(' ').filter(Boolean).slice(0, 2).every(p => opNombre.includes(p));
        });
      }

      const mesReal = trab.mes_documento ? parseInt(trab.mes_documento) : parseInt(mes);
      const anioReal = trab.anio_documento ? parseInt(trab.anio_documento) : parseInt(anio);
      const periodoReal = getNombrePeriodo(mesReal, anioReal);

      let fileUrl = '';
      let driveFileId = '';

      if (tipoDetectado === 'nomina_individual' && pdfDoc) {
        // Nómina individual: extraer la página correspondiente
        const pageIndex = (trab.pagina || 1) - 1;
        if (pageIndex >= 0 && pageIndex < totalPaginas) {
          const pdfIndividual = await PDFDocument.create();
          const [pagCopiada] = await pdfIndividual.copyPages(pdfDoc, [pageIndex]);
          pdfIndividual.addPage(pagCopiada);
          const pdfIndividualBytes = await pdfIndividual.save();
          const base64Individual = btoa(String.fromCharCode(...pdfIndividualBytes));
          const nombreArchivo = `nomina_${dniLimpio || nombreLimpio.replace(/\s+/g, '_')}_${periodoReal.replace(' ', '_')}.pdf`;
          const folderPath = `Nominas/${anioReal}/${String(mesReal).padStart(2, '0')}`;
          const fileResult = await subirPDF(accessToken, useGdrive, base64Individual, folderPath, nombreArchivo, base44);
          fileUrl = fileResult.file_url;
          driveFileId = fileResult.drive_file_id || '';
        }
      } else if (tipoDetectado === 'resumen_costes') {
        // Resumen GEFISCAL: generar un PDF individual por trabajador con sus datos extraídos
        const base64Individual = await generarPDFIndividual(trab, periodoReal);
        if (base64Individual) {
          const nombreArchivo = `nomina_${dniLimpio || nombreLimpio.replace(/\s+/g, '_')}_${periodoReal.replace(' ', '_')}.pdf`;
          const folderPath = `Nominas/${anioReal}/${String(mesReal).padStart(2, '0')}`;
          const fileResult = await subirPDF(accessToken, useGdrive, base64Individual, folderPath, nombreArchivo, base44);
          fileUrl = fileResult.file_url;
          driveFileId = fileResult.drive_file_id || '';
        }
      }

      const nominaData: any = {
        operario_id: operarioMatch?.id || null,
        operario_user_email: operarioMatch?.user_email || '',
        operario_name: operarioMatch?.name || trab.nombre,
        operario_dni: dniLimpio || operarioMatch?.dni || '',
        mes: mesReal,
        anio: anioReal,
        periodo: periodoReal,
        file_url: fileUrl,
        drive_file_id: driveFileId,
        tipo_documento: tipoDetectado,
        liquido_percibir: trab.liquido_percibir || null,
        total_devengado: trab.total_devengado || null,
        prorrata_pagas_extra: trab.prorrata_pagas_extra || null,
        cuotas_obreras: trab.cuotas_obreras || null,
        retencion_irpf: trab.retencion_irpf || null,
        coste_ss_empresa: trab.coste_ss_empresa || null,
        coste_empresa: trab.coste_empresa || null,
        anticipos_deducciones: trab.anticipos_deducciones || null,
        tipo_anticipo: trab.tipo_anticipo || '',
        estado_asignacion: operarioMatch ? 'asignada' : 'sin_asignar',
        lote_id: loteId,
        pagina_origen: trab.pagina || null,
        texto_extraido: JSON.stringify(trab)
      };

      const nominaCreada = await base44.asServiceRole.entities.Nomina.create(nominaData);
      resultados.push({ ...nominaCreada, operario_encontrado: !!operarioMatch });

      if (!operarioMatch) {
        sinAsignar.push({ nombre: trab.nombre, dni: trab.dni, pagina: trab.pagina });
      }
    }

    const periodoLote = resultados.length > 0 ? resultados[0].periodo : getNombrePeriodo(mes, anio);

    if (sinAsignar.length > 0) {
      await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: `⚠️ ${sinAsignar.length} nómina(s) sin asignar - ${periodoLote}`,
        descripcion: `Las siguientes nóminas no pudieron asignarse automáticamente:\n${sinAsignar.map(s => `• ${s.nombre} (DNI: ${s.dni || 'no detectado'})`).join('\n')}\n\nRevisa y asigna manualmente en el módulo de Nóminas.`,
        tipo: 'tarea_manual',
        prioridad: 'alta',
        estado: 'pendiente',
        asignada_a_user_id: user.id,
        asignada_a_nombre: user.full_name,
        asignada_a_rol: 'admin',
        solo_gerencia: true,
        creada_por: 'sistema',
        entidad_relacionada_tipo: 'Nomina',
        contexto_ia: `Lote: ${loteId}`
      });
    }

    return Response.json({
      success: true,
      lote_id: loteId,
      periodo: periodoLote,
      tipo_documento: tipoDetectado,
      total_procesadas: resultados.length,
      asignadas_automaticamente: resultados.filter(r => r.operario_encontrado).length,
      sin_asignar: sinAsignar.length,
      detalle_sin_asignar: sinAsignar,
      nominas: resultados.map(r => ({
        id: r.id,
        operario_name: r.operario_name,
        operario_dni: r.operario_dni,
        pagina: r.pagina_origen,
        asignada: r.operario_encontrado,
        liquido_percibir: r.liquido_percibir,
        coste_empresa: r.coste_empresa,
        cuotas_obreras: r.cuotas_obreras,
        retencion_irpf: r.retencion_irpf,
        anticipos_deducciones: r.anticipos_deducciones,
        tipo_anticipo: r.tipo_anticipo
      }))
    });

  } catch (error) {
    console.error('Error en procesarNominas:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function subirPDF(accessToken: string | null, useGdrive: boolean, base64Data: string, folderPath: string, fileName: string, base44: any) {
  const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  if (useGdrive && accessToken) {
    try {
      const folderId = await getOrCreateFolder(accessToken, folderPath);
      const bytes = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify({ name: fileName, parents: [folderId] })], { type: 'application/json' }));
      formData.append('file', blob, fileName);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: formData,
      });
      if (!res.ok) throw new Error('Error subiendo a Drive');
      const driveFile = await res.json();
      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
      return { file_url: `https://drive.google.com/uc?id=${driveFile.id}&export=download`, drive_file_id: driveFile.id };
    } catch (e) {
      console.warn('GDrive error, usando local:', e.message);
    }
  }
  const localBytes = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
  const localFile = new File([localBytes], fileName, { type: 'application/pdf' });
  const uploadRes = await base44.asServiceRole.integrations.Core.UploadPublicFile({ file: localFile });
  return { file_url: uploadRes.file_url, drive_file_id: '' };
}

async function getOrCreateFolder(accessToken: string, folderPath: string) {
  const folders = folderPath.split('/').filter(Boolean);
  let parentId = ROOT_FOLDER_ID;
  for (const folderName of folders) {
    const q = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    if (searchData.files?.length > 0) {
      parentId = searchData.files[0].id;
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
      });
      parentId = (await createRes.json()).id;
    }
  }
  return parentId;
}

function getNombrePeriodo(mes: number, anio: number) {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${meses[mes - 1]} ${anio}`;
}

// Genera PDF individual con los datos extraídos del resumen GEFISCAL para un trabajador
async function generarPDFIndividual(trab: any, periodo: string): Promise<string | null> {
  try {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4 en puntos
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const fmt = (v: any) => v != null && !isNaN(v)
      ? `${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      : '—';

    const line = (y: number, label: string, value: string, bold_label = false) => {
      page.drawText(label, { x: 60, y, size: 11, font: bold_label ? bold : font, color: rgb(0.13, 0.13, 0.13) });
      page.drawText(value, { x: 380, y, size: 11, font: bold ? bold : font, color: rgb(0.13, 0.13, 0.13) });
    };

    // Título
    page.drawText('SIMANTEC SL — NÓMINA INDIVIDUAL', { x: 60, y: 790, size: 16, font: bold, color: rgb(0, 0, 0) });
    page.drawText(`Período: ${periodo}`, { x: 60, y: 765, size: 12, font, color: rgb(0.2, 0.2, 0.2) });

    // Datos del trabajador
    line(715, 'Trabajador:', (trab.nombre || '—').toUpperCase(), true);
    line(695, 'DNI / NIF:', trab.dni || '—');

    // Línea separadora
    page.drawLine({ start: { x: 60, y: 680 }, end: { x: 535, y: 680 }, thickness: 1, color: rgb(0.4, 0.4, 0.4) });

    // Detalle económico
    page.drawText('Desglose económico', { x: 60, y: 660, size: 12, font: bold, color: rgb(0.13, 0.13, 0.13) });
    let y = 635;
    const rows: [string, any][] = [
      ['Total devengado', trab.total_devengado],
      ['Prorrata pagas extra', trab.prorrata_pagas_extra],
      ['Anticipos y deducciones', trab.anticipos_deducciones],
      ['Cuotas obreras (SS trabajador)', trab.cuotas_obreras],
      ['Retención IRPF', trab.retencion_irpf],
      ['LÍQUIDO A PERCIBIR', trab.liquido_percibir],
      ['Coste S.S. empresa', trab.coste_ss_empresa],
      ['COSTE TOTAL EMPRESA', trab.coste_empresa],
    ];
    for (const [label, value] of rows) {
      const esDestacado = label.includes('LÍQUIDO') || label.includes('COSTE TOTAL');
      page.drawText(label, { x: 60, y, size: 11, font: esDestacado ? bold : font, color: rgb(0.13, 0.13, 0.13) });
      page.drawText(fmt(value), { x: 380, y, size: 11, font: esDestacado ? bold : font, color: rgb(0.13, 0.13, 0.13) });
      if (esDestacado) {
        page.drawLine({ start: { x: 60, y: y - 4 }, end: { x: 535, y: y - 4 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      }
      y -= 22;
    }

    if (trab.tipo_anticipo) {
      page.drawText(`Anticipo/Deducción: ${trab.tipo_anticipo}`, { x: 60, y: y - 5, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    }

    // Pie
    page.drawText('Documento generado automáticamente desde el resumen de costes GEFISCAL.', { x: 60, y: 50, size: 8, font, color: rgb(0.55, 0.55, 0.55) });
    page.drawText('SIMANTEC SL — CIF B-12345678', { x: 60, y: 35, size: 8, font, color: rgb(0.55, 0.55, 0.55) });

    const bytes = await doc.save();
    return btoa(String.fromCharCode(...bytes));
  } catch (e) {
    console.error('Error generando PDF individual:', e.message);
    return null;
  }
}