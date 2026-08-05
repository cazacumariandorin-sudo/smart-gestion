import { safeSeparatorLabel } from '@/lib/chatDateUtils';

export default function ChatDateSeparator({ dateStr }) {
  const label = safeSeparatorLabel(dateStr);
  if (label == null) return null;

  return (
    <div className="flex items-center gap-3 my-2 select-none">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] text-muted-foreground font-medium capitalize">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}