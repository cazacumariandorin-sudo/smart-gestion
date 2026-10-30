import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import {
  calcularHorasNetas,
  esFinDeSemana,
  fechaMadridISO,
  horarioDelDia,
  minutosDe,
} from '../../shared/horarioEmpresa.ts';

/**
 * Cierre automático de fichajes del día.
 *
 * Reglas (horario de empresa, ver base44/shared/horarioEmpresa.ts):
 *   · L-J 08:00-18:00 con comida 14:00-15:00  ·  Viernes 08:00-13:00 sin comida.
 *   · Solo se ejecuta en día laborable: ni fin de semana ni festivo del
 *     CalendarioLaboral (Comunidad de Madrid + San Isidro).
 *   · Completa únicamente fichajes con entrada y sin salida.
 *   · Las horas se calculan desde la ENTRADA REAL del trabajador hasta el fin de
 *     jornada, descontando solo la comida que se solape (no se inventan horas).
 *   · Queda marcado como origen 'cierre_automatico': no es un fichaje real del
 *     trabajador y así consta en el registro legal.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permitir ejecución desde cron (sin usuario) o desde admin/gerencia/administración
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (user && !['admin', 'gerencia', 'administracion'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Solo admin/gerencia/administración' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const fecha = body?.fecha || fechaMadridISO();

    if (esFinDeSemana(fecha)) {
      return Response.json({ success: true, skipped: true, message: 'Fin de semana: no es día laborable' });
    }

    const anio = fecha.slice(0, 4);
    const calendario = await base44.asServiceRole.entities.CalendarioLaboral.filter({
      fecha: { $gte: `${anio}-01-01`, $lte: `${anio}-12-31` },
    });

    // Sin calendario cargado no se completa nada: evita fabricar jornadas en días
    // que sí son festivos. Debe actualizarse cada 1 de enero.
    if (!calendario.length) {
      return Response.json({
        success: true,
        skipped: true,
        message: `Sin calendario laboral cargado para ${anio}. Actualízalo antes de completar fichajes.`,
      });
    }

    const festivo = calendario.find((f) => f.fecha === fecha && f.activo !== false);
    if (festivo) {
      return Response.json({ success: true, skipped: true, message: `Festivo: ${festivo.nombre}` });
    }

    const horario = horarioDelDia(fecha);
    if (!horario) {
      return Response.json({ success: true, skipped: true, message: 'Día no laborable según el horario de empresa' });
    }

    const fichajes = await base44.asServiceRole.entities.Fichaje.filter({ date: fecha });
    const resultados = {
      fecha,
      jornada: `${horario.inicio}-${horario.fin}`,
      completados: 0,
      skipped: 0,
      errores: [],
      detalles: [],
    };

    for (const fichaje of fichajes) {
      try {
        // Solo procesar si tiene hora_entrada pero NO hora_salida
        if (!fichaje.hora_entrada || fichaje.hora_salida) {
          resultados.skipped++;
          continue;
        }

        if (minutosDe(fichaje.hora_entrada) >= minutosDe(horario.fin)) {
          resultados.skipped++;
          resultados.detalles.push({
            operario: fichaje.operario_name,
            accion: 'omitido',
            motivo: `Entrada (${fichaje.hora_entrada}) posterior al fin de jornada (${horario.fin})`,
          });
          continue;
        }

        // Si el trabajador ya registró su pausa, se respeta; si no, la de empresa.
        const pausaRegistrada = Boolean(fichaje.pausa_inicio && fichaje.pausa_fin);
        const pausaInicio = pausaRegistrada ? fichaje.pausa_inicio : horario.pausa_inicio;
        const pausaFin = pausaRegistrada ? fichaje.pausa_fin : horario.pausa_fin;

        const horas = calcularHorasNetas(fichaje.hora_entrada, horario.fin, {
          pausa_inicio: pausaInicio,
          pausa_fin: pausaFin,
        });

        const motivo = `Cierre automático ${horario.fin} · jornada de empresa ${horario.inicio}-${horario.fin}${
          pausaInicio ? ` con comida ${pausaInicio}-${pausaFin}` : ' sin comida'
        }`;

        await base44.asServiceRole.entities.Fichaje.update(fichaje.id, {
          hora_salida: horario.fin,
          pausa_inicio: pausaInicio ?? null,
          pausa_fin: pausaFin ?? null,
          horas_trabajadas: horas,
          // Un cierre automático no es un fichaje real del trabajador.
          origen: 'cierre_automatico',
          cerrado_por: 'sistema',
          fecha_cierre: new Date().toISOString(),
          motivo_cierre: motivo,
          notas: (fichaje.notas || '') + ` [${motivo}]`,
        });

        resultados.completados++;
        resultados.detalles.push({
          operario: fichaje.operario_name,
          accion: 'completado',
          hora_entrada: fichaje.hora_entrada,
          hora_salida: horario.fin,
          horas_trabajadas: horas,
        });
      } catch (error) {
        resultados.errores.push({ fichaje_id: fichaje.id, error: error.message });
      }
    }

    return Response.json({ success: true, ...resultados });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});