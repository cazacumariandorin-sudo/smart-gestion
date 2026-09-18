// Generación de logs de vigilancia en texto plano, listos para copiar/pegar
// o descargar. Usado tanto por el detalle de una vigilancia individual
// (VigilanciaEventosView) como por el informe consolidado de periodo
// (VigilanciaPanel -> VigilanciaInformePeriodoDialog).

export const TIPO_BADGE_LABEL = {
  nav: 'Nav',
  click: 'Click',
  red: 'Red',
  auth: 'Auth',
  error: 'Error',
  promise_rejection: 'Promise',
  visibility: 'Vis',
  render: 'Render',
  network_request: 'Fetch',
  custom: 'Otro',
};

export function fmtCompleta(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso || '—'; }
}

export function fmtCortaFecha(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso || '—'; }
}

/** Log de una única vigilancia: cabecera + eventos cronológicos. */
export function generarTextoLogVigilancia({ vig, resumen, eventos }) {
  const lineas = [];
  lineas.push('='.repeat(60));
  lineas.push('LOG DE VIGILANCIA — SMART GESTIÓN (Simantec)');
  lineas.push('='.repeat(60));
  lineas.push(`Usuario vigilado: ${vig?.user_full_name || vig?.user_email || '—'} (${vig?.user_email || '—'})`);
  lineas.push(`Rol: ${vig?.user_role_snapshot || '—'}`);
  lineas.push(`Motivo: ${vig?.motivo || '—'}`);
  lineas.push(`Iniciada por: ${vig?.iniciado_por || '—'}`);
  lineas.push(`Inicio: ${fmtCompleta(vig?.fecha_inicio)}`);
  lineas.push(`Fin prevista: ${fmtCompleta(vig?.fecha_fin_prevista)}`);
  lineas.push(`Fin real: ${vig?.fecha_fin_real ? fmtCompleta(vig.fecha_fin_real) : '—'}`);
  lineas.push(`Estado: ${vig?.estado || '—'}`);
  lineas.push(`Total de eventos: ${resumen?.total_eventos ?? eventos.length}`);
  if (resumen?.rutas_top?.length > 0) {
    lineas.push(`Rutas más visitadas: ${resumen.rutas_top.map(rt => `${rt.ruta} (${rt.count})`).join(', ')}`);
  }
  lineas.push('-'.repeat(60));
  lineas.push('EVENTOS (orden cronológico)');
  lineas.push('-'.repeat(60));
  lineas.push(...formatearEventos(eventos));
  lineas.push('='.repeat(60));
  lineas.push(`Generado: ${fmtCompleta(new Date().toISOString())}`);
  return lineas.join('\n');
}

function formatearEventos(eventos) {
  if (!eventos || eventos.length === 0) return ['Sin eventos registrados.'];
  return eventos.map((e) => {
    const hora = fmtCompleta(e.timestamp);
    const tipo = (TIPO_BADGE_LABEL[e.tipo_evento] || e.tipo_evento || '').toUpperCase();
    let linea = `[${hora}] ${tipo.padEnd(8)} ${e.ruta || ''}`;
    if (e.datos && Object.keys(e.datos).length > 0) {
      linea += ` — ${JSON.stringify(e.datos)}`;
    }
    return linea;
  });
}

/**
 * Informe consolidado de periodo: une en un solo documento todas las
 * vigilancias (con sus respectivos logs) cuyo intervalo cae dentro del
 * rango solicitado. `vigilancias` es el array devuelto por la acción
 * backend 'informe_periodo': [{ vigilancia, total_eventos, rutas_top, eventos }].
 */
export function generarTextoInformePeriodo({ etiquetaPeriodo, fechaDesde, fechaHasta, vigilancias, generadoPor }) {
  const lineas = [];
  lineas.push('#'.repeat(64));
  lineas.push('INFORME CONSOLIDADO DE VIGILANCIA — SMART GESTIÓN (Simantec)');
  lineas.push(`Periodo: ${etiquetaPeriodo} (${fmtCortaFecha(fechaDesde)} — ${fmtCortaFecha(fechaHasta)})`);
  lineas.push(`Generado por: ${generadoPor || '—'}`);
  lineas.push(`Generado: ${fmtCompleta(new Date().toISOString())}`);
  lineas.push(`Vigilancias incluidas: ${vigilancias.length}`);
  lineas.push('#'.repeat(64));
  lineas.push('');

  if (vigilancias.length === 0) {
    lineas.push('No se registraron vigilancias en este periodo.');
    return lineas.join('\n');
  }

  // Resumen general al inicio, antes del detalle de cada vigilancia.
  lineas.push('RESUMEN DEL PERIODO');
  lineas.push('-'.repeat(60));
  const totalEventos = vigilancias.reduce((acc, v) => acc + (v.total_eventos || 0), 0);
  const porUsuario = {};
  vigilancias.forEach(v => {
    const key = v.vigilancia.user_full_name || v.vigilancia.user_email;
    porUsuario[key] = (porUsuario[key] || 0) + 1;
  });
  lineas.push(`Total de vigilancias: ${vigilancias.length}`);
  lineas.push(`Total de eventos registrados: ${totalEventos}`);
  lineas.push(`Usuarios vigilados: ${Object.entries(porUsuario).map(([u, n]) => `${u} (${n})`).join(', ')}`);
  lineas.push('');

  vigilancias.forEach((item, idx) => {
    const { vigilancia: vig, resumen, eventos, total_eventos, rutas_top } = item;
    lineas.push('='.repeat(60));
    lineas.push(`VIGILANCIA ${idx + 1} / ${vigilancias.length}`);
    lineas.push('='.repeat(60));
    lineas.push(`Usuario vigilado: ${vig.user_full_name || vig.user_email} (${vig.user_email})`);
    lineas.push(`Rol: ${vig.user_role_snapshot || '—'}`);
    lineas.push(`Motivo: ${vig.motivo || '—'}`);
    lineas.push(`Iniciada por: ${vig.iniciado_por || '—'}`);
    lineas.push(`Inicio: ${fmtCompleta(vig.fecha_inicio)}`);
    lineas.push(`Fin: ${vig.fecha_fin_real ? fmtCompleta(vig.fecha_fin_real) : `${fmtCompleta(vig.fecha_fin_prevista)} (prevista)`}`);
    lineas.push(`Estado: ${vig.estado}`);
    lineas.push(`Total de eventos: ${total_eventos ?? resumen?.total_eventos ?? eventos.length}`);
    const rutas = rutas_top || resumen?.rutas_top;
    if (rutas?.length > 0) {
      lineas.push(`Rutas más visitadas: ${rutas.map(rt => `${rt.ruta} (${rt.count})`).join(', ')}`);
    }
    lineas.push('-'.repeat(60));
    lineas.push(...formatearEventos(eventos));
    lineas.push('');
  });

  lineas.push('#'.repeat(64));
  lineas.push('FIN DEL INFORME');
  lineas.push('#'.repeat(64));
  return lineas.join('\n');
}

