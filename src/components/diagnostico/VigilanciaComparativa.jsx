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

const ETIQUETAS = ['A', 'B', 'C'];

export default function VigilanciaComparativa({ vigAId, vigBId, vigCId, onBack, onSelectA, onSelectB, onSelectC, activas }) {
  const ids = [vigAId, vigBId, vigCId].filter(Boolean);
  const idsUnicos = [...new Set(ids)];
  const puedeComparar = idsUnicos.length >= 2;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['vig-comparar', idsUnicos.join('|')],
    queryFn: () => LLAMAR('comparar', { vigilancia_ids: idsUnicos }),
    enabled: !!puedeComparar,
    refetchInterval: 20_000
  });

  const usuarios = data?.usuarios || [];
  // Construir mapas para columnas
  const ev = (et) => data?.[`eventos_${et.toLowerCase()}`] || usuarios.find(u => u.etiqueta === et)?.eventos || [];
  const rs = (et) => data?.[`resumen_${et.toLowerCase()}`] || usuarios.find(u => u.etiqueta === et)?.resumen || {};
  const vg = (et) => data?.[`vig_${et.toLowerCase()}`] || usuarios.find(u => u.etiqueta === et)?.vig || null;

  const evA = ev('A'), evB = ev('B'), evC = ev('C');
  const resA = rs('A'), resB = rs('B'), resC = rs('C');
  const vigA = vg('A'), vigB = vg('B'), vigC = vg('C');

  const listaUsuarios = useMemo(() => {
    const arr = [];
    if (vigA) arr.push({ etiqueta: 'A', vig: vigA, resumen: resA, eventos: evA });
    if (vigB) arr.push({ etiqueta: 'B', vig: vigB, resumen: resB, eventos: evB });
    if (vigC) arr.push({ etiqueta: 'C', vig: vigC, resumen: resC, eventos: evC });
    return arr;
  }, [vigA, vigB, vigC, resA, resB, resC, evA, evB, evC]);

  // Rutas en común donde uno u otro fallan
  const comparativaRutas = useMemo(() => {
    if (!puedeComparar) return [];
    const conjuntos = listaUsuarios.map(u => new Set(
      (u.eventos || []).filter(e => e.tipo_evento === 'error' || e.tipo_evento === 'promise_rejection').map(e => e.ruta)
    ));
    const todas = new Set(conjuntos.flatMap(s => [...s]));
    return Array.from(todas).map(ruta => {
      const row = { ruta };
      listaUsuarios.forEach((u, i) => { row[`falla_${u.etiqueta}`] = conjuntos[i].has(ruta); });
      return row;
    }).filter(r => r.ruta);
  }, [listaUsuarios, puedeComparar]);

  const rolesDistintos = data?.roles_distintos;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver</Button>
        <div className="text-sm font-semibold flex items-center gap-1.5">
          <GitCompare className="w-4 h-4" /> Comparativa de usuarios (hasta 3, cualquier rol)
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <SelectorVig label="Usuario A" value={vigAId} onChange={onSelectA} activas={activas} />
        <SelectorVig label="Usuario B" value={vigBId} onChange={onSelectB} activas={activas} excludeId={vigAId} />
        <SelectorVig label="Usuario C (opcional)" value={vigCId} onChange={onSelectC} activas={activas} excludeIds={[vigAId, vigBId]} />
      </div>

      {!puedeComparar && (
        <div className="text-xs text-muted-foreground text-center py-4">Selecciona al menos 2 vigilancias (distinto usuario) para comparar. Pueden tener el mismo o distinto rol.</div>
      )}

      {isError && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error?.message || 'No se pudo comparar'}
        </div>
      )}

      {puedeComparar && listaUsuarios.length >= 2 && (
        <>
          {rolesDistintos && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Los usuarios tienen roles distintos ({listaUsuarios.map(u => u.vig.user_role_snapshot || '?').join(' vs ')}); la comparativa es orientativa.
            </div>
          )}

          <Card>
            <CardContent className="p-3">
              <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: `1fr repeat(${listaUsuarios.length}, minmax(0,1fr))` }}>
                <div className="font-medium text-[10px] text-muted-foreground">Métrica</div>
                {listaUsuarios.map(u => (
                  <div key={u.etiqueta} className="font-medium text-[10px] text-muted-foreground truncate">
                    {u.vig.user_full_name || u.vig.user_email}
                  </div>
                ))}

                <FilaComparativa label="Eventos total" valores={listaUsuarios.map(u => u.resumen.total)} />
                <FilaComparativa label="Errores JS" valores={listaUsuarios.map(u => u.resumen.errores)} mayorEsPeor />
                <FilaComparativa label="Promise rejections" valores={listaUsuarios.map(u => u.resumen.promise_rejections)} mayorEsPeor />
                <FilaComparativa label="Cambios de red" valores={listaUsuarios.map(u => u.resumen.cambios_red)} mayorEsPeor />
                <FilaComparativa label="Rutas únicas" valores={listaUsuarios.map(u => u.resumen.rutas_unicas)} />
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
                {listaUsuarios.map(u => (
                  <Badge key={u.etiqueta} variant={r[`falla_${u.etiqueta}`] ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1">
                    {u.etiqueta}: {r[`falla_${u.etiqueta}`] ? '✗' : '✓'}
                  </Badge>
                ))}
              </div>
            ))}
          </div>

          <VigilanciaComparativaLog usuarios={listaUsuarios} />
        </>
      )}
    </div>
  );
}

function SelectorVig({ label, value, onChange, activas, excludeId, excludeIds = [] }) {
  const excluidos = new Set([excludeId, ...excludeIds].filter(Boolean));
  const opts = activas.filter(v => !excluidos.has(v.id));
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

function FilaComparativa({ label, valores = [], mayorEsPeor = false }) {
  const max = Math.max(...valores.map(v => v || 0));
  const min = Math.min(...valores.map(v => v || 0));
  // Ganador: el "mejor" según mayorEsPeor. Solo destacamos si hay diferencia real.
  const mejor = mayorEsPeor
    ? (min < max ? valores.indexOf(min) : -1)
    : (max > min ? valores.indexOf(max) : -1);
  return (
    <>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      {valores.map((v, i) => (
        <div key={i} className={`text-sm font-mono ${i === mejor ? 'text-emerald-700' : ''}`}>{v ?? 0}</div>
      ))}
    </>
  );
}