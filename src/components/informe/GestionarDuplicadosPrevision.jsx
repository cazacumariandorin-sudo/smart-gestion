import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Copy, Trash2, AlertTriangle, Loader2, Calendar, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const CLAVE_DUPLICADO = (p) =>
  p.obra_id ? `obra:${p.obra_id}` : `obra_name:${(p.obra_name || '').toLowerCase().trim()}`;

const rangosSolapan = (a, b) => {
  if (!a.fecha_inicio || !b.fecha_inicio) return false;
  const sa = parseISO(a.fecha_inicio);
  const ea = a.fecha_fin ? parseISO(a.fecha_fin) : sa;
  const sb = parseISO(b.fecha_inicio);
  const eb = b.fecha_fin ? parseISO(b.fecha_fin) : sb;
  // Solapamiento inclusivo de [start, end]
  return sa <= eb && sb <= ea;
};

/**
 * Detecta grupos de previsiones duplicadas (misma obra + rangos solapados).
 * Devuelve: [{ clave, obra_name, client_name, previsiones: [...] }]
 */
export function detectarDuplicados(previsiones) {
  const porObra = new Map();
  previsiones.forEach(p => {
    const k = CLAVE_DUPLICADO(p);
    if (!porObra.has(k)) porObra.set(k, []);
    porObra.get(k).push(p);
  });

  const grupos = [];
  porObra.forEach((items, clave) => {
    if (items.length < 2) return;
    // Sub-grupos solapados: para cada item busca con cuáles solapa
    const visitados = new Set();
    items.forEach((a) => {
      if (visitados.has(a.id)) return;
      const cluster = [a];
      visitados.add(a.id);
      // Crecer el cluster añadiendo cualquier item que solape con alguno existente
      let cambio = true;
      while (cambio) {
        cambio = false;
        for (const b of items) {
          if (visitados.has(b.id)) continue;
          if (cluster.some(c => rangosSolapan(c, b))) {
            cluster.push(b);
            visitados.add(b.id);
            cambio = true;
          }
        }
      }
      if (cluster.length >= 2) {
        grupos.push({
          clave,
          obra_name: cluster[0].obra_name,
          client_name: cluster[0].client_name,
          previsiones: cluster,
        });
      }
    });
  });

  return grupos;
}

export default function GestionarDuplicadosPrevision({ previsiones, onOpenChange, open }) {
  const qc = useQueryClient();
  const [eliminando, setEliminando] = useState(null);

  const grupos = useMemo(() => detectarDuplicados(previsiones), [previsiones]);

  const deleteM = useMutation({
    mutationFn: async (id) => base44.entities.PrevisionObra.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['previsiones_obra'] });
      toast.success('Previsión duplicada eliminada');
    },
    onError: (e) => toast.error(e.message || 'No se pudo eliminar'),
    onSettled: () => setEliminando(null),
  });

  const totalDuplicados = useMemo(
    () => grupos.reduce((s, g) => s + (g.previsiones.length - 1), 0),
    [grupos]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Duplicados detectados
            {totalDuplicados > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                {totalDuplicados} redundantes
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {grupos.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-foreground">No se detectaron duplicados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todas las previsiones tienen obras o rangos de fechas distintos.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <p className="text-xs text-muted-foreground flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-md p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Se detectaron previsiones de la <b>misma obra</b> cuyas fechas se solapan.
                Conserva una y elimina las redundantes (solo Admin/Gerencia).
              </span>
            </p>

            {grupos.map((g) => (
              <Card key={g.clave} className="overflow-hidden">
                <div className="bg-amber-50/60 border-b border-amber-100 px-3 py-2 flex items-center gap-2">
                  <Copy className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{g.obra_name || '(sin nombre)'}</p>
                    {g.client_name && (
                      <p className="text-xs text-muted-foreground truncate">{g.client_name}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                    {g.previsiones.length} previsiones
                  </Badge>
                </div>

                <div className="divide-y divide-border">
                  {g.previsiones
                    .slice()
                    .sort((a, b) => (a.fecha_inicio || '').localeCompare(b.fecha_inicio || ''))
                    .map((p, idx) => (
                      <div key={p.id} className="px-3 py-2.5 flex items-center gap-3 text-xs">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
                            {p.fecha_inicio && format(parseISO(p.fecha_inicio), 'dd MMM yyyy', { locale: es })}
                            {p.fecha_fin && (
                              <span className="text-muted-foreground">— {format(parseISO(p.fecha_fin), 'dd MMM yyyy', { locale: es })}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                            {p.operarios_asignados?.length > 0 && (
                              <span>{p.operarios_asignados.length} operarios</span>
                            )}
                            {p.horas_totales_previstas > 0 && (
                              <span>{p.horas_totales_previstas}h previstas</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          disabled={eliminando === p.id}
                          onClick={() => { setEliminando(p.id); deleteM.mutate(p.id); }}
                          title="Eliminar esta previsión"
                        >
                          {eliminando === p.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}