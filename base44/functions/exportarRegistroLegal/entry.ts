import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import * as XLSX from 'npm:xlsx@0.18.5';
import { ESTADOS_OFICIALES, registrarAuditoria } from '../../shared/registroLegal.ts';

/**
 * exportarRegistroLegal
 * Genera el Excel legal de un periodo usando SOLO registros oficiales/validados.
 * Se construye en servidor (no depende de la vista filtrada de gerencia) y deja
 * rastro en AuditoriaHorario. Devuelve el archivo en base64 para descargar.
 *
 * body: { desde, hasta, trabajadorId? }
 */

const ROLES_ADMIN = ['admin', 'propietario', 'administracion'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function trimestreDe(fecha) {
  const m = Number(String(fecha).slice(5, 7));
  return Math.floor((m - 1) / 3) + 1;
}

function diasLaborables(anio, mes) {
  const total = new Date(anio, mes, 0).getDate();
  let n = 0;
  for (let d = 1; d <= total; d++) {
    const dia = new Date(anio, mes - 1, d).getDay();
    if (dia !== 0 && dia !== 6) n++;
  }
  return n;
}

function asArray(res) {
  return Array.isArray(res) ? res : (res?.items || []);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_ADMIN.includes(user.role)) {
      return Response.json({ error: 'Solo administración o admin pueden exportar el registro legal' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { desde, hasta, trabajadorId } = body;
    if (!desde || !hasta) {
      return Response.json({ error: 'desde y hasta son obligatorios' }, { status: 400 });
    }

    const query = {
      fecha: { $gte: desde, $lte: hasta },
      estado_legal: { $in: ESTADOS_OFICIALES },
    };
    if (trabajadorId) query.operario_id = trabajadorId;

    const registros = asArray(await base44.asServiceRole.entities.RegistroHorarioLegal.filter(query));

    if (!registros.length) {
      return Response.json(
        { error: 'No hay registros oficiales en el periodo seleccionado. Valida antes de exportar.' },
        { status: 400 },
      );
    }

    // ── Hoja 1: Detalle legal ──────────────────────────────────────────────
    const detalle = registros.map((r) => ({
      empresa_id: r.empresa_id || '',
      empresa_nombre: r.empresa_nombre || '',
      centro_trabajo_id: r.centro_trabajo_id || '',
      centro_trabajo_nombre: r.centro_trabajo_nombre || '',
      trabajador_id: r.operario_id,
      trabajador_nombre: r.operario_name || '',
      trabajador_dni: r.operario_dni || '',
      fecha: r.fecha,
      dia_semana: r.dia_semana || '',
      hora_entrada: r.hora_entrada || '',
      hora_salida: r.hora_salida || '',
      pausa_inicio: r.pausa_inicio || '',
      pausa_fin: r.pausa_fin || '',
      pausa_minutos: r.pausa_minutos || 0,
      jornada_real_minutos: r.jornada_real_minutos || 0,
      horas_trabajadas: r.horas_trabajadas || 0,
      horas_extra_ordinarias: r.horas_extra_ordinarias || 0,
      horas_extra_festivas: r.horas_extra_festivas || 0,
      obra_id: r.obra_id || '',
      obra_nombre: r.obra_nombre || '',
      obra_tipo: r.obra_tipo || '',
      notas: r.notas || '',
      estado_legal: r.estado_legal,
      origen: r.origen || '',
      version_legal: r.version_legal || 1,
      generado_por: r.generado_por || '',
      validado_por: r.validado_por || '',
      validado_en: r.validado_en || '',
      motivo_validacion: r.motivo_validacion || '',
      fuente_registro: r.fuente_registro || '',
      observaciones_interna: r.observaciones_interna || '',
    }));

    // ── Agregados ──────────────────────────────────────────────────────────
    const mesMap = {};
    const triMap = {};
    const anioMap = {};

    for (const r of registros) {
      const anio = String(r.fecha).slice(0, 4);
      const mes = String(r.fecha).slice(5, 7);
      const tri = trimestreDe(r.fecha);
      const esIncidencia = String(r.origen || '').startsWith('cierre_') ? 1 : 0;

      const base = {
        empresa_id: r.empresa_id || '',
        empresa_nombre: r.empresa_nombre || '',
        trabajador_id: r.operario_id,
        trabajador_nombre: r.operario_name || '',
        trabajador_dni: r.operario_dni || '',
      };

      const accum = (obj, key, extra) => {
        if (!obj[key]) {
          obj[key] = { ...base, ...extra, horas_totales: 0, horas_extra: 0, horas_nocturnas: 0, horas_festivas: 0, incidencias: 0, fechas: new Set(), validado_por: '', validado_en: '' };
        }
        const b = obj[key];
        b.horas_totales += Number(r.horas_trabajadas) || 0;
        b.horas_extra += (Number(r.horas_extra_ordinarias) || 0) + (Number(r.horas_extra_festivas) || 0);
        b.horas_nocturnas += Number(r.horas_nocturnas) || 0;
        b.horas_festivas += Number(r.horas_festivas) || 0;
        b.incidencias += esIncidencia;
        b.fechas.add(r.fecha);
        if (r.validado_en && r.validado_en > (b.validado_en || '')) {
          b.validado_en = r.validado_en;
          b.validado_por = r.validado_por || '';
        }
      };

      accum(mesMap, `${r.operario_id}|${anio}|${mes}`, { anio, mes, mes_label: `${MESES[Number(mes) - 1]} ${anio}` });
      accum(triMap, `${r.operario_id}|${anio}|Q${tri}`, { anio, trimestre: `T${tri}`, trimestre_label: `T${tri} ${anio}` });
      accum(anioMap, `${r.operario_id}|${anio}`, { anio });
    }

    const resumenMes = Object.values(mesMap)
      .sort((a, b) => `${a.anio}${a.mes}${a.trabajador_nombre}`.localeCompare(`${b.anio}${b.mes}${b.trabajador_nombre}`))
      .map((b) => {
        const laborables = diasLaborables(Number(b.anio), Number(b.mes));
        const trabajados = b.fechas.size;
        return {
          ...b,
          dias_laborables: laborables,
          dias_trabajados: trabajados,
          dias_sin_fichaje: Math.max(0, laborables - trabajados),
          horas_ausencia: 0,
          estado_legal: 'oficial',
          fechas: undefined,
        };
      });

    const resumenTrimestre = Object.values(triMap)
      .sort((a, b) => `${a.anio}${a.trimestre}${a.trabajador_nombre}`.localeCompare(`${b.anio}${b.trimestre}${b.trabajador_nombre}`))
      .map((b) => ({
        ...b,
        dias_trabajados: b.fechas.size,
        estado_legal: 'oficial',
        fechas: undefined,
      }));

    const resumenAnual = Object.values(anioMap)
      .sort((a, b) => `${a.anio}${a.trabajador_nombre}`.localeCompare(`${b.anio}${b.trabajador_nombre}`))
      .map((b) => {
        let laborables = 0;
        for (let m = 1; m <= 12; m++) laborables += diasLaborables(Number(b.anio), m);
        const trabajados = b.fechas.size;
        return {
          ...b,
          dias_laborables: laborables,
          dias_trabajados: trabajados,
          dias_sin_fichaje: Math.max(0, laborables - trabajados),
          estado_legal: 'oficial',
          fechas: undefined,
        };
      });

    // ── Hoja 5: Auditoría legal ────────────────────────────────────────────
    const auditoriaRaw = asArray(await base44.asServiceRole.entities.AuditoriaHorario.filter(
      { fecha_hora: { $gte: `${desde}T00:00:00.000Z`, $lte: `${hasta}T23:59:59.999Z` } },
    ));

    const auditoriaLegal = auditoriaRaw.map((a) => ({
      registro_id: a.registro_id || '',
      entidad: a.entidad || '',
      accion: a.accion || '',
      usuario: a.usuario || '',
      rol: a.rol || '',
      fecha_hora: a.fecha_hora || '',
      campo: a.campo || '',
      valor_anterior: a.valor_anterior || '',
      valor_nuevo: a.valor_nuevo || '',
      motivo: a.motivo || '',
      origen: a.origen || '',
      version_legal: a.version_legal ?? '',
    }));

    // ── Nombre del archivo ────────────────────────────────────────────────
    const nombreTrab = String(detalle[0]?.trabajador_nombre || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-');
    const suffix = trabajadorId ? `TRAB-${nombreTrab || 'trabajador'}` : 'Resumen-General';
    const filename = `${desde}_${hasta}-LEGAL-${suffix}.xlsx`;

    // ── Auditoría de la exportación ───────────────────────────────────────
    const ahora = new Date().toISOString();
    await registrarAuditoria(base44, {
      entidad: 'RegistroHorarioLegal',
      accion: 'exportacion_legal_generada',
      usuario: user.email,
      rol: user.role,
      motivo: `Exportación legal ${desde} a ${hasta}`,
      origen: 'exportacion',
      valor_nuevo: filename,
    });
    auditoriaLegal.push({
      registro_id: '',
      entidad: 'RegistroHorarioLegal',
      accion: 'exportacion_legal_generada',
      usuario: user.email,
      rol: user.role,
      fecha_hora: ahora,
      campo: '',
      valor_anterior: '',
      valor_nuevo: filename,
      motivo: `Exportación legal ${desde} a ${hasta}`,
      origen: 'exportacion',
      version_legal: '',
    });

    // Marca de exportación (best-effort, no debe romper la descarga).
    try {
      for (let i = 0; i < registros.length; i += 200) {
        const ids = registros.slice(i, i + 200).map((r) => r.id);
        await base44.asServiceRole.entities.RegistroHorarioLegal.updateMany(
          { id: { $in: ids } },
          { $set: { exportado_en: ahora } },
        );
      }
    } catch (_e) { /* ignore */ }

    // ── Libro Excel ───────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'DetalleLegal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenMes), 'ResumenMesLegal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenTrimestre), 'ResumenTrimestreLegal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenAnual), 'ResumenAnualLegal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(auditoriaLegal), 'AuditoriaLegal');

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    return Response.json({
      success: true,
      filename,
      base64,
      registros: detalle.length,
      auditoria: auditoriaLegal.length,
      desde,
      hasta,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}