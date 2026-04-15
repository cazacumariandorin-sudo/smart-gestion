import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, Users, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/dashboard/StatCard';
import WorkOrderCard from '@/components/workorders/WorkOrderCard';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-created_date', 50),
  });

  const onRefresh = () => queryClient.invalidateQueries({ queryKey: ['workorders'] });
  const { pulling, pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const totalOrders = orders.length;
  const totalHours = orders.reduce((sum, o) => sum + (o.total_hours || 0), 0);
  const totalWorkers = orders.reduce((sum, o) => sum + (o.workers?.length || 0), 0);
  const pendingCount = orders.filter(o => o.status === 'pendiente' || !o.status).length;

  const recentOrders = orders.slice(0, 6);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumen de partes de trabajo</p>
        </div>
        <Link to="/work-orders/new">
          <Button className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Parte</span>
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard title="Total Partes" value={totalOrders} icon={ClipboardList} />
        <StatCard title="Horas Totales" value={`${totalHours}h`} icon={Clock} />
        <StatCard title="Operarios" value={totalWorkers} subtitle="asignaciones totales" icon={Users} />
        <StatCard title="Pendientes" value={pendingCount} icon={ClipboardList} />
      </div>

      {/* Recent Orders */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Partes Recientes</h2>
        <Link to="/work-orders" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : recentOrders.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay partes de trabajo</p>
          <Link to="/work-orders/new">
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Crear primer parte
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentOrders.map(order => (
            <WorkOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}