import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Anthropic from 'npm:@anthropic-ai/sdk@0.40.0';

// ── Diccionario de herramientas disponibles ───────────────────────────────────
const TOOLS_ALL = [
  { name: 'get_obras_activas',          description: 'Obtiene las obras activas con estado, cliente y presupuesto', input_schema: { type: 'object', properties: {} } },
  { name: 'get_fichajes_hoy',           description: 'Obtiene los fichajes de hoy o de una fecha específica', input_schema: { type: 'object', properties: { fecha: { type: 'string', description: 'YYYY-MM-DD, default=hoy' }, operario_id: { type: 'string' } } } },
  { name: 'get_gastos_pendientes',      description: 'Registros de gasto en estado borrador o pendiente', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, sin_obra: { type: 'boolean' } } } },
  { name: 'get_partes_sin_firmar',      description: 'Partes de trabajo sin firma del cliente', input_schema: { type: 'object', properties: {} } },
  { name: 'get_kpis_mes',              description: 'KPIs del mes: horas, gastos, obras activas, partes', input_schema: { type: 'object', properties: {} } },
  { name: 'get_operarios_sin_fichar_hoy', description: 'Trabajadores activos que no han fichado hoy', input_schema: { type: 'object', properties: {} } },
  { name: 'get_obras_sin_presupuesto',  description: 'Obras con presupuesto 0 o nulo', input_schema: { type: 'object', properties: {} } },
  { name: 'generar_resumen_ejecutivo',  description: 'Resumen ejecutivo de obras, fichajes, gastos y partes', input_schema: { type: 'object', properties: { periodo: { type: 'string', enum: ['hoy', 'semana', 'mes'] } }, required: ['periodo'] } },
  { name: 'get_apuntes_produccion',     description: 'Apuntes de producción por operario, obra o fecha', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, fecha_desde: { type: 'string' }, obra_id: { type: 'string' } } } },
  { name: 'get_manuales',              description: 'Manuales técnicos y documentación interna disponible', input_schema: { type: 'object', properties: { categoria: { type: 'string' } } } },
  { name: 'get_vehiculos',             description: 'Estado de la flota de vehículos con alertas de mantenimiento', input_schema: { type: 'object', properties: {} } },
  { name: 'get_vacaciones',            description: 'Vacaciones y ausencias de operarios', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, pendientes_aprobacion: { type: 'boolean' } } } },
  { name: 'get_notas_gastos',          description: 'Notas de gastos de operarios con su estado', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, estado: { type: 'string' } } } },
  { name: 'get_obras_solar',           description: 'Proyectos de instalaciones solares', input_schema: { type: 'object', properties: { status: { type: 'string' } } } },
  { name: 'get_materiales_obra',       description: 'Materiales registrados de una obra específica', input_schema: { type: 'object', properties: { obra_id: { type: 'string' } }, required: ['obra_id'] } },
  { name: 'get_prevision_obras',       description: 'Previsión y planificación de obras con semáforo de avance', input_schema: { type: 'object', properties: {} } },
  { name: 'get_documentos_operarios',  description: 'Documentos de trabajadores y estado de firma', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, firma_status: { type: 'string' } } } },
  { name: 'get_usuarios',             description: 'Lista usuarios de la app con nombre, email y rol', input_schema: { type: 'object', properties: { rol: { type: 'string' } } } },
  { name: 'create_fichaje',           description: 'Registra un fichaje (entrada/salida) para un operario', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, operario_name: { type: 'string' }, date: { type: 'string' }, hora_entrada: { type: 'string' }, hora_salida: { type: 'string' }, obra_id: { type: 'string' }, obra_name: { type: 'string' }, notas: { type: 'string' } }, required: ['operario_id', 'operario_name', 'date', 'hora_entrada'] } },
  { name: 'create_apunte',            description: 'Registra un apunte de producción para un operario', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, operario_name: { type: 'string' }, date: { type: 'string' }, obra_id: { type: 'string' }, obra_name: { type: 'string' }, concepto: { type: 'string' }, cantidad: { type: 'number' }, unidad: { type: 'string' }, precio_unitario: { type: 'number' }, horas_ejecutadas: { type: 'number' }, notas: { type: 'string' } }, required: ['operario_id', 'operario_name', 'date', 'obra_id', 'obra_name', 'concepto', 'cantidad'] } },
  { name: 'create_tarea',             description: 'Crea una tarea en AsistenteTarea para un usuario', input_schema: { type: 'object', properties: { titulo: { type: 'string' }, descripcion: { type: 'string' }, tipo: { type: 'string', enum: ['recordatorio', 'comprobacion', 'alerta', 'tarea_manual', 'informe'] }, prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] }, asignada_a_user_id: { type: 'string' }, asignada_a_nombre: { type: 'string' }, fecha_limite: { type: 'string' }, entidad_relacionada_tipo: { type: 'string' }, entidad_relacionada_id: { type: 'string' } }, required: ['titulo', 'tipo', 'asignada_a_user_id', 'asignada_a_nombre'] } },
  { name: 'create_nota_interna',      description: 'Crea una nota interna confidencial para admin y gerencia', input_schema: { type: 'object', properties: { titulo: { type: 'string' }, contenido: { type: 'string' }, prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] }, entidad_relacionada_tipo: { type: 'string' }, entidad_relacionada_id: { type: 'string' } }, required: ['titulo', 'contenido'] } },
  { name: 'solicitar_cambio_rol',     description: 'Solicita cambio de rol para un usuario (solo Admin/Gerencia/Director)', input_schema: { type: 'object', properties: { user_id: { type: 'string' }, user_nombre: { type: 'string' }, rol_actual: { type: 'string' }, rol_nuevo: { type: 'string' }, motivo: { type: 'string' } }, required: ['user_id', 'user_nombre', 'rol_nuevo'] } },
  { name: 'create_informe_simulacion', description: 'Crea informe post-simulación de rol con observaciones y recomendaciones', input_schema: { type: 'object', properties: { rol_simulado: { type: 'string' }, observaciones: { type: 'string' }, problemas_detectados: { type: 'string' }, recomendaciones: { type: 'string' }, prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] } }, required: ['rol_simulado', 'observaciones'] } },
];

