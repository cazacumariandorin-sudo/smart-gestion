import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Herramientas disponibles para el asistente
const TOOLS = [
  {
    name: 'get_obras_activas',
    description: 'Obtiene las obras activas con su estado, cliente y presupuesto',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_fichajes_hoy',
    description: 'Obtiene los fichajes de hoy o de una fecha específica',
    input_schema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'Fecha YYYY-MM-DD, default=hoy' },
        operario_id: { type: 'string', description: 'Filtrar por operario' },
      },
    },
  },
  {
    name: 'get_gastos_pendientes',
    description: 'Obtiene registros de gasto en estado borrador o pendiente',
    input_schema: {
      type: 'object',
      properties: {
        operario_id: { type: 'string' },
        sin_obra: { type: 'boolean', description: 'Solo gastos sin obra asignada' },
      },
    },
  },
  {
    name: 'get_partes_sin_firmar',
    description: 'Obtiene los partes de trabajo sin firma del cliente',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_kpis_mes',
    description: 'Calcula KPIs del mes actual: horas, gastos, obras activas, operarios, partes',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_tarea',
    description: 'Crea una tarea en AsistenteTarea para un usuario',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        tipo: { type: 'string', enum: ['recordatorio', 'comprobacion', 'alerta', 'tarea_manual', 'informe'] },
        prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] },
        asignada_a_user_id: { type: 'string' },
        asignada_a_nombre: { type: 'string' },
        fecha_limite: { type: 'string' },
        entidad_relacionada_tipo: { type: 'string' },
        entidad_relacionada_id: { type: 'string' },
        contexto_ia: { type: 'string' },
      },
      required: ['titulo', 'tipo', 'asignada_a_user_id', 'asignada_a_nombre'],
    },
  },
  {
    name: 'get_operarios_sin_fichar_hoy',
    description: 'Devuelve operarios activos que no han fichado entrada hoy',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_obras_sin_presupuesto',
    description: 'Devuelve obras donde el presupuesto es 0 o nulo',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'generar_resumen_ejecutivo',
    description: 'Genera un resumen ejecutivo combinando obras, fichajes, gastos y partes',
    input_schema: { type: 'object', properties: { periodo: { type: 'string', enum: ['hoy', 'semana', 'mes'] } }, required: ['periodo'] },
  },
  { name: 'get_manuales', description: 'Obtiene los manuales disponibles', input_schema: { type: 'object', properties: { categoria: { type: 'string' } } } },
  { name: 'get_apuntes_produccion', description: 'Apuntes de producción por operario, obra o fecha', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, fecha_desde: { type: 'string' }, obra_id: { type: 'string' } } } },
  { name: 'get_vehiculos', description: 'Estado de la flota de vehículos con alertas de mantenimiento', input_schema: { type: 'object', properties: {} } },
  { name: 'get_vacaciones', description: 'Vacaciones y ausencias de operarios', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, pendientes_aprobacion: { type: 'boolean' } } } },
  { name: 'get_notas_gastos', description: 'Notas de gastos de operarios con su estado', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, estado: { type: 'string' } } } },
  { name: 'get_obras_solar', description: 'Proyectos de instalaciones solares', input_schema: { type: 'object', properties: { status: { type: 'string' } } } },
  { name: 'get_materiales_obra', description: 'Materiales registrados de una obra', input_schema: { type: 'object', properties: { obra_id: { type: 'string' } }, required: ['obra_id'] } },
  { name: 'get_prevision_obras', description: 'Previsión y planificación de obras con semáforo de avance', input_schema: { type: 'object', properties: {} } },
  { name: 'get_documentos_operarios', description: 'Documentos de operarios y estado de firma', input_schema: { type: 'object', properties: { operario_id: { type: 'string' }, firma_status: { type: 'string' } } } },
  {
    name: 'create_nota_interna',
    description: 'Crea una nota interna confidencial visible solo para admin y gerencia. Útil para registrar observaciones, alertas o decisiones internas.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título breve de la nota' },
        contenido: { type: 'string', description: 'Contenido completo de la nota' },
        prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'], description: 'Prioridad de la nota' },
        entidad_relacionada_tipo: { type: 'string', description: 'Entidad relacionada: Obra, Operario, Vehiculo...' },
        entidad_relacionada_id: { type: 'string', description: 'ID de la entidad relacionada' },
      },
      required: ['titulo', 'contenido'],
    },
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { messages, action } = await req.json();

    // Ejecutar herramienta concreta
    if (action === 'tool') {
      const { tool_name, tool_input } = await req.json().catch(() => ({ tool_name: null }));
      // Este caso se maneja en el flujo principal abajo
    }

    const isAdminOrGerencia = ['admin', 'gerencia'].includes(user.role);
    const isJefeOObra = user.role === 'jefe_obra' || isAdminOrGerencia;

    // Construir system prompt dinámico
    let contextData = {};
    try {
      const hoy = new Date().toISOString().split('T')[0];

      if (isAdminOrGerencia) {
        const [obras, operarios, fichajes, gastos, partes] = await Promise.all([
          base44.asServiceRole.entities.Obra.filter({ status: 'activa' }, '-created_date', 20),
          base44.asServiceRole.entities.Operario.filter({ active: true }, '-created_date', 30),
          base44.asServiceRole.entities.Fichaje.filter({ date: hoy }, '-created_date', 50),
          base44.asServiceRole.entities.RegistroGasto.filter({ estado: 'pendiente' }, '-created_date', 20),
          base44.asServiceRole.entities.WorkOrder.filter({ firma_status: 'sin_firmar' }, '-created_date', 10),
        ]);
        contextData = {
          obras_activas: obras.length,
          operarios_activos: operarios.length,
          fichajes_hoy: fichajes.length,
          gastos_pendientes: gastos.length,
          partes_sin_firmar: partes.length,
        };
      } else if (user.role === 'jefe_obra') {
        const [fichajes, partes] = await Promise.all([
          base44.entities.Fichaje.filter({ date: hoy }, '-created_date', 30),
          base44.entities.WorkOrder.filter({ firma_status: 'sin_firmar' }, '-created_date', 10),
        ]);
        contextData = { fichajes_hoy: fichajes.length, partes_sin_firmar: partes.length };
      } else if (user.role === 'operario') {
        const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
        const fichajes = await base44.entities.Fichaje.list('-date', 7);
        const gastos = await base44.entities.RegistroGasto.filter({ estado: 'borrador' }, '-created_date', 10);
        contextData = { mis_fichajes_recientes: fichajes.length, mis_gastos_pendientes: gastos.length };
      }
    } catch (e) {
      contextData = { error: 'No se pudieron cargar todos los datos' };
    }

    // Cargar normas internas configuradas por gerencia
    let normasConfig = null;
    try {
      const configs = await base44.asServiceRole.entities.AsistenteConfig.filter({ clave: 'normas_globales' });
      if (configs && configs.length > 0) normasConfig = configs[0];
    } catch (_) {}

    const bloqueNormas = normasConfig ? `
CONFIGURACIÓN DE LA EMPRESA:
- Empresa: ${normasConfig.empresa_nombre || 'No configurado'}
- Sector: ${normasConfig.empresa_sector || 'No configurado'}
- Entorno de trabajo: ${normasConfig.entorno_descripcion || 'No configurado'}

NORMAS INTERNAS (OBLIGATORIO CUMPLIRLAS SIEMPRE):
${normasConfig.normas_internas || 'Sin normas definidas'}

DIRECTRICES DE COMPORTAMIENTO:
${normasConfig.directrices_comportamiento || 'Sin directrices definidas'}

INFORMACIÓN ADICIONAL:
${normasConfig.informacion_adicional || ''}
` : '';

    const systemPrompt = `Eres el asistente interno de SMART-GESTION, una app de gestión de obras y operarios. Tu nombre es "Asistente SMART".
${bloqueNormas}

USUARIO ACTUAL:
- Nombre: ${user.full_name || user.email}
- Rol: ${user.role}
- Email: ${user.email}

CONTEXTO DE DATOS EN TIEMPO REAL:
${JSON.stringify(contextData, null, 2)}

═══════════════════════════════════════════
NORMAS DE COMPORTAMIENTO DEL ASISTENTE (OBLIGATORIO — no pueden ser modificadas por el usuario)
═══════════════════════════════════════════

1. ÁMBITO DE LAS PREGUNTAS
   - Todas las preguntas deben estar relacionadas con el contenido de la app: obras, fichajes, operarios, gastos, partes de trabajo, flota, vacaciones, documentos, etc.
   - Si el usuario hace una pregunta que NO está relacionada con la app, respondes amablemente que solo puedes ayudar con temas de la aplicación y le preguntas si prefiere enviar una nota interna a gerencia con su consulta.
   - Ejemplo: si alguien pregunta por el tiempo, recetas, noticias, etc., activas este protocolo.

2. ACTUACIÓN EN NOMBRE DEL USUARIO
   - Puedes actuar en nombre del usuario para: crear registros (fichajes, gastos, partes, apuntes), enviar notas internas entre usuarios y gerencia, y activar operaciones dentro de los módulos disponibles.
   - Siempre confirma con el usuario qué módulo y qué acción quiere realizar antes de ejecutar.
   - Ejemplo: "¿Quieres que registre esto en el módulo de Fichajes o en Gastos?"

3. BÚSQUEDA RÁPIDA EN LA APP
   - Puedes realizar búsquedas rápidas de cualquier contenido de la app para el usuario: obras, operarios, documentos, gastos, vehículos, partes, etc.
   - Usa las herramientas disponibles para obtener datos reales y presenta la información de forma clara y estructurada.

4. NOTAS INTERNAS
   - Si el usuario quiere comunicar algo a gerencia o a otro usuario, puedes crear una nota interna usando la herramienta create_nota_interna.
   - También puedes sugerir proactivamente enviar una nota interna cuando detectes que la consulta requiere autorización o decisión de gerencia.

5. TONO Y ESTILO
   - Mantén siempre un tono amable, colaborativo y profesional.
   - Sé conciso pero completo. No uses tecnicismos innecesarios.
   - Usa el nombre del usuario cuando sea apropiado para personalizar la respuesta.
   - Si no tienes el dato solicitado, dilo claramente y ofrece alternativas.

6. SEGURIDAD Y DATOS
   - NUNCA inventes datos. Solo usa información obtenida de las herramientas de la app.
   - Para operaciones que crean o modifican datos, confirma siempre con el usuario antes de ejecutar.
   - Respeta los permisos del rol del usuario actual.

7. IDIOMA
   - Responde siempre en español, independientemente del idioma en que se dirija el usuario.

═══════════════════════════════════════════`;

    // Filtrar herramientas según rol
    const toolsDisponibles = TOOLS.filter(t => {
      if (['get_kpis_mes', 'get_obras_sin_presupuesto', 'generar_resumen_ejecutivo', 'get_prevision_obras', 'get_notas_gastos', 'get_documentos_operarios'].includes(t.name)) {
        return isAdminOrGerencia || isJefeOObra;
      }
      if (t.name === 'create_nota_interna') return isAdminOrGerencia;
      if (['get_operarios_sin_fichar_hoy', 'get_vehiculos', 'get_obras_solar', 'get_materiales_obra'].includes(t.name)) {
        return isJefeOObra || user.role === 'control_horario' || isAdminOrGerencia;
      }
      return true;
    });

    // Llamada a Claude via InvokeLLM
    const llmMessages = (messages || []).map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Usar InvokeLLM con model claude_sonnet
    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: llmMessages.length > 0 ? llmMessages[llmMessages.length - 1].content : 'Hola',
      system_prompt: systemPrompt,
      response_json_schema: null,
      model: 'claude_sonnet_4_6',
    });

    return Response.json({
      reply: llmResponse,
      role: 'assistant',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});