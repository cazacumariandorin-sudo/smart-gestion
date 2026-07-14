import { useEffect, useState } from 'react';
import { getTimeoutByNetwork } from '@/hooks/useNetworkInfo';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DiagnosticoConexion() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const navigator_connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const timeout = getTimeoutByNetwork();

      setInfo({
        has_connection_api: !!navigator_connection,
        effective_type: navigator_connection?.effectiveType || 'desconocido',
        rtt: navigator_connection?.rtt || 'no disponible',
        downlink: navigator_connection?.downlink || 'no disponible',
        timeout_calculated: timeout,
        user_agent: navigator.userAgent.substring(0, 100),
        browser_online: navigator.onLine,
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            🔧 Diagnóstico de Conexión
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Información detallada sobre tu conexión de red
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">Error al diagnosticar</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        {info && (
          <div className="space-y-4">
            
            {/* Card 1: Network API */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Estado de la Red
                </h2>
                {info.has_connection_api ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                )}
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Network API</p>
                    <p className="text-sm font-semibold">
                      {info.has_connection_api ? '✅ Disponible' : '❌ No disponible'}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Conexión Online</p>
                    <p className="text-sm font-semibold">
                      {info.browser_online ? '🟢 Conectado' : '🔴 Desconectado'}
                    </p>
                  </div>
                </div>

                {info.has_connection_api ? (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    ✅ Tu navegador tiene API de información de red. El timeout se adaptará automáticamente.
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Tu navegador NO tiene Network Information API. Se usará timeout por defecto (15 segundos).
                  </p>
                )}
              </div>
            </div>

            {/* Card 2: Detalles de conexión */}
            {info.has_connection_api && (
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Detalles de Conexión
                </h2>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Tipo</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {info.effective_type.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-sm text-slate-600 dark:text-slate-400">RTT (latencia)</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {info.rtt} ms
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Downlink (velocidad)</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {info.downlink} Mbps
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Card 3: Timeout */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
                ⏱️ Timeout Calculado
              </h2>
              
              <div className="bg-white dark:bg-slate-900/50 rounded p-4 mb-3 text-center">
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {info.timeout_calculated}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  milisegundos máximo de espera
                </p>
              </div>

              <p className="text-xs text-blue-700 dark:text-blue-300">
                Si tu conexión tarda más de {info.timeout_calculated}ms en responder, el sistema reintentará automáticamente.
              </p>
            </div>

            {/* Card 4: Device Info */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                📱 Información del Dispositivo
              </h2>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded font-mono text-xs text-slate-700 dark:text-slate-300 break-words">
                {info.user_agent}
              </div>
            </div>

            {/* Card 5: Recomendaciones */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                💡 Recomendaciones
              </h2>

              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {info.has_connection_api ? (
                  <>
                    {info.rtt > 500 && (
                      <p className="flex gap-2 items-start">
                        <span className="text-amber-600">⚠️</span>
                        <span>Tu RTT es alto ({info.rtt}ms). Usa WiFi si es posible, evita roaming si puedes.</span>
                      </p>
                    )}
                    {info.effective_type === '3g' || info.effective_type === '2g' ? (
                      <p className="flex gap-2 items-start">
                        <span className="text-amber-600">⚠️</span>
                        <span>Estás en conexión {info.effective_type.toUpperCase()}. Las operaciones serán más lentas.</span>
                      </p>
                    ) : (
                      <p className="flex gap-2 items-start">
                        <span className="text-green-600">✅</span>
                        <span>Tu conexión es {info.effective_type.toUpperCase()}. Debería funcionar bien.</span>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="flex gap-2 items-start">
                    <span className="text-blue-600">ℹ️</span>
                    <span>Se usará timeout por defecto de 15 segundos. Si tienes problemas, contacta al soporte.</span>
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-500 dark:text-slate-500 mt-6">
              <p>Si tienes problemas de conexión, copia esta información y envía al equipo de soporte.</p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}