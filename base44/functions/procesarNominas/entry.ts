import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.52.0';

const ROOT_FOLDER_ID = '1yJzcwSzo2acrswgmtKLbNTKVd7WxUtF1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    const { pdf_base64, mes, anio, nombre_archivo } = await req.json();

    if (!pdf_base64 || !mes || !anio) {
      return Response.json({ error: 'Faltan parámetros: pdf_base64, mes, anio' }, { status: 400 });
    }

    // Generar lote ID único
    const loteId = `NOMINAS_${anio}_${String(mes).padStart(2, '0')}_${Date.now()}`;
    const periodoNombre = getNombrePeriodo(mes, anio);

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

    // Usar IA para extraer y analizar las páginas del PDF
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

    // Primero extraemos la estructura completa del PDF con Claude
    const extractResponse = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analiza este PDF de nóminas que contiene múltiples trabajadores (una nómina por página). 
              
Para CADA trabajador extrae en formato JSON array:
{
  "trabajadores": [
    {
      "pagina": 1,
      "nombre": "APELLIDO1 APELLIDO2 NOMBRE o como aparezca",
      "dni": "12345678X",
      "periodo": "De 01/01/26 a 31/01/26",
      "categoria": "PROFESIONAL OFICIO 1ª",
      "liquido_percibir": 1671.17,
      "total_devengado": 2090.53,
      "total_deducir": 419.36
    }
  ]
}

El campo "nombre" aparece tras "PERSONA TRABAJADORA" en la cabecera de cada nómina.
El campo "dni" (NIF) aparece en la columna derecha de la cabecera junto al nombre.
"liquido_percibir" aparece como "LÍQUIDO A PERCIBIR".
Responde SOLO con el JSON, sin texto adicional.`
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
      const jsonText = extractResponse.content[0].text.trim();
      const parsed = JSON.parse(jsonText);
      trabajadoresPDF = parsed.trabajadores || [];
    } catch (e) {
      console.error('Error parseando respuesta IA:', e.message);
      return Response.json({ error: 'Error al procesar el PDF con IA', detalle: e.message }, { status: 500 });
    }

    const resultados = [];
    const sinAsignar = [];

    for (const trab of trabajadoresPDF) {
      // Matching por DNI (prioritario) o por nombre
      const dniLimpio = (trab.dni || '').trim().toUpperCase();
      const nombreLimpio = (trab.nombre || '').trim().toUpperCase();

      let operarioMatch = null;

      // 1. Match exacto por DNI
      if (dniLimpio) {
        operarioMatch = operarios.find(op => 
          (op.dni || '').trim().toUpperCase() === dniLimpio
        );
      }

      // 2. Match por nombre si no se encontró por DNI
      if (!operarioMatch && nombreLimpio) {
        operarioMatch = operarios.find(op => {
          const opNombre = (op.name || '').trim().toUpperCase();
          return opNombre === nombreLimpio || 
                 opNombre.includes(nombreLimpio.split(' ')[0]) ||
                 nombreLimpio.includes(opNombre.split(' ')[0]);
        });
      }

      // Subir el PDF completo (la página individual la identificamos por lote + número de página)
      // Para nóminas individuales subimos el PDF completo una vez y guardamos referencia de página
      let fileUrl = '';
      let driveFileId = '';

      // Subir el PDF original una sola vez (primera iteración)
      if (trab.pagina === 1 || !resultados.some(r => r.lote_id === loteId && r.file_url)) {
        const pdfBase64Clean = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
        const fileResult = await subirPDF(
          accessToken,
          useGdrive,
          pdfBase64Clean,
          `Nominas/${anio}/${String(mes).padStart(2, '0')}`,
          nombre_archivo || `nominas_${periodoNombre.replace(' ', '_')}.pdf`,
          base44
        );
        fileUrl = fileResult.file_url;
        driveFileId = fileResult.drive_file_id || '';
      } else {
        // Reutilizar URL del primer upload
        const primerRegistro = resultados.find(r => r.lote_id === loteId);
        fileUrl = primerRegistro?.file_url || '';
        driveFileId = primerRegistro?.drive_file_id || '';
      }

      const estadoAsignacion = operarioMatch ? 'asignada' : 'sin_asignar';

      const nominaData = {
        operario_id: operarioMatch?.id || null,
        operario_name: operarioMatch?.name || trab.nombre,
        operario_dni: dniLimpio || operarioMatch?.dni || '',
        mes: parseInt(mes),
        anio: parseInt(anio),
        periodo: periodoNombre,
        file_url: fileUrl,
        drive_file_id: driveFileId,
        liquido_percibir: trab.liquido_percibir || null,
        total_devengado: trab.total_devengado || null,
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

    // Si hay nóminas sin asignar, crear tarea para el gerente
    if (sinAsignar.length > 0) {
      await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: `⚠️ ${sinAsignar.length} nómina(s) sin asignar - ${periodoNombre}`,
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

    // Tarea pendiente Parte 2: Asistente explicación nóminas
    const tareasExistentes = await base44.asServiceRole.entities.AsistenteTarea.list();
    const tareaAsistenteExiste = tareasExistentes.some(t => 
      t.titulo && t.titulo.includes('explicación asistente nóminas')
    );

    if (!tareaAsistenteExiste) {
      await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: '🤖 PENDIENTE: Implementar explicación asistente nóminas',
        descripcion: `Tarea técnica pendiente (Parte 2 del módulo de Nóminas):\n\n• Añadir herramienta "leer_nomina_usuario" al asistenteHerramientas\n• Permitir al trabajador preguntar al asistente "¿me explicas mi nómina de enero?"\n• El asistente accederá al campo texto_extraido de la entidad Nomina del trabajador\n• Desglosará en lenguaje natural: sueldo base, incentivos, deducciones, IRPF y líquido final\n\nEsta tarea se eliminará automáticamente una vez implementada.`,
        tipo: 'tarea_manual',
        prioridad: 'media',
        estado: 'pendiente',
        asignada_a_user_id: user.id,
        asignada_a_nombre: user.full_name,
        asignada_a_rol: 'gerencia',
        solo_gerencia: true,
        creada_por: 'sistema',
        entidad_relacionada_tipo: 'Nomina',
        contexto_ia: 'Parte 2 módulo nóminas - pendiente implementación'
      });
    }

    return Response.json({
      success: true,
      lote_id: loteId,
      periodo: periodoNombre,
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
        liquido_percibir: r.liquido_percibir
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
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
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

  const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({
    file: `data:application/pdf;base64,${base64Data}`
  });
  return { file_url, drive_file_id: '', storage: 'local' };
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