import { useEffect, useState } from 'react';

/**
 * Hook para sincronizar cola offline cuando vuelve online
 */
export function useSyncOfflineQueue(entityApis) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    const handleOnline = async () => {
      setSyncing(true);
      console.log('🔄 Sincronizando cola offline...');

      try {
        const { processOfflineQueue } = await import('@/utils/offlineQueue');
        const result = await processOfflineQueue(entityApis);
        console.log(
          `✅ Sincronización completada: ${result.synced} OK, ${result.failed} fallidos, ${result.remaining} pendientes`
        );
        setLastSync(new Date());
      } catch (e) {
        console.error('Error sincronizando cola:', e);
      } finally {
        setSyncing(false);
      }
    };

    // Escuchar evento online del navegador
    window.addEventListener('online', handleOnline);

    // Escuchar evento personalizado
    window.addEventListener('app:online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('app:online', handleOnline);
    };
  }, [entityApis]);

  return { syncing, lastSync };
}
