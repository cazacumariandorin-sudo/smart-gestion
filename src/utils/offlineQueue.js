/**
 * offlineQueue — Sistema avanzado de cola offline con localStorage
 * Soporta reintentos automáticos, priorización y sincronización selectiva
 */

const QUEUE_KEY = 'sg_offline_queue';
const QUEUE_META_KEY = 'sg_offline_queue_meta';

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
  } catch (e) {
    console.error('Error guardando cola offline:', e);
  }
}

export function getQueueMeta() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_META_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveQueueMeta(meta) {
  try {
    localStorage.setItem(QUEUE_META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.error('Error guardando meta de cola:', e);
  }
}

export function getQueueCount() {
  return getQueue().length;
}

export function getQueueCountByHub() {
  const queue = getQueue();
  return {
    obras: queue.filter(i => ['WorkOrder', 'ObraMaterial', 'Obra'].includes(i.entityName)).length,
    personas: queue.filter(i => ['Fichaje', 'ApunteHorario', 'Operario'].includes(i.entityName)).length,
    economico: queue.filter(i => ['RegistroGasto', 'Presupuesto'].includes(i.entityName)).length,
    comunicacion: queue.filter(i => ['Chat', 'Notificacion'].includes(i.entityName)).length,
  };
}

/**
 * Guarda una operación en la cola offline
 */
export async function saveWithOfflineFallback({
  entityName,
  action = 'CREATE',
  payload,
  priority = 'normal', // 'low' | 'normal' | 'high'
  maxRetries = 3,
  autoRetry = true,
  timestamp = new Date().toISOString(),
  intentos = 0,
  error = null,
}) {
  const queue = getQueue();

  const item = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    entityName,
    action,
    payload,
    priority,
    maxRetries,
    autoRetry,
    timestamp,
    intentos,
    error,
    lastRetryAt: null,
    nextRetryAt: calculateNextRetry(intentos),
  };

  // Insertar según prioridad
  if (priority === 'high') {
    queue.unshift(item);
  } else if (priority === 'low') {
    queue.push(item);
  } else {
    queue.push(item);
  }

  saveQueue(queue);
  updateQueueStats(queue);

  return {
    success: true,
    offline: true,
    queueId: item.id,
    message: `Guardado offline. Se sincronizará cuando haya conexión.`,
  };
}

/**
 * Actualiza un item de la cola
 */
export function updateQueue(itemId, updates) {
  const queue = getQueue();
  const index = queue.findIndex(item => item.id === itemId);

  if (index !== -1) {
    queue[index] = {
      ...queue[index],
      ...updates,
      lastRetryAt: new Date().toISOString(),
      nextRetryAt: calculateNextRetry(updates.intentos || 0),
    };
    saveQueue(queue);
    updateQueueStats(queue);
    return true;
  }

  return false;
}

/**
 * Elimina un item de la cola
 */
export function removeFromQueue(itemId) {
  const queue = getQueue();
  const filtered = queue.filter(item => item.id !== itemId);
  saveQueue(filtered);
  updateQueueStats(filtered);
  return filtered.length < queue.length;
}

/**
 * Calcula el siguiente tiempo de reintento con backoff exponencial
 */
function calculateNextRetry(intentos = 0) {
  // Backoff: 1s, 2s, 4s, 8s, 16s (máx 1 minuto)
  const delay = Math.min(1000 * Math.pow(2, intentos), 60000);
  return new Date(Date.now() + delay).toISOString();
}

/**
 * Procesa la cola offline cuando se recupera conexión
 */
export async function processOfflineQueue(entityApis) {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const remaining = [];

  for (const item of queue) {
    try {
      const api = entityApis[item.entityName];
      if (!api) {
        remaining.push(item);
        continue;
      }

      // Ejecutar acción
      if (item.action === 'CREATE') {
        await api.create(item.payload);
      } else if (item.action === 'UPDATE') {
        await api.update(item.payload.id, item.payload);
      } else if (item.action === 'DELETE') {
        await api.delete(item.payload.id);
      }

      synced++;
      console.log(`✅ Sincronizado: ${item.entityName} ${item.id}`);
    } catch (error) {
      failed++;
      console.error(`❌ Error sincronizando ${item.entityName}:`, error);

      // Si no agotó reintentos, guardar para próximo intento
      if (item.intentos < item.maxRetries) {
        remaining.push({
          ...item,
          intentos: item.intentos + 1,
          lastRetryAt: new Date().toISOString(),
          nextRetryAt: calculateNextRetry(item.intentos + 1),
          error: error.message,
        });
      } else {
        // Guardar en "dead letter" si agotó reintentos
        saveDeadLetter(item, error);
      }
    }
  }

  saveQueue(remaining);
  updateQueueStats(remaining);

  // Disparar evento de sincronización
  window.dispatchEvent(
    new CustomEvent('offlineQueue:synced', {
      detail: { synced, failed, remaining: remaining.length },
    })
  );

  return { synced, failed, remaining: remaining.length };
}

/**
 * Guarda items que agotaron reintentos en "dead letter"
 */
function saveDeadLetter(item, error) {
  try {
    const deadLetters = JSON.parse(localStorage.getItem('sg_dead_letters') || '[]');
    deadLetters.push({
      ...item,
      failedAt: new Date().toISOString(),
      error: error.message,
    });
    localStorage.setItem('sg_dead_letters', JSON.stringify(deadLetters.slice(-100))); // Guardar últimos 100
  } catch (e) {
    console.error('Error guardando dead letter:', e);
  }
}

/**
 * Obtiene items fallidos (dead letter)
 */
export function getDeadLetters() {
  try {
    return JSON.parse(localStorage.getItem('sg_dead_letters') || '[]');
  } catch {
    return [];
  }
}

/**
 * Actualiza estadísticas de la cola
 */
function updateQueueStats(queue) {
  const meta = getQueueMeta();
  meta.lastUpdate = new Date().toISOString();
  meta.count = queue.length;
  meta.byEntity = {};

  queue.forEach(item => {
    if (!meta.byEntity[item.entityName]) {
      meta.byEntity[item.entityName] = 0;
    }
    meta.byEntity[item.entityName]++;
  });

  saveQueueMeta(meta);
}

/**
 * Hook para sincronizar cola cuando vuelve online
 */
export function useSyncOfflineQueue(entityApis) {
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🔄 Sincronizando cola offline...');
      const result = await processOfflineQueue(entityApis);
      console.log(`✅ Sincronización completada: ${result.synced} sincronizados, ${result.failed} fallidos`);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('app:online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('app:online', handleOnline);
    };
  }, [entityApis]);
}
