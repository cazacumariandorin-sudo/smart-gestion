import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/lib/useUserRole';
import { HUBS, isHubVisible } from '@/lib/hubs';

/**
 * Menú "Más" — índice completo de módulos para la barra de pestañas móvil.
 * Sustituye al antiguo bottom sheet por hub: ahora cada hub es una pestaña con
 * su propia pila de navegación y aquí queda el acceso a todo lo demás.
 */
export default function MasMenu() {
  const { canAccess, role } = useUserRole();
  const isDemo = role === 'usuario_demo';

  const hubs = HUBS
    .filter(hub => isHubVisible(hub, { role, isDemo }))
    .map(hub => ({ ...hub, items: hub.items.filter(i => i.module === null || canAccess(i.module)) }))
    .filter(hub => hub.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 pt-4 pb-28">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Más</h1>
        <div className="space-y-4">
          {hubs.map(hub => (
            <section key={hub.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <header className={cn('flex items-center gap-2 px-4 py-3 border-b border-border', hub.activeBg)}>
                <hub.icon className={cn('w-4 h-4', hub.color)} aria-hidden="true" />
                <h2 className={cn('text-sm font-bold', hub.color)}>{hub.label}</h2>
              </header>
              <ul className="divide-y divide-border">
                {hub.items.map(item => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      aria-label={item.label}
                      className="flex items-center gap-3 px-4 py-3 min-h-[48px] transition-colors active:bg-muted/60 hover:bg-muted/40"
                    >
                      <item.icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}