import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

/**
 * procesarFacturaAutonomo
 * ════════════════════════════════════════════════════════════════
 * Recibe un file_uri privado (subido por el frontend con UploadPrivateFile),
 * genera una URL firmada temporal para que el LLM pueda leerlo, ejecuta
 * OCR+LLM con el prompt especializado en retención IRPF 111 y CREA el
 * registro FacturaAutonomo con los datos extraídos.
 *
 * Si la confianza es baja o faltan campos clave → marca precisa_revision.
 *
 * POST body: { file_uri: string, nombre?: string, tipo?: string }
 * Response:  { ok, factura, precisa_revision, revision_motivo, confianza, historial_autonomo[] }
 */

const SCHEMA_FACTURA_AUTONOMO = {
  type: 'object',
  properties: {
    numero_factura:       { type: 'string' },
    fecha_factura:        { type: 'string', description: 'Fecha en YYYY-MM-DD' },
    nombre_autonomo:      { type: 'string' },
    nif_autonomo:         { type: 'string', description: 'NIF/DNI/NIE del emisor' },
    concepto:             { type: 'string' },
    base_imponible:       { type: 'number' },
    porcentaje_retencion: { type: 'number', description: 'Porcentaje de retención (ej: 15, 7)' },
    importe_retencion:    { type: 'number' },
    tipo_iva:             { type: 'number', description: 'Porcentaje de IVA: 0, 10 o 21' },
    importe_iva:          { type: 'number' },
    total_factura:        { type: 'number' },
    confianza:            { type: 'number', description: 'Confianza global 0-1' },
    advertencias:         { type: 'array', items: { type: 'string' } },
  },
  required: ['nif_autonomo', 'base_imponible', 'porcentaje_retencion', 'importe_retencion'],
};

const PROMPT_FACTURA_AUTONOMO = `Eres un sistema experto en análisis fiscal de facturas de autónomos españoles con retención de IRPF (Modelo 111).

Analiza la imagen/PDF y extrae los siguientes datos fiscales con MÁXIMA PRECISIÓN:

CAMPOS OBLIGATORIOS:
• numero_factura: Número o serie de la factura (ej: "2026-001", "FAC/2026/023"). Si no aparece → cadena vacía.
• fecha_factura: Fecha de emisión en formato YYYY-MM-DD. Si solo aparece dd/mm → usar año actual.
• nombre_autonomo: Nombre completo o razón social del EMISOR de la factura (quien cobra, no Simantec).
• nif_autonomo: NIF, DNI o NIE del EMISOR. Formato: 12345678A (persona física) o B12345678 (sociedad). CRÍTICO: no confundir con el NIF del receptor (Simantec).
• concepto: Descripción del servicio prestado (máx 120 caracteres).

CAMPOS ECONÓMICOS — leer con cuidado el desglose fiscal:
• base_imponible: Importe ANTES de IVA y ANTES de retención. Buscar "Base imponible", "Base", "Subtotal". Número en euros.
• porcentaje_retencion: Porcentaje de retención IRPF aplicado. Buscar "Retención IRPF", "Ret. IRPF", "-15%", "-7%", "Retención". Número sin %. Valores habituales: 15 (general autónomo), 7 (inicio actividad, primeros 3 años), 19 (profesional específico). Si no aparece explícito pero hay importe retenido → calcular: (importe_retencion / base_imponible) * 100.
• importe_retencion: Importe en euros que se retiene. Buscar línea con signo negativo junto a "Retención" o "IRPF". SIEMPRE positivo (aunque aparezca con signo negativo en la factura).
• tipo_iva: Porcentaje de IVA aplicado (0, 10 o 21). Si no hay IVA (servicios exentos) → 0.
• importe_iva: Importe de IVA en euros. Si no hay IVA → 0.
• total_factura: Total a pagar por Simantec = base_imponible + importe_iva - importe_retencion. Buscar "Total factura", "Total a pagar", "Importe líquido". VERIFICAR la fórmula.

VERIFICACIÓN OBLIGATORIA:
Comprueba que: total_factura ≈ base_imponible + importe_iva - importe_retencion (tolerancia ±0.05€).
Si no cuadra → advertencia en el array advertencias y confianza ≤ 0.6.

REGLAS ESPECIALES:
• Retención "a cuenta" vs "a deducir": siempre es importe_retencion positivo que Simantec retiene y pagará a Hacienda.
• Si hay múltiples tipos de IVA → usar el predominante o el de mayor importe.
• Facturas de actividades profesionales (abogados, arquitectos, ingenieros, consultores) → retención 15% habitual.
• Facturas de inicio de actividad (primeros 2 años) → retención 7%.
• Si aparece "exento de retención" o "no sujeto a retención" → porcentaje_retencion=0, importe_retencion=0.

CONFIANZA:
• 1.0: todo legible, fórmula cuadra, NIF claramente visible.
• 0.7: algún campo poco nítido pero los datos fiscales son seguros.
• 0.5: base/retención deducidos parcialmente, NIF poco legible.
• 0.3: imagen borrosa, datos fiscales dudosos.

Devuelve SOLO el JSON. Sin texto adicional.`;

