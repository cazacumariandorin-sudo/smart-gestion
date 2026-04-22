import { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Determines which tab group a pathname belongs to
function getTabGroup(pathname) {
  if (pathname.startsWith('/operarios') || pathname.startsWith('/documentacion-operarios') || pathname.startsWith('/gastos-operarios') || pathname.startsWith('/calendario-vacaciones')) return 'equipos';
  if (pathname.startsWith('/obras') || pathname.startsWith('/orders') || pathname.startsWith('/materials') || pathname.startsWith('/manuales') || pathname.startsWith('/drawings') || pathname.startsWith('/fabricantes') || pathname.startsWith('/solar')) return 'pedidos';
  if (pathname.startsWith('/control-horario')) return 'horario';
  if (pathname.startsWith('/work-orders')) return 'partes';
  if (pathname === '/') return 'dashboard';
  return 'other';
}

// Per-tab history stacks
const tabStacks = {};

export function useNavDirection() {
  const location = useLocation();
  const direction = useRef('forward');

  useEffect(() => {
    const tab = getTabGroup(location.pathname);
    if (!tabStacks[tab]) tabStacks[tab] = [];
    const stack = tabStacks[tab];
    const key = location.key;

    const existingIdx = stack.indexOf(key);
    if (existingIdx !== -1) {
      // Visited before in this tab → going back
      direction.current = 'back';
      stack.splice(existingIdx + 1); // trim forward entries
    } else {
      direction.current = 'forward';
      stack.push(key);
    }
  }, [location.key, location.pathname]);

  return direction;
}