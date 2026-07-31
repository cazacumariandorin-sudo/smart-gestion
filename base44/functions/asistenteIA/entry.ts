import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.40.0';

// ── Matriz declarativa de herramientas por rol ───────────────────────────────
const TOOLS_BY_ROLE = {
  admin:              'ALL',
  gerencia:           'ALL',
  director_comercial: ['get_obras_activas', 'get_partes_sin_firmar', 'get_obras_sin_presupuesto', 'get_obras_solar', 'get_prevision_obras', 'get_manuales', 'get_usuarios', 'get_notas_gastos', 'get_kpis_mes', 'generar_resumen_ejecutivo', 'get_apuntes_produccion', 'create_tarea', 'create_nota_interna', 'solicitar_cambio_rol', 'create_informe_simulacion'],
  jefe_obra:          ['get_obras_activas', 'get_fichajes_hoy', 'get_partes_sin_firmar', 'get_kpis_mes', 'get_operarios_sin_fichar_hoy', 'get_obras_sin_presupuesto', 'generar_resumen_ejecutivo', 'get_apuntes_produccion', 'get_manuales', 'get_vehiculos', 'get_vacaciones', 'get_notas_gastos', 'get_obras_solar', 'get_materiales_obra', 'get_prevision_obras', 'get_documentos_operarios', 'create_fichaje', 'create_apunte', 'create_tarea'],
  control_horario:    ['get_fichajes_hoy', 'get_operarios_sin_fichar_hoy', 'get_apuntes_produccion', 'get_manuales', 'create_fichaje', 'create_apunte'],
  operario:           ['get_fichajes_hoy', 'get_gastos_pendientes', 'get_notas_gastos', 'get_apuntes_produccion', 'get_manuales'],
  cliente_obra:       ['get_obras_activas', 'get_prevision_obras'],
  usuario_demo:       ['get_manuales'],
};

