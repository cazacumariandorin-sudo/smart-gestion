import { useState } from 'react';
import { Wifi, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useNetworkInfo } from '@/hooks/useNetworkInfo';
import { cn } from '@/lib/utils';

const STYLE_BY_TYPE = {
  '4g': { dot: 'bg-emerald-500', label: '4G' },
  'slow-4g': { dot: 'bg-amber-500', label: 'HSPA' },
  '3g': { dot: 'bg-amber-500', label: '3G' },
  '2g': { dot: 'bg-red-500', label: '2G' },
  'slow-2g': { dot: 'bg-red-500', label: '2G' },
};

export default function NetworkStatusBanner() {
  const { effectiveType, downlink, rtt, isSlowNetwork } = useNetworkInfo();
  const [expanded, setExpanded] = useState(false);
  const cfg = STYLE_BY_TYPE[effectiveType] || STYLE_BY_TYPE['4g'];

  return (
    <div className="w-full bg-muted/40 border-b border-border">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-0.5 text-[10px] text-muted-foreground"
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
        <Wifi className="w-3 h-3" />
        <span className="font-semibold">{cfg.label}</span>
        {isSlowNetwork && <AlertTriangle className="w-3 h-3 text-amber-500" />}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="px-3 pb-1.5 text-[10px] text-muted-foreground text-center space-y-0.5">
          {downlink != null && <p>Velocidad estimada: {downlink} Mbps{rtt != null ? ` · RTT ${rtt}ms` : ''}</p>}
          {isSlowNetwork && <p className="text-amber-600 font-medium">Conexión lenta. Algunos datos pueden tardar más</p>}
        </div>
      )}
    </div>
  );
}