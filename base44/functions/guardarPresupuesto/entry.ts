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
        const { titulo, cliente_id, cliente_name, fecha, importe, conceptos, partes_trabajo_ids, notas, file_url, es_duplicado_confirmado = false } = body;

        // Validaciones básicas
        if (!titulo || !cliente_id || !fecha || !importe) {
            return Response.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

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

        // Crear presupuesto (con sufijo _01 si es duplicado confirmado)
        const tituloFinal = es_duplicado_confirmado ? `${titulo}_01` : titulo;

        const nuevoPresupuesto = await base44.entities.Presupuesto.create({
            titulo: tituloFinal,
            cliente_id,
            cliente_name,
            fecha,
            importe,
            conceptos,
            partes_trabajo_ids: partes_trabajo_ids || [],
            es_duplicado_confirmado,
            notas,
            file_url,
            estado: 'borrador'
        });

        return Response.json({
            success: true,
            data: nuevoPresupuesto,
            mensaje: es_duplicado_confirmado ? 'Presupuesto duplicado creado con sufijo _01' : 'Presupuesto creado correctamente'
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});