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

    // Soporte para pdf_url: descargar y convertir a base64
    if (!pdf_base64 && pdf_url) {
      const pdfRes = await fetch(pdf_url);
      if (!pdfRes.ok) return Response.json({ error: 'No se pudo descargar el PDF desde la URL' }, { status: 400 });
      const arrayBuffer = await pdfRes.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      pdf_base64 = btoa(binary);
    }

    if (!pdf_base64 || !mes || !anio) {
      return Response.json({ error: 'Faltan parámetros: pdf_base64 (o pdf_url), mes, anio' }, { status: 400 });
    }

    // mes/anio son valores de fallback si el documento no tiene fecha clara
    // El loteId se genera con los valores de formulario; se ajustará si el documento tiene período distinto
    const loteId = `NOMINAS_${anio}_${String(mes).padStart(2, '0')}_${Date.now()}`;

    // Obtener lista de operarios para el matching
    const operarios = await base44.asServiceRole.entities.Operario.list();

    // Obtener token de Google Drive si está disponible
    let accessToken = null;
    let useGdrive = false;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      if (conn?.accessToken) {
        accessToken = conn.accessToken;
        useGdrive = true;
      }
    } catch {
      console.log('Google Drive no disponible, usando almacenamiento local');
    }

    // Usar IA para extraer datos de cada trabajador del PDF
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    const extractResponse = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza este PDF de nóminas con múltiples trabajadores (una nómina por página). 
              
Para CADA trabajador extrae en formato JSON array:
{
  "trabajadores": [
    {
      "pagina": 1,
      "nombre": "APELLIDO1 APELLIDO2 NOMBRE o como aparezca",
      "dni": "12345678X",
      "periodo_texto": "De 01/01/26 a 31/01/26",
      "mes_documento": 1,
      "anio_documento": 2026,
      "categoria": "PROFESIONAL OFICIO 1ª",
      "liquido_percibir": 1671.17,
      "total_devengado": 2090.53,
      "total_deducir": 419.36,
      "coste_empresa": 2871.33
    }
  ]
}

