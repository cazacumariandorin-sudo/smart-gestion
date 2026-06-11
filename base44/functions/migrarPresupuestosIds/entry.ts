import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Función de migración para normalizar códigos de registro de presupuestos existentes.
 * Asigna el formato PRES-SG-AAAA-NNN a todos los presupuestos que carecen de codigo_registro.
 * 
 * Uso: Solo para administración. Ejecutar una vez para sanear datos históricos.
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized: Solo administradores' }, { status: 403 });
        }

        const body = await req.json();
        const { dry_run = true } = body; // Por defecto solo simulación

        // Obtener todos los presupuestos
        const presupuestos = await base44.asServiceRole.entities.Presupuesto.list('-created_date', 500);
        
        const resultados = {
            total: presupuestos.length,
            sin_codigo: 0,
            con_codigo: 0,
            migrados: [],
            errores: []
        };

        // Agrupar por año para calcular secuenciales correctos
        const porAnio = {};
        
        for (const p of presupuestos) {
            if (p.codigo_registro) {
                resultados.con_codigo++;
                continue;
            }
            
            resultados.sin_codigo++;
            const anio = new Date(p.fecha).getFullYear();
            const anioStr = String(anio);
            
            if (!porAnio[anioStr]) {
                porAnio[anioStr] = [];
            }
            porAnio[anioStr].push(p);
        }

        // Calcular secuenciales y generar IDs
        for (const [anio, lista] of Object.entries(porAnio)) {
            // Ordenar por fecha de creación para respetar orden cronológico
            lista.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            
            let secuencial = 1;
            
            for (const p of lista) {
                const codigoGenerado = `PRES-SG-${anio}-${String(secuencial).padStart(3, '0')}`;
                
                resultados.migrados.push({
                    id: p.id,
                    titulo: p.titulo,
                    fecha: p.fecha,
                    anio: anio,
                    codigo_generado: codigoGenerado,
                    secuencial: secuencial
                });
                
                if (!dry_run) {
                    try {
                        await base44.asServiceRole.entities.Presupuesto.update(p.id, {
                            codigo_registro: codigoGenerado,
                            titulo: p.titulo || codigoGenerado
                        });
                    } catch (error) {
                        resultados.errores.push({
                            id: p.id,
                            error: error.message
                        });
                    }
                }
                
                secuencial++;
            }
        }

        return Response.json({
            success: true,
            dry_run,
            resumen: {
                total_presupuestos: resultados.total,
                ya_normalizados: resultados.con_codigo,
                pendientes_migracion: resultados.sin_codigo,
                migrados_simulacion: resultados.migrados.length,
                errores: resultados.errores.length
            },
            detalles: dry_run ? {
                mensaje: 'Ejecución en modo simulación (dry_run=true). Envía dry_run=false para aplicar cambios.',
                migrados_pendientes: resultados.migrados
            } : {
                migrados_aplicados: resultados.migrados,
                errores: resultados.errores
            }
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});