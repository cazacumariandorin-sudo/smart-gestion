/**
 * MOTOR DE CÁLCULO DEL SIMULADOR DE NÓMINA — SMART-GESTION
 *
 * Cálculo determinista, puro y testeable (sin acceso a datos ni efectos).
 * Va SIEMPRE de abajo arriba:
 *
 *   días × precio/día      = salario base
 *   + prorrata pagas extra
 *   + pluses / incentivos / mejoras
 *   = base de cotización (sujeta a SS)
 *   + dietas exentas
 *   = total devengado
 *   − deducciones del trabajador = líquido
 *   + aportación de la empresa   = coste de empresa
 *
 * Nada de esto se persiste: el simulador no escribe en la base de datos.
 */

export const ROLES_SIMULADOR = ['admin', 'propietario', 'gerencia', 'administracion'];

export const AVISO_SIMULACION = 'Simulación informativa. Los importes definitivos los calcula la gestoría.';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * PARÁMETROS BLOQUEADOS (no editables en el simulador).
 * Tabla de configuración con fecha de vigencia; se revisa cada enero.
 */
export const PARAMETROS_NOMINA = {
  vigencia: '2026',
  trabajador: [
    { key: 'cc', label: 'Contingencias comunes', tipo: 4.7 },
    { key: 'desempleo', label: 'Desempleo', tipo: 1.55 },
    { key: 'fp', label: 'Formación profesional', tipo: 0.1 },
    { key: 'mei', label: 'MEI', tipo: 0.15 },
  ],
  empresa: [
    { key: 'cc', label: 'Contingencias comunes', tipo: 23.6 },
    { key: 'at_ep', label: 'AT / EP', tipo: 6.7 },
    { key: 'desempleo', label: 'Desempleo', tipo: 5.5 },
    { key: 'fp', label: 'Formación profesional', tipo: 0.6 },
    { key: 'fogasa', label: 'FOGASA', tipo: 0.2 },
    { key: 'mei', label: 'MEI', tipo: 0.75 },
  ],
  dietas: { con_pernocta: 53.34, sin_pernocta: 26.67 },
  base_minima: 994.5,
  base_maxima: 4909.5,
  /**
   * Salarios base mínimos del Convenio del Metal de Madrid por categoría.
   * Valores ORIENTATIVOS de validación: solo generan un aviso, no impiden simular.
   * Revisar cada año con la tabla salarial publicada.
   */
  convenio: {
    peon: { label: 'Peón', mensual: 1420 },
    oficial_segunda: { label: 'Oficial de 2ª', mensual: 1540 },
    oficial_primera: { label: 'Oficial de 1ª', mensual: 1660 },
    encargado: { label: 'Encargado', mensual: 1850 },
    tecnico_solar: { label: 'Técnico solar', mensual: 1700 },
    administrativo: { label: 'Administrativo', mensual: 1500 },
    subcontrata: { label: 'Subcontrata', mensual: 1420 },
    temporal: { label: 'Temporal', mensual: 1420 },
  },
  dias_mes: 30,
};

/** Tipos totales derivados de la tabla (trabajador 6,50 % / empresa 37,35 %). */
export const TIPO_TRABAJADOR =
  PARAMETROS_NOMINA.trabajador.reduce((s, t) => s + t.tipo, 0) / 100;
export const TIPO_EMPRESA = PARAMETROS_NOMINA.empresa.reduce((s, t) => s + t.tipo, 0) / 100;

const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const n0 = (v: any) => Math.max(0, Number(v) || 0);
const indice = (n: any) => (Number(n.anio) || 0) * 100 + (Number(n.mes) || 0);

export const nombrePeriodo = (mes: any, anio: any) =>
  `${MESES[Number(mes) - 1] || ''} ${anio}`.trim();

export const esReta = (regimen: any) => regimen === 'autonomo_societario';

/** Nóminas individuales y válidas para usar como referencia, de más reciente a más antigua. */
export function nominasValidas(nominas: any) {
  return (Array.isArray(nominas) ? nominas : [])
    .filter((n: any) => n && (n.tipo_documento || 'nomina_individual') === 'nomina_individual')
    .filter((n: any) => (n.estado_asignacion || 'asignada') === 'asignada')
    .filter((n: any) => Number(n.total_devengado) > 0)
    .sort((a: any, b: any) => indice(b) - indice(a));
}

