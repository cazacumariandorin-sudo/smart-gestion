import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Festivos nacionales y de la Comunidad de Madrid (fijos + variables por año)
const getFestivosMadrid = (year) => {
  // Festivos fijos nacionales
  const fijosNacionales = [
    '01-01', // Año Nuevo
    '05-01', // Día del Trabajador
    '08-10', // Fiesta Nacional
    '11-01', // Todos los Santos
    '12-06', // Constitución
    '12-08', // Inmaculada
    '12-25', // Navidad
  ];

  // Festivos fijos Madrid
  const fijosMadrid = [
    '05-02', // Fiesta de la Comunidad
    '07-25', // Santiago Apóstol
  ];

  // Festivos variables (Cálculo aproximado para 2024-2026)
  const variables = {
    2024: ['03-28', '03-29', '05-20', '08-15'], // Jueves Santo, Viernes Santo, Pentecostés, Asunción
    2025: ['04-17', '04-18', '06-09', '08-15'], // Jueves Santo, Viernes Santo, Pentecostés, Asunción
    2026: ['04-02', '04-03', '05-25', '08-15'], // Jueves Santo, Viernes Santo, Pentecostés, Asunción
  };

  const festivos = [...fijosNacionales, ...fijosMadrid, ...(variables[year] || [])];
  
  return festivos.map(f => `${year}-${f}`);
};

const HORARIO_NORMAL = {
  inicio: { h: 8, m: 1 },  // 08:01
  fin: { h: 18, m: 4 },    // 18:04
  pausa_inicio: { h: 14, m: 7 },  // 14:07
  pausa_fin: { h: 15, m: 2 },     // 15:02
};

const HORARIO_AJUSTADO = {
  inicio: { h: 8, m: 4 },  // 08:04
  fin: { h: 18, m: 6 },    // 18:06
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
  const fechaStr = fecha.toISOString().split('T')[0];
  return festivos.includes(fechaStr);
}

function esFinDeSemana(fecha) {
  const dia = fecha.getDay();
  return dia === 0 || dia === 6; // Domingo o Sábado
}

