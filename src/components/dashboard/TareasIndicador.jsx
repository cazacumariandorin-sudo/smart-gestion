import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Check, X, Clock, AlertTriangle, ChevronRight, FileText, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PRIORIDAD_CONFIG = {
  urgente: { color: 'bg-red-500', pulse: 'animate-ping', text: 'text-red-500', label: 'Urgente', badgeClass: 'bg-red-100 text-red-700 border-red-200' },
  alta:    { color: 'bg-orange-500', pulse: 'animate-ping', text: 'text-orange-500', label: 'Alta', badgeClass: 'bg-orange-100 text-orange-700 border-orange-200' },
  media:   { color: 'bg-yellow-400', pulse: 'animate-ping', text: 'text-yellow-500', label: 'Media', badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  baja:    { color: 'bg-blue-400', pulse: '', text: 'text-blue-400', label: 'Baja', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const PRIORIDAD_ORDER = ['urgente', 'alta', 'media', 'baja'];

function getPrioridadMax(tareas) {
  for (const p of PRIORIDAD_ORDER) {
    if (tareas.some(t => t.prioridad === p)) return p;
  }
  return 'media';
}

// ── Indicador pulsante para una tarjeta de módulo ────────────────────────────
export function ModuloBadge({ moduloId, tareas, onClick }) {
  const tareasMod = tareas.filter(t =>
    t.modulo === moduloId && t.estado === 'pendiente'
  );
  if (tareasMod.length === 0) return null;

  const prioridad = getPrioridadMax(tareasMod);
  const cfg = PRIORIDAD_CONFIG[prioridad];
  const count = tareasMod.length;

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(tareasMod); }}
      className="absolute -top-1.5 -right-1.5 z-20 flex items-center justify-center"
      title={`${count} tarea${count !== 1 ? 's' : ''} pendiente${count !== 1 ? 's' : ''}`}
    >
      <span className={cn('absolute inline-flex rounded-full h-full w-full opacity-75', cfg.color, cfg.pulse)} />
      <span className={cn(
        'relative inline-flex rounded-full items-center justify-center font-bold text-white shadow-md',
        cfg.color,
        count > 1 ? 'h-5 w-5 text-[9px] min-w-[20px] px-1' : 'h-3 w-3'
      )}>
        {count > 1 ? count : ''}
      </span>
    </button>
  );
}

// ── Panel lateral de tareas ──────────────────────────────────────────────────
function TareaItem({ tarea, onCompletar, onDescartar, completando }) {
  const cfg = PRIORIDAD_CONFIG[tarea.prioridad] || PRIORIDAD_CONFIG.media;
  const isProcessing = completando === tarea.id;

  return (
    <div className="border border-border rounded-xl p-3 space-y-2 bg-card">
      <div className="flex items-start gap-2">
        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', cfg.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{tarea.titulo}</p>
          {tarea.descripcion && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tarea.descripcion}</p>
          )}
          
          {/* Barra de progreso minimalista */}
          {isProcessing && (
            <motion.div
              className="h-0.5 w-full bg-muted rounded-full mt-2 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={cn('h-full rounded-full', cfg.color)}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
            </motion.div>
          )}
        </div>
        <Badge variant="outline" className={cn('text-[9px] shrink-0', cfg.badgeClass)}>
          {cfg.label}
        </Badge>
      </div>

      {tarea.origen_solicitud && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{tarea.origen_solicitud}</span>
        </div>
      )}

      {tarea.fecha_limite && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Límite: {new Date(tarea.fecha_limite).toLocaleDateString('es-ES')}</span>
        </div>
      )}

      {!isProcessing ? (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-3 text-xs gap-1 flex-1 border-green-200 text-green-700 hover:bg-green-50"
            onClick={() => onCompletar(tarea.id)}
          >
            <Check className="w-3 h-3" /> Completar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-xs gap-1 text-muted-foreground hover:text-destructive"
            onClick={() => onDescartar(tarea.id)}
          >
            <X className="w-3 h-3" /> Descartar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Clock className="w-3 h-3" />
          </motion.div>
          <span>Procesando...</span>
        </div>
      )}
    </div>
  );
}

// ── Panel principal ──────────────────────────────────────────────────────────
export function PanelTareas({ tareasSeleccionadas, onClose }) {
  const [completando, setCompletando] = useState(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, estado }) => base44.entities.AsistenteTarea.update(id, { estado }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas_admin'] });
      setCompletando(null);
    },
  });

  const handleCompletar = (id) => {
    setCompletando(id);
    mutation.mutate({ id, estado: 'completada' });
  };

  const handleDescartar = (id) => {
    setCompletando(id);
    mutation.mutate({ id, estado: 'descartada' });
  };

  const pendientes = tareasSeleccionadas.filter(t => t.estado === 'pendiente');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md max-h-[80vh] flex flex-col bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <div>
              <h3 className="font-bold text-sm">Tareas Pendientes</h3>
              <p className="text-xs text-muted-foreground">{pendientes.length} tarea{pendientes.length !== 1 ? 's' : ''} por resolver</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Lista */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2.5">
          {pendientes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay tareas pendientes</p>
            </div>
          ) : (
            pendientes.map(tarea => (
              <TareaItem
                key={tarea.id}
                tarea={tarea}
                onCompletar={handleCompletar}
                onDescartar={handleDescartar}
                completando={completando}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hook para cargar tareas admin ────────────────────────────────────────────
export function useTareasAdmin(enabled) {
  return useQuery({
    queryKey: ['tareas_admin'],
    queryFn: () => base44.entities.AsistenteTarea.filter({ estado: 'pendiente' }, '-created_date', 100),
    enabled,
    staleTime: 60_000,
  });
}