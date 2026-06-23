import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Migración masiva de IDs únicos.
 * Recorre todas las entidades configuradas, ordena los registros sin ID
 * por fecha de creación y les asigna el siguiente secuencial disponible.
 * Solo accesible para admin/gerencia.
 */

const ENTIDADES = [
  { nombre: 'Operario',    prefijo: 'OPE', campo: 'num_empleado' },
  { nombre: 'Client',      prefijo: 'CLI', campo: 'codigo_registro' },
  { nombre: 'Obra',        prefijo: 'OBR', campo: 'codigo_registro' },
  { nombre: 'SolarObra',   prefijo: 'SOL', campo: 'codigo_registro' },
  { nombre: 'Order',       prefijo: 'PED', campo: 'codigo_registro' },
  { nombre: 'WorkOrder',   prefijo: 'ALB', campo: 'codigo_registro' },
  { nombre: 'Presupuesto', prefijo: 'PRES', campo: 'codigo_registro' },
  { nombre: 'Drawing',     prefijo: 'PLN', campo: 'codigo_registro' },
];

function formatearId(prefijo, secuencial, anio, entidad) {
  if (entidad === 'Presupuesto') {
    return `${prefijo}-SG-${anio}-${String(secuencial).padStart(3, '0')}`;
  }
  const anio2 = String(anio).slice(-2);
  return `${prefijo}-${anio2}-${String(secuencial).padStart(5, '0')}`;
}

function calcularSiguienteSecuencial(registros, campo, prefijo, anio, entidad) {
  const anio2 = String(anio).slice(-2);
  let max = 0;
  for (const r of registros) {
    const val = r[campo];
    if (!val) continue;
    const partes = val.split('-');
    if (entidad === 'Presupuesto') {
      // PRES-SG-AAAA-NNN
      if (partes.length === 4 && partes[0] === prefijo && partes[2] === String(anio)) {
        const n = parseInt(partes[3], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    } else {
      // PREFIJO-AA-SSSSS
      if (partes.length === 3 && partes[0] === prefijo && partes[1] === anio2) {
        const n = parseInt(partes[2], 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
  }
  return max + 1;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Solo admin/gerencia puede ejecutar esta migración' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Permite ejecutar solo una entidad específica o todas
    const soloEntidad = body.entidad || null;

    const entidadesAMigrar = soloEntidad
      ? ENTIDADES.filter(e => e.nombre === soloEntidad)
      : ENTIDADES;

    if (entidadesAMigrar.length === 0) {
      return Response.json({ error: `Entidad desconocida: ${soloEntidad}` }, { status: 400 });
    }

    const resumen = [];

    for (const { nombre, prefijo, campo } of entidadesAMigrar) {
      const entityApi = base44.asServiceRole.entities[nombre];
      if (!entityApi) {
        resumen.push({ entidad: nombre, error: 'API no disponible', actualizados: 0 });
        continue;
      }

      // Cargar todos los registros
      const todos = await entityApi.list('created_date', 500);

      // Agrupar por año de creación
      const porAnio = {};
      for (const r of todos) {
        const fechaCreacion = r.created_date ? new Date(r.created_date) : new Date();
        const anio = fechaCreacion.getFullYear();
        if (!porAnio[anio]) porAnio[anio] = { conId: [], sinId: [] };
        if (r[campo]) porAnio[anio].conId.push(r);
        else porAnio[anio].sinId.push(r);
      }

      let actualizados = 0;
      const errores = [];

      for (const [anioStr, { conId, sinId }] of Object.entries(porAnio)) {
        const anio = parseInt(anioStr);
        // Ordenar sin ID por fecha de creación ascendente para respetar el orden cronológico
        sinId.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));

        // Calcular siguiente secuencial partiendo de los que ya tienen ID en ese año
        let siguiente = calcularSiguienteSecuencial([...conId, ...todos.filter(r => r[campo])], campo, prefijo, anio, nombre);

        for (const r of sinId) {
          const nuevoId = formatearId(prefijo, siguiente, anio, nombre);
          try {
            // Construir objeto de actualización mínimo con campos requeridos si es necesario
            const updateData = { [campo]: nuevoId };
            // Para Order: title es requerido, mantener el existente
            if (nombre === 'Order' && !r.title) updateData.title = nuevoId;
            await entityApi.update(r.id, updateData);
            siguiente++;
            actualizados++;
          } catch (e) {
            // Retry con delay en rate limit
            if (e.message?.includes('Rate limit')) {
              await new Promise(res => setTimeout(res, 1500));
              try {
                const updateData = { [campo]: nuevoId };
                if (nombre === 'Order' && !r.title) updateData.title = nuevoId;
                await entityApi.update(r.id, updateData);
                siguiente++;
                actualizados++;
              } catch (e2) {
                errores.push({ id: r.id, error: e2.message });
              }
            } else {
              errores.push({ id: r.id, error: e.message });
            }
          }
          // Pequeño delay para evitar rate limit
          await new Promise(res => setTimeout(res, 80));
        }
      }

      resumen.push({ entidad: nombre, campo, actualizados, errores: errores.length > 0 ? errores : undefined });
    }

    const totalActualizados = resumen.reduce((s, r) => s + (r.actualizados || 0), 0);

    return Response.json({
      success: true,
      mensaje: `Migración completada. ${totalActualizados} registros actualizados.`,
      resumen,
      total_actualizados: totalActualizados,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});