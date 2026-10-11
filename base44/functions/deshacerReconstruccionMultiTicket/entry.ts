import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Deshace una reconstrucción multi-ticket (la versión antigua creaba un registro POR FOTO
// aunque las fotos fueran páginas del mismo documento).
//   operacion 'simular'  { registro_original_id }  → muestra qué se anularía. NO escribe.
//   operacion 'ejecutar' { registro_original_id, estado_restaurar? } → anula los registros creados
//                          y devuelve el original a su estado previo.
// Nada se borra: los registros creados pasan a 'rechazada' con una nota de auditoría.
// Si algún registro creado ya está aprobado/registrado/pagado, NO se hace nada (revisión manual).
//
// Acceso: gerencia, administracion, admin, propietario.

const ROLES_OK = ['admin', 'propietario', 'gerencia', 'administracion'];
const ESTADOS_RESTAURABLES = ['borrador', 'pendiente'];
const ESTADOS_BLOQUEANTES = ['aprobado_gerencia', 'registrado', 'en_administracion', 'pagada'];
const MARCA = 'reconstrucción multi-ticket';

function respuesta(status, obj) { return Response.json(obj, { status }); }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return respuesta(401, { error: 'Unauthorized' });
    if (!ROLES_OK.includes(user.role)) return respuesta(403, { error: 'Forbidden: solo gerencia/administracion/admin' });

    const { registro_original_id, operacion = 'simular', estado_restaurar } = await req.json().catch(() => ({}));
    if (!registro_original_id) return respuesta(400, { error: 'registro_original_id requerido' });
    if (!['simular', 'ejecutar'].includes(operacion)) return respuesta(400, { error: 'operacion no válida' });

    const RG = base44.asServiceRole.entities.RegistroGasto;
    const original = await RG.get(registro_original_id);
    if (!original) return respuesta(404, { error: 'Registro no encontrado' });
    const notas = String(original.notas_admin || '');
    if (original.estado !== 'rechazada' || !notas.includes(MARCA)) {
      return respuesta(400, { error: 'Este registro no fue anulado por una reconstrucción multi-ticket.' });
    }

    // Estado al que volver: el guardado por la versión nueva, o el elegido, o 'pendiente'
    const previo = /\[estado_previo=([a-z_]+)\]/.exec(notas)?.[1];
    const restaurar = ESTADOS_RESTAURABLES.includes(estado_restaurar) ? estado_restaurar
      : (ESTADOS_RESTAURABLES.includes(previo) ? previo : 'pendiente');

    // Registros creados por la reconstrucción: marca nueva [origen=ID] o formato antiguo "Reconstruido desde NOTA"
    const delOperario = await RG.filter({ operario_id: original.operario_id }, '-created_date', 800);
    const prefijoAntiguo = `Reconstruido desde ${original.numero_nota || original.id}`;
    const hijos = (delOperario || []).filter((r) => {
      if (r.id === original.id) return false;
      const n = String(r.notas_admin || '');
      return n.includes(`[origen=${original.id}]`) || n.startsWith(prefijoAntiguo);
    });
    const activos = hijos.filter((h) => h.estado !== 'rechazada');
    const bloqueados = activos.filter((h) => ESTADOS_BLOQUEANTES.includes(h.estado));

    const resumen = {
      original: { id: original.id, numero_nota: original.numero_nota, importe: original.importe, estado_previo: previo || null },
      estado_restaurar: restaurar,
      hijos: activos.map((h) => ({ id: h.id, numero_nota: h.numero_nota, importe: h.importe, estado: h.estado, nombre_comercio: h.nombre_comercio })),
      bloqueados: bloqueados.map((h) => ({ id: h.id, numero_nota: h.numero_nota, estado: h.estado })),
    };

    if (operacion === 'simular') return respuesta(200, { success: true, ...resumen });

    if (bloqueados.length) {
      return respuesta(409, { success: false, error: `${bloqueados.length} registro(s) creado(s) ya están aprobados/registrados/pagados; hay que revisarlos a mano.`, ...resumen });
    }
    const ahora = new Date().toISOString();
    for (const h of activos) {
      await RG.update(h.id, { estado: 'rechazada', notas_admin: `${h.notas_admin || ''} | Anulado al deshacer la reconstrucción (${user.email}, ${ahora})` });
    }
    await RG.update(original.id, { estado: restaurar, notas_admin: `${notas} | Reconstrucción deshecha por ${user.email} el ${ahora}; restaurado como '${restaurar}'.` });
    return respuesta(200, { success: true, anulados: activos.length, restaurado_como: restaurar, ...resumen });
  } catch (error) {
    console.error('[deshacerReconstruccionMultiTicket]', error);
    return respuesta(500, { success: false, error: error.message });
  }
}
