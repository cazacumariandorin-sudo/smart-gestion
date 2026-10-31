/**
 * Núcleo de cálculo del SIMULADOR DE NÓMINAS de SMART-GESTION.
 *
 * Cálculo 100% determinista: la aritmética no se delega a un modelo de IA y
 * NUNCA se escribe en la base de datos. Las tasas (cuota obrera, IRPF y coste
 * de empresa) se derivan de las nóminas reales del propio trabajador, de modo
 * que simular sin cambios reproduce exactamente sus importes.
 *
 * La simulación parte de un DESGLOSE DE CONCEPTOS editable (salario base,
 * prorrata, pluses, incentivos, horas extra, bonus, dietas, otros devengos y
 * anticipos). Lo que es cálculo legal (base de cotización, cuotas, IRPF y
 * Seguridad Social de empresa) no se edita: se calcula aquí.
 */

export const ROLES_SIMULADOR = ['admin', 'propietario', 'gerencia', 'administracion'];

/**
 * Tope de la base de cotización mensual del régimen general.
 * Valor orientativo: actualizar cada enero con la orden de cotización vigente.
 */
export const BASE_MAXIMA_MENSUAL = 4909.5;

/** Importe diario de dieta exenta en España. */
export const LIMITES_DIETA = { con_pernocta: 53.34, sin_pernocta: 26.67 };

export const AVISO_LEGAL =
  'Simulación informativa: no es una nómina, no tiene validez legal ni fiscal y no se guarda en la aplicación.';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: any) => Math.max(0, Number(v) || 0);
const indicePeriodo = (n: any) => (Number(n.anio) || 0) * 100 + (Number(n.mes) || 0);
const nombrePeriodo = (mes: any, anio: any) => `${MESES[Number(mes) - 1] || ''} ${anio}`.trim();

/** Conceptos de devengo editables, en el orden en que se imprimen en la nómina. */
export const CONCEPTOS_DEVENGOS = [
  { key: 'salario_base', label: 'Salario base' },
  { key: 'prorrata_extras', label: 'Prorrata pagas extra' },
  { key: 'plus_convenio', label: 'Plus convenio' },
  { key: 'incentivos', label: 'Incentivos' },
  { key: 'horas_extra', label: 'Horas extra' },
  { key: 'bonus', label: 'Bonus / paga extra' },
  { key: 'otros_devengos', label: 'Otros devengos' },
];

/**
 * Devuelve hasta 6 nóminas individuales válidas anteriores al periodo simulado.
 * Descarta resúmenes de costes, registros sin asignar y meses sin importes.
 * Si no hay meses anteriores al periodo pedido, usa las más recientes.
 */
