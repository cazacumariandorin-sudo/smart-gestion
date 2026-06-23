import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Función central para generación de IDs únicos según estándar:
 * PREFIJO-AÑO(2dig)-SECUENCIAL(5dig con padding)
 * Ej: OPE-26-00084, CLI-26-00045, OBR-26-00120
 *
 * Diccionario de prefijos oficiales:
 *   Operarios   → OPE
 *   Clientes    → CLI
 *   Obras       → OBR
 *   Manuales    → MAN
 *   Pedidos     → PED
 *   Albaranes   → ALB  (WorkOrders / partes de trabajo)
 *   Presupuestos→ PRE
 *   Usuarios    → USR
 *   Solar       → SOL
 *   Vehículos   → VEH
 */

const PREFIJOS = {
  Operario:    'OPE',
  Client:      'CLI',
  Obra:        'OBR',
  SolarObra:   'SOL',
  Manual:      'MAN',
  Order:       'PED',
  WorkOrder:   'ALB',
  Vehiculo:    'VEH',
  User:        'USR',
  Presupuesto: 'PRES',
  Drawing:     'PLN',
};

/**
 * Genera un código de registro estandarizado.
 * @param prefijo  Prefijo (ej: 'OPE' o 'PRES')
 * @param secuencial Número secuencial
 * @param anio   Año completo (ej: 2026)
 * @param entidad Nombre de la entidad para formatos especiales
 */
function formatearId(prefijo, secuencial, anio, entidad) {
  // Presupuesto usa formato especial: PRES-SG-AAAA-NNN
  if (entidad === 'Presupuesto') {
    const seq3 = String(secuencial).padStart(3, '0');
    return `${prefijo.toUpperCase()}-SG-${anio}-${seq3}`;
  }
  // Formato estándar para resto de entidades: PREFIJO-AA-SSSSS
  const anio2 = String(anio).slice(-2);
  const seq5  = String(secuencial).padStart(5, '0');
  return `${prefijo.toUpperCase()}-${anio2}-${seq5}`;
}

/**
 * Calcula el siguiente secuencial para una entidad y año dados.
 * Busca el mayor número ya asignado en el campo `campo` filtrando por año en el ID.
 */
function calcularSiguienteSecuencial(registros, campo, prefijo, anio2) {
  let max = 0;
  for (const r of registros) {
    const val = r[campo];
    if (!val) continue;
    // Formato esperado: PREFIJO-AÑO-SSSSS
    const partes = val.split('-');
    if (partes.length === 3 && partes[0] === prefijo && partes[1] === anio2) {
      const n = parseInt(partes[2], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entidad, record_id, campo_id, anio_override } = await req.json();

    if (!entidad || !record_id) {
      return Response.json({ error: 'entidad y record_id son requeridos' }, { status: 400 });
    }

    const prefijo = PREFIJOS[entidad];
    if (!prefijo) {
      return Response.json({ error: `Entidad desconocida: ${entidad}. Prefijos disponibles: ${Object.keys(PREFIJOS).join(', ')}` }, { status: 400 });
    }

    const campoId = campo_id || 'codigo_registro';
    const anio    = anio_override || new Date().getFullYear();
    const anio2   = String(anio).slice(-2);

    // Obtener todos los registros de la entidad para calcular el secuencial
    const entityApi = base44.asServiceRole.entities[entidad];
    if (!entityApi) {
      return Response.json({ error: `API de entidad no disponible: ${entidad}` }, { status: 400 });
    }

    const todos = await entityApi.list('-created_date', 500);
    const siguiente = calcularSiguienteSecuencial(todos, campoId, prefijo, anio2);
    const nuevoId = formatearId(prefijo, siguiente, anio, entidad);

    // Actualizar el registro con el nuevo ID
    await entityApi.update(record_id, { [campoId]: nuevoId });

    return Response.json({
      success: true,
      id_generado: nuevoId,
      entidad,
      prefijo,
      secuencial: siguiente,
      anio: anio2,
      campo: campoId,
      record_id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});