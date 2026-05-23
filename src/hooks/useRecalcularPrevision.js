/**
 * useRecalcularPrevision — Hook con la lógica del BLOQUE 2.
 * Llamar tras guardar exitosamente un fichaje con obra_id.
 */
import { base44 } from '@/api/base44Client';

export async function recalcularPrevision(obraId, obraName) {
  if (!obraId) return;
  try {
    const fichajes = await base44.entities.Fichaje.filter({ obra_id: obraId });
    const horasReales = fichajes.reduce((sum, f) => sum + (f.horas_trabajadas || 0), 0);

    const previsions = await base44.entities.PrevisionObra.filter({ obra_id: obraId });

    if (previsions.length === 0) {
      await base44.entities.PrevisionObra.create({
        obra_id: obraId,
        obra_name: obraName,
        horas_reales_acumuladas: horasReales,
        status: 'en_curso',
        status_semaforo: 'sin_datos',
        fecha_inicio: new Date().toISOString().split('T')[0],
      });
      return;
    }

    const prevision = previsions[0];
    const horasPrevistas = prevision.horas_totales_previstas || 0;
    const desviacion = horasPrevistas - horasReales;
    const pctAvance = horasPrevistas > 0 ? Math.round((horasReales / horasPrevistas) * 100) : 0;

    let semaforo = 'sin_datos';
    if (horasPrevistas > 0 && prevision.fecha_inicio && prevision.fecha_fin) {
      const hoy = new Date();
      const inicio = new Date(prevision.fecha_inicio);
      const fin = new Date(prevision.fecha_fin);
      const diasTotales = Math.max(1, (fin - inicio) / 86400000);
      const diasTranscurridos = Math.max(0, (hoy - inicio) / 86400000);
      const pctTiempo = Math.min(100, Math.round((diasTranscurridos / diasTotales) * 100));
      const desviacionRelativa = pctAvance - pctTiempo;

      if (hoy > fin && pctAvance < 100) semaforo = 'rojo';
      else if (Math.abs(desviacionRelativa) <= 10) semaforo = 'verde';
      else if (Math.abs(desviacionRelativa) <= 25) semaforo = 'amarillo';
      else semaforo = 'rojo';
    }

    const hoyStr = new Date().toISOString().split('T')[0];
    const fichajesHoy = fichajes.filter(f => f.date === hoyStr);
    const operariosHoy = [...new Set(fichajesHoy.map(f => f.operario_id).filter(Boolean))];
    const fechas = fichajes.map(f => f.date).filter(Boolean).sort();
    const ultimoFichaje = fechas[fechas.length - 1] || null;

    await base44.entities.PrevisionObra.update(prevision.id, {
      horas_reales_acumuladas: Math.round(horasReales * 100) / 100,
      desviacion_horas: Math.round(desviacion * 100) / 100,
      porcentaje_avance_horas: pctAvance,
      ultimo_fichaje_fecha: ultimoFichaje,
      operarios_activos_hoy: operariosHoy,
      status_semaforo: semaforo,
      status: 'en_curso',
    });
  } catch (e) {
    console.warn('recalcularPrevision error:', e);
  }
}