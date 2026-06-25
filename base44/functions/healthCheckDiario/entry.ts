import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MODULOS_PRIORITARIOS = [
  { nombre: 'Notas de Gastos',      entidad: 'RegistroGasto' },
  { nombre: 'Fichajes',             entidad: 'Fichaje' },
  { nombre: 'Calendario de Obras',  entidad: 'Obra' },
  { nombre: 'Vacaciones',           entidad: 'Vacacion' },
  { nombre: 'Manuales y Planos',    entidad: 'Manual' },
];

const MODULOS_SECUNDARIOS = [
  { nombre: 'Clientes',       entidad: 'Client' },
  { nombre: 'Pedidos',        entidad: 'Order' },
  { nombre: 'Vehículos',      entidad: 'Vehiculo' },
  { nombre: 'Galería de Fotos', entidad: 'FotoProyecto' },
  { nombre: 'Chat',           entidad: 'ChatConversacion' },
  { nombre: 'Materiales',     entidad: 'MaterialCatalog' },
];

async function comprobarAccesoUsuarios(base44) {
  const inicio = Date.now();
  try {
    const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 50);
    if (!usuarios || usuarios.length === 0) {
      return { modulo: 'Acceso de Usuarios', estado: 'error', detalle_error: 'No se pudo listar ningún usuario', tiempo_respuesta_ms: Date.now() - inicio };
    }
    const conMayusculas = usuarios.filter(u => u.email && u.email !== u.email.toLowerCase());
    if (conMayusculas.length > 0) {
      return {
        modulo: 'Acceso de Usuarios',
        estado: 'error',
        detalle_error: `${conMayusculas.length} usuario(s) con email sin normalizar`,
        tiempo_respuesta_ms: Date.now() - inicio,
      };
    }
    return { modulo: 'Acceso de Usuarios', estado: 'ok', detalle_error: '', tiempo_respuesta_ms: Date.now() - inicio };
  } catch (e) {
    return { modulo: 'Acceso de Usuarios', estado: 'error', detalle_error: e.message, tiempo_respuesta_ms: Date.now() - inicio };
  }
}

async function comprobarModulo(base44, modulo) {
  const inicio = Date.now();
  try {
    await base44.asServiceRole.entities[modulo.entidad].list('-created_date', 5);
    return { modulo: modulo.nombre, estado: 'ok', detalle_error: '', tiempo_respuesta_ms: Date.now() - inicio };
  } catch (e) {
    return { modulo: modulo.nombre, estado: 'error', detalle_error: e.message || 'Error desconocido', tiempo_respuesta_ms: Date.now() - inicio };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const esManual = req.method === 'POST';
    let solicitadaPor = '';

    if (esManual) {
      try {
        const requester = await base44.auth.me();
        if (!requester || (requester.role !== 'gerencia' && requester.role !== 'admin')) {
          return Response.json({ error: 'Solo Gerencia puede solicitar una comprobación manual' }, { status: 403 });
        }
        solicitadaPor = requester.email;
      } catch (_) { /* cron sin usuario */ }
    }

    const resultadoAcceso = await comprobarAccesoUsuarios(base44);
    const resultadosPrioritarios = [resultadoAcceso];
    let hayErrorPrioritario = resultadoAcceso.estado === 'error';

    for (const modulo of MODULOS_PRIORITARIOS) {
      if (hayErrorPrioritario) break;
      const resultado = await comprobarModulo(base44, modulo);
      resultadosPrioritarios.push(resultado);
      if (resultado.estado === 'error') hayErrorPrioritario = true;
    }

    const resultadosSecundarios = [];
    if (!hayErrorPrioritario) {
      for (const modulo of MODULOS_SECUNDARIOS) {
        const resultado = await comprobarModulo(base44, modulo);
        resultadosSecundarios.push(resultado);
      }
    }

    const todos = [...resultadosPrioritarios, ...resultadosSecundarios];
    const fallidos = todos.filter(r => r.estado === 'error');
    const estadoGlobal = fallidos.length > 0 ? 'error' : 'ok';
    const resumenError = fallidos.length > 0
      ? fallidos.map(f => f.modulo).join(', ') + ' no responden correctamente'
      : '';

    await base44.asServiceRole.entities.SystemHealthCheck.create({
      fecha_ejecucion: new Date().toISOString(),
      tipo_ejecucion: esManual ? 'manual' : 'programada',
      solicitada_por_email: solicitadaPor,
      estado_global: estadoGlobal,
      modulos_prioritarios_resultado: resultadosPrioritarios,
      modulos_secundarios_resultado: resultadosSecundarios,
      resumen_error: resumenError,
      reconocida_por_gerencia: false,
    });

    return Response.json({ success: true, estado_global: estadoGlobal, fallidos: fallidos.length, resumen_error: resumenError });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});