import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Lock, CheckCircle2, Clock, XCircle, AlertTriangle, FileText, Image } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ESTADO_CONFIG = {
  borrador:   { label: 'Borrador',   color: 'bg-slate-100 text-slate-700 border-slate-200',   icon: Clock },
  pendiente:  { label: 'Pendiente',  color: 'bg-amber-100 text-amber-700 border-amber-200',   icon: Clock },
  validada:   { label: 'Validada',   color: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle2 },
  cerrada:    { label: 'Cerrada',    color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Lock },
  rechazada:  { label: 'Rechazada', color: 'bg-red-100 text-red-700 border-red-200',           icon: XCircle },
};

const CAT_COLORS = {
  material:    'bg-violet-100 text-violet-700',
  combustible: 'bg-orange-100 text-orange-700',
  peaje:       'bg-cyan-100 text-cyan-700',
  parking:     'bg-teal-100 text-teal-700',
  otros:       'bg-slate-100 text-slate-600',
};

export default function NotaGastoCard({ nota, onVer }) {
  const cfg = ESTADO_CONFIG[nota.estado] || ESTADO_CONFIG.pendiente;
  const Icon = cfg.icon;

  return (
    <Card
      className={cn(
        'p-4 hover:shadow-md transition-all cursor-pointer border',
        nota.es_gasto_tardio && 'border-red-300 dark:border-red-700'
      )}
      onClick={() => onVer?.(nota)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs font-bold text-primary">{nota.numero_nota || '—'}</span>
            <Badge className={cn('text-[10px] border', cfg.color)}>
              <Icon className="w-3 h-3 mr-1" />{cfg.label}
            </Badge>
            <Badge className={cn('text-[10px]', CAT_COLORS[nota.categoria] || CAT_COLORS.otros)}>
              {nota.categoria}
            </Badge>
            {nota.es_gasto_tardio && (
              <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">
                <AlertTriangle className="w-3 h-3 mr-1" /> Tardío
              </Badge>
            )}
            {nota.es_posible_duplicado && !nota.duplicado_confirmado && (
              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                ⚠ Posible dup.
              </Badge>
            )}
          </div>

          <p className="text-sm font-semibold truncate">{nota.nombre_comercio || nota.concepto || 'Sin descripción'}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {nota.fecha_documento && <span>📅 {nota.fecha_documento}</span>}
            {nota.obra_name && <span>🏗️ {nota.obra_name}</span>}
            {nota.archivos?.length > 0 && (
              <span className="flex items-center gap-0.5">
                <FileText className="w-3 h-3" /> {nota.archivos.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('text-base font-bold', nota.es_gasto_tardio && 'text-red-600')}>
            {(nota.importe || 0).toFixed(2)} €
          </span>
          {nota.operario_name && (
            <span className="text-[10px] text-muted-foreground">{nota.operario_name}</span>
          )}
        </div>
      </div>
    </Card>
  );
}