/**
 * HubBreadcrumb — shows which hub the current page belongs to.
 * Usage: <HubBreadcrumb pageLabel="Obras civiles" />
 */
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HUBS } from './Sidebar';

export default function HubBreadcrumb({ pageLabel }) {
  const location = useLocation();
  const path = location.pathname;

  // Find which hub this path belongs to
  const hub = HUBS.find(h =>
    h.items.some(i => path === i.path || (i.path !== '/' && path.startsWith(i.path)))
  );

  if (!hub) return null;

  const HubIcon = hub.icon;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 px-4 sm:px-6 lg:px-8 pt-4">
      <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
        <LayoutDashboard className="w-3 h-3" />
        <span>Panel</span>
      </Link>
      <ChevronRight className="w-3 h-3 shrink-0" />
      <Link
        to={hub.items[0]?.path || '/'}
        className={cn('flex items-center gap-1 font-medium hover:text-foreground transition-colors', hub.color)}
      >
        <HubIcon className="w-3 h-3" />
        <span>{hub.label}</span>
      </Link>
      {pageLabel && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-foreground font-medium">{pageLabel}</span>
        </>
      )}
    </nav>
  );
}