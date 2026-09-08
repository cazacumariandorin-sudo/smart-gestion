import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Análisis económico por periodo (mes / trimestre / semestre / anual).
// Agrega server-side (service role) para evitar topes de list() en cliente y
// permitir el prorrateo de nóminas a obra por horas (inviable en cliente).
//
// Devuelve: KPIs agregados del periodo + array de obras con ingreso, coste por
// componente (gastos + materiales + flota + nóminas imputadas), margen €/% y
// % sobre presupuesto, además de "fijos" (gastos sin obra y nóminas no imputadas).
//
// Solo gerencia / admin / propietario / director_comercial.

const ESTADOS_APROBADOS = ['aprobado_gerencia', 'en_administracion', 'pagada'];
const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function pad(n) { return String(n).padStart(2, '0'); }
function round2(n) { return Math.round((n || 0) * 100) / 100; }

function mesesDePeriodo(periodo, subPeriodo, anio) {
  let months = [];
  if (periodo === 'mes') months = [subPeriodo];
  else if (periodo === 'trimestre') { const s = subPeriodo; months = [s * 3 - 2, s * 3 - 1, s * 3]; }
  else if (periodo === 'semestre') months = subPeriodo === 1 ? [1,2,3,4,5,6] : [7,8,9,10,11,12];
  else months = [1,2,3,4,5,6,7,8,9,10,11,12];
  months = months.filter(m => m >= 1 && m <= 12);
  return { months, claves: months.map(m => `${anio}-${pad(m)}`) };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin', 'propietario', 'gerencia', 'director_comercial'].includes(user.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const periodo = body.periodo || 'mes';
    const subPeriodo = Number(body.subPeriodo || 1);
    const anio = Number(body.anio || new Date().getFullYear());

    const { months, claves } = mesesDePeriodo(periodo, subPeriodo, anio);
    if (!claves.length) return Response.json({ error: 'Periodo inválido' }, { status: 400 });

    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];
    const fechaDesde = `${anio}-${pad(firstMonth)}-01`;
    const endDay = new Date(Date.UTC(anio, lastMonth, 0)).getUTCDate();
    const fechaHasta = `${anio}-${pad(lastMonth)}-${pad(endDay)}`;

    const sr = base44.asServiceRole;
    const safe = (p) => p.catch(() => []);

    // Obras civiles + solares (budget, cliente)
    const [obrasCivil, obrasSolar] = await Promise.all([
      safe(sr.entities.Obra.list('name', 2000)),
      safe(sr.entities.SolarObra.list('name', 2000)),
    ]);
    const obraMeta = new Map();
    for (const o of obrasCivil) obraMeta.set(o.id, { name: o.name, client: o.client_name || '', budget: o.budget || 0, tipo: 'civil' });
    for (const o of obrasSolar) obraMeta.set(o.id, { name: o.name, client: o.client_name || '', budget: o.budget || 0, tipo: 'solar' });

    const obras = new Map();
    function accObra(obraId) {
      if (!obraId) return null;
      let a = obras.get(obraId);
      if (!a) {
        const meta = obraMeta.get(obraId) || { name: '(obra eliminada)', client: '', budget: 0, tipo: 'desconocido' };
        a = {
          obra_id: obraId, obra_name: meta.name, cliente: meta.client, tipo: meta.tipo, budget: meta.budget || 0,
          ingreso: 0, gastos: 0, materiales: 0, flota: 0, nominas_imputadas: 0,
        };
        obras.set(obraId, a);
      }
      return a;
    }

    const fijos = { gastos_fijos: 0, nominas_no_imputadas: 0 };

    // 1) Gastos aprobados por obra_id (ciclo_mes en el periodo)
    const gastos = await safe(sr.entities.RegistroGasto.filter(
      { ciclo_mes: { $in: claves }, estado: { $in: ESTADOS_APROBADOS } }, undefined, 10000,
    ));
    let totalGastos = 0;
    for (const r of gastos) {
      const imp = r.importe_pagado_real || r.importe || 0;
      totalGastos += imp;
      if (r.obra_id) { const a = accObra(r.obra_id); if (a) a.gastos += imp; }
      else fijos.gastos_fijos += imp;
    }

    // 2) Materiales comprados por obra_id (fecha_documento en el periodo)
    const mats = await safe(sr.entities.MaterialPrecioHistorico.filter(
      { fecha_documento: { $gte: fechaDesde, $lte: fechaHasta } }, undefined, 10000,
    ));
    for (const m of mats) {
      const imp = m.precio_neto || 0;
      if (m.obra_id) { const a = accObra(m.obra_id); if (a) a.materiales += imp; }
    }

    // 3) Flota por proyecto_id (mes YYYY-MM en el periodo)
    const fletas = await safe(sr.entities.CosteFletaProyecto.filter(
      { mes: { $in: claves } }, undefined, 10000,
    ));
    for (const f of fletas) {
      const imp = f.coste_total_estimado || 0;
      if (f.proyecto_id) { const a = accObra(f.proyecto_id); if (a) a.flota += imp; }
    }

    // 4) Nóminas individuales del periodo (sin resumen_costes → evita doble cuenta)
    const nominas = await safe(sr.entities.Nomina.filter(
      { anio, mes: { $in: months }, tipo_documento: 'nomina_individual' }, undefined, 10000,
    ));
    let costeNominas = nominas.reduce((s, n) => s + (n.coste_empresa || 0), 0);
    let periodoNominasEfvo = null;

    // Fallback: si el periodo no tiene nóminas, usar el último mes con datos
    if (costeNominas === 0) {
      const todas = await safe(sr.entities.Nomina.filter({ tipo_documento: 'nomina_individual' }, '-anio', 10000));
      let latest = null;
      for (const n of todas) {
        const key = (n.anio || 0) * 12 + (n.mes || 0);
        if (!latest || key > latest.key) latest = { key, anio: n.anio, mes: n.mes };
      }
      if (latest) {
        const delMes = todas.filter(n => n.anio === latest.anio && n.mes === latest.mes);
        costeNominas = delMes.reduce((s, n) => s + (n.coste_empresa || 0), 0);
        periodoNominasEfvo = { mes: latest.mes, anio: latest.anio, label: `${MESES_NOMBRE[(latest.mes || 1) - 1]} ${latest.anio}` };
      }
    }

    // 5) Horas por (operario_id, obra_id) para prorratear nóminas.
    //    ApunteHorario primario; Fichaje solo para operarios sin apuntes (evita doble cuenta).
    const [apuntes, fichajes] = await Promise.all([
      safe(sr.entities.ApunteHorario.filter({ date: { $gte: fechaDesde, $lte: fechaHasta } }, undefined, 10000)),
      safe(sr.entities.Fichaje.filter({ date: { $gte: fechaDesde, $lte: fechaHasta } }, undefined, 10000)),
    ]);
    const horasObra = new Map();   // operario_id -> Map(obra_id -> horas)
    const horasTotal = new Map();  // operario_id -> total horas
    const conApuntes = new Set();
    for (const a of apuntes) {
      if (!a.operario_id || !a.obra_id || !(a.horas_ejecutadas > 0)) continue;
      conApuntes.add(a.operario_id);
      if (!horasObra.has(a.operario_id)) horasObra.set(a.operario_id, new Map());
      const om = horasObra.get(a.operario_id);
      om.set(a.obra_id, (om.get(a.obra_id) || 0) + a.horas_ejecutadas);
      horasTotal.set(a.operario_id, (horasTotal.get(a.operario_id) || 0) + a.horas_ejecutadas);
    }
    for (const f of fichajes) {
      if (!f.operario_id || !f.obra_id || !(f.horas_trabajadas > 0)) continue;
      if (conApuntes.has(f.operario_id)) continue;
      if (!horasObra.has(f.operario_id)) horasObra.set(f.operario_id, new Map());
      const om = horasObra.get(f.operario_id);
      om.set(f.obra_id, (om.get(f.obra_id) || 0) + f.horas_trabajadas);
      horasTotal.set(f.operario_id, (horasTotal.get(f.operario_id) || 0) + f.horas_trabajadas);
    }
    // Coste de nómina por operario
    const costePorOperario = new Map();
    for (const n of nominas) {
      if (!n.operario_id) { fijos.nominas_no_imputadas += n.coste_empresa || 0; continue; }
      costePorOperario.set(n.operario_id, (costePorOperario.get(n.operario_id) || 0) + (n.coste_empresa || 0));
    }
    for (const [opId, coste] of costePorOperario) {
      const totalH = horasTotal.get(opId) || 0;
      if (totalH <= 0) { fijos.nominas_no_imputadas += coste; continue; }
      const om = horasObra.get(opId) || new Map();
      for (const [obraId, h] of om) {
        const a = accObra(obraId);
        if (a) a.nominas_imputadas += coste * (h / totalH);
      }
    }

    // 6) Ingresos: Presupuesto aceptado (vía partes_trabajo_ids → WorkOrder.obra_id) + TrabajoExtraObra facturado
    const presupuestos = await safe(sr.entities.Presupuesto.filter(
      { fecha: { $gte: fechaDesde, $lte: fechaHasta }, estado: { $in: ['enviado', 'aceptado'] } }, undefined, 10000,
    ));
    let totalPresupuestos = 0;
    const parteIds = new Set();
    for (const p of presupuestos) {
      totalPresupuestos += p.importe || 0;
      for (const id of (p.partes_trabajo_ids || [])) if (id) parteIds.add(id);
    }
    let woMap = new Map();
    if (parteIds.size) {
      const wos = await safe(sr.entities.WorkOrder.filter({ id: { $in: [...parteIds] } }, undefined, 10000));
      for (const w of wos) if (w.obra_id) woMap.set(w.id, w.obra_id);
    }
    for (const p of presupuestos) {
      const obraIds = new Set();
      for (const id of (p.partes_trabajo_ids || [])) { const oid = woMap.get(id); if (oid) obraIds.add(oid); }
      if (!obraIds.size) continue;
      const parte = (p.importe || 0) / obraIds.size;
      for (const oid of obraIds) { const a = accObra(oid); if (a) a.ingreso += parte; }
    }
    // TrabajoExtraObra facturado en el periodo
    const extras = await safe(sr.entities.TrabajoExtraObra.filter(
      { fecha_solicitud: { $gte: fechaDesde, $lte: fechaHasta }, estado: 'facturado' }, undefined, 10000,
    ));
    for (const t of extras) {
      const imp = t.importe_facturado || t.importe_estimado || 0;
      if (t.obra_id) { const a = accObra(t.obra_id); if (a) a.ingreso += imp; }
    }

    // Construir array de obras con margen (solo las con actividad en el periodo)
    const obrasOut = [];
    let obrasSobrecoste = 0;
    let obrasSinPresupuesto = 0;
    for (const a of obras.values()) {
      a.gastos = round2(a.gastos);
      a.materiales = round2(a.materiales);
      a.flota = round2(a.flota);
      a.nominas_imputadas = round2(a.nominas_imputadas);
      a.ingreso = round2(a.ingreso);
      const costeTotal = round2(a.gastos + a.materiales + a.flota + a.nominas_imputadas);
      const margenEur = round2(a.ingreso - costeTotal);
      const margenPct = a.ingreso > 0 ? round2((margenEur / a.ingreso) * 100) : (costeTotal > 0 ? -100 : 0);
      const pctPres = a.budget > 0 ? round2((costeTotal / a.budget) * 100) : null;
      if (a.ingreso === 0 && costeTotal === 0) continue;
      let estado;
      if (a.budget <= 0 && costeTotal > 0) { estado = 'sin_presupuesto'; obrasSinPresupuesto++; }
      else if (margenEur < 0) { estado = 'perdida'; obrasSobrecoste++; }
      else if (a.budget > 0 && costeTotal > a.budget) { estado = 'sobrecoste'; obrasSobrecoste++; }
      else estado = 'ok';
      obrasOut.push({ ...a, coste_total: costeTotal, margen_eur: margenEur, margen_pct: margenPct, pct_sobre_presupuesto: pctPres, estado });
    }
    obrasOut.sort((a, b) => a.margen_eur - b.margen_eur);

    return Response.json({
      periodo: { periodo, subPeriodo, anio, claves, fechaDesde, fechaHasta },
      kpis: {
        gastos_aprobados: round2(totalGastos),
        presupuestos_activos: round2(totalPresupuestos),
        coste_nominas: round2(costeNominas),
        coste_nominas_periodo_efectivo: periodoNominasEfvo,
        obras_sobrecoste: obrasSobrecoste,
        obras_sin_presupuesto: obrasSinPresupuesto,
      },
      obras: obrasOut,
      fijos: { gastos_fijos: round2(fijos.gastos_fijos), nominas_no_imputadas: round2(fijos.nominas_no_imputadas) },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}