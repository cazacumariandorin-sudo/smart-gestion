import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { tool_name, tool_input = {} } = await req.json();
    const isAdminOrGerencia = ['admin', 'gerencia'].includes(user.role);
    const hoy = new Date().toISOString().split('T')[0];

    let result = {};

    if (tool_name === 'get_obras_activas') {
      const obras = await base44.asServiceRole.entities.Obra.filter({ status: 'activa' }, '-created_date', 30);
      result = { obras: obras.map(o => ({ id: o.id, name: o.name, client_name: o.client_name, budget: o.budget, end_date: o.end_date })) };
    }

    else if (tool_name === 'get_fichajes_hoy') {
      const fecha = tool_input.fecha || hoy;
      const query = { date: fecha };
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      const fichajes = await base44.asServiceRole.entities.Fichaje.filter(query, '-created_date', 50);
      result = { fecha, total: fichajes.length, fichajes: fichajes.map(f => ({ operario: f.operario_name, entrada: f.hora_entrada, salida: f.hora_salida, obra: f.obra_name, horas: f.horas_trabajadas })) };
    }

    else if (tool_name === 'get_gastos_pendientes') {
      const query = { estado: 'pendiente' };
      if (tool_input.operario_id) query.operario_id = tool_input.operario_id;
      if (tool_input.sin_obra) query.sin_obra = true;
      const gastos = await base44.asServiceRole.entities.RegistroGasto.filter(query, '-created_date', 30);
      result = { total: gastos.length, importe_total: gastos.reduce((s, g) => s + (g.importe || 0), 0), gastos: gastos.map(g => ({ id: g.id, concepto: g.concepto, importe: g.importe, operario: g.operario_name, obra: g.obra_name })) };
    }

    else if (tool_name === 'get_partes_sin_firmar') {
      const partes = await base44.asServiceRole.entities.WorkOrder.list('-date', 50);
      const sinFirmar = partes.filter(p => p.firma_status !== 'firmado_ambos');
      result = { total: sinFirmar.length, partes: sinFirmar.map(p => ({ id: p.id, numero: p.order_number, proyecto: p.project, fecha: p.date, firma_status: p.firma_status })) };
    }

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

    else if (tool_name === 'get_operarios_sin_fichar_hoy') {
      const [operarios, fichajes] = await Promise.all([
        base44.asServiceRole.entities.Operario.filter({ active: true }, '-created_date', 100),
        base44.asServiceRole.entities.Fichaje.filter({ date: hoy }, '-created_date', 100),
      ]);
      const fichadosIds = new Set(fichajes.map(f => f.operario_id));
      const sinFichar = operarios.filter(o => !fichadosIds.has(o.id));
      result = { total_sin_fichar: sinFichar.length, operarios: sinFichar.map(o => ({ id: o.id, name: o.name })) };
    }

    else if (tool_name === 'get_obras_sin_presupuesto') {
      if (!isAdminOrGerencia) return Response.json({ error: 'Sin permisos' }, { status: 403 });
      const obras = await base44.asServiceRole.entities.Obra.list('-created_date', 100);
      const sinPres = obras.filter(o => !o.budget || o.budget === 0);
      result = { total: sinPres.length, obras: sinPres.map(o => ({ id: o.id, name: o.name, client_name: o.client_name, status: o.status })) };
    }

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

    else {
      return Response.json({ error: `Herramienta desconocida: ${tool_name}` }, { status: 400 });
    }

    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});