/**
 * Referencia del cálculo: la nómina del periodo simulado si existe (así "sin
 * cambios" reproduce exactamente esa nómina); si no, la última anterior.
 */
export function elegirReferencia(nominas: any, mes: any, anio: any) {
  const lista = nominasValidas(nominas);
  const objetivo = Number(anio) * 100 + Number(mes);
  return (
    lista.find((n: any) => indice(n) === objetivo) ||
    lista.find((n: any) => indice(n) < objetivo) ||
    lista[0] ||
    null
  );
}

/** Últimas 3 nóminas completas anteriores (o iguales) al periodo, para la media. */
export function ultimasTres(nominas: any, mes: any, anio: any, referencia: any) {
  const lista = nominasValidas(nominas).filter((n: any) => n.id !== referencia?.id);
  const objetivo = Number(anio) * 100 + Number(mes);
  const previas = lista.filter((n: any) => indice(n) <= objetivo);
  return (previas.length ? previas : lista).slice(0, 3);
}

/**
 * Base de cotización real de la nómina: se deduce de las cuotas aplicando los
 * tipos de la tabla y ajustando al céntimo que mejor encaja con SS obrera,
 * IRPF y SS de empresa. Sin este ajuste, el redondeo de la gestoría desplaza
 * la base unos céntimos.
 */
export function baseDerivada(real: any) {
  const ss = r2(real?.cuotas_obreras);
  const ssEmp = r2(real?.coste_ss_empresa);
  const irpf = r2(real?.retencion_irpf);
  const semilla = ss > 0 ? ss / TIPO_TRABAJADOR : ssEmp > 0 ? ssEmp / TIPO_EMPRESA : 0;
  if (!(semilla > 0)) return 0;

  let mejor: any = null;
  for (let c = -80; c <= 80; c++) {
    const b = r2(semilla + c / 100);
    if (b <= 0) continue;
    const tasa = irpf > 0 ? Math.round((irpf / b) * 10000) / 10000 : 0;
    const err =
      Math.abs(r2(b * TIPO_TRABAJADOR) - ss) +
      (ssEmp > 0 ? Math.abs(r2(b * TIPO_EMPRESA) - ssEmp) : 0) +
      (irpf > 0 ? Math.abs(r2(b * tasa) - irpf) : 0);
    if (!mejor || err < mejor.err - 1e-9) mejor = { b, err };
  }
  if (!mejor) return 0;

  // Entre las bases que encajan (tolerancia de un céntimo), la más próxima a la
  // que se deduce directamente de la cuota obrera.
  let elegida = mejor.b;
  let distancia = Math.abs(mejor.b - semilla);
  for (let c = -80; c <= 80; c++) {
    const b = r2(semilla + c / 100);
    if (b <= 0) continue;
    const tasa = irpf > 0 ? Math.round((irpf / b) * 10000) / 10000 : 0;
    const err =
      Math.abs(r2(b * TIPO_TRABAJADOR) - ss) +
      (ssEmp > 0 ? Math.abs(r2(b * TIPO_EMPRESA) - ssEmp) : 0) +
      (irpf > 0 ? Math.abs(r2(b * tasa) - irpf) : 0);
    const d = Math.abs(b - semilla);
    if (err <= 0.011 && d < distancia - 1e-9) {
      elegida = b;
      distancia = d;
    }
  }
  return elegida;
}

/**
 * Precarga de la simulación desde el histórico real.
 * Deja las entradas listas y devuelve la tasa de IRPF constante y la cuota RETA
 * en especie, que NO son editables.
 */
