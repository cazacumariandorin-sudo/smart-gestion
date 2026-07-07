import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * forzarCierreFichajes — cierra a petición de gerencia/admin todos los fichajes
 * sin hora de salida de la fecha indicada, aplicando las mismas reglas que
 * completarFichajesAutomaticos (horario normal 18:04, pausa 14:07-15:02).
 *
 * body.fecha        — fecha a procesar (YYYY-MM-DD). Por defecto: hoy.
 * body.modo         — 'preview' solo lista los fichajes sin cerrar
 *                   — 'ejecutar' aplica el cierre
 */

const HORARIO_NORMAL = {
  fin:         { h: 18, m: 4  },
  pausa_inicio: { h: 14, m: 7  },
  pausa_fin:   { h: 15, m: 2  },
};

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function timeToMins(t: { h: number; m: number }): number { return t.h * 60 + t.m; }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'gerencia') {
      return Response.json({ error: 'Solo admin o gerencia pueden usar esta herramienta' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const fecha = body.fecha || new Date().toISOString().split('T')[0];
    const modo  = body.modo || 'preview'; // 'preview' | 'ejecutar'

    // Obtener fichajes del día sin hora_salida
    const todos = await base44.asServiceRole.entities.Fichaje.filter({ date: fecha });
    const pendientes = todos.filter((f: any) => f.hora_entrada && !f.hora_salida);

    if (pendientes.length === 0) {
      return Response.json({
        success: true,
        fecha,
        modo,
        mensaje: 'No hay fichajes abiertos para esta fecha',
        pendientes: [],
        completados: 0,
      });
    }

    // PREVIEW — solo listar, no modificar
    if (modo === 'preview') {
      return Response.json({
        success: true,
        fecha,
        modo: 'preview',
        pendientes: pendientes.map((f: any) => ({
          id: f.id,
          operario_name: f.operario_name,
          hora_entrada: f.hora_entrada,
          hora_salida_propuesta: minutesToTime(timeToMins(HORARIO_NORMAL.fin)),
          obra: f.project || null,
        })),
        total: pendientes.length,
      });
    }

    // EJECUTAR — aplicar cierre
    const resultados: any[] = [];
    const errores: any[] = [];

    const horaSalida  = minutesToTime(timeToMins(HORARIO_NORMAL.fin));
    const pausaInicio = minutesToTime(timeToMins(HORARIO_NORMAL.pausa_inicio));
    const pausaFin    = minutesToTime(timeToMins(HORARIO_NORMAL.pausa_fin));

    for (const f of pendientes) {
      try {
        const entradaMins = (() => {
          if (!f.hora_entrada) return timeToMins(HORARIO_NORMAL.fin);
          const [h, m] = f.hora_entrada.split(':').map(Number);
          return h * 60 + m;
        })();

        const salidaMins = timeToMins(HORARIO_NORMAL.fin);
        const pausaBrutas = timeToMins(HORARIO_NORMAL.pausa_fin) - timeToMins(HORARIO_NORMAL.pausa_inicio);
        const horasTrabajadas = Math.max(0, (salidaMins - entradaMins - pausaBrutas) / 60);

        await base44.asServiceRole.entities.Fichaje.update(f.id, {
          hora_salida:     horaSalida,
          pausa_inicio:    pausaInicio,
          pausa_fin:       pausaFin,
          horas_trabajadas: Math.round(horasTrabajadas * 100) / 100,
          notas: ((f.notas || '') + ` [Cierre forzado por ${user.email} - ${new Date().toISOString().slice(0,16).replace('T',' ')}]`).trim(),
        });

        resultados.push({
          operario_name: f.operario_name,
          hora_entrada:  f.hora_entrada,
          hora_salida:   horaSalida,
          horas:         Math.round(horasTrabajadas * 100) / 100,
        });
      } catch (e: any) {
        errores.push({ id: f.id, operario: f.operario_name, error: e.message });
      }
    }

    return Response.json({
      success: true,
      fecha,
      modo: 'ejecutar',
      completados: resultados.length,
      errores:     errores.length,
      resultados,
      errores_detalle: errores,
      ejecutado_por: user.email,
    });

  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});