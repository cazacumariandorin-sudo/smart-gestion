import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ChevronRight, AlertTriangle, CalendarClock, Gavel } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { estadoMeta, tipoFaltaMeta } from '@/lib/expedientesCatalogo';
import { cn } from '@/lib/utils';

export default function ExpedienteCard({ expediente, onClick }) {
  const estado = estadoMeta(expediente.estado);
  const tipo = tipoFaltaMeta(expediente.tipo_falta);

  const diasPrescripcion = expediente.estado === 'abierto' && expediente.fecha_prescripcion
    ? differenceInCalendarDays(parseISO(expediente.fecha_prescripcion), new Date())
    : null;

  return (
    <Card
      className="p-3 hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{expediente.codigo}</span>
            <Badge variant="outline" className={cn('text-[10px] py-0', tipo.className)}>{tipo.label}</Badge>
            <Badge variant="outline" className={cn('text-[10px] py-0', estado.className)}>{estado.label}</Badge>
            {expediente.reincidencia && (
              <Badge variant="outline" className="text-[10px] py-0 bg-orange-50 text-orange-700 border-orange-200">
                Reincidencia
              </Badge>
            )}
          </div>
          <p className="text-sm font-semibold mt-1 truncate">{expediente.operario_name || '—'}</p>
          <p className="text-xs text-muted-foreground truncate">
            {expediente.articulo || 'Sin artículo'} · apertura {expediente.fecha_apertura || '—'}
          </p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-muted-foreground">
            {expediente.fecha_caducidad && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="w-3 h-3" /> caduca {expediente.fecha_caducidad}
              </span>
            )}
            {expediente.fecha_archivo && (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Gavel className="w-3 h-3" /> acta firmada
              </span>
            )}
            {diasPrescripcion !== null && (
              <span className={cn('inline-flex items-center gap-1', diasPrescripcion < 3 ? 'text-red-600 font-semibold' : '')}>
                <AlertTriangle className="w-3 h-3" />
                {diasPrescripcion >= 0 ? `${diasPrescripcion} días para notificar` : 'plazo vencido'}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </Card>
  );
}