export function derivarSemilla({ referencia, historico, regimen, dias }: any) {
  const reta = esReta(regimen);
  const ref = referencia || {};
  const dev = r2(ref.total_devengado);
  const irpf = r2(ref.retencion_irpf);
  const liq = r2(ref.liquido_percibir);
  const anticipos = r2(ref.anticipos_deducciones);
  const diasTrabajo = Number(dias) > 0 ? Number(dias) : PARAMETROS_NOMINA.dias_mes;

  if (reta) {
    const cuota = Math.max(0, r2(dev - liq - irpf - anticipos));
    const dinerarios = Math.max(0, r2(dev - cuota));
    const divisor = dinerarios + cuota;
    const tipo = divisor > 0 && irpf > 0 ? irpf / divisor : 0;
    return {
      entradas: {
        dias: diasTrabajo,
        precio_dia: 0,
        salario_base: dinerarios,
        pagas_extra: 0,
        plus_convenio: 0,
        mejora_productividad: 0,
        carencia_incentivos: 0,
        complemento_absorbible: 0,
        incentivos: 0,
        horas_extra: 0,
        otros_devengos: 0,
        dietas_importe: r2(Math.max(0, dev - dinerarios - cuota)),
        dietas_dias: diasTrabajo,
        dietas_con_pernocta: true,
        anticipos,
        cuota_reta: cuota,
        ingreso_cuenta_especie: 0,
      },
      tipoIrpf: Math.round(tipo * 1e6) / 1e6,
      cuotaReta: cuota,
      base: 0,
    };
  }

  const baseRef = baseDerivada(ref) || dev;

  /**
   * La nómina de la gestoría puede presentar la prorrata de pagas extra solo en
   * la base de cotización (no en el total devengado). Se detecta porque
   * devengado + prorrata = base. En ese caso el modelo la mantiene fuera del
   * devengo para reproducir el documento.
   */
  const prorrataDoc = r2(ref.prorrata_pagas_extra);
  const pagas = 2;
  const prorrataFuera =
    prorrataDoc > 0 && Math.abs(r2(dev + prorrataDoc) - baseRef) <= 0.1;
  const sbFuera = prorrataFuera ? r2((prorrataDoc * 12) / pagas) : 0;
  const otrosFuera = prorrataFuera ? Math.max(0, r2(dev - sbFuera)) : 0;
  const sb = prorrataFuera ? sbFuera : r2(baseRef * 6 / 7);
  const precio = diasTrabajo > 0 ? Math.round((sb / diasTrabajo) * 10000) / 10000 : 0;
  // La retención constante se toma con dos decimales de porcentaje (como la aplica
  // la gestoría) siempre que reproduzca el IRPF real; si no, se usa la tasa efectiva.
  const exacta = baseRef > 0 && irpf > 0 ? irpf / baseRef : 0;
  const dosDecimales = Math.round(exacta * 10000) / 10000;
  const tipo = exacta === 0
    ? 0
    : Math.abs(r2(baseRef * dosDecimales) - irpf) <= 0.01
      ? dosDecimales
      : Math.round(exacta * 1e6) / 1e6;

  return {
    entradas: {
      dias: diasTrabajo,
      precio_dia: precio,
      salario_base: sb,
      pagas_extra: pagas,
      plus_convenio: 0,
      mejora_productividad: 0,
      carencia_incentivos: 0,
      complemento_absorbible: 0,
      incentivos: 0,
      horas_extra: 0,
      otros_devengos: otrosFuera,
      dietas_importe: prorrataFuera ? 0 : Math.max(0, r2(dev - baseRef)),
      dietas_dias: diasTrabajo,
      dietas_con_pernocta: true,
      anticipos,
      cuota_reta: 0,
      ingreso_cuenta_especie: 0,
      prorrata_en_devengado: !prorrataFuera,
    },
    tipoIrpf: tipo,
    cuotaReta: 0,
    base: baseRef,
  };
}

/** Media de los últimos meses: contexto para saber si el dato de referencia es habitual. */
export function mediaHistorico(historico: any) {
  const lista = (Array.isArray(historico) ? historico : []).filter((n: any) => Number(n.total_devengado) > 0);
  if (!lista.length) return null;
  const suma = (fn: any) => r2(lista.reduce((s: number, n: any) => s + (Number(fn(n)) || 0), 0) / lista.length);
  return {
    meses: lista.length,
    devengado: suma((n: any) => n.total_devengado),
    liquido: suma((n: any) => n.liquido_percibir),
    dietas: suma((n: any) => Math.max(0, r2(n.total_devengado) - (baseDerivada(n) || n.total_devengado))),
  };
}

/**
 * CÁLCULO DE LA NÓMINA. Función pura: recibe importes y tasas, devuelve el desglose.
 * Los importes redondean por línea, igual que la nómina de la gestoría.
 */
