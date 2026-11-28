import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * limpiarEmpresa — herramienta de limpieza del propietario.
 *
 * Borra TODO rastro de una empresa eliminada en la base de datos: sus datos de
 * privilegios (invitaciones, solicitudes de privilegio, espacio y plan), sus
 * solicitudes comerciales/de alta, su ficha y los datos que colgaban de ella
 * (plantilla, datos sensibles y registro horario legal). Además desvincula a
 * los usuarios que apuntaban a esa empresa.
 *
 * Modos:
 *  - { modo: 'analizar' }            → localiza rastros de empresas que ya no
 *                                      existen (las inactivas NO se tocan).
 *  - { modo: 'purgar', empresa_id }  → elimina todos los rastros de esa empresa.
 *
 * Solo el propietario de la app puede ejecutarlo.
 */

const ENTIDADES_PRIVILEGIOS = [
  'InvitacionUsuario',
  'SolicitudPrivilegio',
  'EspacioEmpresa',
  'PlanEmpresa',
  'SolicitudEmpresa',
  'SolicitudComercial',
];

const ENTIDADES_DATOS = [
  'Operario',
  'DatosSensiblesUsuario',
  'RegistroHorarioLegal',
];

const TODAS = [...ENTIDADES_PRIVILEGIOS, ...ENTIDADES_DATOS];

async function borrarPorEmpresa(base44: any, nombre: string, empresaId: string) {
  const total = await base44.asServiceRole.entities[nombre].count({ empresa_id: empresaId });
  if (!total) return 0;
  await base44.asServiceRole.entities[nombre].deleteMany({ empresa_id: empresaId });
  return total;
}

async function desvincularUsuarios(base44: any, empresaId: string) {
  const usuarios = await base44.asServiceRole.entities.User.list();
  const vinculados = (usuarios || []).filter((u: any) => u.empresa_id === empresaId);
  let desvinculados = 0;
  for (let i = 0; i < vinculados.length; i += 6) {
    const lote = vinculados.slice(i, i + 6);
    const res = await Promise.allSettled(
      lote.map((u: any) =>
        base44.asServiceRole.entities.User.update(u.id, {
          empresa_id: '',
          empresa_nombre: '',
          fecha_vinculacion_empresa: null,
        })
      )
    );
    desvinculados += res.filter((r: any) => r.status === 'fulfilled').length;
  }
  return desvinculados;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const esPropietario = user.es_propietario_global === true || user.role === 'propietario';
    if (!esPropietario) {
      return Response.json({ error: 'Solo el propietario puede limpiar empresas' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const modo = body?.modo || 'analizar';

    // ── Analizar: rastros de empresas que ya no existen ─────────────────────
    if (modo === 'analizar') {
      const empresas = await base44.asServiceRole.entities.Empresa.list('-created_date', 500);
      const vigentes = new Set((empresas || []).map((e: any) => e.id));
      const ids = new Set<string>();

      for (const nombre of TODAS) {
        const res = await base44.asServiceRole.entities[nombre].list({ distinct: 'empresa_id' }).catch(() => ({ items: [] }));
        (res?.items || []).forEach((v: any) => {
          if (v && !vigentes.has(v)) ids.add(String(v));
        });
      }

      const huerfanos = [];
      for (const empresaId of ids) {
        const detalle: Record<string, number> = {};
        let total = 0;
        for (const nombre of TODAS) {
          const n = await base44.asServiceRole.entities[nombre].count({ empresa_id: empresaId });
          if (n) { detalle[nombre] = n; total += n; }
        }
        huerfanos.push({ empresa_id: empresaId, total_registros: total, detalle });
      }

      const usuarios = await base44.asServiceRole.entities.User.list();
      const usuariosHuerfanos = (usuarios || []).filter(
        (u: any) => u.empresa_id && !vigentes.has(u.empresa_id)
      ).length;

      return Response.json({
        success: true,
        modo,
        empresas_vigentes: vigentes.size,
        huerfanos,
        usuarios_huerfanos: usuariosHuerfanos,
      });
    }

    // ── Purgar: elimina todos los rastros de una empresa ────────────────────
    if (modo === 'purgar') {
      const empresaId = String(body?.empresa_id || '').trim();
      if (!empresaId) return Response.json({ error: 'empresa_id es obligatorio' }, { status: 400 });

      const empresa = await base44.asServiceRole.entities.Empresa
        .get(empresaId)
        .catch((e: any) => (e.status === 404 ? null : Promise.reject(e)));

      const borrados: Record<string, number> = {};
      for (const nombre of TODAS) {
        const n = await borrarPorEmpresa(base44, nombre, empresaId);
        if (n) borrados[nombre] = n;
      }

      let empresaBorrada = false;
      if (empresa) {
        await base44.asServiceRole.entities.Empresa.delete(empresaId).catch(() => null);
        empresaBorrada = true;
      }

      const usuarios = await desvincularUsuarios(base44, empresaId);

      return Response.json({
        success: true,
        modo,
        empresa: empresa?.nombre || null,
        empresa_borrada: empresaBorrada,
        borrados,
        usuarios_desvinculados: usuarios,
      });
    }

    return Response.json({ error: 'Modo no válido' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}