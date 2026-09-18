import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, GitCompare, AlertTriangle } from 'lucide-react';
import VigilanciaComparativaLog from '@/components/diagnostico/VigilanciaComparativaLog';

const LLAMAR = (action, payload = {}) =>
  base44.functions.invoke('gestionVigilanciaDiagnostico', { action, ...payload }).then(r => r?.data || r);

export default function VigilanciaComparativa({ vigAId, vigBId, onBack, onSelectA, onSelectB, activas }) {
  const puedeComparar = vigAId && vigBId && vigAId !== vigBId;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['vig-comparar', vigAId, vigBId],
    queryFn: () => LLAMAR('comparar', { vigilancia_a_id: vigAId, vigilancia_b_id: vigBId }),
    enabled: !!puedeComparar,
    refetchInterval: 20_000
  });

  const evA = data?.eventos_a || [];
  const evB = data?.eventos_b || [];
  const resA = data?.resumen_a || {};
  const resB = data?.resumen_b || {};

  // Rutas en común donde uno u otro fallan
  const comparativaRutas = useMemo(() => {
    if (!puedeComparar) return [];
    const erroresA = new Set(evA.filter(e => e.tipo_evento === 'error' || e.tipo_evento === 'promise_rejection').map(e => e.ruta));
    const erroresB = new Set(evB.filter(e => e.tipo_evento === 'error' || e.tipo_evento === 'promise_rejection').map(e => e.ruta));
    const todas = new Set([...erroresA, ...erroresB]);
    return Array.from(todas).map(ruta => ({
      ruta,
      falla_a: erroresA.has(ruta),
      falla_b: erroresB.has(ruta)
    })).filter(r => r.ruta);
  }, [evA, evB, puedeComparar]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver</Button>
        <div className="text-sm font-semibold flex items-center gap-1.5">
          <GitCompare className="w-4 h-4" /> Comparativa de usuarios (mismo rol)
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SelectorVig label="Usuario A" value={vigAId} onChange={onSelectA} activas={activas} />
        <SelectorVig label="Usuario B" value={vigBId} onChange={onSelectB} activas={activas} excludeId={vigAId} />
      </div>

      {!puedeComparar && (
        <div className="text-xs text-muted-foreground text-center py-4">Selecciona dos vigilancias activas (distinto usuario, mismo rol) para comparar.</div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error?.message || 'No se pudo comparar'}
        </div>
      )}

      {puedeComparar && data?.vig_a && data?.vig_b && (
        <>
          {data.vig_a.user_role_snapshot !== data.vig_b.user_role_snapshot && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Los usuarios tienen roles distintos ({data.vig_a.user_role_snapshot} vs {data.vig_b.user_role_snapshot}); la comparativa puede no ser significativa.
            </div>
          )}

          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="font-medium text-[10px] text-muted-foreground">Métrica</div>
                <div className="font-medium text-[10px] text-muted-foreground truncate">
                  {data.vig_a.user_full_name || data.vig_a.user_email}
                </div>
                <div className="font-medium text-[10px] text-muted-foreground truncate">
                  {data.vig_b.user_full_name || data.vig_b.user_email}
                </div>

                <FilaComparativa label="Eventos total" a={resA.total} b={resB.total} />
                <FilaComparativa label="Errores JS" a={resA.errores} b={resB.errores} mayorEsPeor />
                <FilaComparativa label="Promise rejections" a={resA.promise_rejections} b={resB.promise_rejections} mayorEsPeor />
                <FilaComparativa label="Cambios de red" a={resA.cambios_red} b={resB.cambios_red} mayorEsPeor />
                <FilaComparativa label="Rutas únicas" a={resA.rutas_unicas} b={resB.rutas_unicas} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-1">
            <div className="text-xs font-medium">Rutas con fallos en alguno</div>
            {comparativaRutas.length === 0 && (
              <div className="text-[11px] text-muted-foreground">Sin fallos registrados para ninguno de los usuarios.</div>
            )}
            {comparativaRutas.map(r => (
              <div key={r.ruta} className="flex items-center gap-2 text-[11px] py-1 px-2 border-b">
                <span className="font-mono flex-1 truncate">{r.ruta || '(sin ruta)'}</span>
                <Badge variant={r.falla_a ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1">A: {r.falla_a ? '✗' : '✓'}</Badge>
                <Badge variant={r.falla_b ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1">B: {r.falla_b ? '✗' : '✓'}</Badge>
              </div>
            ))}
          </div>

          <VigilanciaComparativaLog
            vig_a={data.vig_a}
            vig_b={data.vig_b}
            resumen_a={resA}
            resumen_b={resB}
            eventos_a={evA}
            eventos_b={evB}
          />
        </>
      )}
    </div>
  );
}

function SelectorVig({ label, value, onChange, activas, excludeId }) {
  const opts = activas.filter(v => v.id !== excludeId);
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <select
        className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">—</option>
        {opts.map(v => (
          <option key={v.id} value={v.id}>
            {v.user_full_name || v.user_email} ({v.user_role_snapshot || 'sin rol'})
          </option>
        ))}
      </select>
    </div>
  );
}

function FilaComparativa({ label, a = 0, b = 0, mayorEsPeor = false }) {
  const gana = mayorEsPeor ? (a < b ? 'a' : (b < a ? 'b' : null)) : (a > b ? 'a' : (b > a ? 'b' : null));
  return (
    <>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono ${gana === 'a' ? (mayorEsPeor ? 'text-emerald-700' : 'text-emerald-700') : ''}`}>{a}</div>
      <div className={`text-sm font-mono ${gana === 'b' ? (mayorEsPeor ? 'text-emerald-700' : 'text-emerald-700') : ''}`}>{b}</div>
    </>
  );
}