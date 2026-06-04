import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, PlayCircle, XCircle, ChevronDown, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const PRIORIDAD_COLORS = {
  urgente: 'bg-red-100 text-red-700 border-red-200',
  alta: 'bg-orange-100 text-orange-700 border-orange-200',
  media: 'bg-blue-100 text-blue-700 border-blue-200',
  baja: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ESTADO_ICONS = {
  pendiente: Circle,
  en_curso: PlayCircle,
  completada: CheckCircle2,
  descartada: XCircle,
};

const FILTROS = ['todas', 'pendiente', 'en_curso', 'completada'];

export default function AsistenteTareas({ currentUser, onSwitchChat }) {
  const [filtro, setFiltro] = useState('pendiente');
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['asistente-tareas', currentUser?.id],
    queryFn: () => base44.entities.AsistenteTarea.list('-created_date', 50),
    enabled: !!currentUser,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AsistenteTarea.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['asistente-tareas'] }),
    onError: err => toast.error(err.message),
  });

  const tareasFiltradas = tareas.filter(t => {
    if (filtro === 'todas') return true;
    return t.estado === filtro;
  }).sort((a, b) => {
    const ord = { urgente: 0, alta: 1, media: 2, baja: 3 };
    return (ord[a.prioridad] ?? 2) - (ord[b.prioridad] ?? 2);
  });

  const pendientes = tareas.filter(t => t.estado === 'pendiente' || t.estado === 'en_curso').length;

  const cambiarEstado = (tarea, nuevoEstado) => {
    updateMutation.mutate({ id: tarea.id, data: { estado: nuevoEstado, fecha_completada: nuevoEstado === 'completada' ? new Date().toISOString() : null } });
    toast.success(`Tarea ${nuevoEstado === 'completada' ? 'completada' : 'actualizada'}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header con filtros */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Mis Tareas</p>
          {pendientes > 0 && (
            <Badge className="bg-blue-600 text-white text-xs">{pendientes} activas</Badge>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTROS.map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs capitalize transition-colors',
                filtro === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="text-center text-muted-foreground text-sm py-8">Cargando tareas...</div>
        )}
        {!isLoading && tareasFiltradas.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-10 flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 opacity-20" />
            <p>No hay tareas {filtro !== 'todas' ? `en estado "${filtro}"` : ''}</p>
            <button onClick={onSwitchChat} className="text-blue-600 text-xs hover:underline">
              Pide al asistente que cree una
            </button>
          </div>
        )}

        {tareasFiltradas.map(tarea => {
          const StateIcon = ESTADO_ICONS[tarea.estado] || Circle;
          const expanded = expandedId === tarea.id;
          const vencida = tarea.fecha_limite && new Date(tarea.fecha_limite) < new Date() && tarea.estado !== 'completada';

          return (
            <div key={tarea.id} className={cn('rounded-xl border bg-card overflow-hidden transition-all', vencida && 'border-red-200')}>
              <button
                className="w-full text-left p-3 flex items-start gap-2.5"
                onClick={() => setExpandedId(expanded ? null : tarea.id)}
              >
                <StateIcon className={cn('w-4 h-4 mt-0.5 shrink-0',
                  tarea.estado === 'completada' ? 'text-green-500' :
                  tarea.estado === 'en_curso' ? 'text-blue-500' :
                  tarea.estado === 'descartada' ? 'text-muted-foreground' :
                  'text-muted-foreground'
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('text-sm font-medium truncate', tarea.estado === 'completada' && 'line-through text-muted-foreground')}>
                      {tarea.titulo}
                    </p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border capitalize shrink-0', PRIORIDAD_COLORS[tarea.prioridad])}>
                      {tarea.prioridad}
                    </span>
                  </div>
                  {tarea.fecha_limite && (
                    <div className={cn('flex items-center gap-1 text-[11px] mt-0.5', vencida ? 'text-red-500' : 'text-muted-foreground')}>
                      {vencida ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {format(new Date(tarea.fecha_limite), "d MMM yyyy", { locale: es })}
                    </div>
                  )}
                </div>
                <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 transition-transform', expanded && 'rotate-180')} />
              </button>

              {expanded && (
                <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border">
                  {tarea.descripcion && (
                    <p className="text-xs text-muted-foreground">{tarea.descripcion}</p>
                  )}
                  {tarea.contexto_ia && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-[11px] text-blue-700 dark:text-blue-300">
                      <span className="font-medium">IA: </span>{tarea.contexto_ia}
                    </div>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    {tarea.estado === 'pendiente' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => cambiarEstado(tarea, 'en_curso')}>
                        En curso
                      </Button>
                    )}
                    {(tarea.estado === 'pendiente' || tarea.estado === 'en_curso') && (
                      <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => cambiarEstado(tarea, 'completada')}>
                        Completar
                      </Button>
                    )}
                    {tarea.estado !== 'descartada' && tarea.estado !== 'completada' && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => cambiarEstado(tarea, 'descartada')}>
                        Descartar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}