// ── Definición de herramientas ───────────────────────────────────────────────
const TOOLS_ALL = [
  { name: 'get_obras_activas',             description: 'Obtiene las obras activas con estado, cliente y presupuesto', input_schema: { type: 'object', properties: {} } },
  { name: 'get_fichajes_hoy',              description: 'Obtiene los fichajes de hoy o de una fecha específica', input_schema: { type: 'object', properties: { fecha: { type: 'string', description: 'YYYY-MM-DD, default=hoy' }, operario_id: { type: 'string' } } } },
  { name: 'get_gastos_pendientes',         description: 'Registros de gasto en estado borrador o pendiente', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, sin_obra: { type: 'boolean' } } } },
  { name: 'get_partes_sin_firmar',         description: 'Partes de trabajo sin firma del cliente', input_schema: { type: 'object', properties: {} } },
  { name: 'get_kpis_mes',                  description: 'KPIs del mes: horas, gastos, obras activas, partes', input_schema: { type: 'object', properties: {} } },
  { name: 'get_operarios_sin_fichar_hoy',  description: 'Trabajadores activos que no han fichado hoy', input_schema: { type: 'object', properties: {} } },
  { name: 'get_obras_sin_presupuesto',     description: 'Obras con presupuesto 0 o nulo', input_schema: { type: 'object', properties: {} } },
  { name: 'generar_resumen_ejecutivo',     description: 'Resumen ejecutivo de obras, fichajes, gastos y partes', input_schema: { type: 'object', properties: { periodo: { type: 'string', enum: ['hoy', 'semana', 'mes'] } }, required: ['periodo'] } },
  { name: 'get_apuntes_produccion',        description: 'Apuntes de producción por operario, obra o fecha', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, fecha_desde: { type: 'string' }, obra_id: { type: 'string' } } } },
  { name: 'get_manuales',                  description: 'Manuales técnicos y documentación interna disponible', input_schema: { type: 'object', properties: { categoria: { type: 'string' } } } },
  { name: 'get_vehiculos',                 description: 'Estado de la flota de vehículos con alertas de mantenimiento', input_schema: { type: 'object', properties: {} } },
  { name: 'get_vacaciones',                description: 'Vacaciones y ausencias de operarios', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, pendientes_aprobacion: { type: 'boolean' } } } },
  { name: 'get_notas_gastos',              description: 'Notas de gastos de operarios con su estado', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, estado: { type: 'string' } } } },
  { name: 'get_obras_solar',               description: 'Proyectos de instalaciones solares', input_schema: { type: 'object', properties: { status: { type: 'string' } } } },
  { name: 'get_materiales_obra',           description: 'Materiales registrados de una obra específica', input_schema: { type: 'object', properties: { obra_id: { type: 'string' } }, required: ['obra_id'] } },
  { name: 'get_prevision_obras',           description: 'Previsión y planificación de obras con semáforo de avance', input_schema: { type: 'object', properties: {} } },
  { name: 'get_documentos_operarios',      description: 'Documentos de trabajadores y estado de firma', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, firma_status: { type: 'string' } } } },
  { name: 'get_usuarios',                  description: 'Lista usuarios de la app con nombre, email y rol', input_schema: { type: 'object', properties: { rol: { type: 'string' } } } },
  { name: 'create_fichaje',                description: 'Registra un fichaje (entrada/salida) para un operario', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, operario_name: { type: 'string' }, date: { type: 'string' }, hora_entrada: { type: 'string' }, hora_salida: { type: 'string' }, obra_id: { type: 'string' }, obra_name: { type: 'string' }, notas: { type: 'string' } }, required: ['operario_id', 'operario_name', 'date', 'hora_entrada'] } },
  { name: 'create_apunte',                 description: 'Registra un apunte de producción para un operario', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, operario_name: { type: 'string' }, date: { type: 'string' }, obra_id: { type: 'string' }, obra_name: { type: 'string' }, concepto: { type: 'string' }, cantidad: { type: 'number' }, unidad: { type: 'string' }, precio_unitario: { type: 'number' }, horas_ejecutadas: { type: 'number' }, notas: { type: 'string' } }, required: ['operario_id', 'operario_name', 'date', 'obra_id', 'obra_name', 'concepto', 'cantidad'] } },
  { name: 'create_tarea',                  description: 'Crea una tarea en AsistenteTarea para un usuario', input_schema: { type: 'object', properties: { titulo: { type: 'string' }, descripcion: { type: 'string' }, tipo: { type: 'string', enum: ['recordatorio', 'comprobacion', 'alerta', 'tarea_manual', 'informe'] }, prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] }, asignada_a_user_id: { type: 'string' }, asignada_a_nombre: { type: 'string' }, fecha_limite: { type: 'string' }, entidad_relacionada_tipo: { type: 'string' }, entidad_relacionada_id: { type: 'string' } }, required: ['titulo', 'tipo', 'asignada_a_user_id', 'asignada_a_nombre'] } },
  { name: 'create_nota_interna',           description: 'Crea una nota interna confidencial para admin y gerencia', input_schema: { type: 'object', properties: { titulo: { type: 'string' }, contenido: { type: 'string' }, prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] }, entidad_relacionada_tipo: { type: 'string' }, entidad_relacionada_id: { type: 'string' } }, required: ['titulo', 'contenido'] } },
  { name: 'solicitar_cambio_rol',          description: 'Solicita cambio de rol para un usuario (solo Admin/Gerencia/Director)', input_schema: { type: 'object', properties: { user_id: { type: 'string' }, user_nombre: { type: 'string' }, rol_actual: { type: 'string' }, rol_nuevo: { type: 'string' }, motivo: { type: 'string' } }, required: ['user_id', 'user_nombre', 'rol_nuevo'] } },
  { name: 'create_informe_simulacion',     description: 'Crea informe post-simulación de rol con observaciones y recomendaciones', input_schema: { type: 'object', properties: { rol_simulado: { type: 'string' }, observaciones: { type: 'string' }, problemas_detectados: { type: 'string' }, recomendaciones: { type: 'string' }, prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] } }, required: ['rol_simulado', 'observaciones'] } },
];

