import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Aplica la decisión de consolidación de un grupo de duplicados:
// - Anular: marca los registros descartados como duplicado_confirmado + estado rechazado/anulada.
// - Fusionar: además traslada los archivos del descartado al conservado.
// Registra cada acción en DuplicadoLog para auditoría.
//
// Acceso: gerencia, administracion, admin, propietario.
// Parámetros: {
//   conservar_id, entidad_conservar,
//   descartar: [{ id, entidad }],
//   fusionar: bool,
//   motivo?: string
// }

const ENT_MAP: Record<string, { entity: string; fieldArchivo?: string }> = {
  registro_gasto: { entity: 'RegistroGasto', fieldArchivo: 'archivos' },
  factura_autonomo: { entity: 'FacturaAutonomo', fieldArchivo: 'archivos' },
  nomina: { entity: 'Nomina' },
  presupuesto: { entity: 'Presupuesto' },
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const rolesOk = ['admin', 'propietario', 'gerencia', 'administracion'];
    if (!rolesOk.includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { conservar_id, entidad_conservar, descartar = [], fusionar = false, motivo = '' } = body;
    if (!conservar_id || !entidad_conservar || !descartar.length) {
      return Response.json({ error: 'conservar_id, entidad_conservar y descartar[] requeridos' }, { status: 400 });
    }

    const srv = base44.asServiceRole;
    const now = new Date().toISOString();
    const resultados: any[] = [];

    // Si fusionar, mover archivos de los descartados al conservado
    if (fusionar) {
      const cfgConservar = ENT_MAP[entidad_conservar];
      if (cfgConservar && cfgConservar.fieldArchivo) {
        const conservado = await srv.entities[cfgConservar.entity].get(conservar_id);
        const archivosConservado = Array.isArray(conservado[cfgConservar.fieldArchivo]) ? [...conservado[cfgConservar.fieldArchivo]] : [];
        let archivosAnyadidos = 0;

        for (const d of descartar) {
          const cfg = ENT_MAP[d.entidad];
          if (!cfg || !cfg.fieldArchivo || d.entidad !== entidad_conservar) continue; // solo fusionamos intra-entidad
          const desc = await srv.entities[cfg.entity].get(d.id);
          const archivosDesc = Array.isArray(desc[cfg.fieldArchivo]) ? desc[cfg.fieldArchivo] : [];
          for (const a of archivosDesc) {
            if (!archivosConservado.some((x: any) => x.url === a.url)) {
              archivosConservado.push({ ...a, fusionado_de: d.id, fecha_fusion: now });
              archivosAnyadidos++;
            }
          }
        }

        if (archivosAnyadidos > 0) {
          const updateCons: any = { [cfgConservar.fieldArchivo]: archivosConservado };
          if (entidad_conservar === 'registro_gasto') {
            updateCons.notas_admin = ((conservado.notas_admin || '') + `\n[Duplicados ${now}] Fusionados ${archivosAnyadidos} archivo(s) de registros descartados.`).trim();
          }
          await srv.entities[cfgConservar.entity].update(conservar_id, updateCons);
        }
      }
    }

    // Anular los descartados
    for (const d of descartar) {
      const cfg = ENT_MAP[d.entidad];
      if (!cfg) continue;
      let update: any;
      if (d.entidad === 'registro_gasto') {
        update = {
          duplicado_confirmado: true,
          estado: 'rechazada',
          notas_admin: `Anulado por duplicado. Conservado: ${conservar_id}. Motivo: ${motivo || 'consolidación'}. [${now}]`,
        };
      } else if (d.entidad === 'factura_autonomo') {
        update = {
          estado: 'anulada',
          notas: `Anulada por duplicado. Conservado: ${conservar_id}. Motivo: ${motivo || 'consolidación'}. [${now}]`,
        };
      } else if (d.entidad === 'presupuesto') {
        update = {
          es_duplicado_confirmado: true,
          estado: 'rechazado',
          notas: `Anulado por duplicado. Conservado: ${conservar_id}. [${now}]`,
        };
      } else if (d.entidad === 'nomina') {
        update = {
          estado_asignacion: 'revision_manual',
          texto_extraido: `Marcada para revisión por duplicado. Conservado: ${conservar_id}. [${now}]`,
        };
      }
      await srv.entities[cfg.entity].update(d.id, update);
      resultados.push({ id: d.id, entidad: d.entidad, accion: 'anulado' });

      // Auditoría DuplicadoLog
      try {
        await srv.entities.DuplicadoLog.create({
          entidad_tipo: d.entidad === 'registro_gasto' ? 'registro_gasto' : d.entidad,
          entidad_id_nuevo: d.id,
          entidad_id_existente: conservar_id,
          nombre_nuevo: `Consolidación manual`,
          nombre_existente: motivo || 'consolidación',
          similitud_score: 1,
          tipo_similitud: 'importe_fecha',
          accion_usuario: fusionar ? 'creado_como_nuevo' : 'uso_existente', // reuse enum
          es_nuevo_confirmado: false,
          user_email: user.email,
          user_role: user.role,
          fecha: now,
          contexto: `fusionar=${fusionar}; motivo=${motivo || ''}`,
        });
      } catch (e) { /* auditoría best-effort */ }
    }

    return Response.json({ success: true, conservar_id, descartados: resultados, fusionar, fecha: now });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}