import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SystemHealthBanner() {
  const { role } = useUserRole();
  const qc = useQueryClient();
  const [dismissedLocal, setDismissedLocal] = useState(false);

  const esGerencia = role === 'gerencia' || role === 'admin';

  const { data: ultimoCheck } = useQuery({
    queryKey: ['system-health-check-latest'],
    queryFn: async () => {
      const registros = await base44.entities.SystemHealthCheck.list('-fecha_ejecucion', 1);
      return registros[0] || null;
    },
    enabled: esGerencia,
    refetchInterval: 5 * 60 * 1000,
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
  });

  const comprobarAhoraMutation = useMutation({
    mutationFn: () => base44.functions.invoke('healthCheckDiario', {}),
    onSuccess: () => {
      setDismissedLocal(false);
      qc.invalidateQueries({ queryKey: ['system-health-check-latest'] });
    },
  });

  if (!esGerencia || !ultimoCheck) return null;

  const yaReconocido = ultimoCheck.reconocida_por_gerencia;
  if (yaReconocido || dismissedLocal) return null;

  const esOk = ultimoCheck.estado_global === 'ok';

  return (
    <div className={`fixed top-0 left-0 right-0 z-[60] px-4 py-2.5 shadow text-white ${
      esOk ? 'bg-emerald-600' : 'bg-red-600 animate-pulse'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {esOk
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <div>
            <p className="font-medium text-sm">
              {esOk ? 'Sistema funcional' : 'Problema técnico detectado'}
            </p>
            <p className="text-xs opacity-80">
              {esOk
                ? `Última comprobación: ${new Date(ultimoCheck.fecha_ejecucion).toLocaleString('es-ES')}`
                : (ultimoCheck.resumen_error || 'Revisar módulos afectados')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white/10 border-white/30 text-white hover:bg-white/20"
            onClick={() => comprobarAhoraMutation.mutate()}
            disabled={comprobarAhoraMutation.isPending}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${comprobarAhoraMutation.isPending ? 'animate-spin' : ''}`} />
            Comprobar ahora
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={() => reconocerMutation.mutate(ultimoCheck.id)}
            disabled={reconocerMutation.isPending}
          >
            <X className="w-3 h-3 mr-1" />
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
}