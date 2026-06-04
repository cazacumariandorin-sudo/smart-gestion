import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tool_name, tool_input = {} } = await req.json();
    const isAdminOrGerencia = ['admin', 'gerencia'].includes(user.role);
    const isJefeOObra = user.role === 'jefe_obra' || isAdminOrGerencia;
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
      const fichajes = await base44.asServiceRole.entities.Fichaje.filter(query, '-created_date', 50);
      result = { fecha, total: fichajes.length, fichajes: fichajes.map(f => ({ operario: f.operario_name, entrada: f.hora_entrada, salida: f.hora_salida, obra: f.obra_name, horas: f.horas_trabajadas })) };
    }

    // ── Gastos ─────────────────────────────────────────────────────────────────
    else if (tool_name === 'get_gastos_pendientes') {
      const query = { estado: 'pendiente' };
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      if (tool_input.sin_obra) query.sin_obra = true;
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
      if (!isAdminOrGerencia) return Response.json({ error: 'Sin permisos' }, { status: 403 });
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
      if (!isAdminOrGerencia) return Response.json({ error: 'Sin permisos' }, { status: 403 });
      const obras = await base44.asServiceRole.entities.Obra.list('-created_date', 100);
      const sinPres = obras.filter(o => !o.budget || o.budget === 0);
      result = { total: sinPres.length, obras: sinPres.map(o => ({ id: o.id, name: o.name, client_name: o.client_name, status: o.status })) };
    }

    // ── Resumen ejecutivo ──────────────────────────────────────────────────────
    else if (tool_name === 'generar_resumen_ejecutivo') {
      if (!isAdminOrGerencia) return Response.json({ error: 'Sin permisos' }, { status: 403 });
      const periodo = tool_input.periodo || 'mes';
      let fechaDesde = hoy;
      if (periodo === 'semana') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        fechaDesde = d.toISOString().split('T')[0];
      } else if (periodo === 'mes') {
        fechaDesde = hoy.substring(0, 7) + '-01';
      }
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
        periodo,
        fecha_desde: fechaDesde,
        resumen: {
          obras_activas: obras.length,
          operarios_activos: operarios.length,
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
      const query = {};
      if (tool_input.categoria) query.categoria = tool_input.categoria;
      const manuales = await base44.asServiceRole.entities.Manual.list('-created_date', 50);
      const filtrados = tool_input.categoria ? manuales.filter(m => m.categoria === tool_input.categoria) : manuales;
      result = { total: filtrados.length, manuales: filtrados.map(m => ({ id: m.id, titulo: m.title || m.titulo || m.name, categoria: m.categoria, descripcion: m.description || m.descripcion, fecha: m.created_date })) };
    }

    // ── Apuntes de producción ──────────────────────────────────────────────────
    else if (tool_name === 'get_apuntes_produccion') {
      const query = {};
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
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
      result = {
        total: vacaciones.length,
        vacaciones: vacaciones.map(v => ({ id: v.id, operario: v.operario_name, tipo: v.tipo, fecha_inicio: v.fecha_inicio, fecha_fin: v.fecha_fin, dias: v.dias, aprobado: v.aprobado })),
      };
    }

    // ── Notas de gastos ────────────────────────────────────────────────────────
    else if (tool_name === 'get_notas_gastos') {
      const query = {};
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      if (tool_input.estado) query.estado = tool_input.estado;
      const notas = await base44.asServiceRole.entities.NotaGasto.filter(query, '-created_date', 30);
      result = {
        total: notas.length,
        total_importe: notas.reduce((s, n) => s + (n.total_importes || 0), 0).toFixed(2),
        notas: notas.map(n => ({ id: n.id, numero: n.numero_nota, operario: n.operario_name, periodo: n.periodo_mes, estado: n.estado, total: n.total_importes, num_registros: n.num_registros })),
      };
    }

    // ── Solar ──────────────────────────────────────────────────────────────────
    else if (tool_name === 'get_obras_solar') {
      const query = {};
      if (tool_input.status) query.status = tool_input.status;
      const obras = await base44.asServiceRole.entities.SolarObra.filter(query, '-created_date', 30);
      result = {
        total: obras.length,
        obras: obras.map(o => ({ id: o.id, name: o.name, client_name: o.client_name, status: o.status, potencia_kw: o.potencia_kw, budget: o.budget, start_date: o.start_date, end_date: o.end_date })),
      };
    }

    // ── Materiales de obra ─────────────────────────────────────────────────────
    else if (tool_name === 'get_materiales_obra') {
      if (!tool_input.obra_id) return Response.json({ error: 'obra_id requerido' }, { status: 400 });
      const materiales = await base44.asServiceRole.entities.ObraMaterial.filter({ obra_id: tool_input.obra_id }, '-created_date', 50);
      result = {
        total: materiales.length,
        coste_total: materiales.reduce((s, m) => s + (m.precio_total || 0), 0).toFixed(2),
        materiales: materiales.map(m => ({ id: m.id, nombre: m.nombre, tipo: m.tipo, cantidad: m.cantidad, unidad: m.unidad, precio_total: m.precio_total, proveedor: m.proveedor })),
      };
    }

    // ── Previsión de obras ─────────────────────────────────────────────────────
    else if (tool_name === 'get_prevision_obras') {
      const previsiones = await base44.asServiceRole.entities.PrevisionObra.list('-created_date', 30);
      result = {
        total: previsiones.length,
        previsiones: previsiones.map(p => ({ id: p.id, obra_name: p.obra_name, status: p.status, status_semaforo: p.status_semaforo, horas_previstas: p.horas_totales_previstas, horas_reales: p.horas_reales_acumuladas, desviacion: p.desviacion_horas, porcentaje_avance: p.porcentaje_avance_horas, fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin })),
      };
    }

    // ── Documentos de operarios ────────────────────────────────────────────────
    else if (tool_name === 'get_documentos_operarios') {
      const query = {};
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      if (tool_input.firma_status) query.firma_status = tool_input.firma_status;
      const docs = await base44.asServiceRole.entities.OperarioDoc.filter(query, '-created_date', 50);
      result = {
        total: docs.length,
        docs: docs.map(d => ({ id: d.id, operario: d.operario_name, titulo: d.title, tipo: d.tipo, firma_status: d.firma_status, firmado: d.firmado, expiry_date: d.expiry_date })),
      };
    }

    // ── Nota interna (solo admin/gerencia) ────────────────────────────────────
    else if (tool_name === 'create_nota_interna') {
      if (!isAdminOrGerencia) return Response.json({ error: 'Sin permisos' }, { status: 403 });
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

    else {
      return Response.json({ error: `Herramienta desconocida: ${tool_name}` }, { status: 400 });
    }

    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});