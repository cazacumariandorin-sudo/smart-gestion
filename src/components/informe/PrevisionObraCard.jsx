/**
 * Tarjeta colapsable de una obra (carpeta) en la Vista por Obra.
 */
import { useState } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FolderOpen, Folder, ChevronDown, ChevronRight, Calendar, Clock,
  Users, Pencil, Trash2,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const STATUS_CFG = {
  planificada: { label: 'Planificada', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  en_curso:    { label: 'En curso',    className: 'bg-teal-50 text-teal-700 border-teal-200' },
  completada:  { label: 'Completada',  className: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelada:   { label: 'Cancelada',   className: 'bg-red-50 text-red-700 border-red-200' },
};

const SEMAFORO = {
  verde:    { dot: '#1D9E75', label: 'En plazo' },
  amarillo: { dot: '#BA7517', label: 'Atención' },
  rojo:     { dot: '#E24B4A', label: 'Retraso' },
  sin_datos:{ dot: '#888780', label: 'Sin datos' },
};

function durDias(inicio, fin) {
  if (!inicio || !fin) return null;
  return differenceInCalendarDays(parseISO(fin), parseISO(inicio)) + 1;
}

function fmt(d) {
  return d ? format(parseISO(d), 'd MMM yyyy', { locale: es }) : '—';
}

export default function PrevisionObraCard({ obraName, clientName, registros, forceOpen, onEdit, onDelete }) {
  const [open, setOpen] = useState(!!forceOpen);

  // Aggregate
  const fechaMin = registros.map(r => r.fecha_inicio).filter(Boolean).sort()[0];
  const fechaMax = registros.map(r => r.fecha_fin).filter(Boolean).sort().at(-1);
  const totalHoras = registros.reduce((s, r) => {
    const fromOps = (r.operarios_asignados || []).reduce((a, op) => a + (op.horas_previstas || 0), 0);
    return s + (r.horas_totales_previstas || fromOps || 0);
  }, 0);
  const totalReal = registros.reduce((s, r) => s + (r.horas_reales_acumuladas || 0), 0);
  const dias = durDias(fechaMin, fechaMax);
  const status = registros[0]?.status || 'planificada';
  const cfg = STATUS_CFG[status] || STATUS_CFG.planificada;
  const semKey = registros[0]?.status_semaforo || 'sin_datos';
  const sem = SEMAFORO[semKey];

  // Sort registros by fecha_inicio asc
  const sorted = [...registros].sort((a, b) => {
    if (!a.fecha_inicio) return 1;
    if (!b.fecha_inicio) return -1;
    return a.fecha_inicio.localeCompare(b.fecha_inicio);
  });

  return (
    <Card className="overflow-hidden">
      {/* Folder header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors select-none"
        onClick={() => setOpen(v => !v)}
      >
        <div className="text-primary shrink-0">
          {open ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{obraName}</span>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.className}`}>{cfg.label}</Badge>
            {dias && (
              <Badge variant="outline" className="text-[10px] shrink-0">
                <Calendar className="w-2.5 h-2.5 mr-1" />{dias} días
              </Badge>
            )}
            {totalHoras > 0 && (
              <Badge variant="outline" className="text-[10px] shrink-0 bg-blue-50 text-blue-700 border-blue-200">
                <Clock className="w-2.5 h-2.5 mr-1" />{totalHoras}h
              </Badge>
            )}
            {totalReal > 0 && (
              <Badge variant="outline" className="text-[10px] shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: sem.dot }} />
                Real {totalReal}h
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] shrink-0 bg-slate-50 text-slate-600">
              {registros.length} registro{registros.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
            {clientName && <span className="font-medium text-foreground/70">{clientName}</span>}
            {(fechaMin || fechaMax) && (
              <span>{fmt(fechaMin)} → {fmt(fechaMax)}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded: table of registros */}
      {open && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Fechas</th>
                  <th className="px-4 py-2 text-left font-medium">Notas</th>
                  <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Prev.</th>
                  <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Real</th>
                  <th className="px-4 py-2 text-left font-medium whitespace-nowrap">Avance</th>
                  <th className="px-4 py-2 text-left font-medium">Operarios</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                  <th className="px-4 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map(r => {
                  const rcfg = STATUS_CFG[r.status] || STATUS_CFG.planificada;
                  const rHoras = r.horas_totales_previstas
                    || (r.operarios_asignados || []).reduce((s, op) => s + (op.horas_previstas || 0), 0);
                  return (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span>{fmt(r.fecha_inicio)}</span>
                        {r.fecha_fin && r.fecha_fin !== r.fecha_inicio && (
                          <span className="text-muted-foreground"> → {fmt(r.fecha_fin)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        <span className="line-clamp-2 text-muted-foreground">{r.notas || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium">
                        {rHoras > 0 ? `${rHoras}h` : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-medium text-emerald-700">
                        {(r.horas_reales_acumuladas || 0) > 0 ? `${r.horas_reales_acumuladas}h` : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {(r.porcentaje_avance_horas || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: (SEMAFORO[r.status_semaforo] || SEMAFORO.sin_datos).dot }} />
                            {r.porcentaje_avance_horas}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.operarios_asignados?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.operarios_asignados.map((op, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap">
                                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold shrink-0">
                                  {op.operario_name?.[0]?.toUpperCase()}
                                </span>
                                {op.operario_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-[10px] ${rcfg.className}`}>{rcfg.label}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(r)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar previsión?</AlertDialogTitle>
                                <AlertDialogDescription>Se eliminará permanentemente.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(r.id)} className="bg-destructive text-destructive-foreground">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}