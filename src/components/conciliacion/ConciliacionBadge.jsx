import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ConciliacionBadge — indicador único del estado de conciliación contable.
 * Estados visuales derivados de estado_conciliacion + resolucion_estado:
 *  - no_conciliado          → gris "No conciliado"
 *  - conciliado             → verde "Conciliado"
 *  - conciliado_con_discrepancia → ámbar/rojo "Discrepancia" + sub-etiqueta (Pendiente/Resuelta/Cerrada)
 * Informativo, sin botón de acción.
 */
const RESOLUCION_LABEL = {
  pendiente: 'Pendiente',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
  sin_discrepancia: '',
};

export default function ConciliacionBadge({ nota, className }) {
  const estado = nota?.estado_conciliacion || 'no_conciliado';

  if (estado === 'conciliado') {
    return (
      <Badge className={cn('text-[10px] bg-green-100 text-green-700 border-green-200', className)}>
        <CheckCircle2 className="w-3 h-3 mr-1" /> Conciliado
      </Badge>
    );
  }

  if (estado === 'conciliado_con_discrepancia') {
    const res = nota?.resolucion_estado || 'pendiente';
    const resLabel = RESOLUCION_LABEL[res] || 'Pendiente';
    const isPendiente = res === 'pendiente';
    return (
      <Badge
        className={cn(
          'text-[10px] border',
          isPendiente
            ? 'bg-red-100 text-red-700 border-red-200'
            : 'bg-amber-100 text-amber-700 border-amber-200',
          className
        )}
        title={nota?.nota_conciliacion ? `Nota gestoría: ${nota.nota_conciliacion}` : undefined}
      >
        <AlertTriangle className="w-3 h-3 mr-1" /> Discrepancia · {resLabel}
      </Badge>
    );
  }

  return (
    <Badge className={cn('text-[10px] bg-slate-100 text-slate-500 border-slate-200', className)}>
      <Circle className="w-3 h-3 mr-1" /> No conciliado
    </Badge>
  );
}