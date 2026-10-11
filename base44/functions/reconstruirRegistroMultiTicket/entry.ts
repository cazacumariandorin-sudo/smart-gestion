import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { GASTO_OCR_SCHEMA_MULTI, PROMPT_OCR_MULTI, PROMPT_OCR_PRECISION } from '../../shared/ocrGastosConfig.ts';
import { agruparFotos } from '../../shared/reconstruccionMulti.ts';

// Reconstrucción de un RegistroGasto con VARIAS fotos — versión segura en 3 operaciones:
//
//   operacion 'ocr'        { registro_id, indices:[…], precision? }  → lee esas fotos (máx. 4 por llamada). NO escribe nada.
//   operacion 'planificar' { fotos:[…resultados OCR], modo }         → decide qué fotos son PÁGINAS del mismo documento
//                                                                       y cuáles son tickets distintos. NO escribe nada.
//   operacion 'ejecutar'   { registro_id, grupos:[…], precision? }   → crea los registros del plan aprobado y anula el original.
//
// modo: 'auto' (detecta páginas) | 'un_documento' (todas las fotos = 1 documento) | 'separar' (cada foto = 1 ticket, comportamiento antiguo)
//
// Diferencias con la versión anterior (que creaba SIEMPRE un registro por foto y anulaba el original sin avisar):
//   · distingue páginas de un mismo documento (1 registro con todas las fotos) de tickets distintos
//   · nada se escribe hasta que el usuario aprueba el plan
//   · si falla la creación de algún registro, se revierte lo creado y el original NO se anula
//   · el original guarda su estado previo para poder deshacer (función deshacerReconstruccionMultiTicket)
//
// Acceso: gerencia, administracion, admin, propietario.

const ROLES_OK = ['admin', 'propietario', 'gerencia', 'administracion'];
const MAX_FOTOS_POR_LLAMADA = 4;

const SCHEMA = {
  ...GASTO_OCR_SCHEMA_MULTI,
  properties: {
    ...GASTO_OCR_SCHEMA_MULTI.properties,
    pagina_numero: { type: 'integer', description: 'Nº de página si la imagen indica "Página 2 de 4", "Pág. 2/4" u "Hoja 2"; 0 si no consta' },
    pagina_total: { type: 'integer', description: 'Total de páginas indicado ("de 4"); 0 si no consta' },
    es_continuacion: { type: 'boolean', description: 'true si la imagen es la CONTINUACIÓN de un documento más largo: sin cabecera propia, solo líneas de detalle, "suma y sigue", "continúa"' },
    muestra_total_final: { type: 'boolean', description: 'true si en la imagen se ve el TOTAL FINAL A PAGAR de todo el documento' },
  },
};

const PROMPT_PAGINACION = `

DATOS DE PAGINACIÓN (rellénalos siempre):
Esta imagen puede ser UNA PÁGINA de un documento de varias páginas (p. ej. una factura de 4 hojas fotografiadas por separado).
- pagina_numero / pagina_total: solo si la imagen lo indica ("Página 2 de 4", "Pág. 2/4", "Hoja 2"). Si no consta, 0.
- es_continuacion = true si la imagen NO tiene cabecera propia del comercio y solo muestra líneas de detalle, "suma y sigue" o "continúa".
- muestra_total_final = true SOLO si se ve el TOTAL FINAL A PAGAR de todo el documento (no subtotales de página).
Una página intermedia NO es un ticket distinto: no inventes un importe para ella (déjalo null).`;

