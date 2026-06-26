import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Detecta duplicados agrupando por operario_id + operario_name + date.
 * Devuelve solo los grupos con 2+ fichajes.
 */
function detectarDuplicados(fichajes) {
  const mapa = {};
  for (const f of fichajes) {
    const clave = `${f.operario_id}||${f.operario_name}||${f.date}`;
    if (!mapa[clave]) mapa[clave] = [];
    mapa[clave].push(f);
  }
  return Object.values(mapa).filter(g => g.length > 1);
}

/**
 * Elige el registro "mejor" a conservar:
 * - prioridad a quien tenga hora_salida
 * - si empate, el que tenga más campos rellenos
 */
function elegirMejor(grupo) {
  const conSalida = grupo.filter(f => f.hora_salida);
  const candidatos = conSalida.length > 0 ? conSalida : grupo;
  return candidatos.reduce((best, f) => {
    const score = (f.hora_salida ? 2 : 0) + (f.notas ? 1 : 0) + (f.horas_trabajadas > 0 ? 1 : 0);
    const bestScore = (best.hora_salida ? 2 : 0) + (best.notas ? 1 : 0) + (best.horas_trabajadas > 0 ? 1 : 0);
    return score > bestScore ? f : best;
  });
}

export default function DuplicadosFichajesModal({ open, onOpenChange, fichajes }) {
  const qc = useQueryClient();
  const grupos = detectarDuplicados(fichajes);
  const [borrados, setBorrados] = useState(new Set());
  const [progreso, setProgreso] = useState(null); // null | 'running' | 'done'

  const deleteM = useMutation({
    mutationFn: (id) => base44.entities.Fichaje.delete(id),
  });

  const borrarSeleccion = async (idsABorrar) => {
    for (const id of idsABorrar) {
      await deleteM.mutateAsync(id);
      setBorrados(prev => new Set([...prev, id]));
    }
    qc.invalidateQueries({ queryKey: ['fichajes'] });
  };

  const handleBorrarGrupo = async (grupo) => {
    const mejor = elegirMejor(grupo);
    const aBorrar = grupo.filter(f => f.id !== mejor.id).map(f => f.id);
    await borrarSeleccion(aBorrar);
  };

  const handleBorrarTodos = async () => {
    setProgreso('running');
    for (const grupo of gruposActivos) {
      const mejor = elegirMejor(grupo);
      const aBorrar = grupo.filter(f => f.id !== mejor.id).map(f => f.id);
      await borrarSeleccion(aBorrar);
    }
    setProgreso('done');
    qc.invalidateQueries({ queryKey: ['fichajes'] });
  };

  // Grupos que aún tienen duplicados no borrados
  const gruposActivos = grupos.filter(g => g.filter(f => !borrados.has(f.id)).length > 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Duplicados de Fichajes
          </DialogTitle>
        </DialogHeader>

        {gruposActivos.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-emerald-700">Sin duplicados detectados</p>
            <p className="text-sm text-muted-foreground mt-1">
              {grupos.length > 0 && borrados.size > 0
                ? `Se eliminaron ${borrados.size} fichaje${borrados.size > 1 ? 's' : ''} duplicados.`
                : 'No hay fichajes duplicados por operario + nombre + fecha.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-amber-600">{gruposActivos.length}</span> grupo{gruposActivos.length > 1 ? 's' : ''} con duplicados
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBorrarTodos}
                disabled={progreso === 'running' || deleteM.isPending}
                className="gap-2"
              >
                {progreso === 'running'
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Limpiando...</>
                  : <><Trash2 className="w-3.5 h-3.5" /> Limpiar todos</>}
              </Button>
            </div>

            <div className="space-y-4">
              {gruposActivos.map((grupo, gi) => {
                const activos = grupo.filter(f => !borrados.has(f.id));
                const mejor = elegirMejor(activos);
                return (
                  <div key={gi} className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
                    <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{activos[0].operario_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {activos[0].date ? format(parseISO(activos[0].date), "EEEE d 'de' MMMM yyyy", { locale: es }) : activos[0].date}
                          {' · '}<span className="text-amber-700 font-medium">{activos.length} registros</span>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={() => handleBorrarGrupo(activos)}
                        disabled={deleteM.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Mantener mejor
                      </Button>
                    </div>
                    <div className="divide-y divide-border">
                      {activos.map(f => {
                        const esMejor = f.id === mejor.id;
                        return (
                          <div key={f.id} className={`px-4 py-3 flex items-center gap-3 ${esMejor ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-muted-foreground">{f.id.slice(-6)}</span>
                                <span className="text-sm">{f.hora_entrada || '--'} → {f.hora_salida || '--'}</span>
                                {f.horas_trabajadas > 0 && (
                                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">{f.horas_trabajadas.toFixed(1)}h</Badge>
                                )}
                                {f.project && <span className="text-xs text-muted-foreground truncate max-w-[120px]">📍 {f.project}</span>}
                                {f.notas && <span className="text-xs text-muted-foreground italic truncate max-w-[100px]">💬 {f.notas}</span>}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {esMejor ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Conservar
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">
                                  Duplicado
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}