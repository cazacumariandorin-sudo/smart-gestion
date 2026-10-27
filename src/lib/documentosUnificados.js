/**
 * Documentos unificados — puente de solo lectura entre el módulo Documental
 * (entidad Manual) e Ingeniería (entidad MaterialDocumentoOrigen) para que los
 * planos/manuales subidos en cualquiera de los dos módulos sean visibles en el
 * otro, sin duplicar datos ni sincronizar registros.
 *
 * Solo se exponen en Documental los tipos de Ingeniería que son planos/manuales
 * técnicos; los documentos comerciales (factura, albarán, proforma, pedido,
 * presupuesto) son de uso interno de Ingeniería/Contabilidad y no se muestran
 * a los técnicos en Documental.
 */

// Tipo de MaterialDocumentoOrigen → etiqueta de categoría en Documental
export const TIPOS_ING_PARA_DOCUMENTAL = {
  plano_planta: 'Plano de planta',
  ficha_tecnica_equipo: 'Ficha técnica equipo',
  esquema_conexion: 'Esquema de conexión',
  pid_proceso: 'P&ID de proceso',
  listado_puntos: 'Listado de puntos',
  lista_material: 'Lista de material',
};

// Convierte un MaterialDocumentoOrigen en un objeto con la "shape" de Manual
// para mostrarlo dentro de la vista Documental (agrupado por cliente/obra).
export function ingDocToManualShape(doc, obrasById = {}) {
  const obra = doc.obra_id ? obrasById[doc.obra_id] : null;
  return {
    id: `ing-${doc.id}`,
    _origen: 'ingenieria',
    _realId: doc.id,
    title: doc.numero_documento || TIPOS_ING_PARA_DOCUMENTAL[doc.tipo] || doc.tipo || 'Documento ingeniería',
    client_id: obra?.client_id || '',
    client_name: obra?.client_name || '',
    obra_id: doc.obra_id || '',
    obra_name: doc.obra_name || obra?.name || '',
    categoria: TIPOS_ING_PARA_DOCUMENTAL[doc.tipo] || 'Ingeniería',
    fabricante_id: '',
    fabricante_name: doc.proveedor_nombre || '',
    file_url: doc.archivo_url_mejorado || doc.archivo_url_original || '',
    file_type: '',
    version: doc.revision || doc.version_documento || '',
    date: doc.fecha_documento || '',
    notes: doc.estado === 'pendiente_revision' ? 'Pendiente de procesar en Ingeniería' : '',
  };
}

// Convierte un Manual en un objeto ligero para mostrarlo en Ingeniería Documentos.
export function manualToIngDocShape(m) {
  return {
    id: `doc-${m.id}`,
    _origen: 'documental',
    _realId: m.id,
    tipo: 'manual_documental',
    numero_documento: m.title,
    revision: m.version || '',
    fecha_documento: m.date || '',
    estado: 'procesado',
    archivo_url_mejorado: m.file_url || '',
    obra_id: m.obra_id || '',
    obra_name: m.obra_name || '',
    proveedor_nombre: m.fabricante_name || '',
    categoria: m.categoria || '',
  };
}