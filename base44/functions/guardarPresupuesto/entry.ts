import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Roles permitidos para crear presupuestos
        const rolesPermitidos = ['admin', 'gerencia', 'director_comercial', 'jefe_obra'];
        if (!rolesPermitidos.includes(user.role)) {
            return Response.json({ error: 'Forbidden: No tienes permisos para crear presupuestos' }, { status: 403 });
        }

        const body = await req.json();
        const { titulo, cliente_id, cliente_name, fecha, importe, conceptos, partes_trabajo_ids, notas, file_url, descripcion, es_duplicado_confirmado = false } = body;

        // Validaciones básicas (título es opcional, se autogenera)
        if (!cliente_id || !fecha || !importe) {
            return Response.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // Generar título automático si no se proporciona (usando código de registro)
        // El código de registro se genera después de crear el presupuesto
        const tituloFinal = titulo || '';

        // DETECCIÓN DE DUPLICADOS - Solo si no es confirmación manual
        if (!es_duplicado_confirmado) {
            const presupuestosExistentes = await base44.entities.Presupuesto.list();
            
            const duplicado = presupuestosExistentes.find(p => {
                // Criterios de duplicidad multicampo
                const mismoCliente = p.cliente_id === cliente_id;
                const mismaFecha = p.fecha === fecha;
                const mismoImporte = Math.abs((p.importe || 0) - (importe || 0)) < 0.01;
                
                // Verificar conceptos similares (al menos uno debe coincidir)
                const conceptosCoinciden = conceptos && conceptos.length > 0 && p.conceptos && p.conceptos.length > 0
                    ? conceptos.some(c1 => p.conceptos.some(c2 => c1.descripcion?.toLowerCase() === c2.descripcion?.toLowerCase()))
                    : false;

                return mismoCliente && mismaFecha && mismoImporte && conceptosCoinciden;
            });

            if (duplicado) {
                // Devolver 409 Conflict para que el frontend maneje la confirmación
                return Response.json({
                    error: 'Duplicado detectado',
                    code: 'DUPLICATE_BUDGET',
                    duplicado: {
                        id: duplicado.id,
                        titulo: duplicado.titulo,
                        fecha: duplicado.fecha,
                        importe: duplicado.importe
                    }
                }, { status: 409 });
            }
        }

        // Crear presupuesto sin código de registro (se genera después)
        const tituloDefinitivo = es_duplicado_confirmado ? `${tituloFinal}_01` : tituloFinal;

        const nuevoPresupuesto = await base44.entities.Presupuesto.create({
            titulo: tituloDefinitivo || `PRES-SG-${fecha.split('-')[0]}-BORRADOR`,
            cliente_id,
            cliente_name,
            fecha,
            importe,
            conceptos,
            partes_trabajo_ids: partes_trabajo_ids || [],
            es_duplicado_confirmado,
            descripcion,
            notas,
            file_url,
            estado: 'borrador'
        });

        // Generar y asignar código de registro estandarizado
        try {
            const idResponse = await base44.functions.invoke('generarIdUnico', {
                entidad: 'Presupuesto',
                record_id: nuevoPresupuesto.id,
                campo_id: 'codigo_registro',
                anio_override: new Date(fecha).getFullYear()
            });
            
            if (idResponse.data && idResponse.data.id_generado) {
                // Actualizar título con el código de registro si estaba vacío
                const tituloConCodigo = tituloDefinitivo || idResponse.data.id_generado;
                await base44.entities.Presupuesto.update(nuevoPresupuesto.id, {
                    titulo: tituloConCodigo
                });
                
                return Response.json({
                    success: true,
                    data: { ...nuevoPresupuesto, titulo: tituloConCodigo, codigo_registro: idResponse.data.id_generado },
                    codigo_registro: idResponse.data.id_generado,
                    mensaje: es_duplicado_confirmado ? 'Presupuesto duplicado creado con sufijo _01' : 'Presupuesto creado correctamente'
                });
            }
        } catch (error) {
            // Si falla la generación del ID, loguear pero no fallar la operación
            console.error('Error generando código de registro:', error);
        }

        return Response.json({
            success: true,
            data: nuevoPresupuesto,
            mensaje: es_duplicado_confirmado ? 'Presupuesto duplicado creado con sufijo _01' : 'Presupuesto creado correctamente'
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});