export function calcularNomina({ regimen, entradas, tipoIrpf }: any) {
  const e = entradas || {};
  const reta = esReta(regimen);
  const dias = Number(e.dias) > 0 ? Number(e.dias) : PARAMETROS_NOMINA.dias_mes;
  const tipo = Number(tipoIrpf) || 0;
  const anticipos = r2(n0(e.anticipos));
  const dietasImporte = r2(n0(e.dietas_importe));
  const diasDietas = n0(e.dietas_dias) || dias;
  const limiteDietas = r2(
    diasDietas * (e.dietas_con_pernocta === false
      ? PARAMETROS_NOMINA.dietas.sin_pernocta
      : PARAMETROS_NOMINA.dietas.con_pernocta)
  );
  const dietasExentas = r2(Math.min(dietasImporte, limiteDietas));
  const dietasGravadas = r2(dietasImporte - dietasExentas);

  if (reta) {
    const salario = r2(n0(e.salario_base));
    const dinerarios = r2(
      salario + n0(e.complemento_absorbible) + n0(e.incentivos) + n0(e.plus_convenio) +
      n0(e.mejora_productividad) + n0(e.carencia_incentivos) + n0(e.horas_extra) + n0(e.otros_devengos)
    );
    const cuota = r2(n0(e.cuota_reta));
    const ingreso = r2(n0(e.ingreso_cuenta_especie));
    const irpfTotal = r2((dinerarios + cuota) * tipo);
    const irpfEspecie = r2(cuota * tipo);
    const irpfDinerarios = r2(irpfTotal - irpfEspecie);
    const devengado = r2(dinerarios + dietasImporte + cuota + ingreso);
    const liquido = r2(devengado - irpfDinerarios - irpfEspecie - anticipos - cuota);

    const conceptos = {
      salario_base: salario,
      complemento_absorbible: r2(n0(e.complemento_absorbible)),
      incentivos: r2(n0(e.incentivos)),
      plus_convenio: r2(n0(e.plus_convenio)),
      mejora_productividad: r2(n0(e.mejora_productividad)),
      carencia_incentivos: r2(n0(e.carencia_incentivos)),
      horas_extra: r2(n0(e.horas_extra)),
      otros_devengos: r2(n0(e.otros_devengos)),
      dietas_exentas: dietasImporte,
      dietas_gravadas: 0,
      cuota_especie: cuota,
      ingreso_cuenta: ingreso,
    };
    const deducciones = {
      irpf_dinerarios: irpfDinerarios,
      irpf_especie: irpfEspecie,
      dto_especie: cuota,
      anticipos,
      total: r2(irpfDinerarios + irpfEspecie + cuota + anticipos),
    };

    return {
      regimen: 'autonomo_societario',
      dias,
      salario_base: salario,
      prorrata: 0,
      conceptos,
      base_cotizacion: 0,
      total_devengado: devengado,
      deducciones,
      liquido,
      empresa: { ss: 0, total: 0 },
      coste: devengado,
      dietas: { importe: dietasImporte, exentas: dietasImporte, gravadas: 0, limite: limiteDietas, dias: diasDietas },
      irpf: { tipo, total: irpfTotal },
    };
  }

  const salario = r2(n0(e.salario_base));
  const prorrata = r2((salario * n0(e.pagas_extra)) / 12);
  const salariales = r2(
    salario + prorrata + n0(e.plus_convenio) + n0(e.mejora_productividad) +
    n0(e.carencia_incentivos) + n0(e.complemento_absorbible) + n0(e.incentivos) +
    n0(e.horas_extra) + n0(e.otros_devengos)
  );
  const baseCalculada = r2(salariales + dietasGravadas);
  const baseCotizacion = r2(
    Math.min(Math.max(baseCalculada, PARAMETROS_NOMINA.base_minima), PARAMETROS_NOMINA.base_maxima)
  );
  const ssTrabajador = r2(baseCotizacion * TIPO_TRABAJADOR);
  const irpf = r2(baseCotizacion * tipo);
  const prorrataEnDevengo = e.prorrata_en_devengado !== false;
  const devengado = r2(salariales - (prorrataEnDevengo ? 0 : prorrata) + dietasImporte);
  const liquido = r2(devengado - ssTrabajador - irpf - anticipos);
  const ssEmpresa = r2(baseCotizacion * TIPO_EMPRESA);

  const conceptos = {
    salario_base: salario,
    prorrata,
    plus_convenio: r2(n0(e.plus_convenio)),
    mejora_productividad: r2(n0(e.mejora_productividad)),
    carencia_incentivos: r2(n0(e.carencia_incentivos)),
    complemento_absorbible: r2(n0(e.complemento_absorbible)),
    incentivos: r2(n0(e.incentivos)),
    horas_extra: r2(n0(e.horas_extra)),
    otros_devengos: r2(n0(e.otros_devengos)),
    dietas_exentas: dietasExentas,
    dietas_gravadas: dietasGravadas,
    cuota_especie: 0,
    ingreso_cuenta: 0,
  };

  return {
    regimen: 'general',
    dias,
    salario_base: salario,
    precio_dia: r2(salario / dias),
    prorrata,
    conceptos,
    base_cotizacion: baseCotizacion,
    base_calculada: baseCalculada,
    total_devengado: devengado,
    deducciones: {
      ss: ssTrabajador,
      irpf,
      anticipos,
      total: r2(ssTrabajador + irpf + anticipos),
    },
    liquido,
    empresa: { ss: ssEmpresa, total: ssEmpresa },
    coste: r2(devengado + ssEmpresa),
    dietas: { importe: dietasImporte, exentas: dietasExentas, gravadas: dietasGravadas, limite: limiteDietas, dias: diasDietas },
    irpf: { tipo, total: irpf },
  };
}

