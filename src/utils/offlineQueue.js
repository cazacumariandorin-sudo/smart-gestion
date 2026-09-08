/**
 * offlineQueue — Sistema avanzado de cola offline con localStorage
 * Soporta reintentos automáticos, priorización y sincronización selectiva
 */
import { useEffect } from 'react';

const QUEUE_KEY = 'sg_offline_queue';
const QUEUE_META_KEY = 'sg_offline_queue_meta';
const DEAD_LETTERS_KEY = 'sg_dead_letters';

/**
 * QueueValidationError — error de validación de un item de cola.
 * Los items inválidos van a dead letter inmediatamente, SIN gastar reintentos
 * y SIN entrar en `remaining` (P2). Se distingue así de un error de red real.
 */
export class QueueValidationError extends Error {
  constructor(message, item) {
    super(message);
    this.name = 'QueueValidationError';
    this.entityName = item?.entityName;
    this.action = item?.action;
    this.queueItemId = item?.id;
  }
}

/** Detecta QuotaExceededError también en WebView/Safari antiguos (por mensaje). */
function esQuotaError(e) {
  if (!e) return false;
  if (e.name === 'QuotaExceededError' || e.code === 22) return true;
  return /quota/i.test(String(e.message || e));
}

/**
 * Purga dead letters con más de `dias` días de antigüedad (P4: liberación de cuota).
 */
export function purgeOldDeadLetters(dias = 30) {
  try {
    const list = JSON.parse(localStorage.getItem(DEAD_LETTERS_KEY) || '[]');
    if (!list.length) return 0;
    const cutoff = Date.now() - dias * 24 * 60 * 60 * 1000;
    const fresh = list.filter(it => {
      const ref = it.failedAt || it.timestamp;
      if (!ref) return true; // sin fecha: conservar
      return new Date(ref).getTime() >= cutoff;
    });
    const purged = list.length - fresh.length;
    if (purged > 0) localStorage.setItem(DEAD_LETTERS_KEY, JSON.stringify(fresh.slice(-100)));
    return purged;
  } catch {
    return 0;
  }
}

/**
 * safeSetItem — setItem con gestión de cuota (P4).
 * - Camino feliz: setItem normal.
 * - QuotaExceededError: purga dead letters >30d y reintenta UNA vez.
 * - Si sigue fallando: dispatch 'offlineQueue:quota-exceeded' para que un listener
 *   React lo convierta en toast visible al usuario.
 */
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (!esQuotaError(e)) {
      console.error(`Error guardando ${key}:`, e);
      return false;
    }
    // Intento de liberación: purgar dead letters viejos y reintentar una vez.
    let purgados = 0;
    try { purgados = purgeOldDeadLetters(30); } catch { /* sin-op */ }
    try {
      localStorage.setItem(key, value);
      console.warn(`Cuota localStorage: liberados ${purgados} dead letters, guardado OK tras reintento.`);
      return true;
    } catch (e2) {
      console.error(`Cuota localStorage agotada incluso tras purgar (${key}):`, e2);
      try {
        window.dispatchEvent(
          new CustomEvent('offlineQueue:quota-exceeded', {
            detail: { key, purged: purgados, message: 'No se pudo guardar el dato localmente: almacenamiento lleno.' },
          })
        );
      } catch { /* sin-op */ }
      return false;
    }
  }
}

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveQueue(queue) {
  safeSetItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueueMeta() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_META_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveQueueMeta(meta) {
  safeSetItem(QUEUE_META_KEY, JSON.stringify(meta));
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
  if (queue.length === 0) return { synced: 0, failed: 0, rejected: 0 };

  let synced = 0;
  let failed = 0;
  let rejected = 0;
  const remaining = [];

  for (const item of queue) {
    const api = entityApis[item.entityName];
    if (!api) {
      remaining.push(item);
      continue;
    }

    // P2: validación previa — items inválidos van a dead letter inmediatamente,
    // SIN gastar reintentos y SIN entrar en `remaining`.
    const motivo = validarItem(item);
    if (motivo) {
      const err = new QueueValidationError(motivo, item);
      rejected++;
      console.warn(`⚠️ Item inválido rechazado: ${item.entityName} ${item.id} → ${motivo}`);
      saveDeadLetter(item, err);
      continue;
    }

    try {
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

      // Si no agotó reintentos, guardar para próximo intento (backoff exponencial intacto)
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
      detail: { synced, failed, rejected, remaining: remaining.length },
    })
  );

  return { synced, failed, rejected, remaining: remaining.length };
}

/**
 * Valida un item de cola antes de ejecutar la acción (P2).
 * Devuelve un string con el motivo si es inválido, o null si pasa la validación.
 */
function validarItem(item) {
  const payload = item.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return `payload inválido (no es objeto)`;
  }
  if (item.action === 'CREATE') {
    if (Object.keys(payload).length === 0) return `payload vacío en CREATE`;
  } else if (item.action === 'UPDATE' || item.action === 'DELETE') {
    if (payload.id == null || payload.id === '') return `falta payload.id en ${item.action}`;
  }
  return null;
}

/**
 * Guarda items que agotaron reintentos en "dead letter"
 */
function saveDeadLetter(item, error) {
  try {
    const deadLetters = JSON.parse(localStorage.getItem(DEAD_LETTERS_KEY) || '[]');
    deadLetters.push({
      ...item,
      failedAt: new Date().toISOString(),
      error: error.message,
    });
    safeSetItem(DEAD_LETTERS_KEY, JSON.stringify(deadLetters.slice(-100))); // Guardar últimos 100
  } catch (e) {
    console.error('Error guardando dead letter:', e);
  }
}

/**
 * Obtiene items fallidos (dead letter)
 */
export function getDeadLetters() {
  try {
    return JSON.parse(localStorage.getItem(DEAD_LETTERS_KEY) || '[]');
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