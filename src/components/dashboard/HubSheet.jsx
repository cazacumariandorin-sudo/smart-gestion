import { Drawer } from 'vaul';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export default function HubSheet({ hub, open, onOpenChange }) {
  if (!hub) return null;
  const Icon = hub.icon;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none bg-background rounded-t-2xl max-h-[75vh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className={cn('flex items-center gap-3 px-5 py-4 border-b shrink-0', hub.bg)}>
            <div className={cn('p-2.5 rounded-xl shadow-sm', hub.iconBg)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <Drawer.Title className={cn('text-base font-extrabold uppercase tracking-wide', hub.color)}>
              {hub.label}
            </Drawer.Title>
          </div>

          {/* Items */}
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
            {hub.items.map((item) => {
              const IIcon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-secondary hover:bg-secondary/70 active:scale-[0.98] transition-all min-h-[56px]"
                >
                  <IIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="font-semibold text-sm flex-1">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                </Link>
              );
            })}
          </div>

          {/* Safe area bottom */}
          <div className="h-[env(safe-area-inset-bottom,0px)] shrink-0" />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}