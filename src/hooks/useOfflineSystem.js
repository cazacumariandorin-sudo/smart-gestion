import { useEffect } from 'react';
import { getQueue, getDeadLetters } from '@/utils/offlineQueue';
import { initOfflineStorage } from '@/utils/offlineStorage';
import { useOnlineStatus } from './useOnlineStatus';

/**
 * Hook que inicializa todo el sistema offline en la app
 * - Inicializa IndexedDB
 * - Detecta cambios de conexión
 * - Limpia datos expirados
 * - Notifica sobre estado de cola
 */
export function useOfflineSystem() {
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    // Inicializar IndexedDB
    initOfflineStorage().catch(e => console.error('Error inicializando IndexedDB:', e));

    // Limpiar datos expirados cada 5 minutos
    const cleanupInterval = setInterval(async () => {
      const { cleanupExpiredData } = await import('@/utils/offlineStorage');
      cleanupExpiredData();
    }, 5 * 60 * 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Monitorear cambios en la cola
  useEffect(() => {
    const handleQueueChange = () => {
      const queue = getQueue();
      const deadLetters = getDeadLetters();

      // Disparar evento con estadísticas
      window.dispatchEvent(
        new CustomEvent('offlineQueue:stats', {
          detail: {
            queueCount: queue.length,
            deadLetterCount: deadLetters.length,
            hasQueuedItems: queue.length > 0,
          },
        })
      );
    };

    // Escuchar cambios
    window.addEventListener('offlineQueue:updated', handleQueueChange);
    window.addEventListener('offlineQueue:synced', handleQueueChange);

    return () => {
      window.removeEventListener('offlineQueue:updated', handleQueueChange);
      window.removeEventListener('offlineQueue:synced', handleQueueChange);
    };
  }, []);

  return {
    isOnline,
    queueCount: getQueue().length,
    deadLetterCount: getDeadLetters().length,
  };
}
