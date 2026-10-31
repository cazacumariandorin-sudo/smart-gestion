import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  ROLES_SIMULADOR,
  calcularBaseline,
  seleccionarHistorico,
} from '../../shared/nominaSimulacion.ts';
import {
  calcularLineaEscenario,
  resumirEscenario,
  salarioBaseSugerido,
} from '../../shared/nominaEscenario.ts';

const DENEGADO =
  'Error de seguridad (RLS): Acceso denegado. No tiene permisos suficientes para usar el simulador de nóminas.';

const indice = (n: any) => (Number(n.anio) || 0) * 100 + (Number(n.mes) || 0);
const ordenar = (lista: any[]) => [...lista].sort((a, b) => indice(b) - indice(a));

function agrupar(items: any[]) {
  const mapa = new Map();
  for (const n of items) {
    const key = n.operario_id || n.operario_name;
    if (!key) continue;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key).push(n);
  }
  return mapa;
}

export default async function (req: any) {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth
      .me()
      .catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ ok: false, error: 'Sesión no válida.' }, { status: 401 });

    // El rol se valida con la sesión, nunca con el payload.
    if (!ROLES_SIMULADOR.includes(user.role)) {
      return Response.json({ ok: false, error: DENEGADO }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const accion = body.accion === 'simular' ? 'simular' : 'plantilla';

    const { items } = await base44.entities.Nomina.filter(
      { tipo_documento: 'nomina_individual' },
      { sort: '-anio', limit: 400 }
    );
    const porTrabajador = agrupar(items || []);

    if (accion === 'plantilla') {
      const trabajadores = [];

      for (const [, nominas] of porTrabajador) {
        const historico = ordenar(nominas);
        const ultima = historico.find((n: any) => Number(n.total_devengado) > 0);
        if (!ultima) continue;

        const base = calcularBaseline(historico);
        const sugerido = salarioBaseSugerido(ultima);

        trabajadores.push({
          operario_id: ultima.operario_id || '',
          operario_name: ultima.operario_name || 'Sin nombre',
          periodo: base.origen,
          bruto: base.bruto,
          neto: base.neto,
          coste: base.coste,
          anticipos: base.anticipos,
          salario_base: sugerido.salario_base,
          prorrata_extras: sugerido.prorrata_extras,
        });
      }

      trabajadores.sort((a, b) => String(a.operario_name).localeCompare(String(b.operario_name)));

      return Response.json({ ok: true, trabajadores });
    }

    const mes = Number(body.mes);
    const anio = Number(body.anio);

    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return Response.json({ ok: false, error: 'El mes debe estar entre 1 y 12.' }, { status: 400 });
    }
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      return Response.json({ ok: false, error: 'El año no es válido.' }, { status: 400 });
    }

    const entradas = Array.isArray(body.lineas) ? body.lineas.slice(0, 200) : [];
    if (!entradas.length) {
      return Response.json(
        { ok: false, error: 'Incluye al menos un trabajador en el escenario.' },
        { status: 400 }
      );
    }

    const sinBase = entradas.filter((e: any) => !(Number(e.salario_base) > 0));
    if (sinBase.length === entradas.length) {
      return Response.json(
        { ok: false, error: 'Indica un salario base mayor que cero en al menos un trabajador.' },
        { status: 400 }
      );
    }

    const lineas = entradas.map((entrada: any) => {
      const clave = entrada.operario_id || entrada.operario_name;
      const nominas = porTrabajador.get(clave) || [];
      const historico = seleccionarHistorico(ordenar(nominas), mes, anio);
      return calcularLineaEscenario({
        datos: entrada,
        historico,
        mes,
        anio,
      });
    });

    return Response.json({ ok: true, ...resumirEscenario(lineas, mes, anio) });
  } catch (error: any) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}