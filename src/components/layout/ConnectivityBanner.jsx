import { useState, useEffect } from 'react';
import { getQueue } from '@/utils/offlineQueue';

export default function ConnectivityBanner() {
  const [status, setStatus] = useState('online'); // 'online'|'offline'|'syncing'|'synced'
  const [pendingCount, setPendingCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);

  useEffect(() => {
    const updatePending = () => {
      setPendingCount(getQueue().length);
    };

    const handleOffline = () => {
      setStatus('offline');
      updatePending();
    };

    const handleOnline = () => {
      const queue = getQueue();
      if (queue.length > 0) {
        setPendingCount(queue.length);
        setStatus('syncing');
        // El procesamiento real ocurre en App.jsx
        // Aquí esperamos 2.5s para mostrar el resultado visual
        setTimeout(() => {
          const remaining = getQueue();
          const synced = queue.length - remaining.length;
          setSyncedCount(synced > 0 ? synced : queue.length);
          setStatus('synced');
          setTimeout(() => setStatus('online'), 3000);
        }, 2500);
      } else {
        setStatus('online');
      }
    };

    // Set initial state
    if (!navigator.onLine) {
      setStatus('offline');
      updatePending();
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (status === 'online') return null;

  const banners = {
    offline: {
      bg: '#FCEBEB',
      border: '#E24B4A',
      text: '#791F1F',
      msg: `📵 Sin conexión — modo offline activo.${pendingCount > 0 ? ` ${pendingCount} registro(s) pendiente(s) de sincronizar.` : ' Tus cambios se guardarán al recuperar señal.'}`,
    },
    syncing: {
      bg: '#E6F1FB',
      border: '#378ADD',
      text: '#0C447C',
      msg: `🔄 Sincronizando ${pendingCount} registro(s) pendiente(s)...`,
      spinner: true,
    },
    synced: {
      bg: '#E1F5EE',
      border: '#1D9E75',
      text: '#085041',
      msg: `✓ ${syncedCount} registro(s) sincronizado(s) correctamente`,
    },
  };

  const b = banners[status];
  if (!b) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        padding: '8px 16px',
        background: b.bg,
        borderBottom: `1px solid ${b.border}`,
        color: b.text,
        fontSize: '12px',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {b.spinner && (
        <div
          style={{
            width: 12,
            height: 12,
            border: `2px solid ${b.border}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }}
        />
      )}
      {b.msg}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}