import { Loader2, WifiOff, RefreshCw, Inbox, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackButton } from '@/hooks/useBackButton';

/**
 * Estado unificado para consultas: loading / error / vacío.
 * Uso: <QueryErrorFallback isLoading={isLoading} error={error} isEmpty={data.length === 0} retryFn={refetch} emptyMessage="..." />
 * Si ninguno de los 3 estados aplica, no renderiza nada (deja pasar el contenido normal).
 */
export default function QueryErrorFallback({ isLoading, error, isEmpty, retryFn, emptyMessage = 'No hay datos disponibles' }) {
  const { handleBack } = useBackButton();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 border border-dashed border-destructive/40 rounded-xl bg-slate-50 dark:bg-slate-900/40">
        <AlertTriangle className="w-9 h-9 text-destructive mx-auto mb-3" />
        <p className="text-sm font-semibold text-destructive mb-1">No se pudieron cargar los datos</p>
        <p className="text-xs text-muted-foreground mb-4">{error?.message || 'Error de conexión. Comprueba tu red e inténtalo de nuevo.'}</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {retryFn && (
            <Button variant="outline" size="sm" onClick={retryFn} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </Button>
          )}
          <Button variant="default" size="sm" onClick={handleBack} className="gap-2">
            <WifiOff className="w-3.5 h-3.5" /> Volver
          </Button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-12 border border-dashed rounded-xl">
        <Inbox className="w-9 h-9 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return null;
}