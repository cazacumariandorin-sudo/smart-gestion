import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ROLES_INTERNOS_PRESUPUESTO = ['admin', 'propietario', 'gerencia', 'director_comercial', 'administracion'];
const n0 = (value) => Math.max(0, Number(value) || 0);
const r2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

function fechaHace12Meses() {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
}

function gastosFijosMensuales(empresa) {
  return r2(
    n0(empresa.gastos_fijos_gestoria_mensual) +
    n0(empresa.gastos_fijos_luz_telefono_mensual) +
    n0(empresa.gastos_fijos_oficina_mensual) +
    n0(empresa.gastos_fijos_prl_anual) / 12 +
    n0(empresa.gastos_fijos_seguro_convenio_metal_anual) / 12 +
    n0(empresa.gastos_fijos_itv_coches_anual) / 12
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ROLES_INTERNOS_PRESUPUESTO.includes(user.role)) {
      return Response.json({ error: 'No tienes permiso para consultar costes internos de presupuestos.' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const [empresasRaw, presupuestosRaw] = await Promise.all([
      sr.entities.Empresa.list().catch(() => []),
      sr.entities.Presupuesto.list('-fecha', 2000).catch(() => []),
    ]);
    const empresas = Array.isArray(empresasRaw) ? empresasRaw : [];
    const presupuestos = Array.isArray(presupuestosRaw) ? presupuestosRaw : [];
    const empresa = empresas.find((item) => item.es_principal) || empresas.find((item) => item.activa !== false) || empresas[0] || null;
    if (!empresa) return Response.json({ error: 'No hay ficha de empresa configurada.' }, { status: 404 });

    const desde = fechaHace12Meses();
    const hoy = new Date().toISOString().slice(0, 10);
    const presupuestosBase = presupuestos
      .filter((p) => ['enviado', 'aceptado'].includes(p.estado) && String(p.fecha || '').slice(0, 10) >= desde && String(p.fecha || '').slice(0, 10) <= hoy)
      .reduce((sum, p) => sum + n0(p.importe ?? p.base_imponible), 0);
    const facturacionMediaMensual = r2(presupuestosBase / 12);
    const fijosMensuales = gastosFijosMensuales(empresa);
    const tieneBaseIngresos = facturacionMediaMensual > 0;
    const porcentajeFijos = tieneBaseIngresos ? r2((fijosMensuales / facturacionMediaMensual) * 100) : null;

    const revisiones = Array.isArray(empresa.coste_laboral_revisiones) ? empresa.coste_laboral_revisiones : [];
    const revision = empresa.coste_laboral_revision_actual?.estado === 'aprobado'
      ? empresa.coste_laboral_revision_actual
      : [...revisiones].filter((r) => r.estado === 'aprobado').sort((a, b) => new Date(b.fecha_revision || 0) - new Date(a.fecha_revision || 0))[0] || null;
    const proxima = revision?.proxima_revision ? new Date(revision.proxima_revision) : null;

    return Response.json({
      ok: true,
      fuente: 'Empresa principal y presupuestos enviados/aceptados de los últimos 12 meses',
      gastos_fijos: {
        mensual: fijosMensuales,
        anual: r2(fijosMensuales * 12),
        facturacion_base_12_meses: r2(presupuestosBase),
        facturacion_media_mensual: facturacionMediaMensual,
        porcentaje_recomendado: porcentajeFijos,
        base_suficiente: tieneBaseIngresos,
        desde,
        hasta: hoy,
      },
      coste_laboral: revision ? {
        coste_diario_aprobado: r2(revision.coste_diario),
        tipo_dia: revision.tipo_dia || 'laborable',
        fecha_revision: revision.fecha_revision || null,
        proxima_revision: revision.proxima_revision || null,
        revision_vencida: !proxima || proxima <= new Date(),
        aprobado_por: revision.aprobado_por_nombre || revision.aprobado_por || '',
      } : null,
    });
  } catch (error) {
    console.error('calcularCostesPresupuesto:', error);
    return Response.json({ error: error?.message || 'Error al calcular costes internos.' }, { status: 500 });
  }
});
