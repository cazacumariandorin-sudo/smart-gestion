import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Genera y asigna el ID único estándar para un Usuario.
 * Formato: USR-AÑO(2dig)-SECUENCIAL(5dig)
 * Ej: USR-26-00001
 */

function formatearId(prefijo, secuencial, anio) {
  const anio2 = String(anio).slice(-2);
  const seq5  = String(secuencial).padStart(5, '0');
  return `${prefijo}-${anio2}-${seq5}`;
}

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
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { userId, fechaRegistro } = await req.json();

    if (!userId) {
      return Response.json({ error: 'userId es requerido' }, { status: 400 });
    }

    const fecha = fechaRegistro ? new Date(fechaRegistro) : new Date();
    const anio  = fecha.getFullYear();
    const anio2 = String(anio).slice(-2);
    const PREFIJO = 'USR';

    // Obtener todos los usuarios para calcular el secuencial
    const todosUsuarios = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const siguiente = calcularSiguienteSecuencial(todosUsuarios, 'user_id_personalizado', PREFIJO, anio2);
    const idGenerado = formatearId(PREFIJO, siguiente, anio);

    // Actualizar el usuario
    await base44.asServiceRole.entities.User.update(userId, {
      user_id_personalizado: idGenerado,
    });

    return Response.json({
      success: true,
      user_id_personalizado: idGenerado,
      message: `ID generado: ${idGenerado}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});