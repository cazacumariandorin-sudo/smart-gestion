import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/layout/PageHeader';
import QueryErrorFallback from '@/components/QueryErrorFallback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Plus, Search, ShieldCheck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ESTADO_EXPEDIENTE_META } from '@/lib/expedientesCatalogo';
import ExpedienteCard from '@/components/expedientes/ExpedienteCard';
import ExpedienteFormDialog from '@/components/expedientes/ExpedienteFormDialog';
import ExpedienteDetalleDialog from '@/components/expedientes/ExpedienteDetalleDialog';

const ABIERTOS = ['abierto', 'notificado', 'en_conciliacion'];

export default function Expedientes() {
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const { data: expedientes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['expedientes'],
    queryFn: async () => {
      const page = await base44.entities.Expediente.filter({}, { sort: '-fecha_apertura', limit: 200 });
      return page.items;
    },
  });

  const { data: operarios = [] } = useQuery({
    queryKey: ['expedientes-operarios'],
    queryFn: async () => {
      const page = await base44.entities.Operario.filter({ active: true }, { sort: 'name', limit: 300 });
      return page.items;
    },
  });

  const { data: porEstado = {} } = useQuery({
    queryKey: ['expedientes-kpi'],
    queryFn: async () => {
      const res = await base44.entities.Expediente.aggregate({ query: {}, groupBy: 'estado' });
      return Object.fromEntries((res.rows || []).map((r) => [r.estado, r.count]));
    },
  });

  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return expedientes.filter((e) => {
      const coincideEstado = estadoFiltro === 'todos'
        || (estadoFiltro === 'abiertos' ? ABIERTOS.includes(e.estado) : e.estado === estadoFiltro);
      const coincideTexto = !t
        || String(e.operario_name || '').toLowerCase().includes(t)
        || String(e.codigo || '').toLowerCase().includes(t);
      return coincideEstado && coincideTexto;
    });
  }, [expedientes, busqueda, estadoFiltro]);

  const seleccionado = expedientes.find((e) => e.id === selectedId) || null;
  const enCurso = ABIERTOS.reduce((acc, e) => acc + (porEstado[e] || 0), 0);

  const kpis = [
    { key: 'abiertos', label: 'En curso', valor: enCurso, color: 'text-amber-600' },
    { key: 'archivado_conciliado', label: 'Conciliados', valor: porEstado.archivado_conciliado || 0, color: 'text-emerald-600' },
    { key: 'sancionado', label: 'Sancionados', valor: porEstado.sancionado || 0, color: 'text-rose-600' },
    { key: 'prescrito', label: 'Prescritos', valor: porEstado.prescrito || 0, color: 'text-slate-500' },
    { key: 'caducado', label: 'Caducados', valor: porEstado.caducado || 0, color: 'text-muted-foreground' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Expedientes"
        subtitle="Régimen sancionador y conciliación interna Pre-IRMA"
        actions={(
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4" /> Nuevo
          </Button>
        )}
      />

      <div className="px-4 py-4 max-w-3xl mx-auto lg:max-w-5xl space-y-4">
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-900 p-3 text-xs text-indigo-800 dark:text-indigo-300 flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            El acta de conciliación se firma en pantalla por empresa y trabajador. Al firmarse ambas,
            el expediente queda archivado conciliado, no cuenta para la reincidencia y el antecedente
            desaparece del historial al cumplir su plazo de conservación.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {kpis.map((k) => (
            <Card
              key={k.key}
              className={cn(
                'p-2.5 cursor-pointer transition-colors hover:border-primary/40',
                estadoFiltro === k.key && 'border-primary',
              )}
              onClick={() => setEstadoFiltro(estadoFiltro === k.key ? 'todos' : k.key)}
            >
              <p className={cn('text-lg font-bold leading-none', k.color)}>{k.valor}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{k.label}</p>
            </Card>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por trabajador o código"
              className="pl-9"
            />
          </div>
          <div className="sm:w-56">
            <MobileSelect value={estadoFiltro} onValueChange={setEstadoFiltro} placeholder="Estado">
              <MobileSelectItem value="todos">Todos los estados</MobileSelectItem>
              <MobileSelectItem value="abiertos">En curso</MobileSelectItem>
              {Object.entries(ESTADO_EXPEDIENTE_META).map(([value, meta]) => (
                <MobileSelectItem key={value} value={value}>{meta.label}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
        </div>

        {isError ? (
          <QueryErrorFallback error={isError} retryFn={refetch} />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Cargando expedientes…</p>
        ) : lista.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ShieldCheck className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {expedientes.length === 0 ? 'No hay expedientes abiertos.' : 'Ningún expediente coincide con el filtro.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((e) => (
              <ExpedienteCard key={e.id} expediente={e} onClick={() => setSelectedId(e.id)} />
            ))}
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              <Badge variant="outline" className="text-[10px] mr-1">{lista.length}</Badge>
              expedientes · mostrando los últimos 200
            </p>
          </div>
        )}
      </div>

      <ExpedienteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        operarios={operarios}
        expedientes={expedientes}
      />

      <ExpedienteDetalleDialog
        open={!!seleccionado}
        onOpenChange={(v) => { if (!v) setSelectedId(null); }}
        expediente={seleccionado}
      />
    </div>
  );
}