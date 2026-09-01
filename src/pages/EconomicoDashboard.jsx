import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUserRole } from '@/lib/useUserRole';
import { Wallet, TrendingUp, FileText, Banknote, AlertTriangle, PieChart } from 'lucide-react';
import EconomicoObrasChart from '@/components/economico/EconomicoObrasChart';
import ContabilidadAnalitica from '@/components/economico/ContabilidadAnalitica';

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
  const { isAdmin, isGerencia } = useUserRole();
  const puedeAnalitica = isAdmin || isGerencia;
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
        <KpiCard icon={FileText} label="Presupuestos activos" value={eur(totalPresupuestosActivos)} color="bg-purple-100 text-purple-600" />
        <KpiCard icon={Banknote} label="Coste nóminas (mes)" value={eur(costeNominasMes)} color="bg-emerald-100 text-emerald-600" />
        <KpiCard icon={AlertTriangle} label="Obras con sobrecoste" value={obrasConSobrecoste.length} color="bg-red-100 text-red-600" />
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
              <TabsTrigger value="analitica" className="gap-1.5">
                <PieChart className="w-4 h-4" /> Contabilidad analítica
              </TabsTrigger>
            </TabsList>
            <TabsContent value="resumen">{resumen}</TabsContent>
            <TabsContent value="analitica"><ContabilidadAnalitica /></TabsContent>
          </Tabs>
        ) : (
          resumen
        )}
      </div>
    </div>
  );
}