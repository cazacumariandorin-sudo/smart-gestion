import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ClipboardList, Clock, Users, ShoppingCart, Camera, Building2, BookOpen, CalendarDays, UserCog, HardHat, BarChart3, Sun, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { useUserRole } from '@/lib/useUserRole';
import NotificacionesFichaje from '@/components/dashboard/NotificacionesFichaje';
import UserRoleDiagnostic from '@/components/debug/UserRoleDiagnostic';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ALL_MODULES = [
  {
    key: 'work-orders',
    label: 'Partes de Trabajo',
    path: '/work-orders',
    icon: ClipboardList,
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-800',
    iconColor: 'text-orange-600',
    emoji: '📋',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80',
  },
  {
    key: 'control-horario',
    label: 'Control Horario',
    path: '/control-horario',
    icon: Clock,
    bg: 'bg-cyan-50 dark:bg-cyan-950/30',
    border: 'border-cyan-200 dark:border-cyan-800',
    iconColor: 'text-cyan-600',
    emoji: '🕐',
    image: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=400&q=80',
  },
  {
    key: 'clients',
    label: 'Clientes',
    path: '/clients',
    icon: Users,
    bg: 'bg-teal-50 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800',
    iconColor: 'text-teal-600',
    emoji: '🏢',
    image: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=400&q=80',
  },
  {
    key: 'orders',
    label: 'Pedidos',
    path: '/orders',
    icon: ShoppingCart,
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600',
    emoji: '🛒',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&q=80',
  },
  {
    key: 'obras',
    label: 'Obras',
    path: '/obras',
    icon: Building2,
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600',
    emoji: '🏗️',
    image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=80',
  },

  {
    key: 'calendario-vacaciones',
    label: 'Vacaciones',
    path: '/calendario-vacaciones',
    icon: CalendarDays,
    bg: 'bg-indigo-50 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-800',
    iconColor: 'text-indigo-600',
    emoji: '🏖️',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  },
  {
    key: 'photos',
    label: 'Galería de Fotos',
    path: '/photos',
    icon: Camera,
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-200 dark:border-pink-800',
    iconColor: 'text-pink-600',
    emoji: '📷',
    image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&q=80',
  },
  {
    key: 'reports',
    label: 'Informes',
    path: '/reports',
    icon: BarChart3,
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-600',
    emoji: '📊',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80',
  },
  {
    key: 'operarios',
    label: 'Operarios',
    path: '/operarios',
    icon: HardHat,
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    iconColor: 'text-violet-600',
    emoji: '👷',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&q=80',
  },
  {
    key: 'users',
    label: 'Administración',
    path: '/users',
    icon: UserCog,
    bg: 'bg-slate-50 dark:bg-slate-950/30',
    border: 'border-slate-200 dark:border-slate-800',
    iconColor: 'text-slate-600',
    emoji: '⚙️',
    image: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&q=80',
  },
  {
    key: 'informe-obras',
    label: 'Informe Obras',
    path: '/informe-obras',
    icon: BarChart3,
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    iconColor: 'text-emerald-600',
    emoji: '📈',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&q=80',
  },

];

function ModuleCard({ mod, count, subtitle }) {
  const Icon = mod.icon;
  return (
    <Link to={mod.path}>
      <Card className={`overflow-hidden hover:shadow-xl transition-all hover:scale-[1.03] cursor-pointer border-2 ${mod.border} group`}>
        {/* Photo header */}
        <div className="relative h-24 overflow-hidden">
          <img
            src={mod.image}
            alt={mod.label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div className={`absolute inset-0 ${mod.bg} opacity-60`} />
          <div className="absolute top-2 right-2">
            <div className={`w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow`}>
              <Icon className={`w-4 h-4 ${mod.iconColor}`} />
            </div>
          </div>
          <span className="absolute bottom-2 left-2 text-xl drop-shadow">{mod.emoji}</span>
        </div>
        {/* Content */}
        <div className="p-3">
          <p className="text-xs font-bold text-foreground leading-tight">{mod.label}</p>
          {count !== undefined && <p className="text-lg font-bold text-foreground mt-0.5">{count}</p>}
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
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
    'calendario-vacaciones':'vacaciones',
    'reports':              'informes',
    'obras':                'obras',
    'users':                'administración',
  };

  const roleLabels = {
    admin:           { label: 'Administrador',   color: 'bg-red-100 text-red-700 border-red-200' },
    jefe_obra:       { label: 'Jefe de Obra',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
    operario:        { label: 'Usuario',         color: 'bg-amber-100 text-amber-700 border-amber-200' },
    control_horario: { label: 'Control Horario', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    cliente_obra:    { label: 'Cliente Obra',    color: 'bg-violet-100 text-violet-700 border-violet-200' },
  };
  const roleCfg = roleLabels[role] || roleLabels.operario;

  const visibleModules = ALL_MODULES.filter(m => canAccess(m.key));
  const recentOrders = orders.slice(0, 6);
  const showDiagnostic = visibleModules.length === 0;

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

      {/* Alertas de fichaje */}
      <NotificacionesFichaje />

      {/* Module grid - only accessible modules */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8">
        {visibleModules.map(mod => (
          <ModuleCard key={mod.key} mod={mod} count={counts[mod.key]} subtitle={subtitles[mod.key]} />
        ))}
      </div>

      {/* Debug diagnostic when no modules are visible */}
      {showDiagnostic && <UserRoleDiagnostic />}
    </div>
  );
}