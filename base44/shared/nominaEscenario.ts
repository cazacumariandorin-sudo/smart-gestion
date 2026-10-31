/**
 * Motor del SIMULADOR DE ESCENARIO de nóminas de SMART-GESTION.
 *
 * Estima la nómina del próximo mes partiendo de los datos REALES de cada
 * trabajador y permitiendo cambiar el salario base o añadir conceptos
 * variables (incentivos, pagas extra, dietas), para saber qué supone para la
 * empresa: base de cotización, Seguridad Social a cargo de la empresa y coste
 * total. Cálculo 100% determinista y sin escrituras en la base de datos.
 */

import { AVISO_LEGAL, BASE_MAXIMA_MENSUAL, MESES, calcularBaseline } from './nominaSimulacion.ts';

/** Importe diario de dieta exenta en España. */
export const LIMITES_DIETA = { con_pernocta: 53.34, sin_pernocta: 26.67 };

/**
 * Baremo legal orientativo del régimen general (2026). Solo se usa cuando el
 * trabajador no tiene nóminas reales de las que derivar sus tipos efectivos.
 * Obrera: CC 4,70 + desempleo 1,55 + FP 0,10 + MEI 0,18.
 * Empresa: CC 23,60 + desempleo 5,50 + FOGASA 0,20 + FP 0,60 + AT/EP 1,50 + MEI 0,72.
 */
export const TASAS_LEGALES = { obrera: 0.0653, empresa: 0.3212 };

export const SUPUESTOS = [
  'La base de cotización se compone de salario base + prorrata de pagas extra + incentivos + pagas extra o bonus + exceso de dietas, con el tope máximo mensual de cotización.',
  'Las dietas están exentas hasta 53,34 €/día con pernocta y 26,67 €/día sin pernocta. El exceso cotiza y tributa como salario.',
  'Las dietas exentas suman coste para la empresa pero no elevan la base de cotización ni la retención.',
  'Los tipos de Seguridad Social e IRPF se derivan de la última nómina real de cada trabajador; si no tiene nómina, se aplica el baremo legal de 2026.',
  'La proyección anual multiplica el coste del mes por 12 y no incluye atrasos, variables futuros ni cambios de convenio.',
];

const r2 = (n: any) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: any) => Math.max(0, Number(v) || 0);

/**
 * Tipos efectivos de un trabajador a partir de sus nóminas reales.
 * Si no hay histórico, devuelve el baremo legal y lo marca como tal.
 */
export function tasasDeTrabajador(historico: any, esReta: boolean) {
  const lista = (Array.isArray(historico) ? historico : []).filter(
    (n) => Number(n.total_devengado) > 0
  );

  if (!lista.length) {
    return {
      real: {
        origen: 'sin nóminas previas',
        bruto: 0,
        cuotas: 0,
        irpf: 0,
        ssEmpresa: 0,
        anticipos: 0,
        neto: 0,
        coste: 0,
        tipoIrpf: 0,
        baseCotizable: 0,
        desgloseFiable: false,
      },
      tasaObrera: esReta ? 0 : TASAS_LEGALES.obrera,
      tasaEmpresa: esReta ? 0 : TASAS_LEGALES.empresa,
      tipoIrpf: 0,
      origen: esReta ? 'sin_nomina' : 'legal',
    };
  }

  const real = calcularBaseline(lista, esReta);
  const base = real.baseCotizable;

  let tasaObrera = esReta || base <= 0 ? 0 : real.cuotas / base;
  let tasaEmpresa = esReta || base <= 0 ? 0 : real.ssEmpresa / base;
  let origen = 'nomina';

  if (!esReta && tasaObrera <= 0) {
    tasaObrera = TASAS_LEGALES.obrera;
    origen = 'legal';
  }
  if (!esReta && tasaEmpresa <= 0) {
    tasaEmpresa = TASAS_LEGALES.empresa;
    origen = 'legal';
  }

  return { real, tasaObrera, tasaEmpresa, tipoIrpf: real.tipoIrpf, origen };
}