function respuesta(status, obj) { return Response.json(obj, { status }); }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return respuesta(401, { error: 'Unauthorized' });
    if (!ROLES_OK.includes(user.role)) return respuesta(403, { error: 'Forbidden: solo gerencia/administracion/admin' });

    const body = await req.json().catch(() => ({}));
    const { operacion, registro_id, precision = false } = body;
    const RG = base44.asServiceRole.entities.RegistroGasto;

    // Seguridad: una versión antigua de la pantalla no puede lanzar la reconstrucción directa.
    if (!operacion) {
      return respuesta(400, { error: 'Esta herramienta se ha actualizado (ahora muestra un plan antes de aplicar). Recarga la página.' });
    }

    // ───────── planificar: pura, sin acceso a datos ─────────
    if (operacion === 'planificar') {
      const { fotos, modo = 'auto' } = body;
      if (!Array.isArray(fotos)) return respuesta(400, { error: 'fotos requerido' });
      if (!['auto', 'un_documento', 'separar'].includes(modo)) return respuesta(400, { error: 'modo no válido' });
      const plan = agruparFotos(fotos, modo);
      return respuesta(200, { success: true, ...plan, modo });
    }

    if (!registro_id) return respuesta(400, { error: 'registro_id requerido' });
    const original = await RG.get(registro_id);
    if (!original) return respuesta(404, { error: 'Registro no encontrado' });
    const archivos = Array.isArray(original.archivos) ? original.archivos.filter((a) => a?.url) : [];
    if (archivos.length === 0) return respuesta(400, { error: 'El registro no tiene fotos adjuntas' });

    // ───────── ocr: lee fotos, no escribe ─────────
    if (operacion === 'ocr') {
      const indices = Array.isArray(body.indices) ? body.indices.filter((i) => Number.isInteger(i) && i >= 0 && i < archivos.length) : [];
      if (!indices.length) return respuesta(400, { error: 'indices requerido' });
      if (indices.length > MAX_FOTOS_POR_LLAMADA) return respuesta(400, { error: `Máximo ${MAX_FOTOS_POR_LLAMADA} fotos por llamada` });

      const fotos = await Promise.all(indices.map(async (idx) => {
        const a = archivos[idx];
        const base = { idx, url: a.url, nombre: a.nombre || '', tipo: a.tipo || '' };
        try {
          const args = {
            prompt: (precision ? PROMPT_OCR_PRECISION : PROMPT_OCR_MULTI) + PROMPT_PAGINACION,
            file_urls: [a.url],
            response_json_schema: SCHEMA,
          };
          if (precision) args.model = 'gemini_3_flash';
          const res = await base44.asServiceRole.integrations.Core.InvokeLLM(args);
          const resultado = res && typeof res === 'object' ? res : (res?.output || null);
          if (!resultado || !Array.isArray(resultado.documentos)) return { ...base, error: 'Respuesta inválida del OCR' };
          return { ...base, resultado };
        } catch (e) {
          return { ...base, error: e?.message || 'Error InvokeLLM' };
        }
      }));
      return respuesta(200, { success: true, fotos, total_fotos: archivos.length });
    }

    // ───────── ejecutar: crea el plan aprobado ─────────
    if (operacion === 'ejecutar') {
      if (original.estado === 'rechazada') {
        return respuesta(409, { error: 'Este registro ya está anulado (¿ya se reconstruyó?). Usa «Deshacer» antes de volver a reconstruirlo.' });
      }
      const { grupos } = body;
      if (!Array.isArray(grupos) || grupos.length === 0 || grupos.length > 80) return respuesta(400, { error: 'grupos no válidos' });

      // Validación del plan recibido
      for (const g of grupos) {
        const fotos = Array.isArray(g.fotos) ? g.fotos : [];
        if (!fotos.length || !fotos.every((i) => Number.isInteger(i) && i >= 0 && i < archivos.length)) {
          return respuesta(400, { error: 'El plan contiene fotos que no pertenecen al registro' });
        }
        if (!g.registro || typeof g.registro !== 'object') return respuesta(400, { error: 'Plan sin datos de registro' });
      }

      const existentes = await RG.filter({ operario_id: original.operario_id }, '-numero_secuencia', 1, { fields: ['numero_secuencia'] });
      const arr = Array.isArray(existentes) ? existentes : (existentes?.items || []);
      let siguienteSec = (arr[0]?.numero_secuencia || 0) + 1;

      const ahora = new Date().toISOString();
      const creados = [];
      try {
        for (const g of grupos) {
          const d = g.registro;
          const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha_documento || '')) ? d.fecha_documento : original.fecha_documento;
          const importe = d.importe != null && !Number.isNaN(Number(d.importe)) ? Number(d.importe) : 0;
          const nuevo = {
            operario_id: original.operario_id,
            operario_name: original.operario_name,
            operario_email: original.operario_email,
            categoria: d.categoria || original.categoria || 'otros',
            importe,
            fecha_documento: fecha,
            fecha_creacion_real: original.fecha_creacion_real || ahora.slice(0, 10),
            nombre_comercio: d.nombre_comercio || '',
            nif_comercio: d.nif_comercio || '',
            numero_factura: d.numero_factura || '',
            codigo_validacion_fiscal: d.codigo_validacion_fiscal || '',
            localidad: d.localidad || '',
            forma_pago_documento: d.forma_pago_documento || '',
            hora_documento: d.hora_documento || '',
            concepto: d.concepto || '',
            obra_id: original.obra_id || '',
            obra_name: original.obra_name || '',
            obra_tipo: original.obra_tipo || '',
            origen_pago: original.origen_pago || 'medios_propios',
            estado: 'borrador',
            ocr_status: 'procesado',
            ocr_raw: String(d.ocr_raw || '').slice(0, 20000),
            precisa_precision: g.tipo === 'documento' ? true : !!g.precisa_precision,
            precision_motivo: g.precision_motivo || '',
            precision_modelo_usado: precision ? 'gemini_3_flash' : 'automatic',
            ciclo_mes: fecha ? String(fecha).slice(0, 7) : (original.ciclo_mes || ahora.slice(0, 7)),
            numero_secuencia: siguienteSec++,
            archivos: g.fotos.map((i) => ({ ...archivos[i] })),
            notas_admin: `Reconstruido desde ${original.numero_nota || original.id} [origen=${original.id}] por ${user.email} (${ahora}) · ${g.tipo === 'documento' ? `documento de ${g.fotos.length} página(s)` : 'ticket'}`,
          };
          const creado = await RG.create(nuevo);
          creados.push({ id: creado.id, importe, fecha_documento: fecha, nombre_comercio: nuevo.nombre_comercio, categoria: nuevo.categoria,
            ciclo_mes: nuevo.ciclo_mes, precisa_precision: nuevo.precisa_precision, paginas: g.fotos.length, tipo: g.tipo });
        }
      } catch (e) {
        // Revertir lo creado: el original NO se anula
        for (const c of creados) {
          try { await RG.update(c.id, { estado: 'rechazada', notas_admin: `Anulado: la reconstrucción falló y se revirtió (${ahora})` }); } catch { /* best effort */ }
        }
        return respuesta(500, { success: false, error: `No se pudo crear todo el plan; se ha revertido (el original no se ha tocado): ${e?.message || 'fallo'}` });
      }

      await RG.update(original.id, {
        estado: 'rechazada',
        notas_admin: `Anulado por reconstrucción multi-ticket [estado_previo=${original.estado || 'pendiente'}] (${creados.length} registros creados desde sus ${archivos.length} fotos) por ${user.email} el ${ahora}.`,
      });

      return respuesta(200, {
        success: true,
        registro_original_id: original.id,
        registro_original_nota: original.numero_nota,
        total_archivos_procesados: archivos.length,
        total_creados: creados.length,
        total_omitidos: 0,
        registros_creados: creados,
        errores: [],
        modelo_usado: precision ? 'gemini_3_flash' : 'automatic',
        ejecutado_por: user.email,
      });
    }

    return respuesta(400, { error: 'operacion no válida' });
  } catch (error) {
    console.error('[reconstruirRegistroMultiTicket]', error);
    return respuesta(500, { success: false, error: error.message });
  }
}
