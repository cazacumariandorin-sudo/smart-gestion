import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { resumenPago, eur } from '@/lib/pagosNomina';

/**
 * Estado de pago de una nómina: verde si está cobrada por completo,
 * rojo con lo que falta por cobrar si el pago es parcial o no existe.
 */
export default function EstadoPagoBadge({ nomina, justificantes = [] }) {
  const { estado, pagado, falta } = resumenPago(nomina, justificantes);

  if (estado === 'sin_importe') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (estado === 'pagado') {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] gap-1 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" /> Pagada
      </Badge>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Badge variant="destructive" className="text-[10px] gap-1 whitespace-nowrap">
        <AlertCircle className="w-3 h-3" /> Falta {eur(falta)}
      </Badge>
      {pagado > 0 && (
        <span className="text-[10px] font-medium text-emerald-600">Cobrado {eur(pagado)}</span>
      )}
    </div>
  );
}