/** Salario base mensual sugerido a partir de una nómina real. */
export function salarioBaseSugerido(nomina: any) {
  const bruto = num(nomina?.total_devengado);
  const prorrata = num(nomina?.prorrata_pagas_extra);
  const salario = prorrata > 0 && prorrata < bruto ? r2(bruto - prorrata) : bruto;
  return { salario_base: salario, prorrata_extras: prorrata };
}

/** Cálculo completo de la nómina estimada de un trabajador. */
export function calcularLineaEscenario({ datos, historico, baseMaxima, mes, anio }: any) {
  const tope = Number(baseMaxima) || BASE_MAXIMA_MENSUAL;
  const esReta = datos.regimen === 'autonomo_societario';
  const { real, tasaObrera, tasaEmpresa, tipoIrpf, origen } = tasasDeTrabajador(
    historico,
    esReta
  );

  const salario = num(datos.salario_base);
  const prorrata = num(datos.prorrata_extras);
  const incentivo = num(datos.incentivo);
  const bonus = num(datos.bonus);
  const otros = num(datos.otros_devengos);

  const dias = num(datos.dietas_dias);
  const dietas = num(datos.dietas_importe);
  const limiteDia = datos.dietas_con_pernocta
    ? LIMITES_DIETA.con_pernocta
    : LIMITES_DIETA.sin_pernocta;
  const dietasExentas = r2(Math.min(dietas, r2(dias * limiteDia)));
  const dietasGravadas = r2(Math.max(0, dietas - dietasExentas));

  const cotizable = r2(salario + prorrata + incentivo + bonus + otros + dietasGravadas);
  // Un autónomo societario no cotiza por el régimen general: su base no computa.
  const baseCotizacion = esReta ? 0 : r2(Math.min(cotizable, tope));
  const bruto = r2(cotizable + dietasExentas);

  const anticipos =
    datos.anticipos === undefined || datos.anticipos === null
      ? real.anticipos
      : num(datos.anticipos);

  const cuotas = esReta ? 0 : r2(baseCotizacion * tasaObrera);
  const irpf = r2(cotizable * tipoIrpf);
  const neto = r2(bruto - cuotas - irpf - anticipos);
  const ssEmpresa = esReta ? 0 : r2(baseCotizacion * tasaEmpresa);

  const retaAsumida = esReta && datos.empresa_asume_reta === true ? num(datos.cuota_reta) : 0;
  const ingresoCuenta =
    retaAsumida > 0 && tipoIrpf < 1 ? r2((retaAsumida * tipoIrpf) / (1 - tipoIrpf)) : 0;
  const coste = r2(bruto + ssEmpresa + retaAsumida + ingresoCuenta);

  const realBase = esReta ? 0 : r2(Math.min(real.bruto, tope));
  const nombre = datos.operario_name || real.origen || 'Trabajador';
  const avisos = [];

  if (origen === 'legal' && !esReta) {
    avisos.push(
      `${nombre}: sin nómina previa, se aplica el baremo legal 2026 (obrera ${(
        tasaObrera * 100
      ).toFixed(2)} % y empresa ${(tasaEmpresa * 100).toFixed(2)} %).`
    );
  }
  if (!esReta && cotizable > tope) {
    avisos.push(
      `${nombre}: la base (${cotizable.toFixed(2)} €) supera el tope de ${tope.toFixed(2)} € y las cotizaciones quedan topadas.`
    );
  }
  if (dietasGravadas > 0) {
    avisos.push(
      `${nombre}: ${dietasGravadas.toFixed(2)} € de dietas superan el límite exento y cotizan como salario.`
    );
  }

  return {
    operario_id: datos.operario_id || '',
    operario_name: nombre,
    regimen: esReta ? 'autonomo_societario' : 'general',
    devengos: {
      salario_base: r2(salario),
      prorrata_extras: r2(prorrata),
      incentivo: r2(incentivo),
      bonus: r2(bonus),
      otros_devengos: r2(otros),
      dietas_total: r2(dietas),
      dietas_exentas: dietasExentas,
      dietas_gravadas: dietasGravadas,
    },
    real: {
      periodo: real.origen,
      bruto: real.bruto,
      neto: real.neto,
      coste: real.coste,
      base_cotizacion: realBase,
      cuotas: real.cuotas,
      irpf: real.irpf,
      anticipos: real.anticipos,
    },
    calculo: {
      bruto,
      base_cotizacion: baseCotizacion,
      base_irpf: cotizable,
      tope_aplicado: !esReta && cotizable > tope,
      cuotas_obreras: cuotas,
      irpf,
      anticipos,
      neto,
      ss_empresa: ssEmpresa,
      reta_asumida: retaAsumida,
      ingreso_cuenta: ingresoCuenta,
      coste,
      tasa_obrera: r2(tasaObrera * 10000) / 10000,
      tasa_empresa: r2(tasaEmpresa * 10000) / 10000,
      tipo_irpf: r2(tipoIrpf * 10000) / 10000,
      origen_tasas: origen,
    },
    variacion: {
      bruto: r2(bruto - real.bruto),
      neto: r2(neto - real.neto),
      coste: r2(coste - real.coste),
      base_cotizacion: r2(baseCotizacion - realBase),
    },
    coste_anual: r2(coste * 12),
    coste_anual_real: r2(real.coste * 12),
    avisos,
  };
}

