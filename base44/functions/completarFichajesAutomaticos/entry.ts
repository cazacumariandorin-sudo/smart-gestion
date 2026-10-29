import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Festivos nacionales y de la Comunidad de Madrid
const getFestivosMadrid = (year) => {
  const fijosNacionales = ['01-01','05-01','08-10','11-01','12-06','12-08','12-25'];
  const fijosMadrid = ['05-02','07-25'];
  const variables = {
    2024: ['03-28','03-29','05-20','08-15'],
    2025: ['04-17','04-18','06-09','08-15'],
    2026: ['04-02','04-03','05-25','08-15'],
  };
  return [...fijosNacionales, ...fijosMadrid, ...(variables[year] || [])].map(f => `${year}-${f}`);
};

const HORARIO_NORMAL = {
  inicio: { h: 8, m: 1 },
  fin: { h: 18, m: 4 },
  pausa_inicio: { h: 14, m: 7 },
  pausa_fin: { h: 15, m: 2 },
};

function parseTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return { h, m };
}

function timeToMinutes(time) {
  return time.h * 60 + time.m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function esFestivo(fecha, festivos) {
  return festivos.includes(fecha.toISOString().split('T')[0]);
}

function esFinDeSemana(fecha) {
  const dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

function calcularHorasNetas(entrada, salida, pausaInicio, pausaFin) {
  const brutas = timeToMinutes(salida) - timeToMinutes(entrada);
  const pausa = timeToMinutes(pausaFin) - timeToMinutes(pausaInicio);
  return (brutas - pausa) / 60;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permitir ejecución desde cron (sin usuario) o desde admin/gerencia
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (user && user.role !== 'admin' && user.role !== 'gerencia') {
      return Response.json({ error: 'Forbidden: Solo admin/gerencia' }, { status: 403 });
    }

    const hoy = new Date();
    const year = hoy.getFullYear();
    const festivos = getFestivosMadrid(year);

    // No ejecutar en festivos ni fines de semana
    if (esFestivo(hoy, festivos)) {
      return Response.json({ success: true, message: 'Es festivo', skipped: true });
    }
    if (esFinDeSemana(hoy)) {
      return Response.json({ success: true, message: 'Es fin de semana', skipped: true });
    }

    const fechaHoy = hoy.toISOString().split('T')[0];
    const fichajesPendientes = await base44.asServiceRole.entities.Fichaje.filter({ date: fechaHoy });

    const resultados = { completados: 0, skipped: 0, errores: [], detalles: [] };

    for (const fichaje of fichajesPendientes) {
      try {
        // Solo procesar si tiene hora_entrada pero NO hora_salida
        if (!fichaje.hora_entrada || fichaje.hora_salida) {
          resultados.skipped++;
          continue;
        }

        const motivoAuto = 'Cierre automático 18:04 - operario no fichó salida';
        await base44.asServiceRole.entities.Fichaje.update(fichaje.id, {
          hora_salida: minutesToTime(timeToMinutes(HORARIO_NORMAL.fin)),
          pausa_inicio: minutesToTime(timeToMinutes(HORARIO_NORMAL.pausa_inicio)),
          pausa_fin: minutesToTime(timeToMinutes(HORARIO_NORMAL.pausa_fin)),
          horas_trabajadas: calcularHorasNetas(
            HORARIO_NORMAL.inicio,
            HORARIO_NORMAL.fin,
            HORARIO_NORMAL.pausa_inicio,
            HORARIO_NORMAL.pausa_fin
          ),
          // Marca de origen: un cierre automático no es un fichaje real del trabajador.
          origen: 'cierre_automatico',
          cerrado_por: 'sistema',
          fecha_cierre: new Date().toISOString(),
          motivo_cierre: motivoAuto,
          notas: (fichaje.notas || '') + ` [${motivoAuto}]`,
        });

        resultados.completados++;
        resultados.detalles.push({
          operario: fichaje.operario_name,
          accion: 'completado',
          hora_entrada: fichaje.hora_entrada,
          hora_salida: '18:04',
        });
      } catch (error) {
        resultados.errores.push({ fichaje_id: fichaje.id, error: error.message });
      }
    }

    return Response.json({ success: true, fecha: fechaHoy, resultados });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});