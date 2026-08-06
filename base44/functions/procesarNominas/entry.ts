import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

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

    const loteId = `NOMINAS_${anio}_${String(mes).padStart(2, '0')}_${Date.now()}`;
    const operarios = await base44.asServiceRole.entities.Operario.list();

    let accessToken = null;
    let useGdrive = false;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      if (conn?.accessToken) { accessToken = conn.accessToken; useGdrive = true; }
    } catch { /* sin Drive */ }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    // ── PASO 1: detectar el tipo de documento ────────────────────────────────
    const deteccionResp = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `¿Este PDF es (A) un resumen estadístico de costes de nómina con todos los trabajadores en formato tabla (tipo GEFISCAL "Resumen estadístico de costes"), o (B) un conjunto de nóminas individuales una por página?
Responde SOLO con la letra A o B, sin explicación.`
          },
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } }
        ]
      }]
    });

    const tipoDetectado = deteccionResp.content[0].text.trim().toUpperCase().startsWith('A') ? 'resumen_costes' : 'nomina_individual';
    console.log('Tipo documento detectado:', tipoDetectado);

    let trabajadoresPDF: any[] = [];

    if (tipoDetectado === 'resumen_costes') {
      // ── FORMATO GEFISCAL: resumen estadístico de costes ──────────────────
      const extractResp = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Este PDF es un "Resumen estadístico de costes" de nóminas generado por GEFISCAL.
Contiene una tabla con filas por trabajador. Extrae TODOS los trabajadores (ignora las filas de totales/subtotales).

Para cada trabajador extrae:
{
  "trabajadores": [
    {
      "dni": "49011070W",
      "nombre": "BORJA GARCIA MANUEL-ANTONIO",
      "anticipos_deducciones": 0.00,
      "tipo_anticipo": "",
      "liquido_percibir": 870.16,
      "total_devengado": 1046.92,
      "prorrata_pagas_extra": 0.00,
      "cuotas_obreras": 34.38,
      "retencion_irpf": 142.38,
      "coste_ss_empresa": 196.55,
      "coste_empresa": 1243.47,
      "mes_documento": 7,
      "anio_documento": 2026
    }
  ]
}

Notas:
- "anticipos_deducciones" es la columna "Anticipos y deducción" (puede ser ANTICIPO, DTO ESPECIE, etc.)
- "tipo_anticipo": extrae la etiqueta si aparece en la fila (ANTICIPO / DTO ESPECIE / vacío)
- "cuotas_obreras": columna "Cuotas obreras"
- "retencion_irpf": columna "Retención I.R.P.F."
- "coste_ss_empresa": columna "Coste S.S. empresa"
- "coste_empresa": columna "Coste total" (la última columna)
- "mes_documento" y "anio_documento": extráelos del título/encabezado del documento
- Ignora filas que empiecen por "Total para", "DTO ESPECIE", "ANTICIPO" (son subtotales)
Responde SOLO con JSON válido, sin texto adicional.`
            },
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } }
          ]
        }]
      });

      try {
        let jsonText = extractResp.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        trabajadoresPDF = JSON.parse(jsonText).trabajadores || [];
      } catch (e) {
        console.error('Error parse resumen costes:', e.message);
        return Response.json({ error: 'Error al parsear resumen de costes', detalle: e.message }, { status: 500 });
      }
    } else {
      // ── FORMATO NÓMINAS INDIVIDUALES (una por página) ────────────────────
      const extractResp = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza este PDF de nóminas con múltiples trabajadores (una nómina por página).

Para CADA trabajador extrae:
{
  "trabajadores": [
    {
      "pagina": 1,
      "nombre": "APELLIDO1 APELLIDO2 NOMBRE",
      "dni": "12345678X",
      "mes_documento": 7,
      "anio_documento": 2026,
      "liquido_percibir": 1671.17,
      "total_devengado": 2090.53,
      "cuotas_obreras": 88.50,
      "retencion_irpf": 330.86,
      "coste_ss_empresa": 620.00,
      "coste_empresa": 2871.33,
      "anticipos_deducciones": 0.00,
      "tipo_anticipo": ""
    }
  ]
}

Responde SOLO con JSON válido, sin texto adicional.`
            },
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } }
          ]
        }]
      });

      try {
        let jsonText = extractResp.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        trabajadoresPDF = JSON.parse(jsonText).trabajadores || [];
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

    // ── PASO 3: subir PDF completo del resumen (una vez) o páginas individuales ──
    let urlResumenCompleto = '';
    if (tipoDetectado === 'resumen_costes') {
      const nombreArch = nombre_archivo || `resumen_costes_${anio}_${String(mes).padStart(2, '0')}.pdf`;
      const folderPath = `Nominas/${anio}/${String(mes).padStart(2, '0')}`;
      const fileResult = await subirPDF(accessToken, useGdrive, pdf_base64, folderPath, nombreArch, base44);
      urlResumenCompleto = fileResult.file_url;
    }

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

      let fileUrl = urlResumenCompleto;
      let driveFileId = '';

      // Para nóminas individuales: extraer la página correspondiente
      if (tipoDetectado === 'nomina_individual' && pdfDoc) {
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
      }

      const nominaData: any = {
        operario_id: operarioMatch?.id || null,
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
  const bytes = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, fileName);
  const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: formData.get('file') });
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