/** Agrega las líneas y devuelve el impacto global para la empresa. */
export function resumirEscenario(lineas: any[], mes: number, anio: number) {
  const sum = (fn: any) => r2(lineas.reduce((acc, l) => acc + (Number(fn(l)) || 0), 0));

  const realBruto = sum((l) => l.real.bruto);
  const realNeto = sum((l) => l.real.neto);
  const realCoste = sum((l) => l.real.coste);
  const realBase = sum((l) => l.real.base_cotizacion);

  const coste = sum((l) => l.calculo.coste);
  const neto = sum((l) => l.calculo.neto);
  const bruto = sum((l) => l.calculo.bruto);
  const baseCotizacion = sum((l) => l.calculo.base_cotizacion);
  const ssEmpresa = sum((l) => l.calculo.ss_empresa);

  const totales = {
    trabajadores: lineas.length,
    bruto,
    cuotas_obreras: sum((l) => l.calculo.cuotas_obreras),
    irpf: sum((l) => l.calculo.irpf),
    neto,
    ss_empresa: ssEmpresa,
    reta_asumida: sum((l) => l.calculo.reta_asumida),
    base_cotizacion: baseCotizacion,
    dietas_exentas: sum((l) => l.devengos.dietas_exentas),
    incentivos: sum((l) => l.devengos.incentivo),
    bonus: sum((l) => l.devengos.bonus),
    coste,
    real: { bruto: realBruto, neto: realNeto, coste: realCoste, base_cotizacion: realBase },
    variacion: {
      bruto: r2(bruto - realBruto),
      neto: r2(neto - realNeto),
      coste: r2(coste - realCoste),
      base_cotizacion: r2(baseCotizacion - realBase),
    },
    coste_anual: r2(coste * 12),
    coste_anual_real: r2(realCoste * 12),
    variacion_anual: r2((coste - realCoste) * 12),
    coste_por_trabajador: lineas.length ? r2(coste / lineas.length) : 0,
  };

  const avisos = [];
  lineas.forEach((l) => (l.avisos || []).forEach((a: string) => avisos.push(a)));

  return {
    periodo: `${MESES[Number(mes) - 1] || ''} ${anio}`.trim(),
    lineas,
    totales,
    supuestos: SUPUESTOS,
    avisos,
    aviso: AVISO_LEGAL,
  };
}