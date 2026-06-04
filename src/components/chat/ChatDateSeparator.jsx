import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ChatDateSeparator({ dateStr }) {
  const date = new Date(dateStr);
  let label;
  if (isToday(date)) label = 'Hoy';
  else if (isYesterday(date)) label = 'Ayer';
  else label = format(date, "EEEE d 'de' MMMM", { locale: es });

  return (
    <div className="flex items-center gap-3 my-2 select-none">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] text-muted-foreground font-medium capitalize">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}