import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Wallet, Loader2, Info } from 'lucide-react';

const ESTADO_LABELS = {
  pendiente_entrega: 'Pendiente entrega',
  entregado: 'Entregado',
  justificado: 'Justificado',
  parcialmente_justificado: 'Parcial',
  pendiente_devolucion: 'Pend. devolución',
  anulado: 'Anulado',
};
const ESTADO_COLORS = {
  pendiente_entrega: 'bg-slate-100 text-slate-700 border-slate-200',
  entregado: 'bg-blue-50 text-blue-700 border-blue-200',
  justificado: 'bg-green-50 text-green-700 border-green-200',
  parcialmente_justificado: 'bg-amber-50 text-amber-700 border-amber-200',
  pendiente_devolucion: 'bg-red-50 text-red-700 border-red-200',
  anulado: 'bg-gray-100 text-gray-500 border-gray-200 line-through',
};

/**
 * Vista de solo lectura para técnicos: muestra únicamente sus adelantos de tipo 'gastos'
 * (la RLS de Adelanto ya filtra dieta fuera del operario, pero aquí además forzamos
 * el filtro tipo=gastos para no depender solo de RLS).
 */
export default function MisAdelantosTab() {
  const { user } = useAuth();
  const { data: operario } = useQuery({
    queryKey: ['mi_operario_adelantos', user?.email],
    queryFn: async () => {
      const ops = await base44.entities.Operario.filter({ user_email: user?.email });
      return ops?.[0] || null;
    },
    enabled: !!user?.email,
  });

  const { data: adelantos = [], isLoading } = useQuery({
    queryKey: ['mis_adelantos', operario?.id],
    queryFn: () => base44.entities.Adelanto.filter({
      operario_id: operario?.id,
      tipo: 'gastos',
    }, '-fecha_entrega', 200),
    enabled: !!operario?.id,
  });

  const totales = useMemo(() => {
    const activos = adelantos.filter(a => ['entregado', 'justificado', 'parcialmente_justificado'].includes(a.estado));
    return {
      total: activos.reduce((s, a) => s + (a.importe || 0), 0),
      count: activos.length,
      pendientes: adelantos.filter(a => a.estado === 'pendiente_devolucion').length,
    };
  }, [adelantos]);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Los adelantos son dinero que la empresa te entrega antes de que gastes.
          Al cerrar tu ciclo mensual se restan de tus gastos justificados:
          <strong> gastos − adelantos = importe a liquidar</strong>.
          Si el adelanto supera lo justificado, deberás devolver la diferencia.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border p-3 bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Entregado (activos)</p>
          <p className="font-bold text-sm text-blue-600">{totales.total.toFixed(2)} €</p>
        </div>
        <div className="rounded-lg border p-3 bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Adelantos activos</p>
          <p className="font-bold text-sm">{totales.count}</p>
        </div>
        <div className="rounded-lg border p-3 bg-card">
          <p className="text-[10px] uppercase text-muted-foreground">Pend. devolución</p>
          <p className="font-bold text-sm text-red-600">{totales.pendientes}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando tus adelantos…
        </div>
      ) : adelantos.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-xl">
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No tienes adelantos registrados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {adelantos.map(a => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold">{(a.importe || 0).toFixed(2)} €</span>
                <Badge variant="outline" className={cn('text-[10px]', ESTADO_COLORS[a.estado])}>{ESTADO_LABELS[a.estado]}</Badge>
              </div>
              <p className="text-sm">{a.concepto || '—'}</p>
              <p className="text-xs text-muted-foreground">
                {a.fecha_entrega || '—'}
                {a.obra_name && ` · ${a.obra_name}`}
                {a.ciclo_mes && ` · ciclo ${a.ciclo_mes}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}