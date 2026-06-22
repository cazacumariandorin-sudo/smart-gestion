import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Fase 0 Crítica — Migración de datos sensibles desde Operario → DatosSensiblesUsuario
 * Lee todos los Operario con user_email vinculado y crea/actualiza su registro DSU.
 * Es idempotente: si ya existe un DSU con ese user_email, lo actualiza sin duplicar.
 * 
 * Payload: { modo: "preview" | "ejecutar" }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'gerencia'].includes(user.role)) {
      return Response.json({ error: 'Forbidden: solo admin o gerencia' }, { status: 403 });
    }

    const { modo = 'preview' } = await req.json().catch(() => ({ modo: 'preview' }));

    // 1. Leer todos los operarios (paginado)
    const operarios = await base44.asServiceRole.entities.Operario.list('-name', 500);

    // 2. Leer DSU existentes para detectar duplicados
    const dsuExistentes = await base44.asServiceRole.entities.DatosSensiblesUsuario.list('-created_date', 500);
    const dsuPorEmail = {};
    for (const dsu of dsuExistentes) {
      if (dsu.user_email) dsuPorEmail[dsu.user_email.toLowerCase()] = dsu;
    }

    const resultado = {
      total_operarios: operarios.length,
      con_email_vinculado: 0,
      ya_migrados: 0,
      a_crear: 0,
      a_actualizar: 0,
      omitidos_sin_datos: 0,
      errores: [],
      preview: [],
    };

    const ahora = new Date().toISOString();

    for (const op of operarios) {
      // Usar user_email como ancla principal, caer en email si no hay user_email
      const emailAncla = (op.user_email || op.email || '').toLowerCase().trim();
      if (!emailAncla) continue;

      resultado.con_email_vinculado++;

      // Construir payload de datos sensibles a migrar
      const datosSensibles = {
        user_email: emailAncla,
        operario_id: op.id,
        operario_name: op.name,
        migrado_desde_operario: true,
        fecha_migracion: ahora,
      };

      // Solo migrar coste_hora si tiene valor real
      if (op.coste_hora != null && op.coste_hora > 0) {
        datosSensibles.coste_hora = op.coste_hora;
      }

      // Solo migrar DNI si tiene valor real
      if (op.dni && op.dni.trim() !== '') {
        datosSensibles.dni_nie = op.dni.trim();
      }

      // Solo migrar categoría si tiene valor
      if (op.categoria) {
        datosSensibles.categoria_laboral = op.categoria;
      }

      // Si user_id está disponible en Operario, añadirlo
      if (op.user_id) {
        datosSensibles.user_id = op.user_id;
      }

      const tieneAlgunDatoSensible = datosSensibles.coste_hora || datosSensibles.dni_nie || datosSensibles.categoria_laboral;
      
      const dsuExistente = dsuPorEmail[emailAncla];

      if (dsuExistente) {
        resultado.ya_migrados++;
        // Si tiene datos nuevos que actualizar, actualizamos
        if (tieneAlgunDatoSensible) {
          resultado.a_actualizar++;
          resultado.preview.push({
            accion: 'actualizar',
            email: emailAncla,
            operario: op.name,
            dsu_id: dsuExistente.id,
            datos: datosSensibles,
          });
          if (modo === 'ejecutar') {
            await base44.asServiceRole.entities.DatosSensiblesUsuario.update(dsuExistente.id, datosSensibles);
          }
        }
      } else {
        if (!tieneAlgunDatoSensible) {
          resultado.omitidos_sin_datos++;
          resultado.preview.push({
            accion: 'omitir',
            email: emailAncla,
            operario: op.name,
            razon: 'Sin datos sensibles que migrar',
          });
          continue;
        }
        resultado.a_crear++;
        resultado.preview.push({
          accion: 'crear',
          email: emailAncla,
          operario: op.name,
          datos: datosSensibles,
        });
        if (modo === 'ejecutar') {
          await base44.asServiceRole.entities.DatosSensiblesUsuario.create(datosSensibles);
        }
      }
    }

    return Response.json({
      success: true,
      modo,
      ejecutado: modo === 'ejecutar',
      resumen: {
        total_operarios: resultado.total_operarios,
        con_email_vinculado: resultado.con_email_vinculado,
        ya_migrados: resultado.ya_migrados,
        creados: modo === 'ejecutar' ? resultado.a_crear : 0,
        actualizados: modo === 'ejecutar' ? resultado.a_actualizar : 0,
        omitidos_sin_datos: resultado.omitidos_sin_datos,
        a_crear_preview: resultado.a_crear,
        a_actualizar_preview: resultado.a_actualizar,
      },
      preview: resultado.preview,
      errores: resultado.errores,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});