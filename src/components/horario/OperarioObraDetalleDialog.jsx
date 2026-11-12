/**
 * OperarioObraDetalleDialog — Drill-down de la vista "Por obra".
 * Muestra los fichajes de un operario en una obra concreta y periodo,
 * agrupados por día, con horas y desglose entrada/salida.
 */
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Clock, CalendarDays, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { minutosATexto, calcularMinutosFichaje } from './InformesTab';

export default function OperarioObraDetalleDialog({
  open, onOpenChange, operario, fichajes, obraLabel, periodLabel,
}) {
  const [expandedDay, setExpandedDay] = useState(null);

  // Agrupar por día (descendente)
  const porDia = useMemo(() => {
    if (!operario || !fichajes.length) return [];
    const map = {};
    fichajes.forEach(f => {
      const key = f.date ? f.date.slice(0, 10) : 'sin-fecha';
      if (!map[key]) {
        map[key] = { fecha: key, minutos: 0, fichajes: [] };
      }
      map[key].minutos += calcularMinutosFichaje(f);
      map[key].fichajes.push(f);
    });
    return Object.values(map).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [operario, fichajes]);

  if (!operario) return null;

  const totalMinutos = porDia.reduce((s, d) => s + d.minutos, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-2 border-b border-border sticky top-0 bg-background z-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold shrink-0">
              {operario.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate">{operario.name}</p>
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs flex items-center gap-1.5 mt-1">
            <CalendarDays className="w-3 h-3" />
            <span className="font-medium text-foreground">{obraLabel}</span>
            <span>·</span>
            <span className="capitalize">{periodLabel}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 pt-3 space-y-3">
          {/* Resumen del operario */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Horas</p>
              <p className="text-base font-bold text-primary">{minutosATexto(totalMinutos)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Días</p>
              <p className="text-base font-bold">{porDia.length}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Fichajes</p>
              <p className="text-base font-bold">{fichajes.length}</p>
            </div>
          </div>

          {/* Lista de días */}
          {porDia.length === 0 ? (
            <div className="py-10 text-center">
              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sin registros en el periodo</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold px-1">
                Detalle por día ({porDia.length})
              </p>
              {porDia.map(d => {
                const dateObj = d.fecha === 'sin-fecha' ? null : parseISO(d.fecha);
                const diaLabel = dateObj ? format(dateObj, 'EEE dd MMM', { locale: es }) : 'Sin fecha';
                const isExpanded = expandedDay === d.fecha;
                return (
                  <div key={d.fecha} className="border border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedDay(isExpanded ? null : d.fecha)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <span className="text-sm font-semibold capitalize truncate">{diaLabel}</span>
                        <span className="text-[10px] text-muted-foreground">{d.fichajes.length} reg.</span>
                      </div>
                      <span className="text-sm font-bold text-primary whitespace-nowrap">
                        {minutosATexto(d.minutos)}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-border/60 bg-muted/20 divide-y divide-border/40">
                        {d.fichajes.map(f => (
                          <div key={f.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {f.hora_entrada ? `Entrada ${f.hora_entrada}` : 'Sin entrada'}
                                {f.hora_salida ? ` · Salida ${f.hora_salida}` : ''}
                              </p>
                              {(f.notas || f.observaciones) && (
                                <p className="text-[10px] text-muted-foreground truncate">{f.notas || f.observaciones}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {minutosATexto(calcularMinutosFichaje(f))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}