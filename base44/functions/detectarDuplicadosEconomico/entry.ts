import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  mapRegistroGasto, mapFacturaAutonomo, mapNomina, mapPresupuesto,
  agruparDuplicados, GrupoDuplicado,
} from '../../shared/duplicadosEconomico.ts';

// Detecta duplicados en todo el módulo económico (RegistroGasto,
// FacturaAutonomo, Nomina, Presupuesto) aplicando comparación multicriterio.
// Devuelve grupos de duplicados con propuesta de registro a conservar.
//
// Acceso: gerencia, administracion, admin, propietario.
// Parámetros: { entidades?: string[], inicio?, fin?, umbral?: 'critico'|'alto'|'medio'|'bajo',
//   operario_id?, categoria?, solo_no_consolidados?: bool }

const ENTIDADES_VALIDAS = ['registro_gasto', 'factura_autonomo', 'nomina', 'presupuesto'];
const MAX_POR_ENTIDAD = 1500;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const rolesOk = ['admin', 'propietario', 'gerencia', 'administracion'];
    if (!rolesOk.includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo gerencia/administracion/admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      entidades = ENTIDADES_VALIDAS,
      inicio,
      fin,
      umbral = 'medio',
      operario_id,
      categoria,
      solo_no_consolidados = true,
    } = body;

    const ents = (entidades || ENTIDADES_VALIDAS).filter((e: string) => ENTIDADES_VALIDAS.includes(e));
    const docs: any[] = [];

    if (ents.includes('registro_gasto')) {
      const f: any = {};
      if (inicio && fin) f.fecha_documento = { $gte: inicio, $lte: fin };
      if (operario_id) f.operario_id = operario_id;
      if (categoria) f.categoria = categoria;
      if (solo_no_consolidados) f.duplicado_confirmado = { $in: [null, false] };
      const regs = await base44.asServiceRole.entities.RegistroGasto.filter(f, '-fecha_documento', MAX_POR_ENTIDAD);
      for (const r of regs || []) docs.push(mapRegistroGasto(r));
    }

    if (ents.includes('factura_autonomo')) {
      const f: any = {};
      if (inicio && fin) f.fecha_factura = { $gte: inicio, $lte: fin };
      if (solo_no_consolidados) f.estado = { $ne: 'anulada' };
      const regs = await base44.asServiceRole.entities.FacturaAutonomo.filter(f, '-fecha_factura', MAX_POR_ENTIDAD);
      for (const r of regs || []) docs.push(mapFacturaAutonomo(r));
    }

    if (ents.includes('nomina')) {
      const f: any = {};
      if (inicio && fin) {
        // filtrar por anio/mes aproximado
        const [yi, mi] = inicio.split('-').map(Number);
        const [yf, mf] = fin.split('-').map(Number);
        f.$or = [];
        for (let y = yi; y <= yf; y++) {
          const mStart = y === yi ? mi : 1;
          const mEnd = y === yf ? mf : 12;
          for (let m = mStart; m <= mEnd; m++) {
            f.$or.push({ anio: y, mes: m });
          }
        }
        if (f.$or.length === 0) delete f.$or;
      }
      const regs = await base44.asServiceRole.entities.Nomina.filter(f, '-anio', MAX_POR_ENTIDAD);
      for (const r of regs || []) docs.push(mapNomina(r));
    }

    if (ents.includes('presupuesto')) {
      const f: any = {};
      if (inicio && fin) f.fecha = { $gte: inicio, $lte: fin };
      if (solo_no_consolidados) f.es_duplicado_confirmado = { $in: [null, false] };
      const regs = await base44.asServiceRole.entities.Presupuesto.filter(f, '-fecha', MAX_POR_ENTIDAD);
      for (const r of regs || []) docs.push(mapPresupuesto(r));
    }

    const grupos = agruparDuplicados(docs, umbral);

    // Resumen ligero para el frontend
    const resumen = {
      total_docs: docs.length,
      total_grupos: grupos.length,
      criticos: grupos.filter((g: GrupoDuplicado) => g.severidad === 'critico').length,
      altos: grupos.filter((g: GrupoDuplicado) => g.severidad === 'alto').length,
      medios: grupos.filter((g: GrupoDuplicado) => g.severidad === 'medio').length,
      bajos: grupos.filter((g: GrupoDuplicado) => g.severidad === 'bajo').length,
      importe_duplicado: grupos.reduce((s: number, g: GrupoDuplicado) => {
        // Sumar importe de los miembros que NO son el conservado (potencial ahorro)
        const conservar = g.conservar_id;
        return s + g.miembros.filter(m => m.id !== conservar).reduce((ss: number, m: any) => ss + (m.importe || 0), 0);
      }, 0),
    };

    // Mapear grupos a forma serializable (quitar raw pesado, dejar lo mínimo)
    const gruposOut = grupos.map(g => ({
      conservar_id: g.conservar_id,
      severidad: g.severidad,
      score_medio: g.score_medio,
      miembros: g.miembros.map(m => ({
        id: m.id,
        entidad: m.entidad,
        entidad_label: m.entidad_label,
        fecha: m.fecha,
        hora: m.hora,
        importe: m.importe,
        cif: m.cif,
        nombre: m.nombre,
        localidad: m.localidad,
        numero_factura: m.numero_factura,
        codigo_fiscal: m.codigo_fiscal,
        operario_name: m.operario_name,
        operario_email: m.operario_email,
        estado: m.estado,
        categoria: m.categoria,
        obra_name: m.obra_name,
        calidad: m.calidad,
        archivos_count: m.archivos ? m.archivos.length : 0,
        archivo_url: m.archivos && m.archivos[0] ? m.archivos[0].url : null,
      })),
    }));

    return Response.json({ success: true, resumen, grupos: gruposOut });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}