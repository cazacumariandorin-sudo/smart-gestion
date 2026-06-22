import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, CalendarX } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ESTADO_CFG = {
  pendiente:  { label: 'Pendiente',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  aprobada:   { label: 'Aprobada',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rechazada:  { label: 'Rechazada',  className: 'bg-red-100 text-red-700 border-red-200' },
};

export default function PanelAprobacionCancelaciones() {
  const qc = useQueryClient();
  const { user, isAdmin, isJefeObra, role } = useUserRole();
  const canResolve = isAdmin || isJefeObra || role === 'gerencia' || role === 'director_comercial';

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes_cancelacion'],
    queryFn: () => base44.entities.SolicitudCancelacionVacacion.list('-created_date', 100),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, estado }) => base44.entities.SolicitudCancelacionVacacion.update(id, {
      estado,
      resuelta_por: user?.email || '',
      resuelta_por_nombre: user?.full_name || '',
      fecha_resolucion: new Date().toISOString(),
    }),
    onSuccess: async (_, { id, estado, vacacion_id }) => {
      // Si aprobada, eliminar la vacación original
      if (estado === 'aprobada' && vacacion_id) {
        await base44.entities.Vacacion.delete(vacacion_id).catch(() => {});
        qc.invalidateQueries({ queryKey: ['vacaciones'] });
      }
      qc.invalidateQueries({ queryKey: ['solicitudes_cancelacion'] });
    },
  });

  const pendientes = solicitudes.filter(s => s.estado === 'pendiente');
  const resueltas = solicitudes.filter(s => s.estado !== 'pendiente');

  if (isLoading) return (
    <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
  );

  return (
    <div className="space-y-6">
      {/* Pendientes */}
      <div>
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <CalendarX className="w-4 h-4 text-amber-600" />
          Solicitudes pendientes
          {pendientes.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{pendientes.length}</Badge>
          )}
        </h3>
        {pendientes.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-xl">
            <p className="text-sm text-muted-foreground">No hay solicitudes pendientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendientes.map(s => (
              <SolicitudRow key={s.id} s={s} canResolve={canResolve} onResolve={resolveMutation} />
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      {resueltas.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 text-muted-foreground">Historial resueltas</h3>
          <div className="space-y-2">
            {resueltas.slice(0, 10).map(s => (
              <SolicitudRow key={s.id} s={s} canResolve={false} onResolve={resolveMutation} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SolicitudRow({ s, canResolve, onResolve }) {
  const estadoCfg = ESTADO_CFG[s.estado] || ESTADO_CFG.pendiente;
  const isPending = onResolve.isPending && onResolve.variables?.id === s.id;

  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{s.operario_name}</span>
          <Badge variant="outline" className={cn('text-[10px]', estadoCfg.className)}>{estadoCfg.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {s.fecha_inicio_vac}{s.fecha_fin_vac && s.fecha_fin_vac !== s.fecha_inicio_vac ? ` → ${s.fecha_fin_vac}` : ''} · {s.tipo_vac}
        </p>
        <p className="text-xs text-foreground mt-1 italic">"{s.motivo}"</p>
        {s.resuelta_por_nombre && (
          <p className="text-[10px] text-muted-foreground mt-1">Resuelta por {s.resuelta_por_nombre}</p>
        )}
      </div>
      {canResolve && s.estado === 'pendiente' && (
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
            disabled={isPending}
            onClick={() => onResolve.mutate({ id: s.id, estado: 'aprobada', vacacion_id: s.vacacion_id })}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 text-destructive hover:bg-red-50"
            disabled={isPending}
            onClick={() => onResolve.mutate({ id: s.id, estado: 'rechazada', vacacion_id: s.vacacion_id })}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </Card>
  );
}