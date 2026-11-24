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
    if (!user || !['admin', 'propietario', 'gerencia', 'administracion', 'director_comercial'].includes(user.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const periodo = body.periodo || 'mes';
    const subPeriodo = Number(body.subPeriodo || 1);
    const anio = Number(body.anio || new Date().getFullYear());
    // Base temporal del análisis: por fecha del documento o por fecha de pago/cobro.
    const baseTemporal = body.baseTemporal === 'pago' ? 'pago' : 'documento';

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
          ingreso: 0, gastos: 0, materiales: 0, flota: 0, nominas_imputadas: 0, proveedores: 0,
        };
        obras.set(obraId, a);
      }
      return a;
    }

    const fijos = { gastos_fijos: 0, nominas_no_imputadas: 0 };

    // 1) Gastos aprobados por obra_id (por ciclo del mes o por fecha de pago según la base)
    const gastos = await safe(sr.entities.RegistroGasto.filter(
      baseTemporal === 'pago'
        ? { fecha_pago: { $gte: fechaDesde, $lte: fechaHasta }, estado: { $in: ESTADOS_APROBADOS } }
        : { ciclo_mes: { $in: claves }, estado: { $in: ESTADOS_APROBADOS } },
      undefined, 10000,
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

    // 7) Módulo Contabilidad: libro de IVA (facturas de proveedor y emitidas),
    //    facturas de autónomos, borradores de factura y control de modelos fiscales.
    //    Cada documento se cuenta UNA sola vez por su fuente: el libro de IVA no se
    //    suma a las notas de gasto ya aprobadas, solo se desglosa aparte.
    const enRango = (d) => {
      const s = String(d || '').slice(0, 10);
      return !!s && s >= fechaDesde && s <= fechaHasta;
    };
    const sumaDe = (arr, fn) => round2(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0));
    const anioDesde = `${anio}-01-01`;
    const anioHasta = `${anio}-12-31`;

    const [filasIVA, autonomos, borradoresFactura, empresaPendiente, declaraciones] = await Promise.all([
      safe(sr.entities.FacturaIVA.filter({ fecha_factura: { $gte: anioDesde, $lte: anioHasta } }, undefined, 10000)),
      safe(sr.entities.FacturaAutonomo.filter({ fecha_factura: { $gte: anioDesde, $lte: anioHasta } }, undefined, 10000)),
      safe(sr.entities.FacturaBorrador.filter({ fecha: { $gte: fechaDesde, $lte: fechaHasta } }, undefined, 5000)),
      safe(sr.entities.RegistroGasto.filter({
        origen_pago: { $in: ['medio_empresa', 'credito_proveedor'] },
        estado: { $in: ['borrador', 'registrado'] },
        fecha_documento: { $gte: fechaDesde, $lte: fechaHasta },
      }, undefined, 5000)),
      safe(sr.entities.DeclaracionPeriodo.filter({ anio }, undefined, 200)),
    ]);

    // Facturas del libro de IVA del periodo (solo por fecha de factura: el libro no
    // guarda fecha de cobro, así que la base de pago se aplica a las demás fuentes).
    const ivaPeriodo = filasIVA.filter((f) => enRango(f.fecha_factura));
    const ivaRecibidas = ivaPeriodo.filter((f) => f.tipo === 'recibida' && f.estado !== 'anulada');
    const provContab = ivaRecibidas.filter((f) => f.estado === 'revisada');
    const provPend = ivaRecibidas.filter((f) => f.estado === 'borrador');

    const bloqueProv = (arr) => ({
      n: arr.length,
      base: sumaDe(arr, (f) => f.base_imponible),
      iva: sumaDe(arr, (f) => f.cuota_iva),
      total: sumaDe(arr, (f) => f.total_factura ?? ((f.base_imponible || 0) + (f.cuota_iva || 0))),
    });

    const autPeriodo = autonomos.filter((a) => {
      const ref = baseTemporal === 'pago' ? (a.fecha_pago || a.fecha_factura) : a.fecha_factura;
      return enRango(ref) && a.estado !== 'anulada';
    });
    const autContab = autPeriodo.filter((a) => ['pagada', 'incluida_111'].includes(a.estado));
    const autPend = autPeriodo.filter((a) => ['borrador', 'pendiente_pago'].includes(a.estado));
    const bloqueAut = (arr) => ({
      n: arr.length,
      base: sumaDe(arr, (a) => a.base_imponible),
      iva: sumaDe(arr, (a) => a.importe_iva),
      retencion: sumaDe(arr, (a) => a.importe_retencion),
      total: sumaDe(arr, (a) => a.total_factura ?? ((a.base_imponible || 0) + (a.importe_iva || 0) - (a.importe_retencion || 0))),
    });

    // Facturas emitidas: una factura puede tener varias filas (una por tipo de IVA).
    const hoyISO = new Date().toISOString().slice(0, 10);
    const mapaEmitidas = new Map();
    for (const f of ivaPeriodo) {
      if (f.tipo !== 'emitida' || f.estado === 'anulada') continue;
      const k = `${f.numero_factura || f.id}|${(f.nif_contraparte || '').toUpperCase()}`;
      const g = mapaEmitidas.get(k) || {
        key: k, numero: f.numero_factura || 's/n', nombre: f.nombre_contraparte || f.nif_contraparte || '—',
        fecha: String(f.fecha_factura || '').slice(0, 10), vencimiento: f.fecha_vencimiento || '',
        base: 0, iva: 0, total: 0, cobro: '', borrador: false,
      };
      g.base += Number(f.base_imponible) || 0;
      g.iva += Number(f.cuota_iva) || 0;
      g.total += Number(f.total_factura ?? ((f.base_imponible || 0) + (f.cuota_iva || 0))) || 0;
      if (f.estado === 'borrador') g.borrador = true;
      if (f.estado_cobro === 'pendiente') g.cobro = 'pendiente';
      else if (f.estado_cobro === 'pagado' && g.cobro !== 'pendiente') g.cobro = 'pagado';
      mapaEmitidas.set(k, g);
    }
    const emitidas = [...mapaEmitidas.values()];
    const emitidasCobradas = emitidas.filter((g) => g.cobro === 'pagado');
    const emitidasPendientes = emitidas.filter((g) => g.cobro === 'pendiente');
    const emitidasSinEstado = emitidas.filter((g) => !g.cobro);
    const emitidasVencidas = emitidasPendientes.filter((g) => g.vencimiento && String(g.vencimiento).slice(0, 10) < hoyISO);
    const totalEmitidas = (arr) => round2(arr.reduce((s, g) => s + g.total, 0));

    // Coste de proveedores vinculado a obra (informativo: no altera el margen,
    // que sigue calculado con gastos + materiales + flota + nóminas).
    for (const f of [...provContab, ...provPend]) {
      if (!f.obra_id) continue;
      const a = accObra(f.obra_id);
      if (a) a.proveedores += Number(f.base_imponible) || 0;
    }
    for (const a of [...autContab, ...autPend]) {
      if (!a.obra_id) continue;
      const acc = accObra(a.obra_id);
      if (acc) acc.proveedores += Number(a.base_imponible) || 0;
    }

    // Ranking de proveedores (libro de IVA + autónomos), separando estado.
    const porProveedor = new Map();
    const addProv = (nombre, importe, estado) => {
      const key = nombre || 'Sin nombre';
      const p = porProveedor.get(key) || { nombre: key, contabilizado: 0, pendiente: 0 };
      p[estado] += Number(importe) || 0;
      porProveedor.set(key, p);
    };
    for (const f of provContab) addProv(f.nombre_contraparte, f.base_imponible, 'contabilizado');
    for (const f of provPend) addProv(f.nombre_contraparte, f.base_imponible, 'pendiente');
    for (const a of autContab) addProv(a.nombre_autonomo, a.base_imponible, 'contabilizado');
    for (const a of autPend) addProv(a.nombre_autonomo, a.base_imponible, 'pendiente');
    const rankingProveedores = [...porProveedor.values()]
      .map((p) => ({ ...p, contabilizado: round2(p.contabilizado), pendiente: round2(p.pendiente), total: round2(p.contabilizado + p.pendiente) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const borradoresPeriodo = borradoresFactura.filter((f) => ['borrador', 'preparada'].includes(f.estado || 'borrador'));

    const trimestres = [...new Set(months.map((m) => Math.ceil(m / 3)))];
    const impuestos = declaraciones
      .filter((d) => {
        const t = Number(d.trimestre) || Number(String(d.periodo || '').split('-T')[1]) || 0;
        return trimestres.includes(t);
      })
      .map((d) => ({
        modelo: d.modelo,
        periodo: d.periodo,
        estado: d.estado || 'borrador',
        calculado: round2(d.importe_calculado),
        presentado: round2(d.importe_presentado),
        diferencia: round2(d.diferencia),
      }));

    const avisos = [];
    if (baseTemporal === 'pago' && emitidas.length > 0) {
      avisos.push('El libro de IVA no guarda fecha de cobro: las facturas emitidas se imputan por su fecha de factura y solo cuentan como cobradas las marcadas como pagadas.');
    }
    if (autPeriodo.some((a) => baseTemporal === 'pago' && !a.fecha_pago && ['pagada', 'incluida_111'].includes(a.estado))) {
      avisos.push('Algunas facturas de autónomo pagadas no tienen fecha de pago: se imputan por su fecha de factura.');
    }

    const contabilidad = {
      base_temporal: baseTemporal,
      avisos,
      proveedores: {
        contabilizadas: bloqueProv(provContab),
        pendientes: bloqueProv(provPend),
        autonomos: { pagadas: bloqueAut(autContab), pendientes: bloqueAut(autPend) },
        documentos_empresa_pendientes: { n: empresaPendiente.length, total: sumaDe(empresaPendiente, (r) => r.importe) },
        por_proveedor: rankingProveedores,
        total_contabilizado: round2(bloqueProv(provContab).base + bloqueAut(autContab).base),
        total_pendiente: round2(bloqueProv(provPend).base + bloqueAut(autPend).base + sumaDe(empresaPendiente, (r) => r.importe)),
      },
      emitidas: {
        facturado: { n: emitidas.length, base: sumaDe(emitidas, (g) => g.base), iva: sumaDe(emitidas, (g) => g.iva), total: totalEmitidas(emitidas) },
        cobrado: { n: emitidasCobradas.length, total: totalEmitidas(emitidasCobradas) },
        pendiente: { n: emitidasPendientes.length, total: totalEmitidas(emitidasPendientes) },
        vencido: { n: emitidasVencidas.length, total: totalEmitidas(emitidasVencidas) },
        sin_estado_cobro: { n: emitidasSinEstado.length, total: totalEmitidas(emitidasSinEstado) },
        en_borrador_libro: { n: emitidas.filter((g) => g.borrador).length, total: totalEmitidas(emitidas.filter((g) => g.borrador)) },
        por_cliente: [...emitidas.reduce((m, g) => {
          const c = m.get(g.nombre) || { nombre: g.nombre, total: 0, cobrado: 0, pendiente: 0 };
          c.total += g.total;
          if (g.cobro === 'pagado') c.cobrado += g.total;
          if (g.cobro === 'pendiente') c.pendiente += g.total;
          m.set(g.nombre, c);
          return m;
        }, new Map()).values()]
          .map((c) => ({ ...c, total: round2(c.total), cobrado: round2(c.cobrado), pendiente: round2(c.pendiente) }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6),
      },
      borradores_factura: {
        n: borradoresPeriodo.length,
        base: sumaDe(borradoresPeriodo, (f) => f.importe),
        total: sumaDe(borradoresPeriodo, (f) => f.total_con_iva),
      },
      impuestos,
    };

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
      a.proveedores = round2(a.proveedores);
      const costeTotal = round2(a.gastos + a.materiales + a.flota + a.nominas_imputadas);
      const margenEur = round2(a.ingreso - costeTotal);
      const margenPct = a.ingreso > 0 ? round2((margenEur / a.ingreso) * 100) : (costeTotal > 0 ? -100 : 0);
      const pctPres = a.budget > 0 ? round2((costeTotal / a.budget) * 100) : null;
      if (a.ingreso === 0 && costeTotal === 0 && a.proveedores === 0) continue;
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
      contabilidad,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}