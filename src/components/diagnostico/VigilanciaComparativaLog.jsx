// Línea temporal intercalada de eventos de dos vigilancias (A vs B) con
// generación/copia/descarga de log comparativo en texto plano para análisis
// de fallos, bugs o comportamientos indebidos.
import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Filter, ClipboardCopy, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { generarTextoLogComparativa, TIPO_BADGE_LABEL } from '@/lib/vigilanciaLog';

const TIPO_BADGE_VARIANT = {
  nav: 'secondary', click: 'secondary', red: 'secondary',
  auth: 'default', error: 'destructive', promise_rejection: 'destructive',
  visibility: 'secondary', render: 'secondary', network_request: 'destructive',
  custom: 'secondary',
};

function fmtHora(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-ES', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch { return ts; }
}

export default function VigilanciaComparativaLog({ vig_a, vig_b, resumen_a, resumen_b, eventos_a, eventos_b }) {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroUsuario, setFiltroUsuario] = useState('ambos');
  const [copiado, setCopiado] = useState(false);

  const marcados = useMemo(() => {
    const a = eventos_a.map(e => ({ ...e, _u: 'A' }));
    const b = eventos_b.map(e => ({ ...e, _u: 'B' }));
    return [...a, ...b].sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
  }, [eventos_a, eventos_b]);

  const tiposDisponibles = useMemo(() => {
    const s = new Set(marcados.map(e => e.tipo_evento));
    return ['todos', ...Array.from(s)];
  }, [marcados]);

  const filtrados = marcados.filter(e =>
    (filtroTipo === 'todos' || e.tipo_evento === filtroTipo) &&
    (filtroUsuario === 'ambos' || e._u === filtroUsuario)
  );

  const handleCopiar = async () => {
    const texto = generarTextoLogComparativa({ vig_a, vig_b, resumen_a, resumen_b, eventos_a, eventos_b });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success('Log comparativo copiado ✓');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('No se pudo copiar. Prueba a descargarlo.');
    }
  };

  const handleDescargar = () => {
    const texto = generarTextoLogComparativa({ vig_a, vig_b, resumen_a, resumen_b, eventos_a, eventos_b });
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fa = (vig_a?.user_email || 'a').split('@')[0];
    const fb = (vig_b?.user_email || 'b').split('@')[0];
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `comparativa_${fa}_vs_${fb}_${fecha}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Log comparativo descargado');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="text-xs font-medium mr-1">Log comparativo</div>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={handleCopiar}>
          {copiado ? <Check className="w-3.5 h-3.5 mr-1" /> : <ClipboardCopy className="w-3.5 h-3.5 mr-1" />}
          {copiado ? 'Copiado' : 'Copiar log'}
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={handleDescargar}>
          <Download className="w-3.5 h-3.5 mr-1" /> .txt
        </Button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
        {tiposDisponibles.map(t => (
          <Button key={t} size="sm" variant={filtroTipo === t ? 'default' : 'outline'} className="h-7 px-2 text-[11px]"
            onClick={() => setFiltroTipo(t)}>
            {t === 'todos' ? 'Todos' : (TIPO_BADGE_LABEL[t] || t)}
          </Button>
        ))}
        <span className="mx-1 text-muted-foreground">·</span>
        {['ambos', 'A', 'B'].map(u => (
          <Button key={u} size="sm" variant={filtroUsuario === u ? 'default' : 'outline'} className="h-7 px-2 text-[11px]"
            onClick={() => setFiltroUsuario(u)}>
            {u === 'ambos' ? 'A+B' : u}
          </Button>
        ))}
      </div>

      <div className="border rounded-md max-h-[55vh] overflow-y-auto">
        {filtrados.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground text-center">Sin eventos para el filtro actual.</div>
        )}
        {filtrados.map((e, i) => (
          <div key={e.id || i} className="flex items-start gap-2 px-2 py-1.5 border-b text-[11px] hover:bg-muted/40">
            <span className="text-[9px] text-muted-foreground font-mono w-20 shrink-0">{fmtHora(e.timestamp)}</span>
            <Badge variant={e._u === 'A' ? 'default' : 'secondary'} className="text-[9px] h-4 px-1 shrink-0 w-5 justify-center">
              {e._u}
            </Badge>
            <Badge variant={TIPO_BADGE_VARIANT[e.tipo_evento] || 'secondary'} className="text-[9px] h-4 px-1 shrink-0">
              {TIPO_BADGE_LABEL[e.tipo_evento] || e.tipo_evento}
            </Badge>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[10px] text-muted-foreground">{e.ruta}</span>
              {e.datos && Object.keys(e.datos).length > 0 && (
                <pre className="text-[10px] mt-0.5 whitespace-pre-wrap break-words text-foreground/80">
                  {JSON.stringify(e.datos).slice(0, 400)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}