function calcularTrimestre(fechaStr) {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr);
  if (isNaN(fecha.getTime())) return '';
  const mes = fecha.getMonth() + 1;
  const anio = fecha.getFullYear();
  const q = Math.ceil(mes / 3);
  return `${anio}-T${q}`;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const rolesPermitidos = ['admin', 'propietario', 'gerencia', 'administracion'];
    if (!user || !rolesPermitidos.includes(user.role)) {
      return Response.json({ error: 'Unauthorized: solo gerencia/administración pueden procesar facturas de autónomos' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { file_uri, nombre, tipo } = body;
    if (!file_uri) return Response.json({ error: 'file_uri requerido' }, { status: 400 });

    // URL firmada temporal para que el LLM pueda leer el archivo privado
    let fileUrlParaLlm = file_uri;
    try {
      const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
      if (signed?.signed_url) fileUrlParaLlm = signed.signed_url;
    } catch (_) { /* si falla, probamos con el uri directo */ }

    // OCR + LLM (pasada principal)
    let datos = null;
    let ocrError = null;
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: PROMPT_FACTURA_AUTONOMO,
        file_urls: [fileUrlParaLlm],
        response_json_schema: SCHEMA_FACTURA_AUTONOMO,
      });
      datos = res && typeof res === 'object' ? res : (res?.output || null);
    } catch (e) {
      ocrError = e?.message || 'Error en InvokeLLM';
    }

    // Reintento con modelo de respaldo si la pasada principal no devolvió datos
    if (!datos && !ocrError) {
      try {
        const res2 = await base44.integrations.Core.InvokeLLM({
          prompt: PROMPT_FACTURA_AUTONOMO + '\n\nSEGUNDA PASADA: el modelo anterior no devolvió datos. Intenta extraer los datos fiscales mínimos (NIF, base, retención) aunque la imagen sea parcialmente ilegible.',
          file_urls: [fileUrlParaLlm],
          response_json_schema: SCHEMA_FACTURA_AUTONOMO,
          model: 'gemini_3_flash',
        });
        datos = res2 && typeof res2 === 'object' ? res2 : (res2?.output || null);
      } catch (e2) {
        ocrError = ocrError || e2?.message;
      }
    }

    // Evaluar si necesita revisión manual
    const confianza = datos?.confianza ?? 0;
    const faltantes = [];
    if (!datos?.nif_autonomo) faltantes.push('NIF autónomo');
    if (!datos?.base_imponible) faltantes.push('base imponible');
    if (!datos?.importe_retencion) faltantes.push('importe retención');
    if (!datos?.fecha_factura) faltantes.push('fecha');

    const precisaRevision = !datos || confianza < 0.65 || faltantes.length > 0 || !!ocrError;
    const revisionMotivo = ocrError
      ? `Error OCR: ${ocrError}`
      : faltantes.length > 0
        ? `Faltan campos fiscales clave: ${faltantes.join(', ')}`
        : confianza < 0.65
          ? `Confianza baja (${(confianza * 100).toFixed(0)}%) — revisar datos extraídos`
          : '';

    const fechaFactura = datos?.fecha_factura || new Date().toISOString().split('T')[0];
    const trimestre = calcularTrimestre(fechaFactura) || calcularTrimestre(new Date().toISOString());
    const anio = fechaFactura ? new Date(fechaFactura).getFullYear() : new Date().getFullYear();

    // CREAR el registro (siempre, aunque sea para revisión manual)
    const nueva = await base44.asServiceRole.entities.FacturaAutonomo.create({
      file_url: file_uri,
      archivos: [{ url: file_uri, nombre: nombre || '', tipo: tipo || '' }],
      numero_factura: datos?.numero_factura || '',
      fecha_factura: fechaFactura,
      trimestre,
      anio,
      nombre_autonomo: datos?.nombre_autonomo || '',
      nif_autonomo: datos?.nif_autonomo || '',
      concepto: datos?.concepto || '',
      base_imponible: datos?.base_imponible ?? 0,
      porcentaje_retencion: datos?.porcentaje_retencion ?? 0,
      importe_retencion: datos?.importe_retencion ?? 0,
      tipo_iva: datos?.tipo_iva ?? 0,
      importe_iva: datos?.importe_iva ?? 0,
      total_factura: datos?.total_factura ?? 0,
      ocr_raw: datos ? JSON.stringify(datos, null, 2) : (ocrError || ''),
      ocr_status: datos ? 'procesado' : 'error',
      confianza_ocr: confianza,
      precisa_revision: precisaRevision,
      revision_motivo: revisionMotivo,
      estado: 'borrador',
      subido_por: user.email,
      subido_por_nombre: user.full_name || user.email,
    });

    // Buscar historial de este NIF en otras facturas (las más recientes primero).
    // Antes se hacía list('fecha_factura', 50): solo las 50 más antiguas de TODAS las
    // facturas, así que el historial de facturas recientes salía incompleto.
    const nifExtraido = datos?.nif_autonomo || '';
    let historialAutonomo = [];
    let posibleDuplicado = null;
    if (nifExtraido) {
      const delNif = await base44.asServiceRole.entities.FacturaAutonomo
        .filter({ nif_autonomo: nifExtraido }, '-fecha_factura', 200)
        .catch(() => []);
      const otras = (delNif || []).filter((f) => f.id !== nueva.id);
      const numeroNuevo = String(datos?.numero_factura || '').trim().toLowerCase();
      if (numeroNuevo) {
        posibleDuplicado = otras.find(
          (f) => f.estado !== 'anulada' && String(f.numero_factura || '').trim().toLowerCase() === numeroNuevo,
        ) || null;
      }
      historialAutonomo = otras
        .map((f) => ({
          id: f.id,
          numero_factura: f.numero_factura,
          fecha_factura: f.fecha_factura,
          base_imponible: f.base_imponible,
          importe_retencion: f.importe_retencion,
          trimestre: f.trimestre,
          estado: f.estado,
        }))
        .slice(0, 10);
    }

    // Mismo NIF + mismo número de factura = posible duplicado: se marca para revisión
    // (el informe 111 ya avisa de las facturas con precisa_revision).
    const advertenciasExtra = [];
    if (posibleDuplicado) {
      const motivoDup = `Posible duplicado: ya existe la factura ${posibleDuplicado.numero_factura} de este NIF (${posibleDuplicado.fecha_factura || 'sin fecha'}).`;
      advertenciasExtra.push(motivoDup);
      await base44.asServiceRole.entities.FacturaAutonomo
        .update(nueva.id, {
          precisa_revision: true,
          revision_motivo: [revisionMotivo, motivoDup].filter(Boolean).join(' | '),
        })
        .catch((e) => console.error('No se pudo marcar duplicado:', e?.message));
    }

    return Response.json({
      ok: true,
      factura: nueva,
      precisa_revision: precisaRevision || !!posibleDuplicado,
      revision_motivo: posibleDuplicado
        ? [revisionMotivo, advertenciasExtra[0]].filter(Boolean).join(' | ')
        : revisionMotivo,
      confianza,
      trimestre,
      historial_autonomo: historialAutonomo,
      advertencias: [...(datos?.advertencias || []), ...advertenciasExtra],
    });
  } catch (e) {
    console.error('procesarFacturaAutonomo error:', e);
    return Response.json({ error: e?.message || 'Error interno' }, { status: 500 });
  }
}