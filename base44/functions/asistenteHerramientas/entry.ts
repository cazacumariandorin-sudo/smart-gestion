import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Matriz declarativa de permisos de herramientas ───────────────────────────
const TOOL_ROLES = {
  get_obras_activas:            ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'cliente_obra'],
  get_fichajes_hoy:             ['admin', 'gerencia', 'jefe_obra', 'control_horario', 'operario'],
  get_gastos_pendientes:        ['admin', 'gerencia', 'jefe_obra', 'director_comercial', 'operario'],
  get_partes_sin_firmar:        ['admin', 'gerencia', 'director_comercial', 'jefe_obra'],
  get_kpis_mes:                 ['admin', 'gerencia', 'director_comercial', 'jefe_obra'],
  get_operarios_sin_fichar_hoy: ['admin', 'gerencia', 'jefe_obra', 'control_horario'],
  get_obras_sin_presupuesto:    ['admin', 'gerencia', 'director_comercial'],
  generar_resumen_ejecutivo:    ['admin', 'gerencia', 'director_comercial', 'jefe_obra'],
  get_apuntes_produccion:       ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'control_horario', 'operario'],
  get_manuales:                 ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'control_horario', 'operario', 'cliente_obra', 'usuario_demo'],
  get_vehiculos:                ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'control_horario'],
  get_vacaciones:               ['admin', 'gerencia', 'director_comercial', 'jefe_obra'],
  get_notas_gastos:             ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'operario'],
  get_obras_solar:              ['admin', 'gerencia', 'director_comercial', 'jefe_obra'],
  get_materiales_obra:          ['admin', 'gerencia', 'director_comercial', 'jefe_obra'],
  get_prevision_obras:          ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'cliente_obra'],
  get_documentos_operarios:     ['admin', 'gerencia', 'jefe_obra'],
  get_usuarios:                 ['admin', 'gerencia', 'director_comercial'],
  create_fichaje:               ['admin', 'gerencia', 'jefe_obra', 'control_horario'],
  create_apunte:                ['admin', 'gerencia', 'jefe_obra', 'control_horario'],
  create_tarea:                 ['admin', 'gerencia', 'director_comercial', 'jefe_obra'],
  create_nota_interna:          ['admin', 'gerencia'],
  solicitar_cambio_rol:         ['admin', 'gerencia', 'director_comercial'],
  create_informe_simulacion:    ['admin', 'gerencia'],
};

function tienePermiso(role, toolName) {
  const roles = TOOL_ROLES[toolName];
  if (!roles) return false;
  return roles.includes(role);
}

