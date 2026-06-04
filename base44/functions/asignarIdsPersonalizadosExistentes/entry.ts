import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Función de migración: asigna IDs únicos estándar a todos los registros
 * que aún no tengan su campo de código asignado.
 *
 * Entidades soportadas y sus configuraciones:
 *   User       → campo: user_id_personalizado, prefijo: USR
 *   Operario   → campo: codigo_registro,       prefijo: OPE
 *   Client     → campo: codigo_registro,       prefijo: CLI
 *   Obra       → campo: codigo_registro,       prefijo: OBR
 *   SolarObra  → campo: codigo_registro,       prefijo: SOL
 *   WorkOrder  → campo: order_number,          prefijo: ALB
 *   Order      → campo: codigo_registro,       prefijo: PED
 *   Manual     → campo: codigo_registro,       prefijo: MAN
 *   Vehiculo   → campo: codigo_registro,       prefijo: VEH
 */

const ENTIDADES_CONFIG = [
  { entidad: 'User',      campo: 'user_id_personalizado', prefijo: 'USR', fechaCampo: 'created_date' },
  { entidad: 'Operario',  campo: 'codigo_registro',       prefijo: 'OPE', fechaCampo: 'created_date' },
  { entidad: 'Client',    campo: 'codigo_registro',       prefijo: 'CLI', fechaCampo: 'created_date' },
  { entidad: 'Obra',      campo: 'codigo_registro',       prefijo: 'OBR', fechaCampo: 'created_date' },
  { entidad: 'SolarObra', campo: 'codigo_registro',       prefijo: 'SOL', fechaCampo: 'created_date' },
  { entidad: 'WorkOrder', campo: 'order_number',          prefijo: 'ALB', fechaCampo: 'date' },
  { entidad: 'Order',     campo: 'codigo_registro',       prefijo: 'PED', fechaCampo: 'created_date' },
  { entidad: 'Manual',    campo: 'codigo_registro',       prefijo: 'MAN', fechaCampo: 'created_date' },
  { entidad: 'Vehiculo',  campo: 'codigo_registro',       prefijo: 'VEH', fechaCampo: 'created_date' },
];

function formatearId(prefijo, secuencial, anio) {
  const anio2 = String(anio).slice(-2);
  const seq5  = String(secuencial).padStart(5, '0');
  return `${prefijo}-${anio2}-${seq5}`;
}

// Extrae el secuencial máximo ya asignado para un prefijo/año dado
function calcularSiguienteSecuencial(registros, campo, prefijo, anio2) {
  let max = 0;
  for (const r of registros) {
    const val = r[campo];
    if (!val) continue;
    const partes = val.split('-');
    if (partes.length === 3 && partes[0] === prefijo && partes[1] === anio2) {
      const n = parseInt(partes[2], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: Admin o Gerencia requerido' }, { status: 403 });
    }

    const { entidades_filtro } = await req.json().catch(() => ({}));

    const configs = entidades_filtro
      ? ENTIDADES_CONFIG.filter(c => entidades_filtro.includes(c.entidad))
      : ENTIDADES_CONFIG;

    const resumenTotal = { actualizados: 0, omitidos: 0, errores: [], detalles: [] };

    for (const config of configs) {
      const entityApi = base44.asServiceRole.entities[config.entidad];
      if (!entityApi) {
        resumenTotal.errores.push({ entidad: config.entidad, error: 'API no disponible' });
        continue;
      }

      const todos = await entityApi.list('-created_date', 500);

      // Agrupar registros sin ID por año para calcular secuenciales independientes por año
      const sinId = todos.filter(r => !r[config.campo]);
      const conId = todos.filter(r =>  r[config.campo]);

      // Construir mapa de secuenciales máximos por año
      const maxPorAnio = {};
      for (const r of conId) {
        const val = r[config.campo];
        const partes = val.split('-');
        if (partes.length === 3 && partes[0] === config.prefijo) {
          const a = partes[1];
          const n = parseInt(partes[2], 10);
          if (!isNaN(n)) maxPorAnio[a] = Math.max(maxPorAnio[a] || 0, n);
        }
      }

      // Ordenar sin ID por fecha para asignar secuenciales en orden cronológico
      sinId.sort((a, b) => new Date(a[config.fechaCampo] || 0) - new Date(b[config.fechaCampo] || 0));

      for (const registro of sinId) {
        const fecha = new Date(registro[config.fechaCampo] || Date.now());
        const anio  = fecha.getFullYear();
        const anio2 = String(anio).slice(-2);

        maxPorAnio[anio2] = (maxPorAnio[anio2] || 0) + 1;
        const nuevoId = formatearId(config.prefijo, maxPorAnio[anio2], anio);

        try {
          await entityApi.update(registro.id, { [config.campo]: nuevoId });
          resumenTotal.actualizados++;
          resumenTotal.detalles.push({
            entidad: config.entidad,
            id: registro.id,
            nombre: registro.name || registro.full_name || registro.email || registro.id,
            codigo_asignado: nuevoId,
          });
        } catch (err) {
          resumenTotal.errores.push({ entidad: config.entidad, id: registro.id, error: err.message });
        }
      }

      resumenTotal.omitidos += conId.length;
    }

    return Response.json({
      success: true,
      message: `Migración completada: ${resumenTotal.actualizados} registros actualizados, ${resumenTotal.omitidos} ya tenían ID`,
      resumen: resumenTotal,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});