/**
 * Log comparativo de dos vigilancias (mismo o distinto rol): cabecera con
 * datos de ambos usuarios, resumen comparado y línea temporal intercalada
 * de eventos marcando a cuál de los dos pertenece cada uno. Pensado para
 * analizar fallos/bugs o comportamientos indebidos contrastando A vs B.
 */
export function generarTextoLogComparativa({ vig_a, vig_b, resumen_a, resumen_b, eventos_a, eventos_b }) {
  const lineas = [];
  lineas.push('#'.repeat(64));
  lineas.push('LOG COMPARATIVO DE VIGILANCIA — SMART GESTIÓN (Simantec)');
  lineas.push('#'.repeat(64));
  const bloqueUsuario = (pref, vig, resumen, eventos) => {
    lineas.push(`${pref} Usuario: ${vig?.user_full_name || vig?.user_email || '—'} (${vig?.user_email || '—'})`);
    lineas.push(`${pref} Rol: ${vig?.user_role_snapshot || '—'}`);
    lineas.push(`${pref} Motivo: ${vig?.motivo || '—'}`);
    lineas.push(`${pref} Inicio: ${fmtCompleta(vig?.fecha_inicio)}`);
    lineas.push(`${pref} Fin: ${vig?.fecha_fin_real ? fmtCompleta(vig.fecha_fin_real) : `${fmtCompleta(vig?.fecha_fin_prevista)} (prevista)`}`);
    lineas.push(`${pref} Total eventos: ${resumen?.total ?? eventos.length}`);
    lineas.push(`${pref} Errores JS: ${resumen?.errores ?? 0}`);
    lineas.push(`${pref} Promise rejections: ${resumen?.promise_rejections ?? 0}`);
    lineas.push(`${pref} Cambios de red: ${resumen?.cambios_red ?? 0}`);
    lineas.push(`${pref} Rutas únicas: ${resumen?.rutas_unicas ?? 0}`);
  };
  bloqueUsuario('[A]', vig_a, resumen_a, eventos_a);
  lineas.push('-'.repeat(64));
  bloqueUsuario('[B]', vig_b, resumen_b, eventos_b);
  lineas.push('-'.repeat(64));
  if (vig_a?.user_role_snapshot !== vig_b?.user_role_snapshot) {
    lineas.push('AVISO: los usuarios tienen roles distintos; la comparativa puede no ser significativa.');
    lineas.push('-'.repeat(64));
  }
  lineas.push('LÍNEA TEMPORAL INTERCALADA (A / B)');
  lineas.push('-'.repeat(64));
  const marcados = [
    ...eventos_a.map(e => ({ ...e, _u: 'A' })),
    ...eventos_b.map(e => ({ ...e, _u: 'B' })),
  ].sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
  if (marcados.length === 0) {
    lineas.push('Sin eventos registrados en ninguna de las dos vigilancias.');
  } else {
    for (const e of marcados) {
      const hora = fmtCompleta(e.timestamp);
      const tipo = (TIPO_BADGE_LABEL[e.tipo_evento] || e.tipo_evento || '').toUpperCase();
      let linea = `[${hora}] [${e._u}] ${tipo.padEnd(8)} ${e.ruta || ''}`;
      if (e.datos && Object.keys(e.datos).length > 0) {
        linea += ` — ${JSON.stringify(e.datos)}`;
      }
      lineas.push(linea);
    }
  }
  lineas.push('#'.repeat(64));
  lineas.push(`Generado: ${fmtCompleta(new Date().toISOString())}`);
  return lineas.join('\n');
}

/** Rango [desde, hasta] en ISO para un periodo predefinido, en horario local. */
export function calcularRangoPeriodo(tipo) {
  const ahora = new Date();
  const hasta = new Date(ahora);
  let desde;
  if (tipo === 'semanal') {
    desde = new Date(ahora);
    desde.setDate(desde.getDate() - 7);
  } else if (tipo === 'mensual') {
    desde = new Date(ahora);
    desde.setMonth(desde.getMonth() - 1);
  } else {
    desde = new Date(ahora);
    desde.setDate(desde.getDate() - 7);
  }
  desde.setHours(0, 0, 0, 0);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}