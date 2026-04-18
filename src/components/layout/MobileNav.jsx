import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Users, ShoppingCart, Clock, ChevronUp, X, CalendarDays, Building2, BookOpen, FileImage, Receipt, Package, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const mainItems = [
  { path: '/', icon: LayoutDashboard, label: 'Panel' },
  { path: '/work-orders', icon: ClipboardList, label: 'Partes' },
  { path: '/work-orders/new', icon: Plus, label: 'Nuevo' },
  { path: '/control-horario', icon: Clock, label: 'Horario' },
];

const operariosItems = [
  { path: '/operarios', icon: Users, label: 'Operarios' },
  { path: '/gastos-operarios', icon: Receipt, label: 'Gastos' },
  { path: '/calendario-vacaciones', icon: CalendarDays, label: 'Vacaciones' },
];

const pedidosItems = [
  { path: '/obras', icon: Building2, label: 'Obras' },
  { path: '/orders', icon: ShoppingCart, label: 'Pedidos' },
  { path: '/materials', icon: Package, label: 'Materiales' },
  { path: '/manuales', icon: BookOpen, label: 'Manuales' },
  { path: '/drawings', icon: FileImage, label: 'Planos' },
];

function MoreDrawer({ items, onClose }) {
  const location = useLocation();
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-card border-t border-border rounded-t-2xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="grid grid-cols-3 gap-3 pb-2">
          {items.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path} onClick={onClose}
                className={cn('flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <button onClick={onClose} className="w-full mt-2 flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
          <X className="w-4 h-4" /> Cerrar
        </button>
      </div>
    </div>
  );
}

export default function MobileNav() {
  const location = useLocation();
  const [showOperarios, setShowOperarios] = useState(false);
  const [showPedidos, setShowPedidos] = useState(false);

  const isOperariosActive = operariosItems.some(i => location.pathname.startsWith(i.path));
  const isPedidosActive = pedidosItems.some(i => location.pathname.startsWith(i.path));

  return (
    <>
      {(showOperarios || showPedidos) && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => { setShowOperarios(false); setShowPedidos(false); }} />
      )}

      {showOperarios && <MoreDrawer items={operariosItems} onClose={() => setShowOperarios(false)} />}
      {showPedidos && <MoreDrawer items={pedidosItems} onClose={() => setShowPedidos(false)} />}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border px-1 pb-safe">
        <div className="flex justify-around items-center h-16">
          {mainItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link key={item.path} to={item.path}
                className={cn('flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all',
                  isActive ? 'text-primary' : 'text-muted-foreground')}
              >
                <item.icon className={cn('w-5 h-5', isActive && 'stroke-[2.5]')} />
                <span className="text-[9px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => { setShowOperarios(o => !o); setShowPedidos(false); }}
            className={cn('flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all',
              (isOperariosActive || showOperarios) ? 'text-primary' : 'text-muted-foreground')}
          >
            <Users className={cn('w-5 h-5', (isOperariosActive || showOperarios) && 'stroke-[2.5]')} />
            <span className="text-[9px] font-medium">Equipos</span>
          </button>

          <button
            onClick={() => { setShowPedidos(o => !o); setShowOperarios(false); }}
            className={cn('flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all',
              (isPedidosActive || showPedidos) ? 'text-primary' : 'text-muted-foreground')}
          >
            <ShoppingCart className={cn('w-5 h-5', (isPedidosActive || showPedidos) && 'stroke-[2.5]')} />
            <span className="text-[9px] font-medium">Pedidos</span>
          </button>
        </div>
      </nav>
    </>
  );
}