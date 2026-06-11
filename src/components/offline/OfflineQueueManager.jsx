/**
 * OfflineQueueManager — Gestor visual de la cola offline
 * Componente para ver, reintentar y eliminar items de la cola
 */

import { useEffect, useState } from 'react';
import { getQueue, removeFromQueue, updateQueue, getDeadLetters } from '@/utils/offlineQueue';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function OfflineQueueManager() {
  const [queue, setQueue] = useState([]);
  const [deadLetters, setDeadLetters] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showDeadLetters, setShowDeadLetters] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Recargar cola cuando cambia
  useEffect(() => {
    const refreshQueue = () => {
      setQueue(getQueue());
      setDeadLetters(getDeadLetters());
    };

    refreshQueue();

    // Escuchar cambios de cola
    const handleQueueChange = () => refreshQueue();
    window.addEventListener('offlineQueue:synced', handleQueueChange);
    window.addEventListener('offlineQueue:updated', handleQueueChange);

    // Recargar cada 5 segundos
    const interval = setInterval(refreshQueue, 5000);

    return () => {
      window.removeEventListener('offlineQueue:synced', handleQueueChange);
      window.removeEventListener('offlineQueue:updated', handleQueueChange);
      clearInterval(interval);
    };
  }, []);

  if (queue.length === 0 && deadLetters.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Botón flotante en la esquina */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-14 h-14 p-0 shadow-lg"
          variant={queue.length > 0 ? 'destructive' : 'secondary'}
        >
          <AlertTriangle className="w-6 h-6" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center">
            {queue.length + deadLetters.length}
          </span>
        </Button>
      </div>

      {/* Modal */}
      <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Cola Offline ({queue.length} pendientes, {deadLetters.length} fallidos)
          </DialogTitle>
        </DialogHeader>

        {/* PENDIENTES */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pendientes de Sincronizar ({queue.length})
          </h3>

          {queue.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin items pendientes</p>
          ) : (
            queue.map(item => (
              <Card
                key={item.id}
                className="p-3 border-amber-200 bg-amber-50/50"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              >
                <div className="flex items-start justify-between gap-2 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.entityName}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          item.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {item.priority === 'high' ? '⚠️ Alto' : 'Normal'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.intentos}/{item.maxRetries}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.timestamp), 'dd MMM HH:mm', { locale: es })}
                    </p>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQueue(item.id, { intentos: 0 });
                      }}
                      title="Reintentar"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(item.id);
                        setQueue(queue.filter(i => i.id !== item.id));
                      }}
                      title="Eliminar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    {expanded === item.id ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Detalles expandidos */}
                {expanded === item.id && (
                  <div className="mt-3 pt-3 border-t border-amber-200">
                    <pre className="text-xs bg-white p-2 rounded overflow-x-auto">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                    {item.error && (
                      <p className="text-xs text-red-600 mt-2">Error: {item.error}</p>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* DEAD LETTERS */}
        {deadLetters.length > 0 && (
          <div className="space-y-3 mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeadLetters(!showDeadLetters)}
              className="flex items-center gap-2 w-full justify-start"
            >
              {showDeadLetters ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Fallidos permanentemente ({deadLetters.length})</span>
            </Button>

            {showDeadLetters &&
              deadLetters.map(item => (
                <Card key={item.id} className="p-3 border-red-200 bg-red-50/50">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Badge variant="destructive" className="text-xs">
                          {item.entityName}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Fallado:{' '}
                          {format(new Date(item.failedAt), 'dd MMM HH:mm', {
                            locale: es,
                          })}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          removeFromQueue(item.id);
                          setDeadLetters(deadLetters.filter(i => i.id !== item.id));
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    {item.error && (
                      <p className="text-xs text-red-600 font-mono">
                        {item.error}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
          </div>
        )}

        {/* Pie */}
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          <p>
            Los items se sincronizarán automáticamente cuando recuperes conexión.
          </p>
          <p>Reintentos con backoff exponencial: 1s → 2s → 4s → 8s → 16s</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OfflineQueueManager;
