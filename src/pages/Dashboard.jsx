import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, Users, ArrowRight, ShoppingCart, Camera, Building2, Receipt, BookOpen, CalendarDays, UserCog } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import WorkOrderCard from '@/components/workorders/WorkOrderCard';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { useUserRole } from '@/lib/useUserRole';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ALL_MODULES = [
  { key: 'work-orders',         label: 'Partes de Trabajo',  path: '/work-orders',          icon: ClipboardList, bg: 'bg-orange-50 dark:bg-orange-950/30',  border: 'border-orange-200 dark:border-orange-800',  emoji: '📋' },
  { key: 'control-horario',     label: 'Control Horario',    path: '/control-horario',      icon: Clock,         bg: 'bg-cyan-50 dark:bg-cyan-950/30',      border: 'border-cyan-200 dark:border-cyan-800',      emoji: '🕐' },
  { key: 'clients',             label: 'Clientes',           path: '/clients',              icon: Users,         bg: 'bg-teal-50 dark:bg-teal-950/30',      border: 'border-teal-200 dark:border-teal-800',      emoji: '🏢' },
  { key: 'orders',              label: 'Pedidos',            path: '/orders',               icon: ShoppingCart,  bg: 'bg-blue-50 dark:bg-blue-950/30',      border: 'border-blue-200 dark:border-blue-800',      emoji: '🛒' },
  { key: 'obras',               label: 'Obras',              path: '/obras',                icon: Building2,     bg: 'bg-amber-50 dark:bg-amber-950/30',    border: 'border-amber-200 dark:border-amber-800',    emoji: '🏗️' },
  { key: 'gastos-operarios',    label: 'Gastos',             path: '/gastos-operarios',     icon: Receipt,       bg: 'bg-rose-50 dark:bg-rose-950/30',      border: 'border-rose-200 dark:border-rose-800',      emoji: '🧾' },
  { key: 'calendario-vacaciones', label: 'Vacaciones',       path: '/calendario-vacaciones',icon: CalendarDays,  bg: 'bg-indigo-50 dark:bg-indigo-950/30',  border: 'border-indigo-200 dark:border-indigo-800',  emoji: '🏖️' },
  { key: 'photos',              label: 'Galería de Fotos',   path: '/photos',               icon: Camera,        bg: 'bg-pink-50 dark:bg-pink-950/30',      border: 'border-pink-200 dark:border-pink-800',      emoji: '📷' },
  { key: 'reports',             label: 'Informes',           path: '/reports',              icon: BookOpen,      bg: 'bg-green-50 dark:bg-green-950/30',    border: 'border-green-200 dark:border-green-800',    emoji: '📊' },
  { key: 'operarios',           label: 'Operarios',          path: '/operarios',            icon: Users,         bg: 'bg-violet-50 dark:bg-violet-950/30',  border: 'border-violet-200 dark:border-violet-800',  emoji: '👷' },
  { key: 'users',               label: 'Administración',     path: '/users',                icon: UserCog,       bg: 'bg-slate-50 dark:bg-slate-950/30',    border: 'border-slate-200 dark:border-slate-800',    emoji: '⚙️' },
];

function ModuleCard({ mod, count, subtitle }) {
  const Icon = mod.icon;
  return (
    <Link to={mod.path}>
      <Card className={`p-4 hover:shadow-lg transition-all hover:scale-[1.03] cursor-pointer border ${mod.border} ${mod.bg} group`}>
        <div className="flex items-start justify-between mb-3">
          <span className="text-2xl">{mod.emoji}</span>
          <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <p className="text-xs font-semibold text-foreground leading-tight">{mod.label}</p>
        {count !== undefined && <p className="text-xl font-bold text-foreground mt-1">{count}</p>}
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { canAccess, role, isLoading: roleLoading } = useUserRole();

  const onRefresh = () => {
    ['workorders', 'fichajes', 'clients', 'operarios', 'orders_list', 'photos_count'].forEach(k =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: orders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list('-date', 50) });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('name', 200) });
  const { data: operarios = [] } = useQuery({ queryKey: ['operarios'], queryFn: () => base44.entities.Operario.list('name', 200) });
  const { data: pedidos = [] } = useQuery({ queryKey: ['orders_list'], queryFn: () => base44.entities.Order.list('-date', 50) });
  const { data: photos = [] } = useQuery({ queryKey: ['photos_count'], queryFn: () => base44.entities.WorkPhoto.list('-date', 200) });
  const { data: fichajesHoy = [] } = useQuery({
    queryKey: ['fichajes_hoy'],
    queryFn: async () => base44.entities.Fichaje.filter({ date: format(new Date(), 'yyyy-MM-dd') }),
  });

  const counts = {
    'work-orders':          orders.length,
    'orders':               pedidos.filter(p => p.status === 'pendiente').length,
    'control-horario':      fichajesHoy.length,
    'clients':              clients.length,
    'operarios':            operarios.length,
    'photos':               photos.length,
  };
  const subtitles = {
    'work-orders':          `${orders.filter(o => o.status === 'pendiente' || !o.status).length} pendientes`,
    'orders':               'pendientes',
    'control-horario':      'fichajes hoy',
    'clients':              'activos',
    'operarios':            'en plantilla',
    'photos':               'fotos',
    'gastos-operarios':     'gastos',
    'calendario-vacaciones':'vacaciones',
    'reports':              'informes',
    'obras':                'obras',
    'users':                'administración',
  };

  const roleLabels = {
    admin: { label: 'Administrador', color: 'bg-red-100 text-red-700 border-red-200' },
    jefe_obra: { label: 'Jefe de Obra', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    operario: { label: 'Operario', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    control_horario: { label: 'Control Horario', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  };
  const roleCfg = roleLabels[role] || roleLabels.operario;

  const visibleModules = ALL_MODULES.filter(m => canAccess(m.key));
  const recentOrders = orders.slice(0, 6);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Panel</h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <Badge variant="outline" className={`text-xs font-semibold ${roleCfg.color}`}>{roleCfg.label}</Badge>
      </div>

      {/* Module grid - only accessible modules */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8">
        {visibleModules.map(mod => (
          <ModuleCard key={mod.key} mod={mod} count={counts[mod.key]} subtitle={subtitles[mod.key]} />
        ))}
      </div>

      {/* Recent Work Orders */}
      {canAccess('work-orders') && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Partes Recientes</h2>
            <Link to="/work-orders" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl">
              <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay partes de trabajo</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentOrders.map(order => <WorkOrderCard key={order.id} order={order} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}