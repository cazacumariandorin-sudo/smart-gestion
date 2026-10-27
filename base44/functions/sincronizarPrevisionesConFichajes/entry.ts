import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * sincronizarPrevisionesConFichajes
 *
 * Sincroniza las previsiones de obra con datos REALES extraídos de fichajes:
 *  1. Para cada previsión ya iniciada (fecha_inicio <= hoy), recalcula
 *     horas_reales_acumuladas, % de avance, semáforo y último fichaje desde
 *     los Fichajes vinculados a la obra. Las previsiones futuras se dejan
 *     intactas (siguen siendo previsión manual visible para el cliente).
 *  2. Crea previsiones reales para obras que tienen fichajes pero ninguna
 *     previsión, de modo que el informe refleje en qué obra estuvo cada técnico.
 *
 * Pensada para ejecutarse automáticamente cada semana (sábado 06:00).
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole.entities;
    const hoy = new Date().toISOString().slice(0, 10);
    const hoyDate = new Date(hoy + 'T00:00:00');

    // ── Cargar previsiones no canceladas ──
    const previsiones = await admin.PrevisionObra.list('-updated_date', 1000);
    const activas = previsiones.filter(p => p.status !== 'cancelada' && p.obra_id);
    const obrasConPrevision = new Set(activas.map(p => p.obra_id));

    // ── Mapeo obra_id → { name, client_id, client_name } ──
    const [obrasCiviles, obrasSolares] = await Promise.all([
      admin.Obra.list('-updated_date', 1000).catch(() => []),
      admin.SolarObra.list('-updated_date', 1000).catch(() => []),
    ]);
    const obraMap = {};
    [...obrasCiviles, ...obrasSolares].forEach(o => {
      if (o.id) obraMap[o.id] = { name: o.name, client_id: o.client_id, client_name: o.client_name };
    });

    // ── Fichajes del último año, agrupados por obra_id ──
    const desde = new Date();
    desde.setFullYear(desde.getFullYear() - 1);
    const desdeStr = desde.toISOString().slice(0, 10);
    const fichajes = await admin.Fichaje.filter({ date: { $gte: desdeStr } });
    const fichajesPorObra = {};
    fichajes.forEach(f => {
      if (!f.obra_id) return;
      if (!fichajesPorObra[f.obra_id]) fichajesPorObra[f.obra_id] = [];
      fichajesPorObra[f.obra_id].push(f);
    });

    // ── 1. Actualizar previsiones existentes iniciadas ──
    let actualizadas = 0;
    for (const p of activas) {
      // Futuras: dejar como previsión manual
      if (!p.fecha_inicio || p.fecha_inicio > hoy) continue;

      const fichajesObra = (fichajesPorObra[p.obra_id] || []).filter(f => f.date && f.date <= hoy);
      const horasReales = fichajesObra.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);
      const horasPrevistas = p.horas_totales_previstas || 0;
      const desviacion = horasPrevistas - horasReales;
      const pctAvance = horasPrevistas > 0 ? Math.round((horasReales / horasPrevistas) * 100) : 0;

      // Semáforo (misma lógica que recalcularPrevision del cliente)
      let semaforo = 'sin_datos';
      if (horasPrevistas > 0 && p.fecha_inicio && p.fecha_fin) {
        const inicio = new Date(p.fecha_inicio + 'T00:00:00');
        const fin = new Date(p.fecha_fin + 'T00:00:00');
        const diasTotales = Math.max(1, (fin - inicio) / 86400000);
        const diasTranscurridos = Math.max(0, (hoyDate - inicio) / 86400000);
        const pctTiempo = Math.min(100, Math.round((diasTranscurridos / diasTotales) * 100));
        const desviacionRelativa = pctAvance - pctTiempo;
        if (hoyDate > fin && pctAvance < 100) semaforo = 'rojo';
        else if (Math.abs(desviacionRelativa) <= 10) semaforo = 'verde';
        else if (Math.abs(desviacionRelativa) <= 25) semaforo = 'amarillo';
        else semaforo = 'rojo';
      }

      const fechas = fichajesObra.map(f => f.date).filter(Boolean).sort();
      const ultimoFichaje = fechas[fechas.length - 1] || null;
      const fichajesDeHoy = fichajesObra.filter(f => f.date === hoy);
      const operariosHoy = [...new Set(fichajesDeHoy.map(f => f.operario_id).filter(Boolean))];

      // Estado: si ya pasó fecha_fin → completada si avance 100, si no en_curso
      let newStatus = p.status;
      if (p.fecha_fin && p.fecha_fin < hoy) {
        newStatus = pctAvance >= 100 ? 'completada' : 'en_curso';
      } else if (p.status === 'planificada') {
        newStatus = 'en_curso';
      }

      await admin.PrevisionObra.update(p.id, {
        horas_reales_acumuladas: Math.round(horasReales * 100) / 100,
        desviacion_horas: Math.round(desviacion * 100) / 100,
        porcentaje_avance_horas: pctAvance,
        ultimo_fichaje_fecha: ultimoFichaje,
        operarios_activos_hoy: operariosHoy,
        status_semaforo: semaforo,
        status: newStatus,
      });
      actualizadas++;
    }

    // ── 2. Crear previsiones reales para obras con fichajes pero sin previsión ──
    let creadas = 0;
    for (const [obraId, fichajesObra] of Object.entries(fichajesPorObra)) {
      if (obrasConPrevision.has(obraId)) continue;
      const reales = fichajesObra.filter(f => f.date && f.date <= hoy);
      if (reales.length === 0) continue;

      const meta = obraMap[obraId] || {};
      const fechas = reales.map(f => f.date).sort();
      const fechaInicio = fechas[0];
      const fechaFin = fechas[fechas.length - 1];
      const horasReales = reales.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);
      const operarios = [...new Set(reales.map(f => f.operario_id).filter(Boolean))];

      await admin.PrevisionObra.create({
        obra_id: obraId,
        obra_name: meta.name || reales[0]?.obra_name || reales[0]?.project || 'Obra',
        client_id: meta.client_id || '',
        client_name: meta.client_name || '',
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        horas_totales_previstas: Math.round(horasReales * 100) / 100,
        horas_reales_acumuladas: Math.round(horasReales * 100) / 100,
        desviacion_horas: 0,
        porcentaje_avance_horas: 100,
        ultimo_fichaje_fecha: fechaFin,
        operarios_activos_hoy: operarios,
        status_semaforo: 'verde',
        status: 'en_curso',
        notas: 'Generada automáticamente desde fichajes reales',
      });
      creadas++;
    }

    return Response.json({
      success: true,
      previsiones_actualizadas: actualizadas,
      previsiones_creadas: creadas,
      ejecutado_en: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}