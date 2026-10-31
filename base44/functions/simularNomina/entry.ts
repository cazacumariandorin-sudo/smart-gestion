import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ROLES_SIMULADOR, seleccionarHistorico, simularNomina } from '../../shared/nominaSimulacion.ts';

const DENEGADO =
  'Error de seguridad (RLS): Acceso denegado. No tiene permisos suficientes para ver o modificar el simulador de nóminas.';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth
      .me()
      .catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ ok: false, error: 'Sesión no válida.' }, { status: 401 });

    // La autorización se valida aquí, con el usuario de la sesión.
    // Nunca con un rol enviado en el payload.
    if (!ROLES_SIMULADOR.includes(user.role)) {
      return Response.json({ ok: false, error: DENEGADO }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const operarioId = String(body.operario_id || '').trim();
    const operarioName = String(body.operario_name || '').trim();
    const mes = Number(body.mes);
    const anio = Number(body.anio);
    const modo = ['importe', 'porcentaje', 'mantener_neto'].includes(body.modo) ? body.modo : 'importe';
    const valor = Number(body.valor) || 0;
    const regimen = body.regimen === 'autonomo_societario' ? 'autonomo_societario' : 'general';
    const cuotaReta = Number(body.cuota_reta) || 0;
    const empresaAsumeReta = body.empresa_asume_reta === true;

    if (!operarioId) {
      return Response.json({ ok: false, error: 'Selecciona un trabajador.' }, { status: 400 });
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return Response.json({ ok: false, error: 'El mes debe estar entre 1 y 12.' }, { status: 400 });
    }
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      return Response.json({ ok: false, error: 'El año no es válido.' }, { status: 400 });
    }
    if (modo !== 'mantener_neto' && valor <= 0) {
      return Response.json(
        { ok: false, error: 'Indica un importe o porcentaje mayor que cero.' },
        { status: 400 }
      );
    }
    if (regimen === 'autonomo_societario' && empresaAsumeReta && cuotaReta <= 0) {
      return Response.json(
        { ok: false, error: 'Indica la cuota RETA que asume la empresa.' },
        { status: 400 }
      );
    }

    const { items } = await base44.entities.Nomina.filter(
      { operario_id: operarioId, tipo_documento: 'nomina_individual' },
      { sort: '-anio', limit: 24 }
    );

    let historico = seleccionarHistorico(items, mes, anio);

    // Compatibilidad con nóminas antiguas sin operario_id vinculado.
    if (!historico.length && operarioName) {
      const alt = await base44.entities.Nomina.filter(
        { operario_name: operarioName, tipo_documento: 'nomina_individual' },
        { sort: '-anio', limit: 24 }
      );
      historico = seleccionarHistorico(alt.items, mes, anio);
    }

    if (!historico.length) {
      return Response.json(
        {
          ok: false,
          error:
            'No hay nóminas históricas de este trabajador para tomar como referencia. Carga al menos una nómina antes de simular.',
        },
        { status: 400 }
      );
    }

    const resultado = simularNomina({
      historico,
      mes,
      anio,
      modo,
      valor,
      regimen,
      cuotaReta,
      empresaAsumeReta,
      operarioNombre: operarioName || historico[0].operario_name || 'Trabajador',
    });

    return Response.json(resultado);
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}