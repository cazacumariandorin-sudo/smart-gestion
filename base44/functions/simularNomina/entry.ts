import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  ROLES_SIMULADOR,
  AVISO_SIMULACION,
  PARAMETROS_NOMINA,
  TIPO_TRABAJADOR,
  TIPO_EMPRESA,
  nombrePeriodo,
  nominasValidas,
  elegirReferencia,
  ultimasTres,
  derivarSemilla,
  mediaHistorico,
  calcularNomina,
  comparar,
  avisosSimulacion,
  esReta,
} from '../../shared/nominaCalculo.ts';

const DENEGADO =
  'Error de seguridad (RLS): acceso denegado. No tiene permisos para usar el simulador de nóminas.';

const CAMPOS_NUMERICOS = [
  'dias', 'precio_dia', 'salario_base', 'pagas_extra', 'plus_convenio', 'mejora_productividad',
  'carencia_incentivos', 'complemento_absorbible', 'incentivos', 'horas_extra', 'otros_devengos',
  'dietas_importe', 'dietas_dias', 'anticipos', 'cuota_reta', 'ingreso_cuenta_especie',
];

/** El precio/día es la entrada natural en el régimen general: el salario base se deriva. */
function normalizarEntradas(entradas: any, semilla: any) {
  const e: any = {};
  for (const campo of CAMPOS_NUMERICOS) {
    // Un campo no enviado conserva el valor de la precarga (= sin cambios).
    const bruto = entradas?.[campo];
    const base = bruto === undefined || bruto === null || bruto === '' ? semilla?.[campo] : bruto;
    e[campo] = Math.max(0, Number(base ?? 0) || 0);
  }
  const pernocta = entradas?.dietas_con_pernocta;
  e.dietas_con_pernocta =
    pernocta === undefined || pernocta === null ? semilla?.dietas_con_pernocta !== false : pernocta !== false;
  const prorrataDevengo = entradas?.prorrata_en_devengado;
  e.prorrata_en_devengado =
    prorrataDevengo === undefined || prorrataDevengo === null
      ? semilla?.prorrata_en_devengado !== false
      : prorrataDevengo !== false;
  if (e.dias <= 0) e.dias = PARAMETROS_NOMINA.dias_mes;
  if (entradas?.usar_precio === true && e.precio_dia > 0) {
    e.salario_base = Math.round(e.dias * e.precio_dia * 100) / 100;
  }
  return e;
}

