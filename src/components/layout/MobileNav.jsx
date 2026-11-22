import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserCircle, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useUserRole } from '@/lib/useUserRole';
import { HUBS, isHubVisible } from '@/lib/hubs';

/**
 * Barra de pestañas fija (móvil).
 *
 * Sustituye al antiguo bottom sheet por hub: cada pestaña navega directamente a
 * su hub y guarda su propia pila de navegación en sessionStorage, de modo que al
 * cambiar de pestaña y volver se recupera la última pantalla visitada. Volver a
 * pulsar la pestaña activa la devuelve a su raíz.
 */
const STACKS_KEY = 'sg_tab_stacks_v1';
const MAX_PINNED_HUBS = 3;

function haptic(ms = 8) {
  if (navigator?.vibrate) navigator.vibrate(ms);
}

function pathOnly(p) {
  return (p || '').split('?')[0];
}

// Mismo criterio que Sidebar.jsx: un item cuyo `path` lleva query string
// (p. ej. '/notas-gastos?vista=admin') debe compararse contra pathname+search
// completo, no solo el pathname.
function matchNavItem(item, pathname, search) {
  if (item.path.includes('?')) return (pathname + (search || '')) === item.path;
  return pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
}

function readStacks() {
  try {
    return JSON.parse(sessionStorage.getItem(STACKS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function pushStack(tabId, fullPath) {
  const stacks = readStacks();
  const list = (stacks[tabId] || []).filter(p => p !== fullPath);
  list.push(fullPath);
  stacks[tabId] = list.slice(-8);
  try {
    sessionStorage.setItem(STACKS_KEY, JSON.stringify(stacks));
  } catch {
    /* almacenamiento no disponible: se pierde solo la memoria de pestaña */
  }
}

function lastPathOf(tabId) {
  const list = readStacks()[tabId] || [];
  return list.length ? list[list.length - 1] : null;
}

function TabButton({ tab, isActive, onPress }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={() => onPress(tab)}
      aria-label={tab.ariaLabel}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-1 px-1 py-1.5 rounded-xl transition-colors relative',
        'min-h-[48px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <motion.div whileTap={{ scale: 0.85 }} className="relative flex items-center justify-center">
        {isActive && (
          <motion.div
            layoutId="mobile-tab-pill"
            className="absolute -inset-1.5 bg-primary/10 rounded-xl"
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
          />
        )}
        <Icon
          className={cn(
            'w-5 h-5 relative z-10 transition-all',
            isActive ? cn(tab.color || 'text-primary', 'stroke-[2.5]') : 'text-muted-foreground'
          )}
          aria-hidden="true"
        />
      </motion.div>
      <span
        className={cn(
          'text-[10px] font-semibold leading-none max-w-full truncate',
          isActive ? (tab.color || 'text-primary') : 'text-muted-foreground'
        )}
      >
        {tab.label}
      </span>
    </button>
  );
}

export default function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccess, role } = useUserRole();
  const isDemo = role === 'usuario_demo';

  const visibleHubs = HUBS
    .filter(hub => hub.id !== 'sistema')
    .filter(hub => isHubVisible(hub, { role, isDemo }))
    .map(hub => {
      const items = hub.items.filter(i => i.module === null || canAccess(i.module));
      return { ...hub, items, root: items[0]?.path || null };
    })
    .filter(hub => hub.root);

  const pinnedHubs = visibleHubs.slice(0, MAX_PINNED_HUBS);

  const tabs = [
    { id: 'panel', label: 'Panel', ariaLabel: 'Panel de inicio', icon: LayoutDashboard, root: '/', color: 'text-primary' },
    ...pinnedHubs.map(hub => ({
      id: hub.id,
      label: hub.label.split(' ')[0],
      ariaLabel: hub.label,
      icon: hub.icon,
      root: hub.root,
      color: hub.color,
      items: hub.items,
    })),
    { id: 'mas', label: 'Más', ariaLabel: 'Todos los módulos', icon: MoreHorizontal, root: '/mas', color: 'text-primary' },
    { id: 'perfil', label: 'Perfil', ariaLabel: 'Mi perfil', icon: UserCircle, root: '/profile', color: 'text-primary' },
  ];

  // Pestaña propietaria de una ruta. Lo que no es de un hub fijado cuelga de "Más".
  const ownerOf = (pathname, search) => {
    if (pathname === '/') return 'panel';
    if (pathname.startsWith('/mas')) return 'mas';
    if (pathname.startsWith('/profile')) return 'perfil';
    const hub = visibleHubs.find(h => h.items.some(i => matchNavItem(i, pathname, search)));
    return hub ? hub.id : 'mas';
  };

  // Guarda la pantalla actual en la pila de su pestaña
  useEffect(() => {
    pushStack(ownerOf(location.pathname, location.search), location.pathname + location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const belongsToTab = (tab, saved) => {
    if (!saved) return false;
    const path = pathOnly(saved);
    const search = saved.includes('?') ? '?' + saved.split('?').slice(1).join('?') : '';
    if (tab.id === 'panel') return path === '/';
    if (tab.id === 'perfil') return path.startsWith('/profile');
    // "Más" recupera cualquier módulo que no pertenezca a otra pestaña
    if (tab.id === 'mas') return ownerOf(path, search) === 'mas';
    return (tab.items || []).some(i => matchNavItem(i, path, search));
  };

  const handlePress = (tab) => {
    haptic();
    const activeTabId = ownerOf(location.pathname, location.search);

    // Re-pulsar la pestaña activa: vuelve a su raíz
    if (activeTabId === tab.id) {
      if (location.pathname + location.search !== tab.root) navigate(tab.root);
      return;
    }

    // Cambiar de pestaña: recupera su última pantalla (su "pila"), o su raíz
    const saved = lastPathOf(tab.id);
    navigate(belongsToTab(tab, saved) ? saved : tab.root);
  };

  const activeTabId = ownerOf(location.pathname, location.search);

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border safe-bottom"
    >
      <div className="flex items-stretch justify-around h-16 px-1 safe-x">
        {tabs.map(tab => (
          <TabButton key={tab.id} tab={tab} isActive={activeTabId === tab.id} onPress={handlePress} />
        ))}
      </div>
    </nav>
  );
}