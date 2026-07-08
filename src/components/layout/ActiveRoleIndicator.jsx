import { UserCircle2 } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { ROLE_LABELS } from '@/lib/roleLabels';
import { cn } from '@/lib/utils';

function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}

export default function ActiveRoleIndicator() {
  const { role, isSimulating, user } = useUserRole();
  if (!role) return null;

  const cfg = ROLE_LABELS[role] || { label: role, className: 'bg-gray-100 text-gray-700 border-gray-200' };
  const initials = getInitials(user?.full_name);

  return (
    <div
      className={cn(
        'fixed z-40 flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-md text-[10px] font-bold pointer-events-none',
        'top-[calc(env(safe-area-inset-top,0px)+8px)] right-3',
        cfg.className
      )}
    >
      {initials ? (
        <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[8px] shrink-0">
          {initials}
        </span>
      ) : (
        <UserCircle2 className="w-3 h-3" />
      )}
      <span>{cfg.label}</span>
      {isSimulating && <span className="opacity-70">(sim)</span>}
    </div>
  );
}