const CONCEPTOS_GENERAL = [
  ['salario_base', 'Salario base (días × precio)'],
  ['prorrata', 'Prorrata pagas extra'],
  ['plus_convenio', 'Plus convenio'],
  ['mejora_productividad', 'Mejora de productividad'],
  ['carencia_incentivos', 'Carencia de incentivos'],
  ['complemento_absorbible', 'Complemento absorbible'],
  ['incentivos', 'Incentivos'],
  ['horas_extra', 'Horas extra'],
  ['otros_devengos', 'Otros devengos'],
  ['dietas_exentas', 'Dietas exentas (no cotizan ni tributan)'],
  ['dietas_gravadas', 'Dietas que cotizan (exceso del límite)'],
];

const CONCEPTOS_RETA = [
  ['salario_base', 'Dinerarios (salario base)'],
  ['complemento_absorbible', 'Complemento absorbible'],
  ['incentivos', 'Incentivos'],
  ['plus_convenio', 'Plus convenio'],
  ['mejora_productividad', 'Mejora de productividad'],
  ['carencia_incentivos', 'Carencia de incentivos'],
  ['horas_extra', 'Horas extra'],
  ['otros_devengos', 'Otros devengos'],
  ['dietas_exentas', 'Dietas'],
  ['cuota_especie', 'Cuota RETA en especie (devengo)'],
  ['ingreso_cuenta', 'Ingreso a cuenta de la especie'],
];

const fila = (key: string, concepto: string, tipo: string, actual: any, simulado: any) => ({
  key,
  concepto,
  tipo,
  actual: r2(actual),
  simulado: r2(simulado),
  diferencia: r2(r2(simulado) - r2(actual)),
});

/**
 * Tabla comparativa "Actual (histórico) / Simulado / Diferencia".
 * "Actual" es el motor aplicado a la precarga: sin cambios, las dos columnas
 * coinciden y la diferencia es 0.
 */
