/**
 * Núcleo de cálculo del SIMULADOR DE NÓMINAS de SMART-GESTION.
 *
 * Cálculo 100% determinista: la aritmética no se delega a un modelo de IA y
 * NUNCA se escribe en la base de datos. Las tasas (cuota obrera, IRPF y coste
 * de empresa) se derivan de las nóminas reales del propio trabajador, de modo
 * que simular sin cambios reproduce exactamente sus importes.
 */

export const ROLES_SIMULADOR = ['admin', 'propietario', 'gerencia', 'administracion'];

/**
 * Tope de la base de cotización mensual del régimen general.
 * Valor orientativo: actualizar cada enero con la orden de cotización vigente.
 */
export const BASE_MAXIMA_MENSUAL = 4909.5;

export const AVISO_LEGAL =
  'Simulación informativa: no es una nómina, no tiene validez legal ni fiscal y no se guarda en la aplicación.';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const indicePeriodo = (n) => (Number(n.anio) || 0) * 100 + (Number(n.mes) || 0);
const nombrePeriodo = (mes, anio) => `${MESES[Number(mes) - 1] || ''} ${anio}`.trim();

/**
 * Devuelve hasta 6 nóminas individuales válidas anteriores al periodo simulado.
 * Descarta resúmenes de costes, registros sin asignar y meses sin importes.
 * Si no hay meses anteriores al periodo pedido, usa las más recientes.
 */
export function seleccionarHistorico(nominas, mes, anio) {
  const validas = (Array.isArray(nominas) ? nominas : [])
    .filter((n) => n && (n.tipo_documento || 'nomina_individual') === 'nomina_individual')
    .filter((n) => (n.estado_asignacion || 'asignada') === 'asignada')
    .filter((n) => Number(n.total_devengado) > 0)
    .sort((a, b) => indicePeriodo(b) - indicePeriodo(a));

  const objetivo = Number(anio) * 100 + Number(mes);
  const previas = validas.filter((n) => indicePeriodo(n) < objetivo);
  return (previas.length ? previas : validas).slice(0, 6);
}

/** Cuota obrera del régimen general: CC 4,70 % + desempleo 1,55 % + FP 0,10 %. */
const CUOTA_OBRERA_GENERAL = 0.0635;

/**
 * La línea base se toma de la nómina MÁS RECIENTE, no de una media: promediar
 * meses con campos vacíos desvirtúa las tasas.
 * Si esa nómina no desglosa las deducciones, se reconstruyen desde el líquido
 * real del documento para que la tabla cuadre.
 */
export function calcularBaseline(historico, esReta = false) {
  const completa =
    historico.find(
      (n) => Number(n.total_devengado) > 0 && Number(n.liquido_percibir) > 0
    ) || historico[0];

  const bruto = r2(completa.total_devengado);
  const cuotasRegistradas = r2(completa.cuotas_obreras);
  const irpfRegistrado = r2(completa.retencion_irpf);
  const anticiposRegistrados = r2(completa.anticipos_deducciones);

  const gap = r2(bruto - r2(completa.liquido_percibir));
  const declarado = r2(cuotasRegistradas + irpfRegistrado + anticiposRegistrados);
  const desgloseFiable = Math.abs(declarado - gap) <= 0.5;

  let cuotas = cuotasRegistradas;
  let irpf = irpfRegistrado;
  let anticipos = anticiposRegistrados;

  if (!desgloseFiable) {
    anticipos = 0;
    if (esReta) {
      // Autónomo societario: sin SS General, toda la retención es IRPF/ingreso a cuenta.
      cuotas = 0;
      irpf = Math.max(gap, 0);
    } else {
      cuotas = r2(bruto * CUOTA_OBRERA_GENERAL);
      irpf = Math.max(r2(gap - cuotas), 0);
    }
  }

  const neto = r2(bruto - cuotas - irpf - anticipos);
  const ssEmpresa =
    r2(completa.coste_ss_empresa) || Math.max(0, r2(r2(completa.coste_empresa) - bruto));
  const coste = r2(completa.coste_empresa) || r2(bruto + ssEmpresa);

  return {
    meses: historico.map((h) => `${MESES[(Number(h.mes) || 1) - 1]} ${h.anio}`),
    origen: `${MESES[(Number(completa.mes) || 1) - 1]} ${completa.anio}`,
    bruto,
    cuotas,
    irpf,
    ssEmpresa,
    anticipos,
    neto,
    coste,
    desgloseFiable,
    tipoIrpf: bruto > 0 ? irpf / bruto : 0,
    baseCotizable: Math.min(bruto, BASE_MAXIMA_MENSUAL),
  };
}

