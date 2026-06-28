import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { CloudUpload, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DriveStatusBanner() {
  const { role } = useUserRole();
  const [dismissed, setDismissed] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  const esGerencia = role === 'admin' || role === 'gerencia';

  const { data: pendientes = [], refetch } = useQuery({
    queryKey: ['archivos_sync_pendientes'],
    queryFn: () => base44.entities.ArchivoSyncPendiente.filter({ estado: 'pendiente' }, 'created_date', 200),
    enabled: esGerencia,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

  const sincronizarAhora = async () => {
    setSincronizando(true);
    try {
      await base44.functions.invoke('sincronizarArchivosADrive', {});
      await refetch();
    } catch (_) {}
    setSincronizando(false);
  };

  if (!esGerencia || dismissed || pendientes.length === 0) return null;

  const conError = pendientes.filter(p => (p.intentos || 0) >= 4).length;

  return (
    <div className={cn(
      'w-full px-4 py-2 text-xs flex items-center justify-between gap-3',
      conError > 0
        ? 'bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
        : 'bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    )}>
      <div className="flex items-center gap-2">
        <CloudUpload className="w-3.5 h-3.5 shrink-0" />
        <span>
          <strong>{pendientes.length}</strong> archivo{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''} de sincronizar con Google Drive
          {conError > 0 && <span className="ml-1 text-amber-600">· {conError} con error</span>}
          <span className="ml-1 opacity-60">— el cron de las 06:00 los subirá automáticamente</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="sm" variant="ghost" onClick={sincronizarAhora} disabled={sincronizando} className="h-6 gap-1 text-xs px-2">
          <RefreshCw className={cn('w-3 h-3', sincronizando && 'animate-spin')} />
          {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} className="h-6 w-6 p-0">
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}