// ── Filtro de herramientas por rol ────────────────────────────────────────────
function filtrarTools(user) {
  const isAdminOrGerencia = ['admin', 'gerencia'].includes(user.role);
  const isJefeOObra       = user.role === 'jefe_obra' || isAdminOrGerencia;
  const isDirComercial    = user.role === 'director_comercial';

  return TOOLS_ALL.filter(t => {
    // Solo admin/gerencia/jefe_obra
    if (['get_kpis_mes', 'get_obras_sin_presupuesto', 'generar_resumen_ejecutivo', 'get_prevision_obras', 'get_notas_gastos', 'get_documentos_operarios', 'get_vacaciones'].includes(t.name)) {
      return isAdminOrGerencia || isJefeOObra;
    }
    // Solo admin/gerencia/director_comercial
    if (['create_nota_interna', 'get_usuarios', 'solicitar_cambio_rol', 'create_informe_simulacion'].includes(t.name)) {
      return isAdminOrGerencia || isDirComercial;
    }
    // Crear registros: admin/gerencia/jefe/control_horario
    if (['create_fichaje', 'create_apunte'].includes(t.name)) {
      return isAdminOrGerencia || isJefeOObra || user.role === 'control_horario';
    }
    // Flota, solar, materiales: jefe_obra+
    if (['get_vehiculos', 'get_obras_solar', 'get_materiales_obra', 'get_operarios_sin_fichar_hoy'].includes(t.name)) {
      return isJefeOObra || user.role === 'control_horario' || isAdminOrGerencia;
    }
    return true;
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messages } = await req.json();

    const isAdminOrGerencia = ['admin', 'gerencia'].includes(user.role);
    const isJefeOObra       = user.role === 'jefe_obra' || isAdminOrGerencia;

    // ── Contexto en tiempo real ───────────────────────────────────────────────
    let contextData = {};
    let usuariosInfo = [];
    try {
      const hoy = new Date().toISOString().split('T')[0];
      if (isAdminOrGerencia) {
        const [obras, operarios, fichajes, gastos, partes, usuarios] = await Promise.all([
          base44.asServiceRole.entities.Obra.filter({ status: 'activa' }, '-created_date', 20),
          base44.asServiceRole.entities.Operario.filter({ active: true }, '-created_date', 30),
          base44.asServiceRole.entities.Fichaje.filter({ date: hoy }, '-created_date', 50),
          base44.asServiceRole.entities.RegistroGasto.filter({ estado: 'pendiente' }, '-created_date', 20),
          base44.asServiceRole.entities.WorkOrder.filter({ firma_status: 'sin_firmar' }, '-created_date', 10),
          base44.asServiceRole.entities.User.list('-created_date', 100),
        ]);
        contextData = { obras_activas: obras.length, operarios_activos: operarios.length, fichajes_hoy: fichajes.length, gastos_pendientes: gastos.length, partes_sin_firmar: partes.length };
        usuariosInfo = usuarios.map(u => ({ id: u.id, nombre: u.full_name, email: u.email, rol: u.role }));
      } else if (user.role === 'jefe_obra') {
        const [fichajes, partes] = await Promise.all([
          base44.entities.Fichaje.filter({ date: new Date().toISOString().split('T')[0] }, '-created_date', 30),
          base44.entities.WorkOrder.filter({ firma_status: 'sin_firmar' }, '-created_date', 10),
        ]);
        contextData = { fichajes_hoy: fichajes.length, partes_sin_firmar: partes.length };
      } else if (user.role === 'operario') {
        const [fichajes, gastos] = await Promise.all([
          base44.entities.Fichaje.list('-date', 7),
          base44.entities.RegistroGasto.filter({ estado: 'borrador' }, '-created_date', 10),
        ]);
        contextData = { mis_fichajes_recientes: fichajes.length, mis_gastos_pendientes: gastos.length };
      }
    } catch (_) { contextData = { error: 'No se pudieron cargar datos de contexto' }; }

    // ── Normas configuradas por gerencia ──────────────────────────────────────
    let normasConfig = null;
    try {
      const configs = await base44.asServiceRole.entities.AsistenteConfig.filter({ clave: 'normas_globales' });
      if (configs?.length > 0) normasConfig = configs[0];
    } catch (_) {}

    const rolesDesc = {
      admin: 'Acceso total', gerencia: 'JEFE SUPREMO — Acceso total y supervisión global',
      director_comercial: 'Gestión comercial y de clientes', jefe_obra: 'Gestión de obras y operarios',
      operario: 'Control horario y partes propios', control_horario: 'Control de presencia',
      cliente_obra: 'Solo lectura de sus obras', usuario_demo: 'Acceso demo limitado',
    };

    const roleCapabilities = {
      admin: `Tienes acceso total a TODAS las funciones y datos de la app. Puedes responder cualquier pregunta y ejecutar cualquier tarea.`,
      gerencia: `Tienes acceso total. Eres la máxima autoridad. Puedes consultar todos los datos, crear notas internas, gestionar usuarios y configurar el asistente.`,
      director_comercial: `Puedes consultar obras, clientes, KPIs comerciales, usuarios y crear notas internas. NO tienes acceso a datos de nóminas, fichajes individuales ni documentos de operarios.`,
      jefe_obra: `Puedes consultar obras activas, fichajes del día, operarios sin fichar, partes sin firmar, vacaciones, documentos de operarios, vehículos, materiales y previsiones. NO puedes ver datos financieros globales ni gestionar usuarios.`,
      control_horario: `Solo puedes consultar y registrar fichajes y apuntes de producción. NO tienes acceso a datos financieros, clientes, usuarios ni obras completas.`,
      operario: `Solo puedes consultar TUS PROPIOS fichajes, gastos, partes de trabajo y manuales técnicos. NO puedes ver datos de otros operarios, obras completas, KPIs ni información financiera de la empresa.`,
      cliente_obra: `Solo puedes consultar información de TUS PROPIAS obras. No tienes acceso a datos internos de la empresa.`,
      usuario_demo: `Acceso de demostración limitado. Solo puedes hacer preguntas generales sobre el funcionamiento de la app.`,
    };

    const systemPrompt = `Eres "Asistente SMART", el asistente interno de SMART-GESTION.
${normasConfig ? `\nCONFIGURACIÓN EMPRESA:\n- ${normasConfig.empresa_nombre || ''} | ${normasConfig.empresa_sector || ''}\nENTORNO: ${normasConfig.entorno_descripcion || ''}\nNORMAS: ${normasConfig.normas_internas || ''}\nDIRECTRICES: ${normasConfig.directrices_comportamiento || ''}` : ''}

IMPORTANTE — Vocabulario del sistema: La plataforma distingue dos conceptos distintos:
- USUARIO: es la cuenta de acceso al sistema (email, contraseña, rol de acceso como admin/gerencia/jefe_obra/operario...).
- TRABAJADOR: es la ficha laboral de la empresa (DNI, categoría profesional, historial de horas). Un usuario puede o no tener una ficha de Trabajador vinculada.
Cuando alguien pregunte por fichas laborales, usa el término TRABAJADOR. Cuando pregunte por accesos al sistema, usa el término USUARIO.
Categorías profesionales de Trabajador: oficial_primera, oficial_segunda, peon, encargado, tecnico_solar, administrativo, subcontrata, temporal.

USUARIO: ${user.full_name || user.email} | Rol: ${user.role} (${rolesDesc[user.role] || user.role}) | ID: ${user.id}
${usuariosInfo.length > 0 ? `\nUSUARIOS SISTEMA (${usuariosInfo.length}):\n${usuariosInfo.map(u => `- ${u.nombre || u.email} (${u.email}) → ${u.rol}`).join('\n')}` : ''}

DATOS TIEMPO REAL: ${JSON.stringify(contextData)}

CAPACIDADES DE ESTE USUARIO:
${roleCapabilities[user.role] || 'Acceso estándar a funciones básicas.'}

REGLAS ESTRICTAS:
1. SOLO responde preguntas y ejecutas tareas que estén dentro del alcance del rol "${user.role}" descrito arriba.
2. Si el usuario pregunta algo fuera de su rol, responde: "No tengo acceso a esa información con tu nivel de acceso."
3. Usa SOLO las herramientas disponibles para obtener datos reales — NUNCA inventes datos.
4. Confirma antes de crear/modificar registros.
5. Escala a Gerencia (nota urgente) cualquier error o incidencia no resuelta.
6. Responde siempre en español, tono profesional y conciso.
7. SOLO respondes sobre la app SMART-GESTION y sus datos. Rechaza cualquier pregunta ajena a la app.
8. GERENCIA es la máxima autoridad — reporta incidencias graves siempre.`;

    // ── Cliente Anthropic con API key de la plataforma ───────────────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      // Fallback: InvokeLLM sin tool use
      const llmMessages = (messages || []).map(m => ({ role: m.role, content: m.content }));
      const resp = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: llmMessages.length > 0 ? llmMessages[llmMessages.length - 1].content : 'Hola',
        system_prompt: systemPrompt,
        model: 'claude_sonnet_4_6',
      });
      return Response.json({ reply: resp, role: 'assistant' });
    }

    const anthropic = new Anthropic({ apiKey });
    const tools = filtrarTools(user);

    // ── Construir historial de mensajes para Claude ───────────────────────────
    const claudeMessages = (messages || []).map(m => ({ role: m.role, content: m.content }));
    if (claudeMessages.length === 0) claudeMessages.push({ role: 'user', content: 'Hola' });

    // ── Bucle agentico: ejecutar tools hasta obtener respuesta final ─────────
    let iteraciones = 0;
    const MAX_ITER = 5;

    while (iteraciones < MAX_ITER) {
      iteraciones++;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages: claudeMessages,
      });

      // Si el modelo terminó sin tools → devolver respuesta
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        return Response.json({ reply: textBlock?.text || '', role: 'assistant' });
      }

      // Si el modelo pide tool_use → ejecutar y continuar
      if (response.stop_reason === 'tool_use') {
        // Añadir respuesta del asistente al historial
        claudeMessages.push({ role: 'assistant', content: response.content });

        // Ejecutar cada tool call en paralelo
        const toolCalls = response.content.filter(b => b.type === 'tool_use');
        const toolResults = await Promise.all(toolCalls.map(async (toolCall) => {
          let result;
          try {
            const resp = await base44.functions.invoke('asistenteHerramientas', {
              tool_name: toolCall.name,
              tool_input: toolCall.input || {},
            });
            result = JSON.stringify(resp?.result || resp?.data?.result || resp?.data || resp || {});
          } catch (err) {
            result = JSON.stringify({ error: err.message });
          }
          return { type: 'tool_result', tool_use_id: toolCall.id, content: result };
        }));

        claudeMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Cualquier otro stop_reason → extraer texto si hay
      const textBlock = response.content.find(b => b.type === 'text');
      return Response.json({ reply: textBlock?.text || 'No pude completar la respuesta.', role: 'assistant' });
    }

    return Response.json({ reply: 'He alcanzado el límite de operaciones. Por favor, reformula tu pregunta.', role: 'assistant' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});