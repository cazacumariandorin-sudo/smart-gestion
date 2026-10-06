/**
 * Work Order Utilities
 * Funciones y utilidades para gestionar órdenes de trabajo
 */

/**
 * Valida los datos de una orden de trabajo
 * @param {Object} workOrder - Objeto de orden de trabajo
 * @returns {Object} Objeto con validación y errores
 */
export function validateWorkOrder(workOrder) {
  const errors = [];

  if (!workOrder.title || workOrder.title.trim() === '') {
    errors.push('El título de la orden de trabajo es requerido');
  }

  if (!workOrder.assignee) {
    errors.push('Se debe asignar un responsable');
  }

  if (!workOrder.dueDate) {
    errors.push('La fecha de vencimiento es requerida');
  }

  if (workOrder.dueDate && new Date(workOrder.dueDate) < new Date()) {
    errors.push('La fecha de vencimiento no puede ser en el pasado');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calcula el estado de progreso de una orden de trabajo
 * @param {Object} workOrder - Objeto de orden de trabajo
 * @returns {number} Porcentaje de progreso (0-100)
 */
export function calculateProgress(workOrder) {
  if (!workOrder.tasks || workOrder.tasks.length === 0) {
    return 0;
  }

  const completedTasks = workOrder.tasks.filter(task => task.completed).length;
  return Math.round((completedTasks / workOrder.tasks.length) * 100);
}

/**
 * Genera un ID único para una orden de trabajo
 * @returns {string} ID único
 */
export function generateWorkOrderId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `WO-${timestamp}-${random}`.toUpperCase();
}

/**
 * Formatea una orden de trabajo para visualización
 * @param {Object} workOrder - Objeto de orden de trabajo
 * @returns {Object} Orden de trabajo formateada
 */
export function formatWorkOrder(workOrder) {
  return {
    ...workOrder,
    createdAt: new Date(workOrder.createdAt).toLocaleDateString('es-ES'),
    dueDate: new Date(workOrder.dueDate).toLocaleDateString('es-ES'),
    progress: calculateProgress(workOrder)
  };
}

/**
 * Filtra órdenes de trabajo por estado
 * @param {Array} workOrders - Array de órdenes de trabajo
 * @param {string} status - Estado a filtrar (pending, in-progress, completed)
 * @returns {Array} Órdenes filtradas
 */
export function filterByStatus(workOrders, status) {
  return workOrders.filter(wo => wo.status === status);
}

/**
 * Ordena órdenes de trabajo por fecha de vencimiento
 * @param {Array} workOrders - Array de órdenes de trabajo
 * @param {string} order - 'asc' o 'desc'
 * @returns {Array} Órdenes ordenadas
 */
export function sortByDueDate(workOrders, order = 'asc') {
  const sorted = [...workOrders].sort((a, b) => {
    const dateA = new Date(a.dueDate);
    const dateB = new Date(b.dueDate);
    return order === 'asc' ? dateA - dateB : dateB - dateA;
  });
  return sorted;
}

/**
 * Calcula el tiempo restante hasta la fecha de vencimiento
 * @param {string} dueDate - Fecha de vencimiento
 * @returns {Object} Objeto con información de tiempo restante
 */
export function calculateTimeRemaining(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    days: diffDays,
    isOverdue: diffDays < 0,
    isUrgent: diffDays > 0 && diffDays <= 3,
    formattedTime: diffDays < 0 ? `Vencida hace ${Math.abs(diffDays)} días` : `${diffDays} días restantes`
  };
}
