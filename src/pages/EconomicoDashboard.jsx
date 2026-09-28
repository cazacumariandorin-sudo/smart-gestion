import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUserRole } from '@/lib/useUserRole';
import { Wallet, TrendingUp, FileText, Banknote, AlertTriangle, PieChart, RotateCcw, CreditCard, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import EconomicoObrasChart from '@/components/economico/EconomicoObrasChart';
import ContabilidadAnalitica from '@/components/economico/ContabilidadAnalitica';
import AdelantosPanel from '@/components/adelantos/AdelantosPanel';
import DetectorDuplicadosPanel from '@/components/economico/DetectorDuplicadosPanel';

function KpiCard({ icon: Icon, label, value, color, active, onClick }) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={cn(
        'bg-card border rounded-2xl p-4 flex items-center gap-3 text-left transition-all w-full',
        interactive ? 'hover:shadow-md hover:border-primary/40 cursor-pointer' : 'cursor-default',
        active ? 'border-primary ring-2 ring-primary/30' : 'border-border'
      )}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold truncate">{value}</p>
      </div>
    </button>
  );
}

const eur = (n) => `${(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

export default function EconomicoDashboard() {
  const { isAdmin, isGerencia, isDirComercial, isAdministracion } = useUserRole();
  const puedeAnalitica = isAdmin || isGerencia || isAdministracion;
  const puedeAdelantos = isAdmin || isGerencia || isDirComercial || isAdministracion;
  const puedeDuplicados = isAdmin || isGerencia || isAdministracion;
  const [tab, setTab] = useState('resumen');
  const [filtroOrigen, setFiltroOrigen] = useState('todos');

  const { data: registros = [] } = useQuery({ queryKey: ['eco-registros'], queryFn: () => base44.entities.RegistroGasto.list('-fecha_documento', 500) });
  const { data: presupuestos = [] } = useQuery({ queryKey: ['eco-presupuestos'], queryFn: () => base44.entities.Presupuesto.list('-fecha', 300) });
  const { data: nominas = [] } = useQuery({ queryKey: ['eco-nominas'], queryFn: () => base44.entities.Nomina.list('-anio', 500) });
  const { data: obras = [] } = useQuery({ queryKey: ['eco-obras'], queryFn: () => base44.entities.Obra.list('name', 300) });
  const { data: solarObras = [] } = useQuery({ queryKey: ['eco-solar-obras'], queryFn: () => base44.entities.SolarObra.list('name', 300) });

  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  const mesActualStr = `${anioActual}-${String(mesActual).padStart(2, '0')}`;
  const [mesFiltro, setMesFiltro] = useState(mesActualStr);

  const cambiarMes = (delta) => {
    const [y, m] = mesFiltro.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesFiltro(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const mesPrevio = () => cambiarMes(-1);
  const mesSiguiente = () => { if (mesFiltro < mesActualStr) cambiarMes(1); };

  // Origen de pago
  const esReembolsable = (r) => !r.origen_pago || r.origen_pago === 'medios_propios';
  const esEmpresa = (r) => r.origen_pago === 'medio_empresa' || r.origen_pago === 'credito_proveedor';

  const gastosAprobados = useMemo(() => registros.filter(r =>
    ['aprobado_gerencia', 'en_administracion', 'pagada'].includes(r.estado) ||
    (esEmpresa(r) && ['borrador', 'registrado'].includes(r.estado))
  ), [registros]);
  const gastosAprobadosMes = useMemo(() => gastosAprobados.filter(r => r.fecha_documento?.startsWith(mesFiltro)), [gastosAprobados, mesFiltro]);

  const totalGastosMes = useMemo(() => gastosAprobadosMes.reduce((s, r) => s + (r.importe || 0), 0), [gastosAprobadosMes]);
  const totalRecuperar = useMemo(() => gastosAprobadosMes.filter(esReembolsable).reduce((s, r) => s + (r.importe || 0), 0), [gastosAprobadosMes]);
  const totalEmpresa = useMemo(() => gastosAprobadosMes.filter(esEmpresa).reduce((s, r) => s + (r.importe || 0), 0), [gastosAprobadosMes]);

  // Agregados por obra del mes seleccionado (panel de origen y gráfico top 6)
  const gastoPorObra = useMemo(() => {
    const map = {};
    for (const r of gastosAprobadosMes) {
      if (!r.obra_name) continue;
      map[r.obra_name] = (map[r.obra_name] || 0) + (r.importe || 0);
    }
    return map;
  }, [gastosAprobadosMes]);

  const gastoPorObraRecuperar = useMemo(() => {
    const map = {};
    for (const r of gastosAprobadosMes) {
      if (!r.obra_name || !esReembolsable(r)) continue;
      map[r.obra_name] = (map[r.obra_name] || 0) + (r.importe || 0);
    }
    return map;
  }, [gastosAprobadosMes]);

  const gastoPorObraEmpresa = useMemo(() => {
    const map = {};
    for (const r of gastosAprobadosMes) {
      if (!r.obra_name || !esEmpresa(r)) continue;
      map[r.obra_name] = (map[r.obra_name] || 0) + (r.importe || 0);
    }
    return map;
  }, [gastosAprobadosMes]);

  // Agregado por obra histórico (para sobrecoste: todo el histórico vs presupuesto)
  const gastoPorObraAll = useMemo(() => {
    const map = {};
    for (const r of gastosAprobados) {
      if (!r.obra_name) continue;
      map[r.obra_name] = (map[r.obra_name] || 0) + (r.importe || 0);
    }
    return map;
  }, [gastosAprobados]);

  const totalPresupuestosActivos = useMemo(() => presupuestos
    .filter(p => p.estado !== 'rechazado')
    .reduce((s, p) => s + (p.importe || 0), 0), [presupuestos]);

  const costeNominasMes = useMemo(() => nominas
    .filter(n => `${n.anio}-${String(n.mes).padStart(2, '0')}` === mesFiltro)
    .reduce((s, n) => s + (n.coste_empresa || 0), 0), [nominas, mesFiltro]);

  const obrasConSobrecoste = useMemo(() => {
    const todas = [...obras.map(o => ({ ...o, tipo: 'civil' })), ...solarObras.map(o => ({ ...o, tipo: 'solar' }))];
    return todas.filter(o => o.budget > 0 && (gastoPorObraAll[o.name] || 0) > o.budget);
  }, [obras, solarObras, gastoPorObraAll]);

  const obrasListado = useMemo(() => {
    const base = filtroOrigen === 'recuperar' ? gastoPorObraRecuperar
      : filtroOrigen === 'empresa' ? gastoPorObraEmpresa
      : gastoPorObra;
    return Object.entries(base).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [filtroOrigen, gastoPorObra, gastoPorObraRecuperar, gastoPorObraEmpresa]);

  const chartData = useMemo(() => obrasListado.slice(0, 6).map(([name, total]) => ({ name, total })), [obrasListado]);

  const MesSelector = (
    <div className="flex items-center gap-2">
      <button onClick={mesPrevio} className="p-1.5 rounded-lg border hover:bg-muted transition-colors" aria-label="Mes anterior">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <input type="month" value={mesFiltro} max={mesActualStr} onChange={e => setMesFiltro(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm bg-background font-medium" />
      <button onClick={mesSiguiente} disabled={mesFiltro >= mesActualStr} className="p-1.5 rounded-lg border hover:bg-muted transition-colors disabled:opacity-30" aria-label="Mes siguiente">
        <ChevronRight className="w-4 h-4" />
      </button>
      {mesFiltro !== mesActualStr && (
        <button onClick={() => setMesFiltro(mesActualStr)} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">
          Mes actual
        </button>
      )}
    </div>
  );

  const origenActivoLabel = filtroOrigen === 'recuperar' ? 'A recuperar (técnicos)' : filtroOrigen === 'empresa' ? 'Medios empresa' : 'Todos los orígenes';

  const resumen = (
    <div className="space-y-5">
      {/* Barra de cabecera */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Periodo</p>
          <p className="text-lg font-bold leading-tight">{mesFiltro}</p>
        </div>
        {MesSelector}
      </div>

      {/* KPIs interactivos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Wallet} label="Gastos aprobados (mes)" value={eur(totalGastosMes)} color="bg-orange-100 text-orange-600"
          active={filtroOrigen === 'todos'} onClick={() => setFiltroOrigen('todos')} />
        <KpiCard icon={RotateCcw} label="A recuperar (técnicos)" value={eur(totalRecuperar)} color="bg-amber-100 text-amber-700"
          active={filtroOrigen === 'recuperar'} onClick={() => setFiltroOrigen('recuperar')} />
        <KpiCard icon={CreditCard} label="Pagados con medios empresa" value={eur(totalEmpresa)} color="bg-sky-100 text-sky-700"
          active={filtroOrigen === 'empresa'} onClick={() => setFiltroOrigen('empresa')} />
        <KpiCard icon={FileText} label="Presupuestos activos" value={eur(totalPresupuestosActivos)} color="bg-purple-100 text-purple-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Banknote} label="Coste nóminas (mes)" value={eur(costeNominasMes)} color="bg-emerald-100 text-emerald-600" />
        <KpiCard icon={AlertTriangle} label="Obras con sobrecoste" value={obrasConSobrecoste.length} color="bg-red-100 text-red-600" />
      </div>

      {/* Gráfico destacado — junto below the tabs/KPIs */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Gasto aprobado por obra</p>
            <p className="text-xs text-muted-foreground truncate">{mesFiltro} · top 6 · {origenActivoLabel}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Total mostrado</p>
            <p className="text-xl font-bold">{eur(chartData.reduce((s, d) => s + (d.total || 0), 0))}</p>
          </div>
        </div>
        <EconomicoObrasChart data={chartData} />
        {chartData.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sin gastos aprobados en {mesFiltro}.</p>}
      </div>

      {/* Desglose: origen de pago + por obra y origen (2 columnas en desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" /> Origen de pago (aprobados)</p>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> A recuperar por técnicos</span>
                <span className="font-semibold text-amber-700">{eur(totalRecuperar)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${totalGastosMes ? (totalRecuperar / totalGastosMes) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Pagados con medios de empresa</span>
                <span className="font-semibold text-sky-700">{eur(totalEmpresa)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${totalGastosMes ? (totalEmpresa / totalGastosMes) * 100 : 0}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
              <span>Total aprobado</span>
              <span className="font-semibold text-foreground">{eur(totalGastosMes)}</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Por obra y origen (top 8)</p>
          <div className="space-y-2.5">
            {obrasListado.map(([name, total]) => {
              const rec = gastoPorObraRecuperar[name] || 0;
              const emp = gastoPorObraEmpresa[name] || 0;
              return (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{name}</span>
                    <span className="font-semibold">{eur(total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${total ? (rec / total) * 100 : 0}%` }} title={`A recuperar: ${eur(rec)}`} />
                    <div className="h-full bg-sky-500 transition-all" style={{ width: `${total ? (emp / total) * 100 : 0}%` }} title={`Empresa: ${eur(emp)}`} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{eur(rec)}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />{eur(emp)}</span>
                  </div>
                </div>
              );
            })}
            {obrasListado.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin gastos aprobados en {mesFiltro}.</p>}
          </div>
        </div>
      </div>

      {obrasConSobrecoste.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Obras por encima de presupuesto (histórico)</p>
          <div className="space-y-1.5">
            {obrasConSobrecoste.map(o => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <span>{o.name}</span>
                <span className="text-red-600 font-semibold">{eur(gastoPorObraAll[o.name])} / {eur(o.budget)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Dashboard Económico" subtitle="Visión consolidada de gastos, presupuestos y nóminas" />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {puedeAnalitica ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              {puedeAdelantos && (
                <TabsTrigger value="adelantos" className="gap-1.5">
                  <Wallet className="w-4 h-4" /> Adelantos
                </TabsTrigger>
              )}
              <TabsTrigger value="analitica" className="gap-1.5">
                <PieChart className="w-4 h-4" /> Contabilidad analítica
              </TabsTrigger>
              {puedeDuplicados && (
                <TabsTrigger value="duplicados" className="gap-1.5">
                  <Copy className="w-4 h-4" /> Duplicados
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="resumen">{resumen}</TabsContent>
            {puedeAdelantos && <TabsContent value="adelantos"><AdelantosPanel /></TabsContent>}
            <TabsContent value="analitica"><ContabilidadAnalitica /></TabsContent>
            {puedeDuplicados && <TabsContent value="duplicados"><DetectorDuplicadosPanel rango={{ inicio: `${mesFiltro}-01`, fin: `${mesFiltro}-31` }} /></TabsContent>}
          </Tabs>
        ) : (
          resumen
        )}
      </div>
    </div>
  );
}