function resolverBruto({ modo, valor, real, tasaObrera, tipoIrpf }) {
  if (modo === 'importe') return r2(valor);
  if (modo === 'porcentaje') return r2(real.bruto * (1 + Number(valor) / 100));

  // mantener_neto: bruto necesario para que el líquido no cambie.
  const objetivo = real.neto + real.anticipos;
  const denBajo = 1 - tasaObrera - tipoIrpf;
  const denAlto = 1 - tipoIrpf;
  let candidato = denBajo > 0 ? objetivo / denBajo : real.bruto;
  if (candidato > BASE_MAXIMA_MENSUAL && denAlto > 0) {
    candidato = (objetivo + BASE_MAXIMA_MENSUAL * tasaObrera) / denAlto;
  }
  return r2(candidato);
}

const fila = (concepto, tipo, real, simulado) => ({
  concepto,
  tipo,
  real: r2(real),
  simulado: r2(simulado),
  variacion: r2(simulado - real),
});

export function simularNomina({
  historico,
  mes,
  anio,
  modo,
  valor,
  regimen,
  cuotaReta,
  empresaAsumeReta,
  operarioNombre,
}) {
  const esReta = regimen === 'autonomo_societario';
  const real = calcularBaseline(historico, esReta);
  const baseReal = real.baseCotizable;

  // Tasas efectivas derivadas del histórico real del trabajador.
  const tasaObrera = esReta || baseReal <= 0 ? 0 : real.cuotas / baseReal;
  const tasaEmpresa = esReta || baseReal <= 0 ? 0 : real.ssEmpresa / baseReal;
  const tipoIrpf = real.tipoIrpf;

  const brutoSimulado = resolverBruto({ modo, valor, real, tasaObrera, tipoIrpf });
  const baseSim = Math.min(brutoSimulado, BASE_MAXIMA_MENSUAL);

  const cuotas = esReta ? 0 : r2(baseSim * tasaObrera);
  const irpf = r2(brutoSimulado * tipoIrpf);
  const anticipos = real.anticipos;
  const neto = r2(brutoSimulado - cuotas - irpf - anticipos);
  const ssEmpresa = esReta ? 0 : r2(baseSim * tasaEmpresa);

  // Cuota RETA asumida por la empresa: si se refleja como retribución en especie,
  // su ingreso a cuenta se calcula con gross-up para no mermar el líquido.
  const retaAsumida = esReta && empresaAsumeReta ? r2(cuotaReta) : 0;
  const ingresoCuenta =
    retaAsumida > 0 && tipoIrpf < 1 ? r2((retaAsumida * tipoIrpf) / (1 - tipoIrpf)) : 0;
  const costeEmpresa = r2(brutoSimulado + ssEmpresa + retaAsumida + ingresoCuenta);

  const deduccionesReales = r2(real.cuotas + real.irpf + real.anticipos);
  const deduccionesSimuladas = r2(cuotas + irpf + anticipos);

  const filas = [
    fila('Retribución bruta (incl. prorrata pagas extra)', 'devengo', real.bruto, brutoSimulado),
    fila('Cuotas obreras Seguridad Social', 'deduccion', real.cuotas, cuotas),
    fila('Retención IRPF', 'deduccion', real.irpf, irpf),
    fila('Anticipos y otras deducciones', 'deduccion', real.anticipos, anticipos),
    fila('TOTAL DEVENGADO (bruto)', 'total', real.bruto, brutoSimulado),
    fila('TOTAL DEDUCCIONES', 'total', deduccionesReales, deduccionesSimuladas),
    fila('LÍQUIDO A PERCIBIR (neto)', 'neto', real.neto, neto),
  ];

  const impacto = r2(costeEmpresa - real.coste);
  const notas = [];

  notas.push(
    `Línea base tomada de la nómina de ${real.origen}. Tasas efectivas: ` +
      `cuota obrera ${(tasaObrera * 100).toFixed(2)} %, IRPF ${(tipoIrpf * 100).toFixed(2)} % ` +
      `y Seguridad Social de empresa ${(tasaEmpresa * 100).toFixed(2)} % sobre la base de cotización.`
  );

  if (!real.desgloseFiable) {
    notas.push(
      `La nómina de ${real.origen} no desglosa las deducciones; se han reconstruido a partir del líquido real del documento.`
    );
  }

  if (esReta) {
    notas.push('Régimen de autónomo societario: la Seguridad Social General se fija en 0,00 €.');
  }
  if (modo === 'mantener_neto') {
    const ajuste = r2(brutoSimulado - real.bruto);
    notas.push(
      `Para mantener el líquido en ${real.neto.toFixed(2)} €, el bruto se reajusta en ` +
        `${ajuste >= 0 ? '+' : ''}${ajuste.toFixed(2)} €; ese ajuste se aplicaría a incentivos o pluses variables.`
    );
  }
  if (retaAsumida > 0) {
    notas.push(
      `Cuota RETA asumida por la empresa: ${retaAsumida.toFixed(2)} €, con un ingreso a cuenta de ` +
        `${ingresoCuenta.toFixed(2)} € (gross-up) que no reduce el líquido del trabajador.`
    );
  }
  if (brutoSimulado > BASE_MAXIMA_MENSUAL) {
    notas.push(
      `El bruto simulado supera la base máxima de cotización (${BASE_MAXIMA_MENSUAL.toFixed(2)} €), ` +
        'por lo que las cotizaciones quedan topadas.'
    );
  }
  if (tipoIrpf === 0) {
    notas.push('El histórico no tiene retención de IRPF registrada; la simulación aplica 0 %.');
  }
  if (anticipos > 0) {
    notas.push(`Se mantienen los anticipos habituales de ${anticipos.toFixed(2)} €.`);
  }

  const periodo = nombrePeriodo(mes, anio);
  const eur = (x) => Number(x).toFixed(2);
  const sgn = (x) => `${x > 0 ? '+' : ''}${Number(x).toFixed(2)}`;

  const markdown = [
    `### 📊 Simulación Informativa de Nómina: ${operarioNombre}`,
    `**Período Simulado:** ${periodo}`,
    `*${AVISO_LEGAL}*`,
    '',
    '| Concepto Salarial | Valor Real Actual (€) | Valor Simulado (€) | Variación |',
    '| :--- | :---: | :---: | :---: |',
    ...filas.map((f) => `| ${f.concepto} | ${eur(f.real)} | ${eur(f.simulado)} | ${sgn(f.variacion)} |`),
    '',
    '**Análisis de Coste para la Empresa:**',
    `- **Coste Empresa Anterior:** ${eur(real.coste)} €`,
    `- **Coste Empresa Simulado:** ${eur(costeEmpresa)} €`,
    `- **Impacto Económico Neto:** ${sgn(impacto)} € ${impacto > 0 ? '(aumento)' : impacto < 0 ? '(ahorro)' : '(sin cambios)'}`,
  ].join('\n');

  return {
    ok: true,
    empleado: operarioNombre,
    periodo,
    regimen: esReta ? 'autonomo_societario' : 'general',
    filas,
    real: {
      bruto: real.bruto,
      deducciones: deduccionesReales,
      neto: real.neto,
      coste: real.coste,
    },
    simulado: {
      bruto: brutoSimulado,
      cuotas_obreras: cuotas,
      irpf,
      anticipos,
      deducciones: deduccionesSimuladas,
      neto,
      base_cotizacion: r2(baseSim),
      ss_empresa: ssEmpresa,
      reta_asumida: retaAsumida,
      ingreso_cuenta: ingresoCuenta,
      coste: costeEmpresa,
    },
    coste: {
      anterior: real.coste,
      simulado: costeEmpresa,
      impacto,
    },
    notas,
    aviso: AVISO_LEGAL,
    markdown,
  };
}