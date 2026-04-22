import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NotificacionesFichaje() {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ['notificaciones_fichaje'],
    queryFn: () => base44.entities.NotificacionFichaje.list('-created_date', 50),
    enabled: isAdmin,
    refetchInterval: 30000, // Refrescar cada 30s
  });

  const marcarVisto = useMutation({
    mutationFn: (id) => base44.entities.NotificacionFichaje.update(id, { visto: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones_fichaje'] })
  });

  const marcarResuelto = useMutation({
    mutationFn: (id) => base44.entities.NotificacionFichaje.update(id, { resuelto: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones_fichaje'] })
  });

  const noVistas = alertas.filter(a => !a.visto);
  const sinResolver = alertas.filter(a => !a.resuelto && !a.visto);

  if (!isAdmin || isLoading) return null;
  if (alertas.length === 0) return null;

  const tipoConfig = {
    sin_salida: { label: 'Sin hora de salida', icon: Clock, color: 'bg-amber-50 border-amber-200' },
    sin_fichaje: { label: 'Sin fichaje', icon: AlertCircle, color: 'bg-red-50 border-red-200' },
  };

  return (
    <Card className="p-4 mb-6 border-2 border-primary/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Alertas de Fichaje</h3>
            <p className="text-xs text-muted-foreground">{sinResolver.length} sin resolver</p>
          </div>
        </div>
        {noVistas.length > 0 && (
          <Badge className="bg-red-600 text-white animate-pulse">{noVistas.length} nueva{noVistas.length > 1 ? 's' : ''}</Badge>
        )}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {alertas.slice(0, 10).map(alerta => {
          const cfg = tipoConfig[alerta.tipo];
          const Icon = cfg.icon;
          return (
            <div
              key={alerta.id}
              className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 transition-all ${
                alerta.resuelto ? 'opacity-50 bg-muted/30' : cfg.color
              }`}
            >
              <div className="flex-1 min-w-0 flex items-start gap-2">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${alerta.resuelto ? 'text-muted-foreground' : 'text-amber-600'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {alerta.operario_name}
                    {alerta.resuelto && <span className="ml-1 text-green-600 text-[10px]">✓ Resuelto</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{cfg.label} • {alerta.date ? format(parseISO(alerta.date), 'd MMM', { locale: es }) : ''}</p>
                </div>
              </div>
              {!alerta.resuelto && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => marcarVisto.mutate(alerta.id)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-green-600 hover:text-green-700"
                    onClick={() => marcarResuelto.mutate(alerta.id)}
                    title="Marcar como resuelto (fichaje completado)"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {alertas.length > 10 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">{alertas.length - 10} más...</p>
      )}
    </Card>
  );
}