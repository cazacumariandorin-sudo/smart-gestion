import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function SystemHealthBanner() {
  const { role } = useUserRole();
  const qc = useQueryClient();
  const [dismissedLocal, setDismissedLocal] = useState(false);
  const [expandido, setExpandido] = useState(false);

  const esGerencia = role === 'gerencia' || role === 'admin';

  const { data: ultimoCheck } = useQuery({
    queryKey: ['system-health-check-latest'],
    queryFn: async () => {
      const registros = await base44.entities.SystemHealthCheck.list('-fecha_ejecucion', 1);
      return registros[0] || null;
    },
    enabled: esGerencia,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 0,
  });

  const reconocerMutation = useMutation({
    mutationFn: async (id) => {
      const me = await base44.auth.me();
      return base44.entities.SystemHealthCheck.update(id, {
        reconocida_por_gerencia: true,
        reconocida_fecha: new Date().toISOString(),
        reconocida_por_email: me.email,
      });
    },
    onSuccess: () => {
      setDismissedLocal(true);
      qc.invalidateQueries({ queryKey: ['system-health-check-latest'] });
    },
    onError: (err) => {
      toast.error('No se pudo cerrar el aviso', { description: err.message || 'Permiso denegado. Contacta con el administrador.' });
    },
  });

  const comprobarAhoraMutation = useMutation({
    mutationFn: () => base44.functions.invoke('healthCheckDiario', {}),
    onSuccess: () => {
      setDismissedLocal(false);
      setExpandido(true);
      qc.invalidateQueries({ queryKey: ['system-health-check-latest'] });
    },
    onError: (err) => toast.error('Error al comprobar', { description: err.message }),
  });

  if (!esGerencia || !ultimoCheck) return null;

  const yaReconocido = ultimoCheck.reconocida_por_gerencia;
  if (yaReconocido || dismissedLocal) return null;

  const esOk = ultimoCheck.estado_global === 'ok';

  return (
    <div className="fixed top-2 right-2 sm:top-3 sm:right-3 z-[70] max-w-[min(92vw,320px)]">
      <div className={cn(
        'rounded-xl shadow-lg text-white transition-all duration-200 overflow-hidden',
        esOk ? 'bg-emerald-600' : 'bg-red-600',
        !esOk && !expandido && 'animate-pulse',
      )}>
        {/* Píldora compacta — siempre visible */}
        <button
          onClick={() => setExpandido(e => !e)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left"
        >
          {esOk
            ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          <span className="text-[11px] font-medium leading-none flex-1 truncate">
            {esOk ? 'Sistema OK' : 'Problema detectado'}
          </span>
          <X
            className="w-3 h-3 shrink-0 opacity-70 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); reconocerMutation.mutate(ultimoCheck.id); }}
          />
        </button>

        {/* Detalle expandido — solo al pulsar la píldora */}
        {expandido && (
          <div className="px-2.5 pb-2 pt-0.5 border-t border-white/20 space-y-1.5">
            <p className="text-[10px] opacity-85 leading-snug">
              {esOk
                ? `Última comprobación: ${new Date(ultimoCheck.fecha_ejecucion).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : (ultimoCheck.resumen_error || 'Revisar módulos afectados')}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={() => comprobarAhoraMutation.mutate()}
                disabled={comprobarAhoraMutation.isPending}
              >
                <RefreshCw className={cn('w-2.5 h-2.5 mr-1', comprobarAhoraMutation.isPending && 'animate-spin')} />
                Comprobar
              </Button>
              <Button
                size="sm"
                className="h-6 text-[10px] px-2 bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => reconocerMutation.mutate(ultimoCheck.id)}
                disabled={reconocerMutation.isPending}
              >
                Entendido
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}