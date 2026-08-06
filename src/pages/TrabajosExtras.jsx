import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Filter, CheckCircle2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUserRole } from '@/lib/useUserRole';
import NuevaSolicitudDirecta from '@/components/extras/NuevaSolicitudDirecta';

const ESTADOS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'facturado', label: 'Facturado' },
];

const PRIORIDAD_BADGE = {
  alta: 'bg-red-100 text-red-700 border-red-200',
  media: 'bg-amber-100 text-amber-700 border-amber-200',
  baja: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function TrabajosExtras() {
  const { user } = useAuth();
  const { isGerencia, isAdmin, isJefeObra } = useUserRole();
  const qc = useQueryClient();
  const [showNueva, setShowNueva] = useState(false);
  const hoy = new Date();
  const [filtroMes, setFiltroMes] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroObra, setFiltroObra] = useState('');

  const { data: trabajos = [], isLoading } = useQuery({
    queryKey: ['trabajos-extras-obra', filtroMes],
    queryFn: async () => {
      const [anioStr, mesStr] = filtroMes.split('-');
      const anio = Number(anioStr);
      const mesNum = Number(mesStr);
      const todos = await base44.entities.TrabajoExtraObra.list('-fecha_solicitud', 500);
      return todos.filter((t) => t.anio === anio && t.mes_numero === mesNum);
    },
  });

  const filtrados = useMemo(() => {
    return trabajos.filter((t) => {
      if (filtroEstado !== 'todos' && t.estado !== filtroEstado) return false;
      if (filtroObra.trim() && !(t.obra_name || '').toLowerCase().includes(filtroObra.trim().toLowerCase())) return false;
      return true;
    });
  }, [trabajos, filtroEstado, filtroObra]);

  const agrupadoPorObra = useMemo(() => {
    const map = {};
    filtrados.forEach((t) => {
      const key = t.obra_name || 'Sin obra';
      if (!map[key]) map[key] = { id: t.obra_id, items: [], pendientes: 0, facturados: 0 };
      map[key].items.push(t);
      if (t.estado === 'facturado') map[key].facturados++;
      else map[key].pendientes++;
    });
    return map;
  }, [filtrados]);

  const facturarMut = useMutation({
    mutationFn: async ({ trabajo, importe }) => {
      const payload = {
        estado: 'facturado',
        fecha_facturacion: new Date().toISOString().split('T')[0],
        facturado_por: user?.email,
      };
      if (importe !== null) payload.importe_facturado = Number(importe);
      return base44.entities.TrabajoExtraObra.update(trabajo.id, payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trabajos-extras-obra'] }),
  });

  const reabrirMut = useMutation({
    mutationFn: (trabajo) => base44.entities.TrabajoExtraObra.update(trabajo.id, {
      estado: 'pendiente', fecha_facturacion: null, facturado_por: null,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trabajos-extras-obra'] }),
  });

  const marcarFacturado = (trabajo) => {
    const input = window.prompt(`Importe facturado (€) para el trabajo extra de "${trabajo.obra_name || 'Sin obra'}":`, String(trabajo.importe_estimado || ''));
    if (input === null) return;
    facturarMut.mutate({ trabajo, importe: input === '' ? null : input });
  };

  const resumen = {
    total: filtrados.length,
    pendientes: filtrados.filter((t) => t.estado === 'pendiente').length,
    facturados: filtrados.filter((t) => t.estado === 'facturado').length,
    importeFacturado: filtrados
      .filter((t) => t.estado === 'facturado')
      .reduce((acc, t) => acc + (Number(t.importe_facturado) || 0), 0),
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader title="Trabajos Extras" subtitle="Trabajos extras solicitados en partes diarios, centralizados por obra" />

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {(isGerencia || isAdmin || isJefeObra) && (
          <Button onClick={() => setShowNueva(true)} className="w-full gap-1.5">
            <Plus className="w-4 h-4" /> Nueva solicitud directa (visita/seguimiento)
          </Button>
        )}
        <NuevaSolicitudDirecta open={showNueva} onOpenChange={setShowNueva} tipo="trabajo_extra" />

        {/* Resumen mensual */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ResumenCard label="Total" valor={resumen.total} tone="slate" />
          <ResumenCard label="Pendientes" valor={resumen.pendientes} tone="amber" />
          <ResumenCard label="Facturados" valor={resumen.facturados} tone="emerald" />
          <ResumenCard label="Facturado €" valor={resumen.importeFacturado.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} tone="purple" />
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="w-3.5 h-3.5" /> Filtros
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Mes</Label>
                <Input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Estado</Label>
                <MobileSelect value={filtroEstado} onValueChange={setFiltroEstado}>
                  {ESTADOS.map((e) => <MobileSelectItem key={e.value} value={e.value}>{e.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Buscar obra</Label>
                <Input value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)} placeholder="Nombre de obra..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No hay trabajos extras en el filtro seleccionado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(agrupadoPorObra).map(([obra, grupo]) => (
              <div key={obra} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold truncate">{obra}</h3>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{grupo.pendientes} pend.</span>
                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{grupo.facturados} fact.</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {grupo.items.map((t) => (
                    <Card key={t.id} className="overflow-hidden">
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground">
                              {format(new Date(t.fecha_solicitud), 'dd MMM yyyy', { locale: es })} · {t.solicitado_por_nombre || '—'}
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{t.descripcion}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge className={`text-[10px] ${PRESTADO(t.estado)}`}>{t.estado}</Badge>
                            <Badge className={`text-[10px] ${PRIORIDAD_BADGE[t.prioridad] || ''}`}>{t.prioridad}</Badge>
                          </div>
                        </div>
                        {(t.importe_estimado != null || t.importe_facturado != null) && (
                          <p className="text-[10px] text-muted-foreground">
                            Estimado: {formatEUR(t.importe_estimado)} · Facturado: {formatEUR(t.importe_facturado)}
                          </p>
                        )}
                        {t.notas_admin && (
                          <p className="text-[11px] text-slate-600 italic">Notas: {t.notas_admin}</p>
                        )}
                        <div className="flex gap-1.5 pt-1">
                          {t.estado === 'pendiente' && (
                            <Button size="sm" variant="outline" onClick={() => marcarFacturado(t)} disabled={facturarMut.isPending} className="gap-1.5 h-7 text-xs">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Marcar facturado
                            </Button>
                          )}
                          {t.estado === 'facturado' && (
                            <Button size="sm" variant="ghost" onClick={() => reabrirMut.mutate(t)} disabled={reabrirMut.isPending} className="gap-1.5 h-7 text-xs text-amber-600">
                              Volver a pendiente
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PRESTADO(estado) {
  return estado === 'facturado'
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';
}

function ResumenCard({ label, valor, tone }) {
  const toneClass = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
  }[tone];
  return (
    <div className={`border rounded-lg p-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-sm font-bold truncate">{valor}</p>
    </div>
  );
}

function formatEUR(v) {
  if (v == null || isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}