export function comparar(actual: any, simulado: any, regimen: any) {
  const reta = esReta(regimen);
  const lista = reta ? CONCEPTOS_RETA : CONCEPTOS_GENERAL;
  const filas: any[] = lista
    .filter(([key]) => reta || key !== 'cuota_especie')
    .map(([key, label]) => fila(key, label, 'concepto', actual.conceptos[key], simulado.conceptos[key]));

  if (!reta) {
    filas.push(fila('base_cotizacion', 'Base de cotización (sujeta a SS)', 'base', actual.base_cotizacion, simulado.base_cotizacion));
  }

  filas.push(fila('total_devengado', 'TOTAL DEVENGADO', 'total', actual.total_devengado, simulado.total_devengado));

  if (reta) {
    filas.push(fila('irpf_dinerarios', 'Retención IRPF sobre dinerarios', 'deduccion', actual.deducciones.irpf_dinerarios, simulado.deducciones.irpf_dinerarios));
    filas.push(fila('irpf_especie', 'Retención IRPF sobre la especie', 'deduccion', actual.deducciones.irpf_especie, simulado.deducciones.irpf_especie));
    filas.push(fila('dto_especie', 'Descuento de la cuota en especie', 'deduccion', actual.deducciones.dto_especie, simulado.deducciones.dto_especie));
  } else {
    filas.push(fila('ss', 'Seguridad Social del trabajador (6,50 %)', 'deduccion', actual.deducciones.ss, simulado.deducciones.ss));
    filas.push(fila('irpf', `Retención IRPF (${(Number(actual.irpf.tipo) * 100).toFixed(2)} %)`, 'deduccion', actual.deducciones.irpf, simulado.deducciones.irpf));
  }
  filas.push(fila('anticipos', 'Anticipos y otras deducciones', 'deduccion', actual.deducciones.anticipos, simulado.deducciones.anticipos));
  filas.push(fila('total_deducciones', 'TOTAL A DEDUCIR', 'total', actual.deducciones.total, simulado.deducciones.total));
  filas.push(fila('liquido', 'LÍQUIDO A PERCIBIR', 'liquido', actual.liquido, simulado.liquido));

  if (!reta) {
    filas.push(fila('ss_empresa', 'Seguridad Social a cargo de la empresa (37,35 %)', 'empresa', actual.empresa.ss, simulado.empresa.ss));
  }
  filas.push(fila('coste', 'COSTE TOTAL PARA LA EMPRESA', 'coste', actual.coste, simulado.coste));

  return {
    filas,
    totales: {
      liquido: { actual: actual.liquido, simulado: simulado.liquido, diferencia: r2(simulado.liquido - actual.liquido) },
      coste: { actual: actual.coste, simulado: simulado.coste, diferencia: r2(simulado.coste - actual.coste) },
      devengado: { actual: actual.total_devengado, simulado: simulado.total_devengado, diferencia: r2(simulado.total_devengado - actual.total_devengado) },
    },
  };
}

/** Avisos de validación: convenio, bases, dietas y naturaleza del IRPF. */
export function avisosSimulacion({ regimen, simulado, entradas, tipoIrpf, categoria, origenIrpf }: any) {
  const avisos: any[] = [];
  const reta = esReta(regimen);

  if (!reta) {
    const precio = Number(simulado.precio_dia) || 0;
    const convenio = PARAMETROS_NOMINA.convenio[categoria];
    if (convenio && precio > 0) {
      const minimoDia = r2(convenio.mensual / PARAMETROS_NOMINA.dias_mes);
      if (precio < minimoDia) {
        avisos.push({
          nivel: 'aviso',
          texto: `Precio/día (${precio.toFixed(2)} €) por debajo del mínimo orientativo de convenio para ${convenio.label} (${minimoDia.toFixed(2)} €/día).`,
        });
      }
    }
    if (Number(simulado.base_calculada) > PARAMETROS_NOMINA.base_maxima) {
      avisos.push({ nivel: 'aviso', texto: `La base calculada supera la base máxima de cotización (${PARAMETROS_NOMINA.base_maxima.toFixed(2)} €): las cuotas quedan topadas.` });
    }
    if (Number(simulado.base_calculada) > 0 && Number(simulado.base_calculada) < PARAMETROS_NOMINA.base_minima) {
      avisos.push({ nivel: 'aviso', texto: `La base calculada está por debajo de la base mínima (${PARAMETROS_NOMINA.base_minima.toFixed(2)} €): se cotiza por la mínima.` });
    }
  }

  const dietas = simulado.dietas || {};
  if (Number(dietas.importe) > 0 && Number(dietas.gravadas) > 0) {
    avisos.push({
      nivel: 'aviso',
      texto: `Dietas por encima del límite exento (${Number(dietas.limite).toFixed(2)} €): ${Number(dietas.gravadas).toFixed(2)} € cotizan y tributan como salario.`,
    });
  }

  avisos.push({
    nivel: 'info',
    texto: `IRPF aproximado: ${(Number(tipoIrpf) * 100).toFixed(2)} % constante tomado de ${origenIrpf || 'la última nómina'}. La retención real la recalcula la gestoría.`,
  });

  if (reta) {
    avisos.push({ nivel: 'info', texto: 'Régimen RETA societario: no hay cotización a la Seguridad Social General en nómina.' });
  }

  return avisos;
}