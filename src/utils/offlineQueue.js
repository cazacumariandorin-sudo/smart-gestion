/**
 * offlineQueue — Cola de operaciones offline con localStorage.
 * Las operaciones se encolan cuando no hay conexión y se sincronizan al recuperarla.
 */

const QUEUE_KEY = 'sg_offline_queue';

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function getQueueCount() {
  return getQueue().length;
}

export function getQueueCountByHub() {
  const queue = getQueue();
  return {
    obras: queue.filter(i => ['WorkOrder', 'ObraMaterial'].includes(i.entityName)).length,
    personas: queue.filter(i => ['Fichaje', 'ApunteHorario'].includes(i.entityName)).length,
    economico: queue.filter(i => i.entityName === 'GastoOperario').length,
  };
}

/**
 * Guarda una operación directamente si hay conexión, o la encola si está offline.
 */
export async function saveWithOfflineFallback(entityName, operation, payload, entityApi) {
  if (navigator.onLine) {
    try {
      const result = operation === 'create'
        ? await entityApi.create(payload)
        : await entityApi.update(payload.id, payload);
      return { success: true, result, offline: false };
    } catch (e) {
      return { success: false, error: e.message, offline: false };
    }
  } else {
    const queue = getQueue();
    const item = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      entityName,
      operation,
      payload,
      timestamp: new Date().toISOString(),
      intentos: 0,
    };
    queue.push(item);
    saveQueue(queue);
    return { success: true, offline: true, queueId: item.id };
  }
}

/**
 * Procesa la cola pendiente usando los entityApis proporcionados.
 * Retorna el número de operaciones sincronizadas con éxito.
 */
export async function processOfflineQueue(entityApis) {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      const api = entityApis[item.entityName];
      if (!api) {
        remaining.push(item);
        continue;
      }
      if (item.operation === 'create') {
        await api.create(item.payload);
      } else {
        await api.update(item.payload.id, item.payload);
      }
      synced++;
    } catch {
      remaining.push({ ...item, intentos: item.intentos + 1 });
    }
  }

  saveQueue(remaining);
  return synced;
}