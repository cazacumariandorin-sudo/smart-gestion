import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { fechaMadridISO } from '../../shared/horarioEmpresa.ts';

/**
 * Mantenimiento diario de expedientes sancionadores.
 *
 *  1. PRESCRIPCIÓN — un expediente abierto (sin carta notificada) cuya fecha de
 *     prescripción ya pasó queda en estado 'prescrito': la empresa ya no puede
 *     sancionar y no debe seguir contando en la reincidencia.
 *  2. CADUCIDAD — los expedientes cerrados que cumplen su plazo de conservación
 *     se ANONIMIZAN: se borran los datos personales, las firmas y el acta, y
 *     desaparecen del historial visible del trabajador. Solo sobreviven el
 *     código, las fechas y la calificación (para el cómputo interno).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite cron (sin usuario) o ejecución manual por dirección/administración
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (user && !['admin', 'propietario', 'gerencia', 'administracion'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const hoy = fechaMadridISO();
    const ahora = new Date().toISOString();
    const Expediente = base44.asServiceRole.entities.Expediente;

    const entrada = (h) => ({
      fecha: ahora,
      usuario_email: 'sistema',
      accion: h.accion,
      estado_anterior: h.estado_anterior,
      estado_nuevo: h.estado_nuevo,
      nota: h.nota || '',
    });

    // ── 1. Prescripción de expedientes sin notificar ──────────────────────
    const abiertos = await Expediente.filter({ estado: 'abierto' });
    const prescritos = [];
    for (const exp of abiertos) {
      if (!exp.fecha_prescripcion || exp.fecha_prescripcion >= hoy) continue;
      await Expediente.update(exp.id, {
        estado: 'prescrito',
        bloquea_reincidencia: true,
        historial: [
          ...(exp.historial || []),
          entrada({
            accion: 'Prescrito por plazo',
            estado_anterior: exp.estado,
            estado_nuevo: 'prescrito',
            nota: `Plazo de notificación vencido el ${exp.fecha_prescripcion}`,
          }),
        ],
      });
      prescritos.push(exp.codigo);
    }

    // ── 2. Caducidad y anonimización del antecedente ──────────────────────
    const cerrados = await Expediente.filter({
      anonimizado: { $ne: true },
      estado: { $in: ['archivado_conciliado', 'sancionado', 'anulado'] },
    });
    const caducados = [];
    for (const exp of cerrados) {
      if (!exp.fecha_caducidad || exp.fecha_caducidad > hoy) continue;
      await Expediente.update(exp.id, {
        estado: 'caducado',
        anonimizado: true,
        bloquea_reincidencia: true,
        operario_name: 'ANONIMIZADO',
        operario_email: '',
        operario_dni: '',
        descripcion_hechos: 'Registro caducado por plazo de conservación.',
        notas_internas: '',
        acta_manifiestan: '',
        acta_acuerdos: [],
        acta_pdf_url: '',
        firma_empresa: '',
        firma_empresa_nombre: '',
        firma_empresa_email: '',
        firma_trabajador: '',
        firma_trabajador_nombre: '',
        historial: [
          ...(exp.historial || []),
          entrada({
            accion: 'Anonimizado por caducidad del antecedente',
            estado_anterior: exp.estado,
            estado_nuevo: 'caducado',
            nota: `Caducidad cumplida el ${exp.fecha_caducidad}`,
          }),
        ],
      });
      caducados.push(exp.codigo);
    }

    return Response.json({
      success: true,
      fecha: hoy,
      prescritos: prescritos.length,
      caducados: caducados.length,
      detalle: { prescritos, caducados },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});