import { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Users, ShoppingCart, Clock, X, CalendarDays, Building2, BookOpen, FileImage, Receipt, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserRole } from '@/lib/useUserRole';

const ALL_MAIN_ITEMS = [
  { path: '/',               icon: LayoutDashboard, label: 'Panel',   module: null },
  { path: '/work-orders',    icon: ClipboardList,   label: 'Partes',  module: 'work-orders' },
  { path: '/control-horario',icon: Clock,           label: 'Horario', module: 'control-horario' },
];

const ALL_OPERARIOS_ITEMS = [
  { path: '/operarios',              icon: Users,       label: 'Operarios',  module: 'operarios' },
  { path: '/gastos-operarios',       icon: Receipt,     label: 'Gastos',     module: 'gastos-operarios' },
  { path: '/calendario-vacaciones',  icon: CalendarDays,label: 'Vacaciones', module: 'calendario-vacaciones' },
];

const ALL_PEDIDOS_ITEMS = [
  { path: '/obras',     icon: Building2,   label: 'Obras',      module: 'obras' },
  { path: '/orders',    icon: ShoppingCart,label: 'Pedidos',    module: 'orders' },
  { path: '/materials', icon: Package,     label: 'Materiales', module: 'orders' },
  { path: '/manuales',  icon: BookOpen,    label: 'Manuales',   module: 'orders' },
  { path: '/drawings',  icon: FileImage,   label: 'Planos',     module: 'orders' },
];

// Trigger vibration if supported
function haptic(ms = 8) {
  if (navigator?.vibrate) navigator.vibrate(ms);
}

function BottomSheet({ title, items, onClose }) {
  const location = useLocation();
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Sheet */}
      <motion.div
        className="relative bg-card border-t border-border rounded-t-3xl pt-3 pb-8 px-4 shadow-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />

        {title && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">{title}</p>}

        <div className="grid grid-cols-3 gap-2.5">
          {items.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { haptic(); onClose(); }}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl transition-all active:scale-95',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground rounded-xl hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cerrar
        </button>
      </motion.div>
    </motion.div>
  );
}

function NavItem({ item, isActive, onReset, onNavigate }) {
  const Icon = item.icon;

  const handleClick = () => {
    haptic();
    if (isActive) {
      // Tab reset: scroll to top + navigate to root of this tab
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onReset(item.path);
    } else {
      onNavigate(item.path);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all relative min-w-[52px]"
    >
      <motion.div whileTap={{ scale: 0.82 }} className="relative flex items-center justify-center">
        {isActive && (
          <motion.div
            layoutId="nav-pill"
            className="absolute -inset-1.5 bg-primary/12 rounded-xl"
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
          />
        )}
        <Icon className={cn('w-5 h-5 relative z-10 transition-all', isActive ? 'text-primary stroke-[2.5]' : 'text-muted-foreground')} />
      </motion.div>
      <span className={cn('text-[9px] font-semibold transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}>
        {item.label}
      </span>
    </button>
  );
}

function GroupNavItem({ icon: Icon, label, isActive, isOpen, onClick }) {
  return (
    <button
      onClick={() => { haptic(); onClick(); }}
      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all relative min-w-[52px]"
    >
      <motion.div whileTap={{ scale: 0.82 }} className="relative flex items-center justify-center">
        {(isActive || isOpen) && (
          <motion.div
            layoutId={`nav-pill-group-${label}`}
            className="absolute -inset-1.5 bg-primary/12 rounded-xl"
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
          />
        )}
        <Icon className={cn('w-5 h-5 relative z-10 transition-all', (isActive || isOpen) ? 'text-primary stroke-[2.5]' : 'text-muted-foreground')} />
      </motion.div>
      <span className={cn('text-[9px] font-semibold transition-colors', (isActive || isOpen) ? 'text-primary' : 'text-muted-foreground')}>
        {label}
      </span>
    </button>
  );
}

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccess } = useUserRole();
  const [showOperarios, setShowOperarios] = useState(false);
  const [showPedidos, setShowPedidos] = useState(false);

  const mainItems      = ALL_MAIN_ITEMS.filter(i => i.module === null || canAccess(i.module));
  const operariosItems = ALL_OPERARIOS_ITEMS.filter(i => canAccess(i.module));
  const pedidosItems   = ALL_PEDIDOS_ITEMS.filter(i => canAccess(i.module));

  const isOperariosActive = operariosItems.some(i => location.pathname.startsWith(i.path));
  const isPedidosActive   = pedidosItems.some(i => location.pathname.startsWith(i.path));

  const closeAll = useCallback(() => { setShowOperarios(false); setShowPedidos(false); }, []);

  // Tab reset: navigate to root of tab, scroll to top
  const handleReset = useCallback((path) => {
    closeAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate(path, { replace: true });
  }, [navigate, closeAll]);

  const handleNavigate = useCallback((path) => {
    closeAll();
    navigate(path);
  }, [navigate, closeAll]);

  // Group tab reset: if already on a group tab → navigate to first item root and reset
  const handleGroupReset = useCallback((items, setShow, otherSet) => {
    haptic();
    const groupActive = items.some(i => location.pathname.startsWith(i.path));
    if (groupActive) {
      // Reset to first item of the group
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navigate(items[0].path, { replace: true });
      setShow(false);
      otherSet(false);
    } else {
      setShow(o => !o);
      otherSet(false);
    }
  }, [location.pathname, navigate]);

  return (
    <>
      <AnimatePresence>
        {showOperarios && (
          <BottomSheet title="Equipos" items={operariosItems} onClose={() => setShowOperarios(false)} />
        )}
        {showPedidos && (
          <BottomSheet title="Pedidos y Obras" items={pedidosItems} onClose={() => setShowPedidos(false)} />
        )}
      </AnimatePresence>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-around items-center h-16 px-1">
          {mainItems.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <NavItem
                key={item.path}
                item={item}
                isActive={isActive}
                onReset={handleReset}
                onNavigate={handleNavigate}
              />
            );
          })}

          {operariosItems.length > 0 && (
            <GroupNavItem
              icon={Users}
              label="Equipos"
              isActive={isOperariosActive}
              isOpen={showOperarios}
              onClick={() => handleGroupReset(operariosItems, setShowOperarios, setShowPedidos)}
            />
          )}

          {pedidosItems.length > 0 && (
            <GroupNavItem
              icon={ShoppingCart}
              label="Pedidos"
              isActive={isPedidosActive}
              isOpen={showPedidos}
              onClick={() => handleGroupReset(pedidosItems, setShowPedidos, setShowOperarios)}
            />
          )}
        </div>
      </nav>
    </>
  );
}