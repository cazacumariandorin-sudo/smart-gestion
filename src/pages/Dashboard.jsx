import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, Users, ArrowRight, ShoppingCart, Camera, Building2, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/card';
import StatCard from '@/components/dashboard/StatCard';
import WorkOrderCard from '@/components/workorders/WorkOrderCard';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['workorders'] });
    queryClient.invalidateQueries({ queryKey: ['fichajes'] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['operarios'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-date', 50),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });
  const { data: pedidos = [] } = useQuery({
    queryKey: ['orders_list'],
    queryFn: () => base44.entities.Order.list('-date', 50),
  });
  const { data: photos = [] } = useQuery({
    queryKey: ['photos_count'],
    queryFn: () => base44.entities.WorkPhoto.list('-date', 200),
  });
  const { data: fichajesHoy = [] } = useQuery({
    queryKey: ['fichajes_hoy'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      return base44.entities.Fichaje.filter({ date: today });
    },
  });

  const totalHours = orders.reduce((sum, o) => sum + (o.total_hours || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pendiente' || !o.status).length;
  const pedidosPendientes = pedidos.filter(p => p.status === 'pendiente').length;
  const recentOrders = orders.slice(0, 6);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Panel</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard title="Partes de Trabajo" value={orders.length} subtitle={`${pendingCount} pendientes`} icon={ClipboardList} />
        <StatCard title="Horas Totales" value={`${totalHours}h`} subtitle="registradas" icon={Clock} />
        <StatCard title="Clientes" value={clients.length} subtitle="activos" icon={Users} />
        <StatCard title="Operarios" value={operarios.length} subtitle="en plantilla" icon={Users} />
      </div>

      {/* Quick access modules */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: 'Partes', path: '/work-orders', icon: ClipboardList, count: orders.length, color: 'text-orange-500' },
          { label: 'Pedidos', path: '/orders', icon: ShoppingCart, count: pedidosPendientes + ' pend.', color: 'text-blue-500' },
          { label: 'Control Horario', path: '/control-horario', icon: Clock, count: `${fichajesHoy.length} hoy`, color: 'text-emerald-500' },
          { label: 'Clientes', path: '/clients', icon: Users, count: clients.length, color: 'text-purple-500' },
          { label: 'Operarios', path: '/operarios', icon: Users, count: operarios.length, color: 'text-amber-500' },
          { label: 'Galería', path: '/photos', icon: Camera, count: photos.length, color: 'text-pink-500' },
        ].map(mod => (
          <Link key={mod.path} to={mod.path}>
            <Card className="p-4 text-center hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer">
              <mod.icon className={`w-7 h-7 mx-auto mb-2 ${mod.color}`} />
              <p className="text-xs font-semibold text-foreground">{mod.label}</p>
              <p className="text-lg font-bold text-primary">{mod.count}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Work Orders */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Partes Recientes</h2>
        <Link to="/work-orders" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loadingOrders ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : recentOrders.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay partes de trabajo</p>
          <Link to="/work-orders" className="text-xs text-primary hover:underline mt-2 inline-block">Ir a Partes →</Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentOrders.map(order => <WorkOrderCard key={order.id} order={order} />)}
        </div>
      )}
    </div>
  );
}