/**
 * OverflowMenu — BLOQUE 3
 * Menú de tres puntos (⋮) reutilizable para tablas y vistas de detalle.
 *
 * Uso:
 *   <OverflowMenu actions={[
 *     { label: 'Editar', icon: Pencil, onClick: () => {} },
 *     { label: 'Eliminar', icon: Trash2, onClick: () => {}, danger: true, divider: true },
 *   ]} />
 */
import { useState, useEffect, useRef } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OverflowMenu({ actions = [], align = 'right', triggerClassName }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, []);

  if (!actions || actions.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        aria-label="Más acciones"
        className={cn(
          'flex items-center justify-center rounded-lg transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          'h-[44px] w-[44px]',
          triggerClassName
        )}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-full mt-1 z-50 min-w-[180px]',
            'bg-card border border-border rounded-xl shadow-lg overflow-hidden',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          onClick={e => e.stopPropagation()}
        >
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                type="button"
                disabled={action.disabled}
                onClick={() => { action.onClick(); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors',
                  'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed',
                  action.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground',
                  i > 0 && action.divider ? 'border-t border-border' : ''
                )}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}