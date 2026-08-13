import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Filter, ClipboardCopy, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { generarTextoLogVigilancia, TIPO_BADGE_LABEL } from '@/lib/vigilanciaLog';

const LLAMAR = (action, payload = {}) =>
  base44.functions.invoke('gestionVigilanciaDiagnostico', { action, ...payload }).then(r => r?.data || r);

const TIPO_BADGE = {
  nav: { label: 'Nav', variant: 'secondary' },
  click: { label: 'Click', variant: 'secondary' },
  red: { label: 'Red', variant: 'secondary' },
  auth: { label: 'Auth', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
  promise_rejection: { label: 'Promise', variant: 'destructive' },
  visibility: { label: 'Vis', variant: 'secondary' },
  render: { label: 'Render', variant: 'secondary' },
  network_request: { label: 'Fetch', variant: 'destructive' },
  custom: { label: 'Otro', variant: 'secondary' }
};

function fmtHora(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-ES', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch { return ts; }
}

export default function VigilanciaEventosView({ vigilanciaId, onBack }) {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [copiado, setCopiado] = useState(false);

  const { data: resumen, isLoading: loadingResumen } = useQuery({
    queryKey: ['vig-resumen', vigilanciaId],
    queryFn: () => LLAMAR('resumen', { vigilancia_id: vigilanciaId }),
    refetchInterval: 15_000
  });

  const { data: evData, isLoading: loadingEv } = useQuery({
    queryKey: ['vig-eventos', vigilanciaId],
    queryFn: () => LLAMAR('eventos', { vigilancia_id: vigilanciaId, limit: 300 }),
    refetchInterval: 15_000
  });

  const eventos = evData?.eventos || [];
  const tiposDisponibles = useMemo(() => {
    const s = new Set(eventos.map(e => e.tipo_evento));
    return ['todos', ...Array.from(s)];
  }, [eventos]);

  const eventosFiltrados = filtroTipo === 'todos'
    ? eventos
    : eventos.filter(e => e.tipo_evento === filtroTipo);

  const vig = resumen?.vigilancia;

  const handleCopiarLog = async () => {
    const texto = generarTextoLogVigilancia({ vig, resumen, eventos: eventosFiltrados });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success('Log copiado ✓');
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      console.error('Error copiando log al portapapeles:', e);
      toast.error('No se pudo copiar. Prueba a descargarlo en su lugar.');
    }
  };

  const handleDescargarLog = () => {
    const texto = generarTextoLogVigilancia({ vig, resumen, eventos: eventosFiltrados });
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nombreUsuario = (vig?.user_email || 'usuario').split('@')[0];
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `vigilancia_${nombreUsuario}_${fecha}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Log descargado');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver</Button>
        <div className="text-sm font-semibold">
          Eventos · {vig?.user_full_name || vig?.user_email || ''}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={handleCopiarLog}>
            {copiado ? <Check className="w-3.5 h-3.5 mr-1" /> : <ClipboardCopy className="w-3.5 h-3.5 mr-1" />}
            {copiado ? 'Copiado' : 'Generar log'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={handleDescargarLog}>
            <Download className="w-3.5 h-3.5 mr-1" /> .txt
          </Button>
        </div>
      </div>

      {vig && (
        <Card>
          <CardContent className="p-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Usuario" value={vig.user_email} />
              <Stat label="Rol" value={vig.user_role_snapshot || '—'} />
              <Stat label="Iniciada" value={fmtCorta(vig.fecha_inicio)} />
              <Stat label="Fin prevista" value={fmtCorta(vig.fecha_fin_prevista)} />
              <Stat label="Estado" value={vig.estado} />
              <Stat label="Eventos" value={resumen?.total_eventos || 0} />
              <Stat label="Motivo" value={vig.motivo || '—'} />
              <Stat label="Iniciada por" value={vig.iniciado_por} />
            </div>
            {(resumen?.rutas_top?.length > 0) && (
              <div className="mt-2 pt-2 border-t">
                <div className="text-[10px] text-muted-foreground mb-1">Rutas más visitadas</div>
                <div className="flex flex-wrap gap-1">
                  {resumen.rutas_top.map(rt => (
                    <Badge key={rt.ruta} variant="outline" className="text-[10px]">{rt.ruta} ({rt.count})</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
        {tiposDisponibles.map(t => (
          <Button key={t} size="sm" variant={filtroTipo === t ? 'default' : 'outline'} className="h-7 px-2 text-[11px]"
            onClick={() => setFiltroTipo(t)}>
            {t === 'todos' ? 'Todos' : (TIPO_BADGE[t]?.label || t)}
          </Button>
        ))}
      </div>

      <div className="border rounded-md max-h-[55vh] overflow-y-auto">
        {loadingEv && <div className="p-4 text-xs text-muted-foreground">Cargando eventos…</div>}
        {!loadingEv && eventosFiltrados.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground text-center">Sin eventos registrados todavía.</div>
        )}
        {eventosFiltrados.map((e, i) => (
          <div key={e.id || i} className="flex items-start gap-2 px-2 py-1.5 border-b text-[11px] hover:bg-muted/40">
            <span className="text-[9px] text-muted-foreground font-mono w-20 shrink-0">{fmtHora(e.timestamp)}</span>
            <Badge variant={TIPO_BADGE[e.tipo_evento]?.variant || 'secondary'} className="text-[9px] h-4 px-1 shrink-0">
              {TIPO_BADGE[e.tipo_evento]?.label || e.tipo_evento}
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

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xs font-medium truncate">{value}</div>
    </div>
  );
}

function fmtCorta(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}