export function seleccionarHistorico(nominas: any, mes: any, anio: any) {
  const validas = (Array.isArray(nominas) ? nominas : [])
    .filter((n: any) => n && (n.tipo_documento || 'nomina_individual') === 'nomina_individual')
    .filter((n: any) => (n.estado_asignacion || 'asignada') === 'asignada')
    .filter((n: any) => Number(n.total_devengado) > 0)
    .sort((a: any, b: any) => indicePeriodo(b) - indicePeriodo(a));

  const objetivo = Number(anio) * 100 + Number(mes);
  const previas = validas.filter((n: any) => indicePeriodo(n) < objetivo);
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
export function calcularBaseline(historico: any, esReta = false) {
  const lista = Array.isArray(historico) ? historico : [];
  const completa =
    lista.find((n: any) => Number(n.total_devengado) > 0 && Number(n.liquido_percibir) > 0) ||
    lista[0] ||
    {};

  const bruto = r2(completa.total_devengado);
  const prorrata = r2(completa.prorrata_pagas_extra);
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
    meses: lista.map((h: any) => `${MESES[(Number(h.mes) || 1) - 1]} ${h.anio}`),
    origen: `${MESES[(Number(completa.mes) || 1) - 1]} ${completa.anio}`,
    bruto,
    prorrata,
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

/** Dietas: parte exenta (no cotiza ni tributa) y exceso que va al salario. */
export function desgloseDietas(importe: any, dias: any, conPernocta: boolean) {
  const total = r2(num(importe));
  const limite =
    num(dias) * (conPernocta ? LIMITES_DIETA.con_pernocta : LIMITES_DIETA.sin_pernocta);
  const exentas = r2(Math.min(total, limite));
  return { total, exentas, gravadas: r2(total - exentas), limite: r2(limite) };
}

/** Tipos efectivos del trabajador derivados de su nómina de referencia. */
export function tasasDeNomina(real: any, esReta: boolean) {
  const base = Number(real.baseCotizable) || 0;
  return {
    obrera: esReta || base <= 0 ? 0 : Number(real.cuotas) / base,
    empresa: esReta || base <= 0 ? 0 : Number(real.ssEmpresa) / base,
    irpf: Number(real.tipoIrpf) || 0,
  };
}

/**
 * Desglose de conceptos precargado con la nómina real del trabajador.
 * Solo se conoce el bruto y la prorrata del documento, así que el resto de
 * conceptos arrancan a cero: lo que el usuario quiera añadir, lo edita.
 */
export function devengosDesdeHistorico(historico: any, esReta: boolean) {
  const real = calcularBaseline(historico, esReta);
  return {
    salario_base: r2(Math.max(0, real.bruto - real.prorrata)),
    prorrata_extras: real.prorrata,
    plus_convenio: 0,
    incentivos: 0,
    horas_extra: 0,
    bonus: 0,
    otros_devengos: 0,
    dietas_importe: 0,
    dietas_dias: 0,
    dietas_con_pernocta: true,
    anticipos: real.anticipos,
  };
}

/** Datos de partida que ve el usuario antes de tocar nada. */
export function datosBaseNomina({ historico, mes, anio, regimen, operarioNombre }: any) {
  const esReta = regimen === 'autonomo_societario';
  const real = calcularBaseline(historico, esReta);
  const tasas = tasasDeNomina(real, esReta);

  return {
    ok: true,
    empleado: operarioNombre,
    periodo: nombrePeriodo(mes, anio),
    regimen: esReta ? 'autonomo_societario' : 'general',
    origen: real.origen,
    desglose_fiable: real.desgloseFiable,
    devengos: devengosDesdeHistorico(historico, esReta),
    tasas,
    real: {
      bruto: real.bruto,
      prorrata: real.prorrata,
      base_cotizacion: r2(real.baseCotizable),
      cuotas: real.cuotas,
      irpf: real.irpf,
      anticipos: real.anticipos,
      neto: real.neto,
      ss_empresa: real.ssEmpresa,
      coste: real.coste,
    },
    aviso: AVISO_LEGAL,
  };
}

const fila = (concepto: string, tipo: string, real: any, simulado: any) => ({
  concepto,
  tipo,
  real: r2(real),
  simulado: r2(simulado),
  variacion: r2(r2(simulado) - r2(real)),
});

/**
 * Calcula la nómina simulada completa a partir del desglose de conceptos.
 * Los importes legales se calculan, nunca se reciben del cliente.
 */
export function calcularNominaSimulada({
  historico,
  devengos,
  regimen,
  cuotaReta,
  empresaAsumeReta,
  mes,
  anio,
  operarioNombre,
}: any) {
  const esReta = regimen === 'autonomo_societario';
  const real = calcularBaseline(historico, esReta);
  const tasas = tasasDeNomina(real, esReta);

  const d = devengos || {};
  const salario = r2(num(d.salario_base));
  const prorrata = r2(num(d.prorrata_extras));
  const plus = r2(num(d.plus_convenio));
  const incentivos = r2(num(d.incentivos));
  const horas = r2(num(d.horas_extra));
  const bonus = r2(num(d.bonus));
  const otros = r2(num(d.otros_devengos));
  const anticipos = r2(num(d.anticipos));
  const dietas = desgloseDietas(d.dietas_importe, d.dietas_dias, d.dietas_con_pernocta !== false);

  // La base de cotización y el IRPF solo gravan lo salarial: las dietas exentas quedan fuera.
  const cotizable = r2(salario + prorrata + plus + incentivos + horas + bonus + otros + dietas.gravadas);
  const baseCotizacion = esReta ? 0 : r2(Math.min(cotizable, BASE_MAXIMA_MENSUAL));
  const bruto = r2(cotizable + dietas.exentas);

  const cuotas = esReta ? 0 : r2(baseCotizacion * tasas.obrera);
  const irpf = r2(cotizable * tasas.irpf);
  const neto = r2(bruto - cuotas - irpf - anticipos);
  const ssEmpresa = esReta ? 0 : r2(baseCotizacion * tasas.empresa);

  // Cuota RETA asumida por la empresa: si se refleja como retribución en especie,
  // su ingreso a cuenta se calcula con gross-up para no mermar el líquido.
  const retaAsumida = esReta && empresaAsumeReta ? r2(num(cuotaReta)) : 0;
  const ingresoCuenta =
    retaAsumida > 0 && tasas.irpf < 1 ? r2((retaAsumida * tasas.irpf) / (1 - tasas.irpf)) : 0;
  const coste = r2(bruto + ssEmpresa + retaAsumida + ingresoCuenta);

  const salarioReal = r2(Math.max(0, real.bruto - real.prorrata));
  const deduccionesReales = r2(real.cuotas + real.irpf + real.anticipos);
  const deduccionesSimuladas = r2(cuotas + irpf + anticipos);

  const filas = [
    fila('Salario base', 'devengo', salarioReal, salario),
    fila('Prorrata pagas extra', 'devengo', real.prorrata, prorrata),
    fila('Plus convenio', 'devengo', 0, plus),
    fila('Incentivos', 'devengo', 0, incentivos),
    fila('Horas extra', 'devengo', 0, horas),
    fila('Bonus / paga extra', 'devengo', 0, bonus),
    fila('Otros devengos', 'devengo', 0, otros),
    fila('Dietas exentas (no cotizan ni tributan)', 'devengo', 0, dietas.exentas),
    fila('Dietas que cotizan (exceso del límite)', 'devengo', 0, dietas.gravadas),
    fila('TOTAL DEVENGADO (bruto)', 'total', real.bruto, bruto),
    fila('Base de cotización', 'info', esReta ? 0 : r2(real.baseCotizable), baseCotizacion),
    fila('Cuota obrera Seguridad Social', 'deduccion', real.cuotas, cuotas),
    fila(`Retención IRPF (${(tasas.irpf * 100).toFixed(2)} %)`, 'deduccion', real.irpf, irpf),
    fila('Anticipos y otras deducciones', 'deduccion', real.anticipos, anticipos),
    fila('TOTAL A DEDUCIR', 'total', deduccionesReales, deduccionesSimuladas),
    fila('LÍQUIDO A PERCIBIR (neto)', 'neto', real.neto, neto),
    fila('Seguridad Social a cargo de la empresa', 'empresa', real.ssEmpresa, ssEmpresa),
    ...(retaAsumida > 0
      ? [fila('Cuota RETA asumida por la empresa', 'empresa', 0, retaAsumida)]
      : []),
    ...(ingresoCuenta > 0
      ? [fila('Ingreso a cuenta de la RETA (gross-up)', 'empresa', 0, ingresoCuenta)]
      : []),
    fila('COSTE TOTAL PARA LA EMPRESA', 'empresa-total', real.coste, coste),
  ];

  const impacto = r2(coste - real.coste);
  const notas: string[] = [];

  notas.push(
    `Línea base tomada de la nómina de ${real.origen}. Tasas efectivas: ` +
      `cuota obrera ${(tasas.obrera * 100).toFixed(2)} %, IRPF ${(tasas.irpf * 100).toFixed(2)} % ` +
      `y Seguridad Social de empresa ${(tasas.empresa * 100).toFixed(2)} % sobre la base de cotización.`
  );

  if (!real.desgloseFiable) {
    notas.push(
      `La nómina de ${real.origen} no desglosa las deducciones; se han reconstruido a partir del líquido real del documento.`
    );
  }
  if (esReta) {
    notas.push('Régimen de autónomo societario: la Seguridad Social General se fija en 0,00 €.');
  }
  if (dietas.total > 0) {
    notas.push(
      `Dietas: ${dietas.exentas.toFixed(2)} € exentos de ${dietas.total.toFixed(2)} € ` +
        `(límite ${dietas.limite.toFixed(2)} €). El exceso cotiza y tributa como salario.`
    );
  }
  if (retaAsumida > 0) {
    notas.push(
      `Cuota RETA asumida por la empresa: ${retaAsumida.toFixed(2)} €, con un ingreso a cuenta de ` +
        `${ingresoCuenta.toFixed(2)} € (gross-up) que no reduce el líquido del trabajador.`
    );
  }
  if (cotizable > BASE_MAXIMA_MENSUAL) {
    notas.push(
      `El importe cotizable supera la base máxima de cotización (${BASE_MAXIMA_MENSUAL.toFixed(2)} €), ` +
        'por lo que las cotizaciones quedan topadas.'
    );
  }
  if (tasas.irpf === 0) {
    notas.push('El histórico no tiene retención de IRPF registrada; la simulación aplica 0 %.');
  }
  if (anticipos > 0) {
    notas.push(`Se aplican anticipos y otras deducciones por ${anticipos.toFixed(2)} €.`);
  }

  const periodo = nombrePeriodo(mes, anio);
  const f2 = (x: any) => Number(x).toFixed(2);
  const sgn = (x: any) => `${x > 0 ? '+' : ''}${Number(x).toFixed(2)}`;

  const markdown = [
    `### 📊 Simulación Informativa de Nómina: ${operarioNombre}`,
    `**Período Simulado:** ${periodo}`,
    `*${AVISO_LEGAL}*`,
    '',
    '| Concepto Salarial | Valor Real Actual (€) | Valor Simulado (€) | Variación |',
    '| :--- | :---: | :---: | :---: |',
    ...filas.map((f: any) => `| ${f.concepto} | ${f2(f.real)} | ${f2(f.simulado)} | ${sgn(f.variacion)} |`),
    '',
    '**Análisis de Coste para la Empresa:**',
    `- **Coste Empresa Anterior:** ${f2(real.coste)} €`,
    `- **Coste Empresa Simulado:** ${f2(coste)} €`,
    `- **Impacto Económico Neto:** ${sgn(impacto)} € ${impacto > 0 ? '(aumento)' : impacto < 0 ? '(ahorro)' : '(sin cambios)'}`,
  ].join('\n');

  return {
    ok: true,
    empleado: operarioNombre,
    periodo,
    regimen: esReta ? 'autonomo_societario' : 'general',
    filas,
    devengos: {
      salario_base: salario,
      prorrata_extras: prorrata,
      plus_convenio: plus,
      incentivos,
      horas_extra: horas,
      bonus,
      otros_devengos: otros,
      dietas_importe: dietas.total,
      dietas_dias: r2(num(d.dietas_dias)),
      dietas_con_pernocta: d.dietas_con_pernocta !== false,
      dietas_exentas: dietas.exentas,
      dietas_gravadas: dietas.gravadas,
      anticipos,
    },
    calculado: {
      bruto,
      cotizable,
      base_cotizacion: baseCotizacion,
      cuotas_obreras: cuotas,
      irpf,
      tipo_irpf: tasas.irpf,
      anticipos,
      deducciones: deduccionesSimuladas,
      neto,
      ss_empresa: ssEmpresa,
      reta_asumida: retaAsumida,
      ingreso_cuenta: ingresoCuenta,
      coste,
    },
    tasas,
    real: {
      bruto: real.bruto,
      prorrata: real.prorrata,
      base_cotizacion: r2(real.baseCotizable),
      cuotas: real.cuotas,
      irpf: real.irpf,
      anticipos: real.anticipos,
      neto: real.neto,
      ss_empresa: real.ssEmpresa,
      coste: real.coste,
      origen: real.origen,
    },
    coste: { anterior: real.coste, simulado: coste, impacto },
    notas,
    aviso: AVISO_LEGAL,
    markdown,
  };
}