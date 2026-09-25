import { ScrollText, Car, AlertCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { estadoLabel, estadoColor, MOTIVO_DESCARGO } from './multaConstants';

export default function MultaCard({ multa, onClick }) {
  const m = multa;
  return (
    <Card
      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onClick(m)}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
          <ScrollText className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm tracking-widest">{m.vehiculo_matricula}</span>
            <Badge className={cn('text-xs', estadoColor(m.estado))}>{estadoLabel(m.estado)}</Badge>
            {!m.descargo_presenta && m.estado === 'pendiente_revision' && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px]">Sin descargo</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
            {m.fecha_multa}{m.hora_multa ? <><Clock className="w-3 h-3 inline" /> {m.hora_multa}</> : ''} · {m.autoridad} · {MOTIVO_DESCARGO[m.motivo_autoridad] || m.motivo_autoridad}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold">{m.importe != null ? `${Number(m.importe).toFixed(2)} €` : '—'}</p>
        </div>
      </div>
    </Card>
  );
}