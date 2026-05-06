import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import WorkOrderCard from '@/components/workorders/WorkOrderCard';

export default function WorkOrders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');

  const onRefresh = () => queryClient.invalidateQueries({ queryKey: ['workorders'] });
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  // Read client param from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('client');
    if (clientId) setClientFilter(clientId);
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-date', 200),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  const filtered = orders.filter(order => {
    const matchesSearch = !search ||
      order.project?.toLowerCase().includes(search.toLowerCase()) ||
      order.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesClient = clientFilter === 'all' || order.client_id === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Partes de Trabajo"
        subtitle={`${filtered.length} partes encontrados`}
        hideBack={true}
        actions={
          <Link to="/work-orders/new">
            <Button className="gap-2 shadow-sm" size="sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Parte</span>
            </Button>
          </Link>
        }
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por obra o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={clientFilter} onValueChange={setClientFilter} placeholder="Cliente" triggerClassName="w-full sm:w-48">
          <MobileSelectItem value="all">Todos los clientes</MobileSelectItem>
          {clients.map(c => (
            <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>
          ))}
        </MobileSelect>
        <MobileSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="Estado" triggerClassName="w-full sm:w-40">
          <MobileSelectItem value="all">Todos</MobileSelectItem>
          <MobileSelectItem value="pendiente">Pendiente</MobileSelectItem>
          <MobileSelectItem value="en_curso">En curso</MobileSelectItem>
          <MobileSelectItem value="completado">Completado</MobileSelectItem>
        </MobileSelect>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <p className="text-sm text-muted-foreground">No se encontraron partes</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(order => (
            <WorkOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}