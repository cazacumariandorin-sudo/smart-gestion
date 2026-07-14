import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, AlertCircle, WifiOff } from 'lucide-react';

export default function GlobalLoadingBar() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Cargando...');

  useEffect(() => {
    setIsLoading(true);
    setProgress(10);
    setError(null);
    setLoadingMessage('Cargando página...');

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + Math.random() * 30;
      });
    }, 200);

    const timer = setTimeout(() => {
      setProgress(100);
      setIsLoading(false);
    }, 800);

    const timeoutWarning = setTimeout(() => {
      if (isLoading) {
        setLoadingMessage('Conexión lenta... reintentando');
      }
    }, 5000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
      clearTimeout(timeoutWarning);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleError = (event) => {
      if (event.detail?.error) {
        setError(event.detail.error);
        setIsLoading(false);
      }
    };

    window.addEventListener('pageError', handleError);
    return () => window.removeEventListener('pageError', handleError);
  }, []);

  return (
    <>
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800 z-50">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {isLoading && progress < 50 && (
        <div className="fixed inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-40">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {loadingMessage}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {Math.round(progress)}%
          </p>
        </div>
      )}

      {error?.type === 'timeout' && (
        <div className="fixed inset-0 bg-white/95 dark:bg-slate-950/95 flex flex-col items-center justify-center z-40 p-4">
          <div className="text-center max-w-sm">
            <WifiOff className="w-16 h-16 text-amber-600 dark:text-amber-400 mx-auto mb-4 animate-pulse" />
            <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-300 mb-2">
              Conexión muy lenta
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              La conexión está degradada. Esto es común en zonas rurales o con roaming.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-6">
              Motivo: RTT {error.rtt}ms (timeout esperado: {error.timeout}ms)
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reintentar
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-3">
              Reintentando automáticamente en 3 segundos...
            </p>
          </div>
        </div>
      )}

      {error?.type === 'error' && (
        <div className="fixed inset-0 bg-white/95 dark:bg-slate-950/95 flex flex-col items-center justify-center z-40 p-4">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
              Error al cargar página
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              {error.message}
            </p>
            {error.details && (
              <p className="text-xs text-slate-500 dark:text-slate-500 mb-6 font-mono">
                {error.details}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {error?.type === 'toast' && (
        <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 z-50 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-red-700 dark:text-red-300">{error.message}</p>
            {error.details && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error.details}</p>
            )}
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-700 flex-shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}

export function usePageError() {
  const dispatchError = (type, message, details) => {
    window.dispatchEvent(
      new CustomEvent('pageError', {
        detail: {
          error: { type, message, details },
        },
      })
    );
  };

  return {
    setError: (message, details) => dispatchError('error', message, details),
    setTimeout: (rtt, timeout) =>
      dispatchError('timeout', 'Conexión lenta', `RTT: ${rtt}ms, Timeout: ${timeout}ms`),
    setToast: (message, details) => dispatchError('toast', message, details),
  };
}