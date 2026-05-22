import { useUserRole } from '@/lib/useUserRole';

export default function DemoWatermark() {
  const { isDemo } = useUserRole();
  if (!isDemo) return null;

  return (
    <div
      className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-20 pointer-events-none select-none"
      aria-hidden="true"
    >
      <span className="text-[11px] font-black tracking-[0.3em] uppercase text-muted-foreground/20 rotate-[-30deg] block border border-muted-foreground/10 px-2 py-0.5 rounded">
        DEMO
      </span>
    </div>
  );
}