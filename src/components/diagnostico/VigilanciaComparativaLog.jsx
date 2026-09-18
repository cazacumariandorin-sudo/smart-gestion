// Línea temporal intercalada de eventos de 2 o 3 vigilancias (A / B / C)
// con generación/copia/descarga de log comparativo en texto plano para
// análisis de fallos, bugs o comportamientos indebidos.
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

const ETIQ_VARIANT = { A: 'default', B: 'secondary', C: 'outline' };

function fmtHora(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-ES', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch { return ts; }
}

export default function VigilanciaComparativaLog({ usuarios, vig_a, vig_b, vig_c, resumen_a, resumen_b, resumen_c, eventos_a, eventos_b, eventos_c }) {
  const lista = Array.isArray(usuarios) && usuarios.length > 0
    ? usuarios
    : [
        { etiqueta: 'A', vig: vig_a, resumen: resumen_a, eventos: eventos_a },
        { etiqueta: 'B', vig: vig_b, resumen: resumen_b, eventos: eventos_b },
        { etiqueta: 'C', vig: vig_c, resumen: resumen_c, eventos: eventos_c },
      ].filter(u => u.vig);

  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroUsuario, setFiltroUsuario] = useState('todos');
  const [copiado, setCopiado] = useState(false);

  const marcados = useMemo(() =>
    lista.flatMap(u => (u.eventos || []).map(e => ({ ...e, _u: u.etiqueta })))
      .sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp)),
    [lista]);

  const tiposDisponibles = useMemo(() => {
    const s = new Set(marcados.map(e => e.tipo_evento));
    return ['todos', ...Array.from(s)];
  }, [marcados]);

  const etiquetas = lista.map(u => u.etiqueta);

  const filtrados = marcados.filter(e =>
    (filtroTipo === 'todos' || e.tipo_evento === filtroTipo) &&
    (filtroUsuario === 'todos' || e._u === filtroUsuario)
  );

  const handleCopiar = async () => {
    const texto = generarTextoLogComparativa({ usuarios: lista });
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
    const texto = generarTextoLogComparativa({ usuarios: lista });
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nombres = lista.map(u => (u.vig?.user_email || u.etiqueta.toLowerCase()).split('@')[0]).join('_vs_');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `comparativa_${nombres}_${fecha}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Log comparativo descargado');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="text-xs font-medium mr-1">Log comparativo ({lista.length} usuarios)</div>
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
        <Button size="sm" variant={filtroUsuario === 'todos' ? 'default' : 'outline'} className="h-7 px-2 text-[11px]"
          onClick={() => setFiltroUsuario('todos')}>
          {etiquetas.join('+')}
        </Button>
        {etiquetas.map(u => (
          <Button key={u} size="sm" variant={filtroUsuario === u ? 'default' : 'outline'} className="h-7 px-2 text-[11px]"
            onClick={() => setFiltroUsuario(u)}>
            {u}
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
            <Badge variant={ETIQ_VARIANT[e._u] || 'secondary'} className="text-[9px] h-4 px-1 shrink-0 w-5 justify-center">
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