import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { mapRegistroGasto, compararPar } from '../../shared/duplicadosEconomico.ts';

// Cruza un gasto CANDIDATO (aún sin guardar) con TODOS los registros existentes,
// también los de otros técnicos (que el técnico no puede leer directamente por permisos).
// Devuelve solo datos mínimos de cada coincidencia (sin nombres de otros usuarios).
//
// Parámetros: { candidato: { fecha_documento, hora_documento, importe, nif_comercio, nombre_comercio,
//   localidad, numero_factura, codigo_validacion_fiscal, tarjeta_ultimos_digitos, archivos:[{dhash}] }, excluir_id? }

const VENTANA_DIAS = 45;
const MAX = 1500;

function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { candidato = {}, excluir_id } = await req.json().catch(() => ({}));
    const cand = mapRegistroGasto({ id: '__candidato__', ...candidato, operario_email: user.email });
    const RG = base44.asServiceRole.entities.RegistroGasto;

    // 1) Registros cercanos en fecha
    let registros: any[] = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(candidato.fecha_documento || ''))) {
      registros = await RG.filter({
        fecha_documento: { $gte: sumarDias(candidato.fecha_documento, -VENTANA_DIAS), $lte: sumarDias(candidato.fecha_documento, VENTANA_DIAS) },
      }, '-fecha_documento', MAX);
    } else {
      registros = await RG.list('-created_date', 500);
    }

    // 2) Mismo nº de factura o código fiscal en cualquier fecha
    const extra: any[] = [];
    if (candidato.numero_factura) extra.push(...(await RG.filter({ numero_factura: candidato.numero_factura }, '-created_date', 50)));
    if (candidato.codigo_validacion_fiscal) extra.push(...(await RG.filter({ codigo_validacion_fiscal: candidato.codigo_validacion_fiscal }, '-created_date', 50)));
    const porId = new Map<string, any>();
    [...registros, ...extra].forEach((r) => { if (r?.id && r.id !== excluir_id) porId.set(r.id, r); });

    const coincidencias = [];
    for (const r of porId.values()) {
      if (r.estado === 'rechazada') continue; // un gasto anulado no cuenta como duplicado
      const par = compararPar(cand, mapRegistroGasto(r));
      if (!par.es_duplicado) continue;
      const propio = r.operario_email === user.email;
      coincidencias.push({
        id: r.id,
        numero_nota: r.numero_nota || '',
        score: Math.round(par.score * 100) / 100,
        severidad: par.severidad,
        motivos: par.motivos,
        fecha_documento: r.fecha_documento || '',
        importe: r.importe ?? null,
        nombre_comercio: r.nombre_comercio || '',
        numero_factura: r.numero_factura || '',
        estado: r.estado || '',
        propio,
        registrado_por: propio ? 'tuyo' : 'de otro técnico',
      });
    }
    coincidencias.sort((a, b) => b.score - a.score);
    return Response.json({ success: true, coincidencias: coincidencias.slice(0, 5) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
