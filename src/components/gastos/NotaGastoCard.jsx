import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, Lock, CheckCircle2, Clock, XCircle, AlertTriangle, FileText, Image } from 'lucide-react';
import ConciliacionBadge from '@/components/conciliacion/ConciliacionBadge';
import SemaforoTrazabilidadBadge from '@/components/contabilidad/SemaforoTrazabilidadBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ESTADO_CONFIG = {
  borrador:           { label: 'Borrador',            color: 'bg-slate-100 text-slate-700 border-slate-200',    icon: Clock },
  pendiente:          { label: 'Pendiente',            color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: Clock },
  aprobado_gerencia:  { label: 'Aprobado gerencia',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  en_administracion:  { label: 'En administración',   color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Clock },
  pagada:             { label: 'Pagada',               color: 'bg-green-100 text-green-700 border-green-200',    icon: CheckCircle2 },
  rechazada:          { label: 'Rechazada',            color: 'bg-red-100 text-red-700 border-red-200',          icon: XCircle },
  // legacy
  validada:           { label: 'Validada',             color: 'bg-green-100 text-green-700 border-green-200',    icon: CheckCircle2 },
  cerrada:            { label: 'Cerrada',              color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Lock },
};

const CAT_COLORS = {
  material:    'bg-violet-100 text-violet-700',
  combustible: 'bg-orange-100 text-orange-700',
  peaje:       'bg-cyan-100 text-cyan-700',
  parking:     'bg-teal-100 text-teal-700',
  comida:      'bg-amber-100 text-amber-700',
  otros:       'bg-slate-100 text-slate-600',
};

export default function NotaGastoCard({ nota, onVer }) {
  const cfg = ESTADO_CONFIG[nota.estado] || ESTADO_CONFIG.pendiente;
  const Icon = cfg.icon;
  // Gasto de un ciclo ya cerrado, redirigido al ciclo activo: se distingue en morado
  const esDeCicloCerrado = !!(nota.es_gasto_tardio && nota.justificacion_tardia?.includes('[CICLO CERRADO'));

  return (
    <Card
      className={cn(
        'p-4 hover:shadow-md transition-all cursor-pointer border',
        esDeCicloCerrado
          ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
          : nota.es_gasto_tardio
            ? 'border-red-300 dark:border-red-700'
            : ''
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
            {esDeCicloCerrado ? (
              <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
                <Lock className="w-3 h-3 mr-1" /> Ciclo cerrado
              </Badge>
            ) : nota.es_gasto_tardio && (
              <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">
                <AlertTriangle className="w-3 h-3 mr-1" /> Tardío
              </Badge>
            )}
            {nota.es_posible_duplicado && !nota.duplicado_confirmado && (
              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                ⚠ Posible dup.
              </Badge>
            )}
            {nota.sin_obra && (
              <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">
                🏗 Sin obra
              </Badge>
            )}
            {nota.precisa_precision && (
              <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300" title={nota.precision_motivo || 'Precisa revisión de precisión'}>
                🔍 Precisa precisión
              </Badge>
            )}
            {nota.origen_pago && nota.origen_pago !== 'medios_propios' && (
              <Badge className="text-[10px] bg-cyan-100 text-cyan-700 border-cyan-200" title={nota.origen_pago === 'medio_empresa' ? 'Pagado con medio de empresa (no reembolsable)' : 'Factura a crédito de proveedor'}>
                {nota.origen_pago === 'medio_empresa' ? '🏢 Medio empresa' : '📑 Crédito prov.'}
              </Badge>
            )}
            <ConciliacionBadge nota={nota} />
            <SemaforoTrazabilidadBadge doc={nota} showLabel={false} />
            {nota.forma_pago_documento && (
              <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
                💳 {nota.forma_pago_documento}
              </Badge>
            )}
          </div>

          <p className="text-sm font-semibold truncate">{nota.nombre_comercio || nota.concepto || 'Sin descripción'}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {nota.fecha_documento && <span>📅 {nota.fecha_documento}</span>}
            {nota.obra_name && <span>🏗️ {nota.obra_name}</span>}
            {nota.localidad && <span>📍 {nota.localidad}</span>}
            {nota.numero_factura && <span title="Número de factura/ticket">🧾 {nota.numero_factura}</span>}
            {nota.nif_comercio && <span title="NIF del comercio">🆔 {nota.nif_comercio}</span>}
            {nota.archivos?.length > 0 && (
              <span className="flex items-center gap-0.5">
                <FileText className="w-3 h-3" /> {nota.archivos.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('text-base font-bold', nota.es_gasto_tardio && (esDeCicloCerrado ? 'text-indigo-600' : 'text-red-600'))}>
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