Deno.serve(async (req) => {
  const tool_name_ref = { value: 'desconocida' };
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tool_name, tool_input = {} } = await req.json();
    tool_name_ref.value = tool_name;

    // ── Guard de permisos unificado ───────────────────────────────────────────
    if (!tienePermiso(user.role, tool_name)) {
      return Response.json({ error: `Sin permisos para "${tool_name}" con rol "${user.role}"` }, { status: 403 });
    }

    const hoy = new Date().toISOString().split('T')[0];
    let result = {};

    // ── Obras civiles ──────────────────────────────────────────────────────────
    if (tool_name === 'get_obras_activas') {
      const obras = await base44.asServiceRole.entities.Obra.filter({ status: 'activa' }, '-created_date', 30);
      result = { obras: obras.map(o => ({ id: o.id, name: o.name, client_name: o.client_name, budget: o.budget, end_date: o.end_date, status: o.status })) };
    }

    // ── Fichajes ───────────────────────────────────────────────────────────────
    else if (tool_name === 'get_fichajes_hoy') {
      const fecha = tool_input.fecha || hoy;
      const query = { date: fecha };
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      // Operario solo ve sus propios fichajes
      if (user.role === 'operario') query.operario_id = user.id;
      const fichajes = await base44.asServiceRole.entities.Fichaje.filter(query, '-created_date', 50);
      result = { fecha, total: fichajes.length, fichajes: fichajes.map(f => ({ operario: f.operario_name, entrada: f.hora_entrada, salida: f.hora_salida, obra: f.obra_name, horas: f.horas_trabajadas })) };
    }

    // ── Gastos ─────────────────────────────────────────────────────────────────
    else if (tool_name === 'get_gastos_pendientes') {
      const query = { estado: 'pendiente' };
      if (user.role === 'operario') query.operario_id = user.id;
      else if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      const gastos = await base44.asServiceRole.entities.RegistroGasto.filter(query, '-created_date', 30);
      result = { total: gastos.length, importe_total: gastos.reduce((s, g) => s + (g.importe || 0), 0), gastos: gastos.map(g => ({ id: g.id, concepto: g.concepto, importe: g.importe, operario: g.operario_name, obra: g.obra_name })) };
    }

    // ── Partes de trabajo ──────────────────────────────────────────────────────
    else if (tool_name === 'get_partes_sin_firmar') {
      const partes = await base44.asServiceRole.entities.WorkOrder.list('-date', 50);
      const sinFirmar = partes.filter(p => p.firma_status !== 'firmado_ambos');
      result = { total: sinFirmar.length, partes: sinFirmar.map(p => ({ id: p.id, numero: p.order_number, proyecto: p.project, fecha: p.date, firma_status: p.firma_status })) };
    }

    // ── KPIs mes ───────────────────────────────────────────────────────────────
    else if (tool_name === 'get_kpis_mes') {
      const mesInicio = hoy.substring(0, 7) + '-01';
      const [fichajes, gastos, obras, partes] = await Promise.all([
        base44.asServiceRole.entities.Fichaje.list('-date', 200),
        base44.asServiceRole.entities.RegistroGasto.list('-created_date', 200),
        base44.asServiceRole.entities.Obra.filter({ status: 'activa' }, '-created_date', 50),
        base44.asServiceRole.entities.WorkOrder.list('-date', 100),
      ]);
      const fichajesMes = fichajes.filter(f => f.date >= mesInicio);
      const gastosMes = gastos.filter(g => g.fecha_documento >= mesInicio);
      result = {
        mes: hoy.substring(0, 7),
        total_horas: fichajesMes.reduce((s, f) => s + (f.horas_trabajadas || 0), 0).toFixed(1),
        total_gastos: gastosMes.reduce((s, g) => s + (g.importe || 0), 0).toFixed(2),
        obras_activas: obras.length,
        partes_completados: partes.filter(p => p.status === 'completado').length,
        partes_pendientes_firma: partes.filter(p => p.firma_status !== 'firmado_ambos').length,
      };
    }

    // ── Operarios sin fichar ───────────────────────────────────────────────────
    else if (tool_name === 'get_operarios_sin_fichar_hoy') {
      const [operarios, fichajes] = await Promise.all([
        base44.asServiceRole.entities.Operario.filter({ active: true }, '-created_date', 100),
        base44.asServiceRole.entities.Fichaje.filter({ date: hoy }, '-created_date', 100),
      ]);
      const fichadosIds = new Set(fichajes.map(f => f.operario_id));
      const sinFichar = operarios.filter(o => !fichadosIds.has(o.id));
      result = { total_sin_fichar: sinFichar.length, operarios: sinFichar.map(o => ({ id: o.id, name: o.name })) };
    }

    // ── Obras sin presupuesto ──────────────────────────────────────────────────
    else if (tool_name === 'get_obras_sin_presupuesto') {
      const obras = await base44.asServiceRole.entities.Obra.list('-created_date', 100);
      const sinPres = obras.filter(o => !o.budget || o.budget === 0);
      result = { total: sinPres.length, obras: sinPres.map(o => ({ id: o.id, name: o.name, client_name: o.client_name, status: o.status })) };
    }

    // ── Resumen ejecutivo ──────────────────────────────────────────────────────
    else if (tool_name === 'generar_resumen_ejecutivo') {
      const periodo = tool_input.periodo || 'mes';
      let fechaDesde = hoy;
      if (periodo === 'semana') { const d = new Date(); d.setDate(d.getDate() - 7); fechaDesde = d.toISOString().split('T')[0]; }
      else if (periodo === 'mes') { fechaDesde = hoy.substring(0, 7) + '-01'; }
      const [fichajes, gastos, obras, partes, operarios] = await Promise.all([
        base44.asServiceRole.entities.Fichaje.list('-date', 200),
        base44.asServiceRole.entities.RegistroGasto.list('-created_date', 200),
        base44.asServiceRole.entities.Obra.filter({ status: 'activa' }, '-created_date', 50),
        base44.asServiceRole.entities.WorkOrder.list('-date', 100),
        base44.asServiceRole.entities.Operario.filter({ active: true }, '-created_date', 50),
      ]);
      const fFich = fichajes.filter(f => f.date >= fechaDesde);
      const fGasto = gastos.filter(g => g.fecha_documento >= fechaDesde);
      result = {
        periodo, fecha_desde: fechaDesde,
        resumen: {
          obras_activas: obras.length, operarios_activos: operarios.length,
          total_horas: fFich.reduce((s, f) => s + (f.horas_trabajadas || 0), 0).toFixed(1),
          total_gastos_eur: fGasto.reduce((s, g) => s + (g.importe || 0), 0).toFixed(2),
          partes_completados: partes.filter(p => p.status === 'completado').length,
          partes_pendientes_firma: partes.filter(p => p.firma_status !== 'firmado_ambos').length,
          obras_sin_presupuesto: obras.filter(o => !o.budget || o.budget === 0).length,
        },
      };
    }

    // ── Manuales ───────────────────────────────────────────────────────────────
    else if (tool_name === 'get_manuales') {
      const manuales = await base44.asServiceRole.entities.Manual.list('-created_date', 50);
      const filtrados = tool_input.categoria ? manuales.filter(m => m.categoria === tool_input.categoria) : manuales;
      result = { total: filtrados.length, manuales: filtrados.map(m => ({ id: m.id, titulo: m.title || m.titulo || m.name, categoria: m.categoria, descripcion: m.description || m.descripcion, fecha: m.created_date })) };
    }

    // ── Apuntes de producción ──────────────────────────────────────────────────
    else if (tool_name === 'get_apuntes_produccion') {
      const query = {};
      if (user.role === 'operario') query.operario_id = user.id;
      else if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      if (tool_input.obra_id) query.obra_id = tool_input.obra_id;
      const apuntes = await base44.asServiceRole.entities.ApunteHorario.filter(query, '-date', 50);
      const filtrados = tool_input.fecha_desde ? apuntes.filter(a => a.date >= tool_input.fecha_desde) : apuntes;
      result = {
        total: filtrados.length,
        total_horas: filtrados.reduce((s, a) => s + (a.horas_ejecutadas || 0), 0).toFixed(1),
        total_importe: filtrados.reduce((s, a) => s + (a.total || 0), 0).toFixed(2),
        apuntes: filtrados.map(a => ({ id: a.id, operario: a.operario_name, obra: a.obra_name, fecha: a.date, concepto: a.concepto, cantidad: a.cantidad, unidad: a.unidad, horas: a.horas_ejecutadas, total: a.total })),
      };
    }

    // ── Flota / Vehículos ──────────────────────────────────────────────────────
    else if (tool_name === 'get_vehiculos') {
      const vehiculos = await base44.asServiceRole.entities.Vehiculo.list('-created_date', 50);
      const hoyDate = new Date();
      result = {
        total: vehiculos.length,
        vehiculos: vehiculos.map(v => {
          const alertas = [];
          if (v.itv_fecha && new Date(v.itv_fecha) < new Date(hoyDate.getTime() + 30 * 86400000)) alertas.push('ITV próxima a caducar');
          return { id: v.id, matricula: v.matricula, modelo: v.modelo, asignado_a: v.asignado_a, km_actuales: v.km_actuales, estado_motor: v.estado_motor, itv_fecha: v.itv_fecha, alertas };
        }),
      };
    }

    // ── Vacaciones ─────────────────────────────────────────────────────────────
    else if (tool_name === 'get_vacaciones') {
      const query = {};
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      if (tool_input.pendientes_aprobacion) query.aprobado = false;
      const vacaciones = await base44.asServiceRole.entities.Vacacion.filter(query, '-fecha_inicio', 50);
      result = { total: vacaciones.length, vacaciones: vacaciones.map(v => ({ id: v.id, operario: v.operario_name, tipo: v.tipo, fecha_inicio: v.fecha_inicio, fecha_fin: v.fecha_fin, dias: v.dias, aprobado: v.aprobado })) };
    }

    // ── Notas de gastos ────────────────────────────────────────────────────────
    else if (tool_name === 'get_notas_gastos') {
      const query = {};
      if (user.role === 'operario') query.operario_id = user.id;
      else if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      if (tool_input.estado) query.estado = tool_input.estado;
      const notas = await base44.asServiceRole.entities.NotaGasto.filter(query, '-created_date', 30);
      result = { total: notas.length, total_importe: notas.reduce((s, n) => s + (n.total_importes || 0), 0).toFixed(2), notas: notas.map(n => ({ id: n.id, numero: n.numero_nota, operario: n.operario_name, periodo: n.periodo_mes, estado: n.estado, total: n.total_importes, num_registros: n.num_registros })) };
    }

    // ── Solar ──────────────────────────────────────────────────────────────────
    else if (tool_name === 'get_obras_solar') {
      const query = {};
      if (tool_input.status) query.status = tool_input.status;
      const obras = await base44.asServiceRole.entities.SolarObra.filter(query, '-created_date', 30);
      result = { total: obras.length, obras: obras.map(o => ({ id: o.id, name: o.name, client_name: o.client_name, status: o.status, potencia_kw: o.potencia_kw, budget: o.budget, start_date: o.start_date, end_date: o.end_date })) };
    }

    // ── Materiales de obra ─────────────────────────────────────────────────────
    else if (tool_name === 'get_materiales_obra') {
      if (!tool_input.obra_id) return Response.json({ error: 'obra_id requerido' }, { status: 400 });
      const materiales = await base44.asServiceRole.entities.ObraMaterial.filter({ obra_id: tool_input.obra_id }, '-created_date', 50);
      result = { total: materiales.length, coste_total: materiales.reduce((s, m) => s + (m.precio_total || 0), 0).toFixed(2), materiales: materiales.map(m => ({ id: m.id, nombre: m.nombre, tipo: m.tipo, cantidad: m.cantidad, unidad: m.unidad, precio_total: m.precio_total, proveedor: m.proveedor })) };
    }

    // ── Previsión de obras ─────────────────────────────────────────────────────
    else if (tool_name === 'get_prevision_obras') {
      const previsiones = await base44.asServiceRole.entities.PrevisionObra.list('-created_date', 30);
      result = { total: previsiones.length, previsiones: previsiones.map(p => ({ id: p.id, obra_name: p.obra_name, status: p.status, status_semaforo: p.status_semaforo, horas_previstas: p.horas_totales_previstas, horas_reales: p.horas_reales_acumuladas, desviacion: p.desviacion_horas, porcentaje_avance: p.porcentaje_avance_horas, fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin })) };
    }

    // ── Documentos de operarios ────────────────────────────────────────────────
    else if (tool_name === 'get_documentos_operarios') {
      const query = {};
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      const docs = await base44.asServiceRole.entities.OperarioDoc.filter(query, '-created_date', 50);
      result = { total: docs.length, docs: docs.map(d => ({ id: d.id, operario: d.operario_name, titulo: d.title, tipo: d.tipo, firmado: d.firmado, expiry_date: d.expiry_date })) };
    }

    // ── Usuarios del sistema ───────────────────────────────────────────────────
    else if (tool_name === 'get_usuarios') {
      const usuarios = await base44.asServiceRole.entities.User.list('-created_date', 100);
      const rolesDescripcion = { admin: 'Acceso total', gerencia: 'Gestión completa', director_comercial: 'Gestión comercial', jefe_obra: 'Gestión de obra', operario: 'Operario de campo', control_horario: 'Control de presencia', cliente_obra: 'Cliente (solo lectura)', usuario_demo: 'Demo' };
      const filtrados = tool_input.rol ? usuarios.filter(u => u.role === tool_input.rol) : usuarios;
      result = { total: filtrados.length, usuarios: filtrados.map(u => ({ id: u.id, nombre: u.full_name, email: u.email, rol: u.role, descripcion_rol: rolesDescripcion[u.role] || u.role, fecha_alta: u.created_date })) };
    }

    // ── Crear fichaje ──────────────────────────────────────────────────────────
    else if (tool_name === 'create_fichaje') {
      const fichaje = await base44.asServiceRole.entities.Fichaje.create({
        operario_id: tool_input.operario_id,
        operario_name: tool_input.operario_name,
        date: tool_input.date,
        hora_entrada: tool_input.hora_entrada,
        hora_salida: tool_input.hora_salida || null,
        obra_id: tool_input.obra_id || null,
        obra_name: tool_input.obra_name || null,
        notas: tool_input.notas || null,
        horas_trabajadas: tool_input.hora_salida ? (() => {
          const [eh, em] = tool_input.hora_entrada.split(':').map(Number);
          const [sh, sm] = tool_input.hora_salida.split(':').map(Number);
          return parseFloat(((sh * 60 + sm - eh * 60 - em) / 60).toFixed(2));
        })() : null,
      });
      result = { success: true, fichaje_id: fichaje.id, operario: tool_input.operario_name, fecha: tool_input.date, entrada: tool_input.hora_entrada, salida: tool_input.hora_salida || 'Sin registrar' };
    }

    // ── Crear apunte de producción ─────────────────────────────────────────────
    else if (tool_name === 'create_apunte') {
      const total = (tool_input.cantidad || 0) * (tool_input.precio_unitario || 0);
      const apunte = await base44.asServiceRole.entities.ApunteHorario.create({
        operario_id: tool_input.operario_id,
        operario_name: tool_input.operario_name,
        date: tool_input.date,
        obra_id: tool_input.obra_id,
        obra_name: tool_input.obra_name,
        concepto: tool_input.concepto,
        cantidad: tool_input.cantidad,
        unidad: tool_input.unidad || 'ud',
        precio_unitario: tool_input.precio_unitario || 0,
        total,
        horas_ejecutadas: tool_input.horas_ejecutadas || null,
        notas: tool_input.notas || null,
      });
      result = { success: true, apunte_id: apunte.id, operario: tool_input.operario_name, obra: tool_input.obra_name, concepto: tool_input.concepto, total };
    }

    // ── Crear tarea ────────────────────────────────────────────────────────────
    else if (tool_name === 'create_tarea') {
      const tarea = await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: tool_input.titulo,
        descripcion: tool_input.descripcion || '',
        tipo: tool_input.tipo || 'tarea_manual',
        prioridad: tool_input.prioridad || 'media',
        estado: 'pendiente',
        asignada_a_user_id: tool_input.asignada_a_user_id,
        asignada_a_nombre: tool_input.asignada_a_nombre,
        fecha_limite: tool_input.fecha_limite || null,
        entidad_relacionada_tipo: tool_input.entidad_relacionada_tipo || null,
        entidad_relacionada_id: tool_input.entidad_relacionada_id || null,
        contexto_ia: tool_input.contexto_ia || null,
        creada_por: 'asistente_ia',
      });
      result = { success: true, tarea_id: tarea.id, titulo: tarea.titulo };
    }

    // ── Nota interna ───────────────────────────────────────────────────────────
    else if (tool_name === 'create_nota_interna') {
      const nota = await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: tool_input.titulo,
        descripcion: tool_input.contenido,
        tipo: 'nota_interna',
        prioridad: tool_input.prioridad || 'media',
        estado: 'pendiente',
        asignada_a_user_id: user.id,
        asignada_a_nombre: user.full_name || user.email,
        asignada_a_rol: user.role,
        entidad_relacionada_tipo: tool_input.entidad_relacionada_tipo || null,
        entidad_relacionada_id: tool_input.entidad_relacionada_id || null,
        contexto_ia: 'Nota interna creada por el asistente IA',
        creada_por: 'asistente_ia',
        solo_gerencia: true,
      });
      result = { success: true, nota_id: nota.id, titulo: nota.titulo };
    }

    // ── Informe post-simulación ────────────────────────────────────────────────
    else if (tool_name === 'create_informe_simulacion') {
      const contenido = `INFORME DE SIMULACIÓN DE ROL\nGenerado por: ${user.full_name || user.email} (${user.role})\nFecha: ${new Date().toLocaleDateString('es-ES')}\nRol simulado: ${tool_input.rol_simulado?.toUpperCase()}\n\nOBSERVACIONES:\n${tool_input.observaciones || 'Sin observaciones'}\n\nPROBLEMAS DETECTADOS:\n${tool_input.problemas_detectados || 'Ninguno'}\n\nRECOMENDACIONES:\n${tool_input.recomendaciones || 'Sin recomendaciones'}`;
      const informe = await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: `Informe simulación: Rol ${tool_input.rol_simulado}`,
        descripcion: contenido,
        tipo: 'informe',
        prioridad: tool_input.prioridad || 'media',
        estado: 'pendiente',
        asignada_a_user_id: user.id,
        asignada_a_nombre: user.full_name || user.email,
        asignada_a_rol: user.role,
        contexto_ia: 'Informe generado por el asistente IA tras simulación de roles',
        creada_por: 'asistente_ia',
        solo_gerencia: true,
      });
      result = { success: true, informe_id: informe.id, titulo: informe.titulo, mensaje: 'Informe guardado. Disponible en la pestaña Tareas del asistente.' };
    }

    // ── Solicitar cambio de rol ────────────────────────────────────────────────
    else if (tool_name === 'solicitar_cambio_rol') {
      const nota = await base44.asServiceRole.entities.AsistenteTarea.create({
        titulo: `Cambio de rol: ${tool_input.user_nombre} → ${tool_input.rol_nuevo}`,
        descripcion: `Solicitud de cambio de rol:\n- Usuario: ${tool_input.user_nombre}\n- Rol actual: ${tool_input.rol_actual || 'desconocido'}\n- Rol nuevo: ${tool_input.rol_nuevo}\n- Motivo: ${tool_input.motivo || 'No especificado'}\n- Solicitado por: ${user.full_name || user.email}`,
        tipo: 'tarea_manual',
        prioridad: 'alta',
        estado: 'pendiente',
        asignada_a_user_id: user.id,
        asignada_a_nombre: user.full_name || user.email,
        asignada_a_rol: 'admin',
        contexto_ia: `Cambio de rol solicitado vía asistente IA. User ID: ${tool_input.user_id}`,
        creada_por: 'asistente_ia',
        solo_gerencia: true,
      });
      result = { success: true, mensaje: `Solicitud registrada para ${tool_input.user_nombre}. El administrador recibirá la notificación.`, tarea_id: nota.id };
    }

    else {
      return Response.json({ error: `Herramienta desconocida: ${tool_name}` }, { status: 400 });
    }

    return Response.json({ result });

  } catch (error) {
    // Escalado enriquecido: incluye contexto completo del fallo
    try {
      const base44Err = createClientFromRequest(req);
      await base44Err.asServiceRole.entities.AsistenteTarea.create({
        titulo: `⚠️ Error en asistente: ${tool_name_ref.value}`,
        descripcion: `Herramienta: "${tool_name_ref.value}"\nError: ${error.message}\n\nEscalado automático a Gerencia.`,
        tipo: 'alerta',
        prioridad: 'urgente',
        estado: 'pendiente',
        asignada_a_nombre: 'Gerencia',
        asignada_a_rol: 'gerencia',
        contexto_ia: 'Error auto-detectado por el asistente IA',
        creada_por: 'sistema',
        solo_gerencia: true,
      });
    } catch (_) {}
    return Response.json({
      error: true,
      mensaje: `No se pudieron obtener los datos de "${tool_name_ref.value}". Incidencia registrada para revisión.`,
      detalle: error.message,
    }, { status: 500 });
  }
});