El campo "nombre" aparece tras "PERSONA TRABAJADORA" en la cabecera.
El campo "dni" (NIF) aparece en la columna derecha de la cabecera junto al nombre.
"liquido_percibir" aparece como "LÍQUIDO A PERCIBIR".
"coste_empresa" aparece como "Coste Empresa=" en la parte inferior izquierda de la nómina.
"periodo_texto" es el texto literal del período que aparece en el documento (ej: "De 01/01/26 a 31/01/26").
"mes_documento" y "anio_documento" son el mes (1-12) y año (4 dígitos) del período de la nómina según el documento.
Responde SOLO con el JSON, sin texto adicional ni bloques de código.`
            },
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf_base64,
              }
            }
          ]
        }
      ]
    });

    let trabajadoresPDF = [];
    try {
      let jsonText = extractResponse.content[0].text.trim();
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(jsonText);
      trabajadoresPDF = parsed.trabajadores || [];
    } catch (e) {
      console.error('Error parseando respuesta IA:', e.message, 'Raw:', extractResponse.content[0]?.text?.substring(0, 300));
      return Response.json({ error: 'Error al procesar el PDF con IA', detalle: e.message }, { status: 500 });
    }

    // Cargar el PDF completo con pdf-lib para extraer páginas individuales
    const pdfBase64Clean = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
    const pdfBytes = Uint8Array.from(atob(pdfBase64Clean), c => c.charCodeAt(0));
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPaginas = pdfDoc.getPageCount();

    const resultados = [];
    const sinAsignar = [];

    for (const trab of trabajadoresPDF) {
      const dniLimpio = (trab.dni || '').trim().toUpperCase();
      const nombreLimpio = (trab.nombre || '').trim().toUpperCase();

      // Matching: 1. DNI exacto, 2. nombre
      let operarioMatch = null;
      if (dniLimpio) {
        operarioMatch = operarios.find(op =>
          (op.dni || '').trim().toUpperCase() === dniLimpio
        );
      }
      if (!operarioMatch && nombreLimpio) {
        operarioMatch = operarios.find(op => {
          const opNombre = (op.name || '').trim().toUpperCase();
          return opNombre === nombreLimpio ||
                 opNombre.includes(nombreLimpio.split(' ')[0]) ||
                 nombreLimpio.includes(opNombre.split(' ')[0]);
        });
      }

      // Extraer SOLO la página de este trabajador como PDF individual
      const pageIndex = (trab.pagina || 1) - 1;
      let fileUrl = '';
      let driveFileId = '';

      if (pageIndex >= 0 && pageIndex < totalPaginas) {
        const pdfIndividual = await PDFDocument.create();
        const [pagCopiada] = await pdfIndividual.copyPages(pdfDoc, [pageIndex]);
        pdfIndividual.addPage(pagCopiada);
        const pdfIndividualBytes = await pdfIndividual.save();
        const base64Individual = btoa(String.fromCharCode(...pdfIndividualBytes));

        const mesReal = trab.mes_documento ? parseInt(trab.mes_documento) : parseInt(mes);
        const anioReal = trab.anio_documento ? parseInt(trab.anio_documento) : parseInt(anio);
        const periodoReal = getNombrePeriodo(mesReal, anioReal);
        const nombreArchivo = `nomina_${dniLimpio || nombreLimpio.replace(/\s+/g, '_')}_${periodoReal.replace(' ', '_')}.pdf`;
        const folderPath = `Nominas/${anioReal}/${String(mesReal).padStart(2, '0')}`;

        const fileResult = await subirPDF(accessToken, useGdrive, base64Individual, folderPath, nombreArchivo, base44);
        fileUrl = fileResult.file_url;
        driveFileId = fileResult.drive_file_id || '';
      }

      const estadoAsignacion = operarioMatch ? 'asignada' : 'sin_asignar';

      // Usar mes/año extraído del documento; si la IA no lo detectó, caer al valor del formulario
      const mesReal = trab.mes_documento ? parseInt(trab.mes_documento) : parseInt(mes);
      const anioReal = trab.anio_documento ? parseInt(trab.anio_documento) : parseInt(anio);
      const periodoReal = getNombrePeriodo(mesReal, anioReal);

      const nominaData = {
        operario_id: operarioMatch?.id || null,
        operario_name: operarioMatch?.name || trab.nombre,
        operario_dni: dniLimpio || operarioMatch?.dni || '',
        mes: mesReal,
        anio: anioReal,
        periodo: periodoReal,
        file_url: fileUrl,
        drive_file_id: driveFileId,
        liquido_percibir: trab.liquido_percibir || null,
        total_devengado: trab.total_devengado || null,
        coste_empresa: trab.coste_empresa || null,
        estado_asignacion: estadoAsignacion,
        lote_id: loteId,
        pagina_origen: trab.pagina,
        texto_extraido: JSON.stringify(trab)
      };

      const nominaCreada = await base44.asServiceRole.entities.Nomina.create(nominaData);
      resultados.push({ ...nominaCreada, operario_encontrado: !!operarioMatch });

      if (!operarioMatch) {
        sinAsignar.push({ nombre: trab.nombre, dni: trab.dni, pagina: trab.pagina });
      }
    }

    // Período representativo del lote (del primer resultado)
    const periodoLote = resultados.length > 0 ? resultados[0].periodo : getNombrePeriodo(mes, anio);

    // Tarea si hay nóminas sin asignar
    if (sinAsignar.length > 0) {
      await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: `⚠️ ${sinAsignar.length} nómina(s) sin asignar - ${periodoLote}`,
        descripcion: `Las siguientes nóminas no pudieron asignarse automáticamente:\n${sinAsignar.map(s => `• ${s.nombre} (DNI: ${s.dni || 'no detectado'}, pág. ${s.pagina})`).join('\n')}\n\nRevisa y asigna manualmente en el módulo de Nóminas.`,
        tipo: 'tarea_manual',
        prioridad: 'alta',
        estado: 'pendiente',
        asignada_a_user_id: user.id,
        asignada_a_nombre: user.full_name,
        asignada_a_rol: 'admin',
        solo_gerencia: true,
        creada_por: 'sistema',
        entidad_relacionada_tipo: 'Nomina',
        contexto_ia: `Lote procesado: ${loteId}`
      });
    }

    // Tarea técnica pendiente Parte 2 (una sola vez)
    const tareasExistentes = await base44.asServiceRole.entities.AsistenteTarea.list();
    const tareaAsistenteExiste = tareasExistentes.some(t =>
      t.titulo && t.titulo.includes('explicación asistente nóminas')
    );
    if (!tareaAsistenteExiste) {
      await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: '🤖 PENDIENTE: Implementar explicación asistente nóminas',
        descripcion: `Tarea técnica pendiente (Parte 2):\n• Herramienta "leer_nomina_usuario" en asistenteHerramientas\n• El trabajador puede preguntar "¿me explicas mi nómina de enero?"\n• El asistente accede a texto_extraido de Nomina y explica en lenguaje natural`,
        tipo: 'tarea_manual',
        prioridad: 'media',
        estado: 'pendiente',
        asignada_a_user_id: user.id,
        asignada_a_nombre: user.full_name,
        asignada_a_rol: 'gerencia',
        solo_gerencia: true,
        creada_por: 'sistema',
        entidad_relacionada_tipo: 'Nomina',
        contexto_ia: 'Parte 2 módulo nóminas'
      });
    }

    return Response.json({
      success: true,
      lote_id: loteId,
      periodo: periodoLote,
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
        coste_empresa: r.coste_empresa
      }))
    });

  } catch (error) {
    console.error('Error en procesarNominas:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function subirPDF(accessToken, useGdrive, base64Data, folderPath, fileName, base44) {
  if (useGdrive && accessToken) {
    try {
      const folderId = await getOrCreateFolder(accessToken, folderPath);
      const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const formData = new FormData();
      const metadata = { name: fileName, parents: [folderId] };
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', blob, fileName);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Error subiendo a Drive');
      const driveFile = await res.json();

      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      return {
        file_url: `https://drive.google.com/uc?id=${driveFile.id}&export=download`,
        drive_file_id: driveFile.id,
        storage: 'googledrive'
      };
    } catch (e) {
      console.warn('Error GDrive, usando local:', e.message);
    }
  }

  // Fallback: almacenamiento local via UploadFile
  const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, fileName);
  const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: formData.get('file') });
  return { file_url: uploadRes.file_url, drive_file_id: '', storage: 'local' };
}

async function getOrCreateFolder(accessToken, folderPath) {
  const folders = folderPath.split('/').filter(Boolean);
  let parentId = ROOT_FOLDER_ID;

  for (const folderName of folders) {
    const searchQuery = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${searchQuery}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      parentId = searchData.files[0].id;
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
      });
      const createData = await createRes.json();
      parentId = createData.id;
    }
  }
  return parentId;
}

function getNombrePeriodo(mes, anio) {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[mes - 1]} ${anio}`;
}