function calcularHorasNetas(entrada, salida, pausaInicio, pausaFin) {
  const entradaMin = timeToMinutes(entrada);
  const salidaMin = timeToMinutes(salida);
  const pausaInicioMin = timeToMinutes(pausaInicio);
  const pausaFinMin = timeToMinutes(pausaFin);
  
  const brutas = salidaMin - entradaMin;
  const pausa = pausaFinMin - pausaInicioMin;
  
  return (brutas - pausa) / 60;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'gerencia')) {
      return Response.json({ error: 'Forbidden: Solo admin/gerencia' }, { status: 403 });
    }

    const hoy = new Date();
    const year = hoy.getFullYear();
    const festivos = getFestivosMadrid(year);

    // No ejecutar fines de semana o festivos
    if (esFinDeSemana(hoy) || esFestivo(hoy, festivos)) {
      return Response.json({ 
        success: true, 
        message: 'No es día laborable',
        skipped: true 
      });
    }

    // Buscar fichajes incompletos de hoy
    const fechaHoy = hoy.toISOString().split('T')[0];
    const fichajesPendientes = await base44.entities.Fichaje.filter({
      date: fechaHoy,
    });

    const resultados = {
      completados: 0,
      ajustados: 0,
      skipped: 0,
      errores: [],
      detalles: [],
    };

    for (const fichaje of fichajesPendientes) {
      try {
        // Solo procesar si tiene hora_entrada pero no hora_salida
        if (!fichaje.hora_entrada || fichaje.hora_salida) {
          resultados.skipped++;
          continue;
        }

        const entrada = parseTime(fichaje.hora_entrada);
        const entradaMin = timeToMinutes(entrada);
        
        const horarioNormalInicio = timeToMinutes(HORARIO_NORMAL.inicio);
        const horarioNormalFin = timeToMinutes(HORARIO_NORMAL.fin);
        const horarioAjustadoInicio = timeToMinutes(HORARIO_AJUSTADO.inicio);
        const horarioAjustadoFin = timeToMinutes(HORARIO_AJUSTADO.fin);

        // CASO 1: Fichaje dentro del rango normal (08:01 - 18:04)
        if (entradaMin >= horarioNormalInicio && entradaMin <= horarioNormalFin) {
          await base44.entities.Fichaje.update(fichaje.id, {
            hora_salida: minutesToTime(horarioNormalFin),
            pausa_inicio: minutesToTime(timeToMinutes(HORARIO_NORMAL.pausa_inicio)),
            pausa_fin: minutesToTime(timeToMinutes(HORARIO_NORMAL.pausa_fin)),
            horas_trabajadas: calcularHorasNetas(
              HORARIO_NORMAL.inicio,
              HORARIO_NORMAL.fin,
              HORARIO_NORMAL.pausa_inicio,
              HORARIO_NORMAL.pausa_fin
            ),
            notas: (fichaje.notas || '') + ' [Auto-completado por sistema]',
          });

          resultados.completados++;
          resultados.detalles.push({
            operario: fichaje.operario_name,
            accion: 'completado',
            hora_entrada: fichaje.hora_entrada,
            hora_salida: '18:04',
          });

        // CASO 2: Fichaje fuera del rango normal → ajustar y crear apuntes
        } else {
          // Calcular horas extras para apuntes
          const horasExtraInicio = entradaMin < horarioAjustadoInicio 
            ? (horarioAjustadoInicio - entradaMin) / 60 
            : 0;
          
          // Si no hay hora_salida, asumir que trabajó hasta tarde
          // Para este caso, usamos 21:30 como ejemplo o calculamos horas estándar
          const salidaEstimadaMin = timeToMinutes({ h: 21, m: 30 }); // Default si no hay salida
          const horasExtraFin = salidaEstimadaMin > horarioAjustadoFin 
            ? (salidaEstimadaMin - horarioAjustadoFin) / 60 
            : 0;

          const totalHorasExtra = horasExtraInicio + horasExtraFin;

          // Actualizar fichaje con horario ajustado
          await base44.entities.Fichaje.update(fichaje.id, {
            hora_salida: minutesToTime(horarioAjustadoFin),
            pausa_inicio: minutesToTime(timeToMinutes(HORARIO_NORMAL.pausa_inicio)),
            pausa_fin: minutesToTime(timeToMinutes(HORARIO_NORMAL.pausa_fin)),
            horas_trabajadas: calcularHorasNetas(
              HORARIO_AJUSTADO.inicio,
              HORARIO_AJUSTADO.fin,
              HORARIO_NORMAL.pausa_inicio,
              HORARIO_NORMAL.pausa_fin
            ),
            notas: (fichaje.notas || '') + ' [Ajustado por sistema - fuera de horario]',
          });

          // Crear apunte horario si hay horas extra
          if (totalHorasExtra > 0) {
            await base44.entities.ApunteHorario.create({
              operario_id: fichaje.operario_id,
              operario_name: fichaje.operario_name,
              date: fechaHoy,
              obra_id: fichaje.obra_id || '',
              obra_name: fichaje.obra_name || 'Sin asignar',
              concepto: 'Horas extras por jornada extendida',
              unidad: 'ud',
              cantidad: parseFloat(totalHorasExtra.toFixed(2)),
              precio_unitario: 12,
              total: parseFloat((totalHorasExtra * 12).toFixed(2)),
              horas_ejecutadas: totalHorasExtra,
              notas: 'Generado automáticamente por fichaje fuera de horario',
            });
          }

          resultados.ajustados++;
          resultados.detalles.push({
            operario: fichaje.operario_name,
            accion: 'ajustado',
            hora_entrada_original: fichaje.hora_entrada,
            hora_entrada_ajustada: '08:04',
            hora_salida_ajustada: '18:06',
            horas_extra: totalHorasExtra.toFixed(2),
          });
        }
      } catch (error) {
        resultados.errores.push({
          fichaje_id: fichaje.id,
          error: error.message,
        });
      }
    }

    return Response.json({
      success: true,
      fecha: fechaHoy,
      resultados,
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});