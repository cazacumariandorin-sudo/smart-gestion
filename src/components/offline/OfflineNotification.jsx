import { useEffect } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

/**
 * Hook que muestra notificación flotante de estado de conexión
 */
export function useOfflineNotifier() {
  const { isOnline } = useOnlineStatus();
  const [showNotif, setShowNotif] = useStateWithPersist('offlineNotif', false);

  useEffect(() => {
    if (!isOnline) {
      setShowNotif(true);
    } else {
      // Mantener visible 2 segundos al recuperar conexión
      setTimeout(() => setShowNotif(false), 2000);
    }
  }, [isOnline, setShowNotif]);

  return { showNotif, isOnline };
}

/**
 * Componente de notificación flotante
 */
export function OfflineNotification() {
  const { showNotif, isOnline } = useOfflineNotifier();

  if (!showNotif) return null;

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 sm:left-6 sm:right-auto sm:w-80 p-4 rounded-lg shadow-lg border-2 animate-in slide-in-from-bottom-4 z-50 transition-all ${
        isOnline
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-amber-50 border-amber-200 text-amber-800'
      }`}
    >
      <div className="flex items-center gap-3">
        {isOnline ? (
          <>
            <Wifi className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">✅ Conexión recuperada</p>
              <p className="text-xs opacity-75">Sincronizando datos...</p>
            </div>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">📴 Modo offline</p>
              <p className="text-xs opacity-75">Los datos se guardarán localmente</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper para estado persistente
function useStateWithPersist(key, initial) {
  const [state, setState] = useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  }, [key, initial]);

  const setState2 = (value) => {
    setState(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  return [state, setState2];
}
