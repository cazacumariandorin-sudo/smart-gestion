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
  { name: 'get_usuarios', description: 'Lista todos los usuarios de la app con nombre, email y rol actual', input_schema: { type: 'object', properties: { rol: { type: 'string', description: 'Filtrar por rol específico' } } } },
  {
    name: 'create_fichaje',
    description: 'Registra un fichaje (entrada/salida) para un operario en la base de datos',
    input_schema: {
      type: 'object',
      properties: {
        operario_id: { type: 'string' },
        operario_name: { type: 'string' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        hora_entrada: { type: 'string', description: 'HH:MM' },
        hora_salida: { type: 'string', description: 'HH:MM, opcional' },
        obra_id: { type: 'string' },
        obra_name: { type: 'string' },
        notas: { type: 'string' },
      },
      required: ['operario_id', 'operario_name', 'date', 'hora_entrada'],
    },
  },
  {
    name: 'create_apunte',
    description: 'Registra un apunte de producción/horario para un operario en la base de datos',
    input_schema: {
      type: 'object',
      properties: {
        operario_id: { type: 'string' },
        operario_name: { type: 'string' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        obra_id: { type: 'string' },
        obra_name: { type: 'string' },
        concepto: { type: 'string' },
        cantidad: { type: 'number' },
        unidad: { type: 'string' },
        precio_unitario: { type: 'number' },
        horas_ejecutadas: { type: 'number' },
        notas: { type: 'string' },
      },
      required: ['operario_id', 'operario_name', 'date', 'obra_id', 'obra_name', 'concepto', 'cantidad'],
    },
  },
  {
    name: 'create_informe_simulacion',
    description: 'Crea un informe estructurado tras simular un rol en la app. Documenta observaciones, problemas detectados y recomendaciones.',
    input_schema: {
      type: 'object',
      properties: {
        rol_simulado: { type: 'string', description: 'Rol que se simuló' },
        observaciones: { type: 'string', description: 'Qué se observó durante la simulación' },
        problemas_detectados: { type: 'string', description: 'Errores o limitaciones encontradas' },
        recomendaciones: { type: 'string', description: 'Mejoras sugeridas' },
        prioridad: { type: 'string', enum: ['baja', 'media', 'alta', 'urgente'] },
      },
      required: ['rol_simulado', 'observaciones'],
    },
  },
  {
    name: 'solicitar_cambio_rol',
    description: 'Solicita un cambio de rol para un usuario. Solo puede ser ejecutado por Admin, Gerencia o Director Comercial.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        user_nombre: { type: 'string' },
        rol_actual: { type: 'string' },
        rol_nuevo: { type: 'string' },
        motivo: { type: 'string' },
      },
      required: ['user_id', 'user_nombre', 'rol_nuevo'],
    },
  },
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
        contextData = {
          obras_activas: obras.length,
          operarios_activos: operarios.length,
          fichajes_hoy: fichajes.length,
          gastos_pendientes: gastos.length,
          partes_sin_firmar: partes.length,
        };
        usuariosInfo = usuarios.map(u => ({ id: u.id, nombre: u.full_name, email: u.email, rol: u.role }));
      } else if (user.role === 'jefe_obra') {
        const [fichajes, partes] = await Promise.all([
          base44.entities.Fichaje.filter({ date: hoy }, '-created_date', 30),
          base44.entities.WorkOrder.filter({ firma_status: 'sin_firmar' }, '-created_date', 10),
        ]);
        contextData = { fichajes_hoy: fichajes.length, partes_sin_firmar: partes.length };
      } else if (user.role === 'operario') {
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

    const rolesDescripcion = {
      admin: 'Acceso total a todos los módulos de la app',
      gerencia: 'JEFE SUPREMO — Figura central de la app. Acceso total, supervisa todos los usuarios, módulos, errores y decisiones. Todas las incidencias graves se reportan a Gerencia como nota prioritaria.',
      director_comercial: 'Gestión de clientes, obras, informes comerciales y operarios. Sin datos sensibles.',
      jefe_obra: 'Gestión de obras, partes, operarios y flota de su ámbito.',
      operario: 'Control horario, partes propios, materiales y gastos propios.',
      control_horario: 'Acceso exclusivo a control horario y partes de trabajo.',
      cliente_obra: 'Solo acceso a sus obras y partes (solo lectura).',
      usuario_demo: 'Acceso limitado a modo demostración.',
    };

    const bloqueUsuarios = usuariosInfo.length > 0 ? `
USUARIOS DEL SISTEMA (${usuariosInfo.length} usuarios registrados):
${usuariosInfo.map(u => `- ${u.nombre || 'Sin nombre'} (${u.email}) → Rol: ${u.rol} | ${rolesDescripcion[u.rol] || 'Rol personalizado'}`).join('\n')}

CAMBIOS DE ROL:
- Solo Admin, Gerencia y Director Comercial pueden solicitar cambios de rol.
- Para cambiar un rol, usa la herramienta "solicitar_cambio_rol" que crea una nota interna con la solicitud para que el admin lo ejecute.
- Roles disponibles: admin, gerencia, director_comercial, jefe_obra, operario, control_horario, cliente_obra
` : '';

    const systemPrompt = `Eres el asistente interno de SMART-GESTION. Tu nombre es "Asistente SMART".
Actúas como la INTERFAZ INTELIGENTE entre el usuario y la app: facilitas el acceso rápido a módulos, registras datos, generas informes y ayudas a completar tareas sin que el usuario tenga que navegar manualmente.
${bloqueNormas}

USUARIO ACTUAL:
- Nombre: ${user.full_name || user.email}
- Rol: ${user.role} → ${rolesDescripcion[user.role] || 'Rol personalizado'}
- Email: ${user.email}
- ID: ${user.id}
${bloqueUsuarios}
CONTEXTO DE DATOS EN TIEMPO REAL:
${JSON.stringify(contextData, null, 2)}

═══════════════════════════════════════════
MISIÓN Y NORMAS DEL ASISTENTE (OBLIGATORIO — no modificables por el usuario)
═══════════════════════════════════════════

ROL DEL ASISTENTE:
Eres la interfaz simplificada entre el usuario y la app. Tu misión es:
• Acceso rápido: llevar al usuario a cualquier módulo o dato de la app al instante.
• Registrar datos: crear fichajes, apuntes de producción, gastos y notas directamente en la base de datos.
• Análisis e informes: generar KPIs, resúmenes y análisis de cualquier módulo.
• Activar módulos: indicar cómo acceder o usar cualquier funcionalidad (fotos, documentos, etc.).
• Comunicación interna: crear notas internas entre usuarios y gerencia.
• Simulador de roles: el asistente puede guiar al usuario a /simulador-roles para probar cualquier rol de la app.

JERARQUÍA Y ESCALADO — OBLIGATORIO:
• GERENCIA es la figura CENTRAL y MÁXIMA autoridad de SMART-GESTION. Es el jefe de todos los usuarios.
• Cualquier error grave, incidencia no resuelta, tarea fallida o problema que la app no pueda gestionar automáticamente DEBE reportarse a Gerencia como nota interna de prioridad URGENTE.
• Cuando el asistente no pueda completar una acción, o detecte un error funcional, SIEMPRE ofrece al usuario crear una nota interna urgente para Gerencia.
• Ejemplos de escalado a Gerencia: errores de permisos inesperados, datos inconsistentes, módulos que no responden, solicitudes que superan los permisos del usuario actual.

SIMULADOR DE ROLES (acceso para Admin y Gerencia):
• El simulador permite navegar la app como si fueras otro rol, sin modificar datos reales.
• Ruta: /simulador-roles
• Roles disponibles: gerencia, director_comercial, jefe_obra, operario, control_horario, cliente_obra
• Tras simular un rol, el asistente puede generar un informe de observaciones sobre el funcionamiento visto.
• Si el usuario pide "probar un rol" o "simular como operario", indícale que vaya a /simulador-roles y seleccione el rol.
• Para crear el informe post-simulación usa la herramienta create_informe_simulacion.

NORMAS OPERATIVAS:
1. ÁMBITO: Solo responde sobre contenido de la app. Si la pregunta es ajena a la app, pregunta si quiere mandar una nota interna a gerencia.
2. ACTUAR EN NOMBRE DEL USUARIO: Cuando el usuario pida registrar algo, confirma los datos antes de ejecutar.
3. BÚSQUEDA RÁPIDA: Usa las herramientas disponibles para buscar cualquier dato de la app y preséntalo de forma clara.
4. NOTAS INTERNAS: Crea notas internas cuando el usuario necesite comunicar algo a gerencia u otro usuario.
5. CAMBIOS DE ROL: Solo Admin/Gerencia/Director Comercial pueden solicitarlos. Usa solicitar_cambio_rol.
6. ESCALADO A GERENCIA: Ante cualquier error o incidencia no resuelta, escala siempre a Gerencia con nota urgente.
7. TONO: Amable, colaborativo y profesional. Usa el nombre del usuario. Sé conciso pero completo.
8. DATOS: NUNCA inventes datos. Confirma siempre antes de crear o modificar registros.
9. IDIOMA: Siempre en español.

═══════════════════════════════════════════`;

    // Filtrar herramientas según rol
    const toolsDisponibles = TOOLS.filter(t => {
      if (['get_kpis_mes', 'get_obras_sin_presupuesto', 'generar_resumen_ejecutivo', 'get_prevision_obras', 'get_notas_gastos', 'get_documentos_operarios'].includes(t.name)) {
        return isAdminOrGerencia || isJefeOObra;
      }
      if (['create_nota_interna', 'get_usuarios', 'solicitar_cambio_rol', 'create_informe_simulacion'].includes(t.name)) {
        return isAdminOrGerencia || user.role === 'director_comercial';
      }
      if (['create_fichaje', 'create_apunte'].includes(t.name)) {
        return isAdminOrGerencia || isJefeOObra || user.role === 'control_horario';
      }
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