function filtrarTools(role) {
  const allowed = TOOLS_BY_ROLE[role];
  if (!allowed) return [];
  if (allowed === 'ALL') return TOOLS_ALL;
  return TOOLS_ALL.filter(t => allowed.includes(t.name));
}

// ── Caché en memoria (vida: 5 minutos por usuario) ───────────────────────────
const contextCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getContextData(base44, user) {
  const cacheKey = `${user.id}_${user.role}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const hoy = new Date().toISOString().split('T')[0];
  let data = {};
  let usuariosInfo = [];

  try {
    const isAdminOrGerencia = ['admin', 'gerencia'].includes(user.role);
    const isJefeOObra = user.role === 'jefe_obra' || isAdminOrGerencia;

    if (isAdminOrGerencia) {
      const [obras, operarios, fichajes, gastos, partes, usuarios] = await Promise.all([
        base44.asServiceRole.entities.Obra.filter({ status: 'activa' }, '-created_date', 20),
        base44.asServiceRole.entities.Operario.filter({ active: true }, '-created_date', 30),
        base44.asServiceRole.entities.Fichaje.filter({ date: hoy }, '-created_date', 50),
        base44.asServiceRole.entities.RegistroGasto.filter({ estado: 'pendiente' }, '-created_date', 20),
        base44.asServiceRole.entities.WorkOrder.filter({ firma_status: 'sin_firmar' }, '-created_date', 10),
        base44.asServiceRole.entities.User.list('-created_date', 100),
      ]);
      data = { obras_activas: obras.length, operarios_activos: operarios.length, fichajes_hoy: fichajes.length, gastos_pendientes: gastos.length, partes_sin_firmar: partes.length };
      usuariosInfo = usuarios.map(u => ({ id: u.id, nombre: u.full_name, email: u.email, rol: u.role }));
    } else if (isJefeOObra) {
      const [fichajes, partes] = await Promise.all([
        base44.entities.Fichaje.filter({ date: hoy }, '-created_date', 30),
        base44.entities.WorkOrder.filter({ firma_status: 'sin_firmar' }, '-created_date', 10),
      ]);
      data = { fichajes_hoy: fichajes.length, partes_sin_firmar: partes.length };
    } else if (user.role === 'operario') {
      const [fichajes, gastos] = await Promise.all([
        base44.entities.Fichaje.list('-date', 7),
        base44.entities.RegistroGasto.filter({ estado: 'borrador' }, '-created_date', 10),
      ]);
      data = { mis_fichajes_recientes: fichajes.length, mis_gastos_pendientes: gastos.length };
    }
  } catch (_) {
    data = { aviso: 'Datos de contexto no disponibles temporalmente' };
  }

  const result = { contextData: data, usuariosInfo };
  contextCache.set(cacheKey, { ts: Date.now(), data: result });
  return result;
}

// ── Carga reglas de oro incumplidas para el prompt ───────────────────────────
async function getReglasGobernanza(base44, role) {
  if (!['admin', 'gerencia'].includes(role)) return null;
  try {
    const reglas = await base44.asServiceRole.entities.ReglaDeOro.filter({ activa: true }, '-created_date', 50);
    const incumplidas = reglas.filter(r => r.estado_cumplimiento === 'incumplida');
    const pendientesDecision = reglas.filter(r => r.decision_requerida && !r.decision_tomada);
    if (incumplidas.length === 0 && pendientesDecision.length === 0) return null;
    return {
      incumplidas: incumplidas.map(r => `[${r.codigo}] ${r.titulo}`),
      pendientes_decision: pendientesDecision.map(r => `[${r.codigo}] ${r.titulo}`),
    };
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messages } = await req.json();

    // ── Carga paralela: contexto + normas + gobernanza ────────────────────────
    const [{ contextData, usuariosInfo }, normasConfig, gobernanza] = await Promise.all([
      getContextData(base44, user),
      base44.asServiceRole.entities.AsistenteConfig.filter({ clave: 'normas_globales' }).then(r => r?.[0] || null).catch(() => null),
      getReglasGobernanza(base44, user.role),
    ]);

    // ── Descripciones de roles ────────────────────────────────────────────────
    const rolesDesc = {
      admin: 'Acceso total', gerencia: 'JEFE SUPREMO — Acceso total y supervisión global',
      director_comercial: 'Gestión comercial y de clientes', jefe_obra: 'Gestión de obras y operarios',
      operario: 'Control horario y partes propios', control_horario: 'Control de presencia',
      cliente_obra: 'Solo lectura de sus obras', usuario_demo: 'Acceso demo limitado',
    };

    const roleCapabilities = {
      admin:              'Tienes acceso total a TODAS las funciones y datos de la app.',
      gerencia:           'Eres la máxima autoridad. Puedes consultar todos los datos, crear notas internas, gestionar usuarios y configurar el asistente.',
      director_comercial: 'Puedes consultar obras, clientes, KPIs comerciales, usuarios y crear notas internas. NO accedes a nóminas, fichajes individuales ni documentos de operarios.',
      jefe_obra:          'Puedes consultar obras activas, fichajes, operarios sin fichar, partes, vacaciones, documentos, vehículos, materiales y previsiones. NO ves datos financieros globales ni gestionas usuarios.',
      control_horario:    'Solo consultas y registras fichajes y apuntes de producción. Sin acceso a financiero, clientes, usuarios ni obras completas.',
      operario:           'Solo consultas TUS PROPIOS fichajes, gastos, partes y manuales. NO ves datos de otros operarios, KPIs ni información financiera.',
      cliente_obra:       'Solo consultas información de TUS PROPIAS obras.',
      usuario_demo:       'Acceso de demostración limitado. Solo preguntas generales sobre el funcionamiento de la app.',
    };

    // ── System Prompt ─────────────────────────────────────────────────────────
    const systemPrompt = [
      'Eres "Asistente SMART", el asistente interno de SMART-GESTION.',
      normasConfig ? `\nCONFIGURACIÓN EMPRESA:\n- ${normasConfig.empresa_nombre || ''} | ${normasConfig.empresa_sector || ''}\nENTORNO: ${normasConfig.entorno_descripcion || ''}\nNORMAS: ${normasConfig.normas_internas || ''}\nDIRECTRICES: ${normasConfig.directrices_comportamiento || ''}` : '',
      `\nVOCABULARIO DEL SISTEMA:
- USUARIO: cuenta de acceso (email, contraseña, rol).
- TRABAJADOR: ficha laboral (DNI, categoría, historial de horas). Un usuario puede o no tener ficha de Trabajador vinculada.
Categorías profesionales: oficial_primera, oficial_segunda, peon, encargado, tecnico_solar, administrativo, subcontrata, temporal.`,
      `\nUSUARIO ACTIVO: ${user.full_name || user.email} | Rol: ${user.role} (${rolesDesc[user.role] || user.role}) | ID: ${user.id}`,
      usuariosInfo.length > 0 ? `\nUSUARIOS SISTEMA (${usuariosInfo.length}):\n${usuariosInfo.map(u => `- ${u.nombre || u.email} (${u.email}) → ${u.rol}`).join('\n')}` : '',
      `\nDATOS TIEMPO REAL: ${JSON.stringify(contextData)}`,
      `\nCAPACIDADES DE ESTE USUARIO:\n${roleCapabilities[user.role] || 'Acceso estándar.'}`,
      gobernanza ? `\n⚠️ GOBERNANZA — REGLAS DE ORO PENDIENTES:
${gobernanza.incumplidas.length > 0 ? `Reglas INCUMPLIDAS:\n${gobernanza.incumplidas.map(r => `  - ${r}`).join('\n')}` : ''}
${gobernanza.pendientes_decision.length > 0 ? `Reglas con DECISIÓN PENDIENTE de Dirección:\n${gobernanza.pendientes_decision.map(r => `  - ${r}`).join('\n')}` : ''}
Alerta al usuario sobre estas incidencias si son relevantes para su consulta. Recomienda resolver las decisiones pendientes.` : '',
      `\nREGLAS ESTRICTAS:
1. SOLO responde preguntas y ejecutas tareas dentro del alcance del rol "${user.role}".
2. Si el usuario pregunta algo fuera de su rol, responde: "No tengo acceso a esa información con tu nivel de acceso."
3. Usa SOLO las herramientas disponibles para obtener datos reales — NUNCA inventes datos.
4. Confirma antes de crear/modificar registros.
5. Si una herramienta falla, informa al usuario con calma: "No he podido consultar esos datos ahora, pero he registrado la incidencia para revisión."
6. Escala a Gerencia (nota urgente) cualquier error o incidencia no resuelta.
7. Responde siempre en español, tono profesional y conciso.
8. SOLO respondes sobre la app SMART-GESTION y sus datos. Rechaza cualquier pregunta ajena a la app.
9. GERENCIA es la máxima autoridad — reporta incidencias graves siempre.`,
    ].filter(Boolean).join('');

    // ── Cliente Anthropic ─────────────────────────────────────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      const llmMessages = (messages || []);
      const resp = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: llmMessages.length > 0 ? llmMessages[llmMessages.length - 1].content : 'Hola',
        system_prompt: systemPrompt,
      });
      return Response.json({ reply: resp, role: 'assistant' });
    }

    const anthropic = new Anthropic({ apiKey });
    const tools = filtrarTools(user.role);

    const claudeMessages = (messages || []).map(m => ({ role: m.role, content: m.content }));
    if (claudeMessages.length === 0) claudeMessages.push({ role: 'user', content: 'Hola' });

    // ── Respaldo si Claude falla en tiempo real (caída, rate limit, timeout) ──
    const fallbackInvokeLLM = async () => {
      const ultimoMensaje = claudeMessages[claudeMessages.length - 1];
      const prompt = typeof ultimoMensaje?.content === 'string' ? ultimoMensaje.content : 'Hola';
      const resp = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        system_prompt: systemPrompt + '\n\nNOTA: La IA primaria no está disponible ahora mismo, estás respondiendo en modo respaldo sin acceso a herramientas en tiempo real. Avisa brevemente al usuario de esto si es relevante.',
      });
      return Response.json({ reply: resp, role: 'assistant', modo_respaldo: true });
    };

    // ── Bucle agéntico ────────────────────────────────────────────────────────
    let iteraciones = 0;
    const MAX_ITER = 5;

    while (iteraciones < MAX_ITER) {
      iteraciones++;

      let response;
      try {
        response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: systemPrompt,
          tools,
          messages: claudeMessages,
        });
      } catch (claudeError) {
        return await fallbackInvokeLLM();
      }

      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        return Response.json({ reply: textBlock?.text || '', role: 'assistant' });
      }

      if (response.stop_reason === 'tool_use') {
        claudeMessages.push({ role: 'assistant', content: response.content });

        const toolCalls = response.content.filter(b => b.type === 'tool_use');
        const toolResults = await Promise.all(toolCalls.map(async (toolCall) => {
          let resultContent;
          try {
            const resp = await base44.functions.invoke('asistenteHerramientas', {
              tool_name: toolCall.name,
              tool_input: toolCall.input || {},
            });
            resultContent = JSON.stringify(resp?.result || resp?.data?.result || resp?.data || resp || {});
          } catch (err) {
            // Respuesta degradada: informa sin bloquear la conversación
            resultContent = JSON.stringify({
              error: true,
              mensaje: `No se pudieron obtener los datos de "${toolCall.name}". Incidencia registrada para revisión.`,
              detalle: err.message,
            });
          }
          return { type: 'tool_result', tool_use_id: toolCall.id, content: resultContent };
        }));

        claudeMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      const textBlock = response.content.find(b => b.type === 'text');
      return Response.json({ reply: textBlock?.text || 'No pude completar la respuesta.', role: 'assistant' });
    }

    return Response.json({ reply: 'He alcanzado el límite de operaciones. Por favor, reformula tu pregunta.', role: 'assistant' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});