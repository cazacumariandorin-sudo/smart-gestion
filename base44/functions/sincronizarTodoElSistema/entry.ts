import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * SINCRO-MAESTRA: Normaliza operarios, asigna IDs únicos y 
 * propaga la identidad a toda la operativa empresarial.
 * Implementa la "Regla de Oro de Integridad de Identidad Permanente"
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Acceso Denegado: Solo administradores' }, { status: 403 });
        }

        const reporte = {
            operarios_normalizados: 0,
            ids_generados: 0,
            registros_actualizados: 0,
            alertas_obra_huerfana: 0,
            entidades_procesadas: []
        };

        // FASE 1: NORMALIZACIÓN DE OPERARIOS (Limpieza de datos)
        const operariosRaw = await base44.asServiceRole.entities.Operario.list();
        const operarios = Array.isArray(operariosRaw) ? operariosRaw : (operariosRaw?.data || []);
        
        for (const op of operarios) {
            const datos = op.data || op;
            const cambios = {};
            
            // Normalizar nombre (trim)
            if (datos.name && typeof datos.name === 'string' && datos.name.trim() !== datos.name) {
                cambios.name = datos.name.trim();
            }
            
            // Normalizar email (trim + lowercase)
            const email = (datos.email || "");
            if (typeof email === 'string') {
                const emailNormalizado = email.trim().toLowerCase();
                if (emailNormalizado && emailNormalizado !== datos.email) {
                    cambios.email = emailNormalizado;
                }
            }
            
            if (Object.keys(cambios).length > 0) {
                await base44.asServiceRole.entities.Operario.update(op.id, cambios);
                reporte.operarios_normalizados++;
            }
        }

        // FASE 2: MAPEO DE IDENTIDAD (Generación de User-SG-AAAA-NNN)
        const operariosActualizadosRaw = await base44.asServiceRole.entities.Operario.list();
        const operariosActualizados = Array.isArray(operariosActualizadosRaw) ? operariosActualizadosRaw : (operariosActualizadosRaw?.data || []);
        const mapaMigracion = {};
        
        for (const op of operariosActualizados) {
            const datos = op.data || op;
            let nuevoId = datos.codigo_registro;
            
            // Generar ID si no existe
            if (!nuevoId) {
                // Usar año de creación si existe, sino año actual
                const fechaCreacion = datos.created_date ? new Date(datos.created_date) : new Date();
                const año = fechaCreacion.getFullYear();
                
                // Generar número secuencial basado en el índice
                const numeroSecuencial = String(operariosActualizados.indexOf(op) + 1).padStart(3, '0');
                nuevoId = `User-SG-${año}-${numeroSecuencial}`;
                
                await base44.asServiceRole.entities.Operario.update(op.id, { codigo_registro: nuevoId });
                reporte.ids_generados++;
            }
            
            mapaMigracion[op.id] = nuevoId;
        }

        // FASE 3: PROPAGACIÓN EN CASCADA (Integridad de Identidad)
        const entidades = [
            { nombre: 'Fichaje', campoOperario: 'operario_id', tieneObra: true },
            { nombre: 'ApunteHorario', campoOperario: 'operario_id', tieneObra: true },
            { nombre: 'Nomina', campoOperario: 'operario_id', tieneObra: false },
            { nombre: 'AsignacionHerramienta', campoOperario: 'operario_id', tieneObra: true },
            { nombre: 'NotaGasto', campoOperario: 'operario_id', tieneObra: true }
        ];

        for (const operarioId in mapaMigracion) {
            const nuevoId = mapaMigracion[operarioId];
            
            for (const entidad of entidades) {
                try {
                    const registrosRaw = await base44.asServiceRole.entities[entidad.nombre].filter({ [entidad.campoOperario]: operarioId });
                    const registros = Array.isArray(registrosRaw) ? registrosRaw : (registrosRaw?.data || []);
                    
                    if (registros.length > 0 && !reporte.entidades_procesadas.includes(entidad.nombre)) {
                        reporte.entidades_procesadas.push(entidad.nombre);
                    }
                    
                    for (const reg of registros) {
                        const datos = reg.data || reg;
                        const updates = {};
                        
                        // Actualizar ID de usuario si es necesario
                        if (datos.user_sg_id !== nuevoId) {
                            updates.user_sg_id = nuevoId;
                        }
                        
                        // Validación de Obra (Seguridad Extra - Regla de Oro)
                        if (entidad.tieneObra && datos.obra_id) {
                            const obraRaw = await base44.asServiceRole.entities.Obra.list({ id: datos.obra_id });
                            const obra = Array.isArray(obraRaw) ? obraRaw : (obraRaw?.data || []);
                            if (!obra || obra.length === 0) {
                                updates.notas = (datos.notas || "") + " [ALERTA: Obra huérfana detectada]";
                                reporte.alertas_obra_huerfana++;
                            }
                        }
                        
                        if (Object.keys(updates).length > 0) {
                            await base44.asServiceRole.entities[entidad.nombre].update(reg.id, updates);
                            reporte.registros_actualizados++;
                        }
                    }
                } catch (error) {
                    // Entidad puede no existir o no tener registros - continuar
                    console.log(`Entidad ${entidad.nombre} no disponible o sin registros`);
                }
            }
        }

        return Response.json({ 
            success: true, 
            mensaje: "Sincronización completada según Regla de Oro SIMANTEC",
            resumen: reporte 
        });
    } catch (error) {
        console.error('Error en sincronización:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});