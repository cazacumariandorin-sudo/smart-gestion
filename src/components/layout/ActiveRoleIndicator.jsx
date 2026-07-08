import { UserCircle2 } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { ROLE_LABELS } from '@/lib/roleLabels';
import { cn } from '@/lib/utils';

export default function ActiveRoleIndicator() {
  const { role, isSimulating } = useUserRole();
  if (!role) return null;

  const cfg = ROLE_LABELS[role] || { label: role, className: 'bg-gray-100 text-gray-700 border-gray-200' };

  return (
    <div
      className={cn(
        'fixed z-40 flex items-center gap-1 rounded-full border px-2.5 py-1 shadow-md text-[10px] font-bold pointer-events-none',
        'top-[calc(env(safe-area-inset-top,0px)+8px)] right-3',
        cfg.className
      )}
    >
      <UserCircle2 className="w-3 h-3" />
      <span>{cfg.label}</span>
      {isSimulating && <span className="opacity-70">(sim)</span>}
    </div>
  );
}