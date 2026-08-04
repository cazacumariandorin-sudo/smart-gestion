import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, Package, Clock, Lock, Archive, FileSignature } from 'lucide-react';

export default function ParteDiarioCard({ parte, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-xl p-4 space-y-2 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm min-w-0">
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{parte.obra_name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {parte.estado === 'cerrado' && <Lock className="w-3 h-3 text-blue-600" />}
          {parte.activo === false && <Archive className="w-3 h-3 text-amber-500" />}
          {parte.firma_url && <FileSignature className="w-3 h-3 text-emerald-600" />}
          <Badge variant="outline" className="text-xs">
            {format(new Date(parte.fecha), 'dd MMM yyyy', { locale: es })}
          </Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {parte.tecnico_name}
        {parte.tecnicos_adicionales?.length > 0 && ` + ${parte.tecnicos_adicionales.map(t => t.operario_name).join(', ')}`}
      </p>
      {parte.trabajos_realizados && (
        <p className="text-sm line-clamp-2"><span className="font-medium">Trabajos: </span>{parte.trabajos_realizados}</p>
      )}
      {parte.materiales_necesarios && (
        <p className="text-xs text-muted-foreground flex items-start gap-1 line-clamp-2">
          <Package className="w-3.5 h-3.5 mt-0.5 shrink-0" />{parte.materiales_necesarios}
        </p>
      )}
      {parte.trabajos_pendientes && (
        <p className="text-xs text-amber-600 flex items-start gap-1 line-clamp-2">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />Pendiente: {parte.trabajos_pendientes}
        </p>
      )}
      {parte.fotos?.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {parte.fotos.slice(0, 4).map((f, i) => (
            <img key={i} src={f.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
          ))}
        </div>
      )}
    </button>
  );
}