import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUserRole } from '@/lib/useUserRole';
import { Wallet, TrendingUp, FileText, Banknote, AlertTriangle, PieChart, RotateCcw, CreditCard } from 'lucide-react';
import EconomicoObrasChart from '@/components/economico/EconomicoObrasChart';
import ContabilidadAnalitica from '@/components/economico/ContabilidadAnalitica';
import AdelantosPanel from '@/components/adelantos/AdelantosPanel';

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

const eur = (n) => `${(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

export default function EconomicoDashboard() {
  const { isAdmin, isGerencia, isDirComercial } = useUserRole();
  const puedeAnalitica = isAdmin || isGerencia;
  const puedeAdelantos = isAdmin || isGerencia || isDirComercial;
  const [tab, setTab] = useState('resumen');

  const { data: registros = [] } = useQuery({ queryKey: ['eco-registros'], queryFn: () => base44.entities.RegistroGasto.list('-fecha_documento', 500) });
  const { data: presupuestos = [] } = useQuery({ queryKey: ['eco-presupuestos'], queryFn: () => base44.entities.Presupuesto.list('-fecha', 300) });
  const { data: nominas = [] } = useQuery({ queryKey: ['eco-nominas'], queryFn: () => base44.entities.Nomina.list('-anio', 500) });
  const { data: obras = [] } = useQuery({ queryKey: ['eco-obras'], queryFn: () => base44.entities.Obra.list('name', 300) });
  const { data: solarObras = [] } = useQuery({ queryKey: ['eco-solar-obras'], queryFn: () => base44.entities.SolarObra.list('name', 300) });

  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  const gastosAprobados = useMemo(() => registros.filter(r => ['aprobado_gerencia', 'en_administracion', 'pagada'].includes(r.estado)), [registros]);

  const totalGastosMes = useMemo(() => gastosAprobados
    .filter(r => r.fecha_documento?.startsWith(`${anioActual}-${String(mesActual).padStart(2, '0')}`))
    .reduce((s, r) => s + (r.importe || 0), 0), [gastosAprobados, mesActual, anioActual]);

  // Gastos a recuperar (medios propios: reembolsables a técnicos/usuarios)
  const esReembolsable = (r) => !r.origen_pago || r.origen_pago === 'medios_propios';
  const esEmpresa = (r) => r.origen_pago === 'medio_empresa' || r.origen_pago === 'credito_proveedor';

  const totalRecuperar = useMemo(() => gastosAprobados
    .filter(r => r.fecha_documento?.startsWith(`${anioActual}-${String(mesActual).padStart(2, '0')}`) && esReembolsable(r))
    .reduce((s, r) => s + (r.importe || 0), 0), [gastosAprobados, mesActual, anioActual]);

  const totalEmpresa = useMemo(() => gastosAprobados
    .filter(r => r.fecha_documento?.startsWith(`${anioActual}-${String(mesActual).padStart(2, '0')}`) && esEmpresa(r))
    .reduce((s, r) => s + (r.importe || 0), 0), [gastosAprobados, mesActual, anioActual]);

  const gastoPorObraRecuperar = useMemo(() => {
    const map = {};
    for (const r of gastosAprobados) {
      if (!r.obra_name || !esReembolsable(r)) continue;
      map[r.obra_name] = (map[r.obra_name] || 0) + (r.importe || 0);
    }
    return map;
  }, [gastosAprobados]);

  const gastoPorObraEmpresa = useMemo(() => {
    const map = {};
    for (const r of gastosAprobados) {
      if (!r.obra_name || !esEmpresa(r)) continue;
      map[r.obra_name] = (map[r.obra_name] || 0) + (r.importe || 0);
    }
    return map;
  }, [gastosAprobados]);

  const totalPresupuestosActivos = useMemo(() => presupuestos
    .filter(p => p.estado !== 'rechazado')
    .reduce((s, p) => s + (p.importe || 0), 0), [presupuestos]);

  const costeNominasMes = useMemo(() => nominas
    .filter(n => n.mes === mesActual && n.anio === anioActual)
    .reduce((s, n) => s + (n.coste_empresa || 0), 0), [nominas, mesActual, anioActual]);

  const gastoPorObra = useMemo(() => {
    const map = {};
    for (const r of gastosAprobados) {
      if (!r.obra_name) continue;
      map[r.obra_name] = (map[r.obra_name] || 0) + (r.importe || 0);
    }
    return map;
  }, [gastosAprobados]);

  const obrasConSobrecoste = useMemo(() => {
    const todas = [...obras.map(o => ({ ...o, tipo: 'civil' })), ...solarObras.map(o => ({ ...o, tipo: 'solar' }))];
    return todas.filter(o => o.budget > 0 && (gastoPorObra[o.name] || 0) > o.budget);
  }, [obras, solarObras, gastoPorObra]);

  const chartData = useMemo(() => Object.entries(gastoPorObra)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, total]) => ({ name, total })), [gastoPorObra]);

  const resumen = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Wallet} label="Gastos aprobados (mes)" value={eur(totalGastosMes)} color="bg-orange-100 text-orange-600" />
        <KpiCard icon={RotateCcw} label="A recuperar (técnicos)" value={eur(totalRecuperar)} color="bg-amber-100 text-amber-700" />
        <KpiCard icon={CreditCard} label="Pagados con medios empresa" value={eur(totalEmpresa)} color="bg-sky-100 text-sky-700" />
        <KpiCard icon={FileText} label="Presupuestos activos" value={eur(totalPresupuestosActivos)} color="bg-purple-100 text-purple-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Banknote} label="Coste nóminas (mes)" value={eur(costeNominasMes)} color="bg-emerald-100 text-emerald-600" />
        <KpiCard icon={AlertTriangle} label="Obras con sobrecoste" value={obrasConSobrecoste.length} color="bg-red-100 text-red-600" />
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" /> Gastos por origen de pago (aprobados, mes en curso)</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-amber-600" /> A recuperar por técnicos</span>
            <span className="font-semibold text-amber-700">{eur(totalRecuperar)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${totalGastosMes ? (totalRecuperar / totalGastosMes) * 100 : 0}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm pt-1">
            <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-sky-600" /> Pagados con medios de empresa</span>
            <span className="font-semibold text-sky-700">{eur(totalEmpresa)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-sky-500" style={{ width: `${totalGastosMes ? (totalEmpresa / totalGastosMes) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Gasto aprobado por obra y origen (top 8)</p>
        <div className="space-y-2">
          {Object.entries(gastoPorObra).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, total]) => {
            const rec = gastoPorObraRecuperar[name] || 0;
            const emp = gastoPorObraEmpresa[name] || 0;
            return (
              <div key={name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{name}</span>
                  <span className="font-semibold">{eur(total)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-amber-500" style={{ width: `${total ? (rec / total) * 100 : 0}%` }} title={`A recuperar: ${eur(rec)}`} />
                  <div className="h-full bg-sky-500" style={{ width: `${total ? (emp / total) * 100 : 0}%` }} title={`Empresa: ${eur(emp)}`} />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{eur(rec)}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" />{eur(emp)}</span>
                </div>
              </div>
            );
          })}
          {chartData.length === 0 && <p className="text-sm text-muted-foreground">Sin gastos aprobados este mes.</p>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Gasto aprobado por obra (top 6)</p>
        <EconomicoObrasChart data={chartData} />
      </div>

      {obrasConSobrecoste.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Obras por encima de presupuesto</p>
          <div className="space-y-1.5">
            {obrasConSobrecoste.map(o => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <span>{o.name}</span>
                <span className="text-red-600 font-semibold">{eur(gastoPorObra[o.name])} / {eur(o.budget)}</span>
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
            </TabsList>
            <TabsContent value="resumen">{resumen}</TabsContent>
            {puedeAdelantos && <TabsContent value="adelantos"><AdelantosPanel /></TabsContent>}
            <TabsContent value="analitica"><ContabilidadAnalitica /></TabsContent>
          </Tabs>
        ) : (
          resumen
        )}
      </div>
    </div>
  );
}