export default async function (req: any) {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
  if (!user) return Response.json({ ok: false, error: 'Sesión no válida.' }, { status: 401 });
  if (!ROLES_SIMULADOR.includes(user.role)) {
    return Response.json({ ok: false, error: DENEGADO }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const accion = body.accion === 'calcular' ? 'calcular' : 'plantilla';
  const operarioId = String(body.operario_id || '').trim();
  const operarioName = String(body.operario_name || '').trim();
  const mes = Number(body.mes);
  const anio = Number(body.anio);
  const regimen = body.regimen === 'autonomo_societario' ? 'autonomo_societario' : 'general';

  if (!operarioId) return Response.json({ ok: false, error: 'Selecciona un trabajador.' }, { status: 400 });
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return Response.json({ ok: false, error: 'El mes debe estar entre 1 y 12.' }, { status: 400 });
  }
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return Response.json({ ok: false, error: 'El año no es válido.' }, { status: 400 });
  }

  const { items } = await base44.entities.Nomina.filter(
    { operario_id: operarioId, tipo_documento: 'nomina_individual' },
    { sort: '-anio', limit: 36 }
  );
  let nominas = items || [];
  if (!nominas.length && operarioName) {
    const alt = await base44.entities.Nomina.filter(
      { operario_name: operarioName, tipo_documento: 'nomina_individual' },
      { sort: '-anio', limit: 36 }
    );
    nominas = alt.items || [];
  }
  if (!nominasValidas(nominas).length) {
    return Response.json(
      { ok: false, error: 'No hay nóminas de este trabajador para tomar como referencia. Carga al menos una nómina.' },
      { status: 400 }
    );
  }

  const referencia = elegirReferencia(nominas, mes, anio);
  const tresMeses = ultimasTres(nominas, mes, anio, referencia);
  const operario = await base44.entities.Operario.get(operarioId).catch(() => null);
  const nombre = operarioName || operario?.name || referencia?.operario_name || 'Trabajador';

  const semilla = derivarSemilla({ referencia, historico: tresMeses, regimen, dias: PARAMETROS_NOMINA.dias_mes });
  const periodoRef = nombrePeriodo(referencia?.mes, referencia?.anio);
  const origenIrpf = `la nómina de ${periodoRef || 'referencia'}`;
  const prorrata = Math.round((semilla.entradas.salario_base * semilla.entradas.pagas_extra) / 12 * 100) / 100;

  const contexto = {
    ok: true,
    trabajador: {
      id: operarioId,
      nombre,
      categoria: operario?.categoria || '',
      categoria_label: PARAMETROS_NOMINA.convenio[operario?.categoria]?.label || '',
    },
    periodo: { mes, anio, label: nombrePeriodo(mes, anio) },
    regimen,
    referencia: {
      periodo: periodoRef,
      metodo: `Importes tomados de la nómina de ${periodoRef}`,
      meses: tresMeses.map((n: any) => nombrePeriodo(n.mes, n.anio)),
      media: mediaHistorico(tresMeses),
    },
    tipo_irpf: semilla.tipoIrpf,
    origen_irpf: origenIrpf,
    cuota_reta: semilla.cuotaReta,
    prorrata,
    entradas: semilla.entradas,
    registrado: {
      base_cotizacion: Number(referencia?.cuotas_obreras) > 0
        ? Math.round((Number(referencia.cuotas_obreras) / TIPO_TRABAJADOR) * 100) / 100
        : semilla.base,
      devengado: Number(referencia?.total_devengado) || 0,
      liquido: Number(referencia?.liquido_percibir) || 0,
      coste: Number(referencia?.coste_empresa) || 0,
    },
    parametros: {
      ...PARAMETROS_NOMINA,
      tipo_trabajador: Math.round(TIPO_TRABAJADOR * 10000) / 100,
      tipo_empresa: Math.round(TIPO_EMPRESA * 10000) / 100,
    },
    aviso: AVISO_SIMULACION,
  };

  if (accion === 'plantilla') return Response.json(contexto);

  if (!body.entradas || typeof body.entradas !== 'object') {
    return Response.json({ ok: false, error: 'Faltan los conceptos a simular.' }, { status: 400 });
  }
  for (const campo of CAMPOS_NUMERICOS) {
    const valor = Number(body.entradas[campo] ?? 0);
    if (!Number.isFinite(valor) || valor < 0) {
      return Response.json({ ok: false, error: `El concepto "${campo}" no es un importe válido.` }, { status: 400 });
    }
  }


  const entradas = normalizarEntradas(body.entradas, semilla.entradas);

  // Modo absorbible: el aumento de salario base se compensa con el complemento.
  if (body.entradas?.absorcion === true) {
    const subida = Math.max(0, Math.round((entradas.salario_base - semilla.entradas.salario_base) * 100) / 100);
    entradas.complemento_absorbible = Math.max(
      0,
      Math.round((semilla.entradas.complemento_absorbible - subida) * 100) / 100
    );
  }

  const actual = calcularNomina({ regimen, entradas: semilla.entradas, tipoIrpf: semilla.tipoIrpf });
  const simulado = calcularNomina({ regimen, entradas, tipoIrpf: semilla.tipoIrpf });
  const { filas, totales } = comparar(actual, simulado, regimen);

  // Modo "complemento absorbible": el aumento de salario base se compensa con el complemento.
  const incremento = Math.round((simulado.salario_base - actual.salario_base) * 100) / 100;
  let variantes = null;
  if (incremento > 0) {
    const absorcion = Math.max(0, Math.round((semilla.entradas.complemento_absorbible - incremento) * 100) / 100);
    const absorbido = calcularNomina({
      regimen,
      entradas: { ...entradas, complemento_absorbible: absorcion },
      tipoIrpf: semilla.tipoIrpf,
    });
    variantes = {
      incremento,
      disponible: semilla.entradas.complemento_absorbible,
      absorbe: { liquido: absorbido.liquido, coste: absorbido.coste, complemento: absorcion },
      suma: { liquido: simulado.liquido, coste: simulado.coste, complemento: Number(entradas.complemento_absorbible) },
    };
  }

  return Response.json({
    ...contexto,
    entradas,
    actual,
    simulado,
    filas,
    totales,
    variantes,
    avisos: avisosSimulacion({
      regimen,
      simulado,
      entradas,
      tipoIrpf: semilla.tipoIrpf,
      categoria: operario?.categoria || '',
      origenIrpf,
    }),
  });
}