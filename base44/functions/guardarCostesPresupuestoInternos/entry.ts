import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ROLES = ['admin', 'propietario', 'gerencia', 'director_comercial', 'administracion'];
const n0 = (v) => Math.max(0, Number(v) || 0);
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

function gastosFijosMensuales(empresa) {
  return r2(
    n0(empresa.gastos_fijos_gestoria_mensual) + n0(empresa.gastos_fijos_luz_telefono_mensual) +
    n0(empresa.gastos_fijos_oficina_mensual) + n0(empresa.gastos_fijos_prl_anual) / 12 +
    n0(empresa.gastos_fijos_seguro_convenio_metal_anual) / 12 + n0(empresa.gastos_fijos_itv_coches_anual) / 12
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES.includes(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const presupuestoId = String(body.presupuesto_id || '');
    if (!presupuestoId) return Response.json({ error: 'presupuesto_id es obligatorio' }, { status: 400 });
    const sr = base44.asServiceRole;
    const presupuesto = await sr.entities.Presupuesto.get(presupuestoId).catch(() => null);
    if (!presupuesto) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

    const empresas = await sr.entities.Empresa.list().catch(() => []);
    const empresa = (Array.isArray(empresas) ? empresas : []).find((e) => e.es_principal) || (Array.isArray(empresas) ? empresas : []).find((e) => e.activa !== false) || (Array.isArray(empresas) ? empresas : [])[0];
    if (!empresa) return Response.json({ error: 'No hay ficha de empresa configurada' }, { status: 404 });

    const ahora = new Date();
    const desdeDate = new Date(ahora);
    desdeDate.setMonth(desdeDate.getMonth() - 12);
    const desde = desdeDate.toISOString().slice(0, 10);
    const hasta = ahora.toISOString().slice(0, 10);
    const historicos = await sr.entities.Presupuesto.list('-fecha', 2000).catch(() => []);
    const ventas12m = (Array.isArray(historicos) ? historicos : [])
      .filter((p) => p.id !== presupuestoId && ['enviado', 'aceptado'].includes(p.estado) && String(p.fecha || '').slice(0, 10) >= desde && String(p.fecha || '').slice(0, 10) <= hasta)
      .reduce((sum, p) => sum + n0(p.importe ?? p.base_imponible), 0);
    const gastosMensuales = gastosFijosMensuales(empresa);
    const ventaMediaMensual = r2(ventas12m / 12);
    const porcentajeRecomendado = ventaMediaMensual > 0 ? r2((gastosMensuales / ventaMediaMensual) * 100) : null;

    const revisiones = Array.isArray(empresa.coste_laboral_revisiones) ? empresa.coste_laboral_revisiones : [];
    const revision = empresa.coste_laboral_revision_actual?.estado === 'aprobado'
      ? empresa.coste_laboral_revision_actual
      : [...revisiones].filter((r) => r.estado === 'aprobado').sort((a, b) => new Date(b.fecha_revision || 0) - new Date(a.fecha_revision || 0))[0] || null;
    const costeDiario = revision && revision.coste_diario > 0 ? Number(revision.coste_diario) : null;
    const horasDia = n0(revision?.horas_jornada) || 8;
    const horasInput = Array.isArray(body.horas_por_partida) ? body.horas_por_partida : [];
    const conceptos = Array.isArray(presupuesto.conceptos) ? presupuesto.conceptos : [];
    if (horasInput.length !== conceptos.length) return Response.json({ error: 'Las estimaciones de horas no coinciden con las líneas del presupuesto' }, { status: 400 });

    let horasTotales = 0;
    const lineasHoras = conceptos.map((c, i) => {
      const horas = n0(horasInput[i]);
      if (horas > 10000) throw new Error(`Horas fuera de rango en la partida ${i + 1}`);
      horasTotales += horas;
      return { indice: i, descripcion: String(c.descripcion || ''), horas, coste_laboral: costeDiario ? r2((horas / horasDia) * costeDiario) : 0 };
    });
    horasTotales = r2(horasTotales);
    const costeHora = costeDiario ? r2(costeDiario / horasDia) : null;
    const costeLaboral = r2(lineasHoras.reduce((sum, l) => sum + l.coste_laboral, 0));
    const basePresupuesto = r2(n0(presupuesto.base_imponible ?? presupuesto.importe));
    const laboralPct = basePresupuesto > 0 ? r2((costeLaboral / basePresupuesto) * 100) : 0;
    const fijoAplicado = body.gastos_fijos_aplicados === true;
    const pctFijo = porcentajeRecomendado == null ? 0 : porcentajeRecomendado;
    const baseSinFijos = n0(body.base_presupuesto_sin_gastos_fijos);
    const importeFijos = fijoAplicado ? r2(baseSinFijos * pctFijo / 100) : 0;
    const snapshot = {
      presupuesto_id: presupuestoId,
      presupuesto_codigo: presupuesto.codigo_registro || '',
      horas_por_partida: lineasHoras,
      horas_totales: horasTotales,
      coste_diario_aprobado: costeDiario || 0,
      horas_por_dia: horasDia,
      coste_hora_interno: costeHora || 0,
      coste_laboral_estimado: costeLaboral,
      base_presupuesto: basePresupuesto,
      porcentaje_coste_laboral: laboralPct,
      gastos_fijos_aplicados: fijoAplicado,
      porcentaje_gastos_fijos: pctFijo,
      importe_gastos_fijos: importeFijos,
      base_presupuesto_sin_gastos_fijos: r2(baseSinFijos),
      coste_diario_revision_fecha: revision?.fecha_revision || '',
      gastos_fijos_fuente_periodo: `${desde}/${hasta}`,
      calculado_en: ahora.toISOString(),
      calculado_por: user.email || user.full_name || '',
      estado: 'calculado',
    };

    const existentes = await sr.entities.PresupuestoCosteInterno.filter({ presupuesto_id: presupuestoId }).catch(() => []);
    const anterior = Array.isArray(existentes) ? existentes[0] : null;
    const guardado = anterior
      ? await sr.entities.PresupuestoCosteInterno.update(anterior.id, snapshot)
      : await sr.entities.PresupuestoCosteInterno.create(snapshot);
    return Response.json({ ok: true, snapshot: guardado || snapshot });
  } catch (error) {
    console.error('guardarCostesPresupuestoInternos:', error);
    return Response.json({ error: error?.message || 'No se pudieron guardar los costes internos' }, { status: 500 });
  }
});
