import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, Package, Clock } from 'lucide-react';

export default function ParteDiarioCard({ parte }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm min-w-0">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{parte.obra_name}</span>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {format(new Date(parte.fecha), 'dd MMM yyyy', { locale: es })}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {parte.tecnico_name}
        {parte.tecnicos_adicionales?.length > 0 && ` + ${parte.tecnicos_adicionales.map(t => t.operario_name).join(', ')}`}
      </p>
      {parte.trabajos_realizados && (
        <p className="text-sm"><span className="font-medium">Trabajos: </span>{parte.trabajos_realizados}</p>
      )}
      {parte.materiales_necesarios && (
        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <Package className="w-3.5 h-3.5 mt-0.5 shrink-0" />{parte.materiales_necesarios}
        </p>
      )}
      {parte.trabajos_pendientes && (
        <p className="text-xs text-amber-600 flex items-start gap-1">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />Pendiente: {parte.trabajos_pendientes}
        </p>
      )}
      {parte.fotos?.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {parte.fotos.map((f, i) => (
            <img key={i} src={f.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}