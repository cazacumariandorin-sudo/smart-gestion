import { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserRole } from '@/lib/useUserRole';
import { HUBS, isHubVisible } from '@/lib/hubs';

function haptic(ms = 8) {
  if (navigator?.vibrate) navigator.vibrate(ms);
}

function BottomSheet({ hub, onClose, saveTabPath }) {
  const location = useLocation();
  const { canAccess } = useUserRole();
  const items = hub.items.filter(i => i.module === null || canAccess(i.module));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <motion.div
        className="relative bg-card border-t border-border rounded-t-3xl pt-3 pb-8 px-4"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
        <div className={cn('flex items-center gap-2 mb-4 px-1')}>
          <hub.icon className={cn('w-4 h-4', hub.color)} />
          <p className={cn('text-sm font-bold', hub.color)}>{hub.label}</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {items.map(item => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { haptic(); saveTabPath(item.path, item.path); onClose(); }}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl transition-all active:scale-95',
                  isActive ? cn(hub.activeBg, hub.color, 'font-semibold') : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold text-center leading-tight">{item.label}</span>
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

function NavTab({ icon: Icon, label, isActive, isOpen, onClick, color }) {
  return (
    <button
      onClick={() => { haptic(); onClick(); }}
      className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all relative min-w-[44px]"
    >
      <motion.div whileTap={{ scale: 0.82 }} className="relative flex items-center justify-center">
        {(isActive || isOpen) && (
          <motion.div
            layoutId={`nav-pill-${label}`}
            className="absolute -inset-1.5 bg-primary/10 rounded-xl"
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
          />
        )}
        <Icon className={cn('w-5 h-5 relative z-10 transition-all', (isActive || isOpen) ? (color || 'text-primary') + ' stroke-[2.5]' : 'text-muted-foreground')} />
      </motion.div>
      <span className={cn('text-[9px] font-semibold transition-colors', (isActive || isOpen) ? (color || 'text-primary') : 'text-muted-foreground')}>
        {label}
      </span>
    </button>
  );
}

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccess, isAdmin, role } = useUserRole();
  const isGerencia = role === 'gerencia';

  const [openHub, setOpenHub] = useState(null);

  const getTabKey = (tabPath) => `tab_last_path_${tabPath}`;
  const saveTabPath = useCallback((tabPath, fullPath) => {
    if (tabPath && fullPath.startsWith(tabPath)) {
      sessionStorage.setItem(getTabKey(tabPath), fullPath);
    }
  }, []);

  const closeAll = useCallback(() => setOpenHub(null), []);

  const isDemo = role === 'usuario_demo';
  const visibleHubs = HUBS.filter(hub => {
    if (hub.id === 'sistema') return false;
    if (!isHubVisible(hub, { role, isDemo })) return false;
    return hub.items.some(i => i.module === null || canAccess(i.module));
  });

  // Show at most 4 hubs in the bottom bar + profile; the rest are in "Más"
  const MAX_TABS = 4;
  const pinnedHubs = visibleHubs.slice(0, MAX_TABS);

  return (
    <>
      <AnimatePresence>
        {openHub && (
          <BottomSheet
            key={openHub.id}
            hub={openHub}
            onClose={closeAll}
            saveTabPath={saveTabPath}
          />
        )}
      </AnimatePresence>

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex justify-around items-center h-16 px-1">
          {/* Dashboard tab */}
          <button
            onClick={() => { haptic(); closeAll(); navigate('/'); }}
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all relative min-w-[44px]"
          >
            <motion.div whileTap={{ scale: 0.82 }} className="relative flex items-center justify-center">
              {location.pathname === '/' && (
                <motion.div layoutId="nav-pill-dash" className="absolute -inset-1.5 bg-primary/10 rounded-xl" transition={{ type: 'spring', damping: 26, stiffness: 350 }} />
              )}
              <LayoutDashboard className={cn('w-5 h-5 relative z-10', location.pathname === '/' ? 'text-primary stroke-[2.5]' : 'text-muted-foreground')} />
            </motion.div>
            <span className={cn('text-[9px] font-semibold', location.pathname === '/' ? 'text-primary' : 'text-muted-foreground')}>Panel</span>
          </button>

          {/* Hub tabs */}
          {pinnedHubs.map(hub => {
            const isActive = hub.items.some(i => location.pathname === i.path || (i.path !== '/' && location.pathname.startsWith(i.path)));
            const isOpen = openHub?.id === hub.id;
            return (
              <NavTab
                key={hub.id}
                icon={hub.icon}
                label={hub.label}
                isActive={isActive}
                isOpen={isOpen}
                color={hub.color}
                onClick={() => setOpenHub(isOpen ? null : hub)}
              />
            );
          })}

          {/* Profile */}
          <button
            onClick={() => { haptic(); closeAll(); navigate('/profile'); }}
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all relative min-w-[44px]"
          >
            <motion.div whileTap={{ scale: 0.82 }} className="relative flex items-center justify-center">
              {location.pathname === '/profile' && (
                <motion.div layoutId="nav-pill-profile" className="absolute -inset-1.5 bg-primary/10 rounded-xl" transition={{ type: 'spring', damping: 26, stiffness: 350 }} />
              )}
              <UserCircle className={cn('w-5 h-5 relative z-10', location.pathname === '/profile' ? 'text-primary stroke-[2.5]' : 'text-muted-foreground')} />
            </motion.div>
            <span className={cn('text-[9px] font-semibold', location.pathname === '/profile' ? 'text-primary' : 'text-muted-foreground')}>Perfil</span>
          </button>
        </div>
      </nav>
    </>
  );
}