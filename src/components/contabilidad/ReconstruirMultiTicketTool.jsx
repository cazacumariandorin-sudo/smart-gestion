import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Split, Sparkles, AlertTriangle, CheckCircle2, Image as ImageIcon, SearchCheck, Undo2, FileStack, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useUserRole } from '@/lib/useUserRole';

const MESES = [
  ['1', 'Enero'], ['2', 'Febrero'], ['3', 'Marzo'], ['4', 'Abril'], ['5', 'Mayo'], ['6', 'Junio'],
  ['7', 'Julio'], ['8', 'Agosto'], ['9', 'Septiembre'], ['10', 'Octubre'], ['11', 'Noviembre'], ['12', 'Diciembre'],
];

const MODOS = [
  ['auto', 'Detectar automáticamente', 'Une las fotos que son páginas del mismo documento y separa los tickets distintos.'],
  ['un_documento', 'Todas son un SOLO documento', 'Todas las fotos son páginas de una misma factura/albarán → 1 registro con todas las fotos.'],
  ['separar', 'Cada foto es un ticket distinto', 'Un registro por foto (solo si de verdad son tickets sueltos: parkings, peajes…).'],
];

const FOTOS_POR_LLAMADA = 4;

// Mensaje real del servidor (no el genérico "Request failed with status code 500")
const msgError = (e) => e?.response?.data?.error || e?.message || 'fallo';

/**
 * Re-OCR multi-ticket — reconstruir un registro con varias fotos.
 *
 * Flujo SEGURO en 3 pasos (antes se creaba un registro por foto y se anulaba el original sin avisar):
 *   1) Analizar: lee las fotos y propone un PLAN (no cambia nada).
 *   2) Revisar el plan: qué fotos son páginas de un mismo documento y cuáles son tickets distintos.
 *      Se puede cambiar el modo sin volver a leer las fotos (sin gastar créditos).
 *   3) Aplicar: crea los registros del plan y anula el original (conserva su estado para poder deshacer).
 * Además permite DESHACER reconstrucciones anteriores mal hechas.
 */
export default function ReconstruirMultiTicketTool() {
  const { isGerencia, isAdministracion, isAdmin } = useUserRole();
  const puede = isGerencia || isAdministracion || isAdmin;
  const qc = useQueryClient();

  const [selAnio, setSelAnio] = useState(() => String(new Date().getFullYear()));
  const [selMes, setSelMes] = useState(() => String(new Date().getMonth() + 1));
  const [operarioId, setOperarioId] = useState('todos');
  const [operarios, setOperarios] = useState([]);

  const [buscando, setBuscando] = useState(false);
  const [candidatos, setCandidatos] = useState(null);
  const [registroSel, setRegistroSel] = useState(null);

  const [modo, setModo] = useState('auto');
  const [precision, setPrecision] = useState(false);
  const [fase, setFase] = useState('inicio'); // inicio | leyendo | plan | aplicando
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });
  const [fotosOcr, setFotosOcr] = useState([]);
  const [plan, setPlan] = useState(null); // { grupos, omitidas }
  const [resultado, setResultado] = useState(null);

  const [anulados, setAnulados] = useState(null);
  const [deshaciendo, setDeshaciendo] = useState('');

  useEffect(() => {
    base44.entities.Operario.filter({ active: true }, 'name', 200).then(setOperarios).catch(() => setOperarios([]));
  }, []);

  const rango = useMemo(() => {
    const m = String(selMes).padStart(2, '0');
    const ultimoDia = new Date(Number(selAnio), Number(selMes), 0).getDate();
    return { desde: `${selAnio}-${m}-01`, hasta: `${selAnio}-${m}-${String(ultimoDia).padStart(2, '0')}`, etiqueta: `${m}/${selAnio}` };
  }, [selAnio, selMes]);

  const fotosDe = (reg) => (reg?.archivos || []).filter((a) => a?.url);

  const reiniciar = () => { setFase('inicio'); setPlan(null); setFotosOcr([]); setResultado(null); };

  const buscar = async () => {
    setBuscando(true); setCandidatos(null); setRegistroSel(null); reiniciar();
    try {
      const filtro = { fecha_documento: { $gte: rango.desde, $lte: rango.hasta } };
      if (operarioId !== 'todos') filtro.operario_id = operarioId;
      const regs = await base44.entities.RegistroGasto.filter(filtro, '-fecha_documento', 300);
      // Más de una foto puede ser un documento de varias PÁGINAS o varios tickets: se decide en el plan.
      const conVariasFotos = (regs || []).filter((r) => r.estado !== 'rechazada' && fotosDe(r).length > 1);
      setCandidatos(conVariasFotos);
      if (!conVariasFotos.length) toast.info('Sin candidatos con más de una foto en ese periodo');
    } catch (e) {
      toast.error(`Error buscando candidatos: ${msgError(e)}`);
    } finally {
      setBuscando(false);
    }
  };

  const planificar = async (fotos, modoElegido) => {
    const res = await base44.functions.invoke('reconstruirRegistroMultiTicket', { operacion: 'planificar', fotos, modo: modoElegido });
    const data = res?.data || res;
    if (data?.success === false) throw new Error(data?.error || 'Error');
    setPlan({ grupos: data.grupos || [], omitidas: data.omitidas || [] });
    setFase('plan');
  };

  const analizar = async () => {
    if (!registroSel) { toast.error('Elige primero un registro de la lista'); return; }
    const total = fotosDe(registroSel).length;
    setFase('leyendo'); setPlan(null); setResultado(null); setProgreso({ hecho: 0, total });
    try {
      const acumulado = [];
      for (let i = 0; i < total; i += FOTOS_POR_LLAMADA) {
        const indices = Array.from({ length: Math.min(FOTOS_POR_LLAMADA, total - i) }, (_, k) => i + k);
        try {
          const res = await base44.functions.invoke('reconstruirRegistroMultiTicket', {
            operacion: 'ocr', registro_id: registroSel.id, indices, precision,
          });
          const data = res?.data || res;
          if (data?.success === false) throw new Error(data?.error || 'Error');
          acumulado.push(...(data.fotos || []));
        } catch (e) {
          indices.forEach((idx) => acumulado.push({ idx, url: fotosDe(registroSel)[idx]?.url, error: msgError(e) }));
        }
        setProgreso({ hecho: Math.min(i + FOTOS_POR_LLAMADA, total), total });
      }
      setFotosOcr(acumulado);
      await planificar(acumulado, modo);
    } catch (e) {
      toast.error(`Error al analizar: ${msgError(e)}`, { duration: 9000 });
      setFase('inicio');
    }
  };

  const cambiarModo = async (nuevo) => {
    setModo(nuevo);
    if (fase === 'plan' && fotosOcr.length) {
      try { await planificar(fotosOcr, nuevo); } catch (e) { toast.error(`Error: ${msgError(e)}`); }
    }
  };

  const aplicar = async () => {
    if (!plan?.grupos?.length) return;
    const ok = window.confirm(
      `Se crearán ${plan.grupos.length} registro(s) y el registro ${registroSel.numero_nota || ''} pasará a «rechazada» (se puede deshacer). ¿Continuar?`
    );
    if (!ok) return;
    setFase('aplicando');
    try {
      const res = await base44.functions.invoke('reconstruirRegistroMultiTicket', {
        operacion: 'ejecutar', registro_id: registroSel.id, grupos: plan.grupos, precision,
      });
      const data = res?.data || res;
      if (data?.success === false) throw new Error(data?.error || 'Error');
      setResultado(data);
      toast.success(`${data.total_creados} registro(s) creado(s) desde ${data.total_archivos_procesados} foto(s)`);
      setCandidatos((cs) => (cs || []).filter((c) => c.id !== registroSel.id));
      setRegistroSel(null); setPlan(null); setFotosOcr([]); setFase('inicio');
      qc.invalidateQueries({ predicate: (q) => /gasto|notas|conciliacion|fotos/i.test(String(q.queryKey?.[0] ?? '')) });
    } catch (e) {
      toast.error(`No se aplicó nada: ${msgError(e)}`, { duration: 9000 });
      setFase('plan');
    }
  };

  const buscarAnulados = async () => {
    try {
      const filtro = { fecha_documento: { $gte: rango.desde, $lte: rango.hasta }, estado: 'rechazada' };
      if (operarioId !== 'todos') filtro.operario_id = operarioId;
      const regs = await base44.entities.RegistroGasto.filter(filtro, '-fecha_documento', 300);
      setAnulados((regs || []).filter((r) => String(r.notas_admin || '').includes('reconstrucción multi-ticket')));
    } catch (e) {
      toast.error(`Error buscando: ${msgError(e)}`);
    }
  };

  const deshacer = async (reg) => {
    setDeshaciendo(reg.id);
    try {
      const sim = (await base44.functions.invoke('deshacerReconstruccionMultiTicket', { registro_original_id: reg.id, operacion: 'simular' }))?.data;
      if (sim?.bloqueados?.length) {
        toast.error(`${sim.bloqueados.length} registro(s) creado(s) ya están aprobados o pagados: hay que revisarlos a mano.`, { duration: 9000 });
        return;
      }
      const total = (sim?.hijos || []).reduce((s, h) => s + Number(h.importe || 0), 0);
      const ok = window.confirm(
        `Se anularán ${sim?.hijos?.length || 0} registro(s) creados (${total.toFixed(2)} €) y ${sim?.original?.numero_nota || reg.numero_nota} volverá a «${sim?.estado_restaurar}». ¿Continuar?`
      );
      if (!ok) return;
      await base44.functions.invoke('deshacerReconstruccionMultiTicket', { registro_original_id: reg.id, operacion: 'ejecutar' });
      toast.success('Reconstrucción deshecha. Ya puedes volver a reconstruirlo en el modo correcto.');
      setAnulados((a) => (a || []).filter((x) => x.id !== reg.id));
      qc.invalidateQueries({ predicate: (q) => /gasto|notas|conciliacion|fotos/i.test(String(q.queryKey?.[0] ?? '')) });
    } catch (e) {
      toast.error(`No se pudo deshacer: ${msgError(e)}`, { duration: 9000 });
    } finally {
      setDeshaciendo('');
    }
  };

  if (!puede) {
    return <Card className="p-6 text-center text-muted-foreground text-sm">Solo gerencia, administración o admin pueden reconstruir registros.</Card>;
  }

  const fotosSel = fotosDe(registroSel);
  const ocupado = fase === 'leyendo' || fase === 'aplicando';

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Split className="w-4 h-4 text-primary" />
        <span className="font-medium">Re-OCR multi-ticket — reconstruir registro</span>
        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Herramienta de precisión</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Para un registro con varias fotos que se creó mal. Primero se <b>analiza y se muestra un plan</b> (no cambia nada); tú decides si las fotos son
        <b> páginas de un mismo documento</b> (1 registro) o <b>tickets distintos</b> (1 registro por ticket). El registro original se anula, no se borra, y se puede deshacer.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Año</Label>
          <Input type="number" min="2000" max="2100" value={selAnio} onChange={(e) => setSelAnio(e.target.value)} className="w-24" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mes</Label>
          <MobileSelect value={selMes} onValueChange={setSelMes} placeholder="Mes" triggerClassName="w-36">
            {MESES.map(([v, l]) => <MobileSelectItem key={v} value={v}>{l}</MobileSelectItem>)}
          </MobileSelect>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Técnico</Label>
          <MobileSelect value={operarioId} onValueChange={setOperarioId} placeholder="Todos" triggerClassName="w-48">
            <MobileSelectItem value="todos">Todos los técnicos</MobileSelectItem>
            {operarios.map((op) => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
          </MobileSelect>
        </div>
        <Button onClick={buscar} disabled={buscando || ocupado} variant="outline" className="gap-2">
          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCheck className="w-4 h-4" />}
          {buscando ? 'Buscando…' : 'Buscar candidatos'}
        </Button>
      </div>

      {candidatos !== null && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs text-muted-foreground">
            {candidatos.length === 0
              ? `Sin registros con más de una foto en ${rango.etiqueta}.`
              : `${candidatos.length} registro(s) con varias fotos en ${rango.etiqueta} — elige cuál analizar:`}
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {candidatos.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={ocupado}
                onClick={() => { setRegistroSel(c); reiniciar(); }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors ${registroSel?.id === c.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'}`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-primary shrink-0">{c.numero_nota || '—'}</span>
                  <span className="truncate font-medium">{c.nombre_comercio || '—'}</span>
                  {c.operario_name && <span className="text-muted-foreground shrink-0">· {c.operario_name}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="text-[9px] bg-slate-100 text-slate-600">{fotosDe(c).length} fotos</Badge>
                  <span className="font-bold">{Number(c.importe || 0).toFixed(2)} €</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {registroSel && (
        <div className="space-y-3 pt-2 border-t">
          <div className="text-xs">
            Registro: <span className="font-mono font-bold text-primary">{registroSel.numero_nota}</span> · {fotosSel.length} fotos · {Number(registroSel.importe || 0).toFixed(2)} €
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {fotosSel.map((a, i) => (
              <div key={i} className="relative shrink-0">
                <img src={a.url} alt={`Foto ${i + 1}`} className="w-14 h-14 object-cover rounded border" />
                <span className="absolute bottom-0 right-0 text-[9px] bg-black/60 text-white px-1 rounded-tl">{i + 1}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">¿Qué son estas fotos?</Label>
            <div className="grid sm:grid-cols-3 gap-1.5">
              {MODOS.map(([v, titulo, ayuda]) => (
                <button
                  key={v}
                  type="button"
                  disabled={ocupado}
                  onClick={() => cambiarModo(v)}
                  className={`text-left rounded-lg border px-2.5 py-2 text-xs transition-colors ${modo === v ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'}`}
                >
                  <span className="font-medium block">{titulo}</span>
                  <span className="text-[10px] text-muted-foreground">{ayuda}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
              <input type="checkbox" id="precision-chk" checked={precision} onChange={(e) => setPrecision(e.target.checked)} className="w-4 h-4" disabled={ocupado} />
              <Label htmlFor="precision-chk" className="text-xs cursor-pointer flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Alta precisión (gemini, +créditos)
              </Label>
            </div>
            <Button onClick={analizar} disabled={ocupado} variant={plan ? 'outline' : 'default'} className="gap-2">
              {fase === 'leyendo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCheck className="w-4 h-4" />}
              {fase === 'leyendo' ? `Leyendo fotos ${progreso.hecho}/${progreso.total}…` : plan ? 'Volver a leer las fotos' : 'Analizar (no cambia nada)'}
            </Button>
          </div>
        </div>
      )}

      {plan && registroSel && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm font-medium">Plan propuesto: {plan.grupos.length} registro(s) a crear</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {plan.grupos.map((g, i) => (
              <div key={i} className="rounded-lg border p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    {g.tipo === 'documento' ? <FileStack className="w-3.5 h-3.5 text-primary" /> : <Receipt className="w-3.5 h-3.5 text-primary" />}
                    {g.tipo === 'documento' ? `Documento de ${g.fotos.length} página(s)` : 'Ticket'}
                    {g.precisa_precision && <Badge className="text-[9px] bg-amber-100 text-amber-700">revisar</Badge>}
                  </div>
                  <span className="font-bold">{g.registro.importe != null ? `${Number(g.registro.importe).toFixed(2)} €` : 'sin importe'}</span>
                </div>
                <div className="flex gap-1">
                  {g.fotos.map((idx) => (
                    <img key={idx} src={fotosSel[idx]?.url} alt={`Foto ${idx + 1}`} className="w-10 h-10 object-cover rounded border" />
                  ))}
                </div>
                <p className="text-muted-foreground">
                  {[g.registro.nombre_comercio, g.registro.fecha_documento, g.registro.numero_factura && `nº ${g.registro.numero_factura}`].filter(Boolean).join(' · ') || 'Sin datos legibles'}
                </p>
                {g.motivos?.length > 0 && <p className="text-[10px] text-muted-foreground">{g.motivos.join(' · ')}</p>}
                {g.avisos?.map((a, k) => (
                  <p key={k} className="text-[11px] text-amber-700 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{a}</p>
                ))}
              </div>
            ))}
          </div>
          {plan.omitidas.length > 0 && (
            <p className="text-[11px] text-amber-700">
              Fotos no incluidas: {plan.omitidas.map((o) => `foto ${o.idx + 1} (${o.motivo})`).join('; ')}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={aplicar} disabled={fase === 'aplicando' || !plan.grupos.length} className="gap-2">
              {fase === 'aplicando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4" />}
              {fase === 'aplicando' ? 'Aplicando…' : `Aplicar plan (${plan.grupos.length} registro${plan.grupos.length === 1 ? '' : 's'})`}
            </Button>
            <span className="text-[10px] text-muted-foreground">Si algo falla durante la creación, se revierte y el original no se toca.</span>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Coste aprox: ~1 crédito de integración por foto (automático) o ~5 créditos/foto (alta precisión). Cambiar el modo del plan NO vuelve a gastar créditos.
      </p>

      {resultado && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{resultado.total_creados} registro(s) creado(s)</span>
            <span className="text-xs text-muted-foreground">· {resultado.total_archivos_procesados} foto(s) en el original</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
            {resultado.registros_creados?.map((r, i) => (
              <div key={r.id || i} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded border bg-card">
                <div className="min-w-0">
                  <span className="font-medium truncate">{r.nombre_comercio || '—'}</span>
                  <span className="text-muted-foreground ml-1">· {r.fecha_documento}{r.paginas > 1 ? ` · ${r.paginas} págs.` : ''}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.precisa_precision && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                  <span className="font-bold">{Number(r.importe || 0).toFixed(2)} €</span>
                  <Badge className="text-[9px] bg-slate-100 text-slate-600">{r.ciclo_mes}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deshacer reconstrucciones anteriores */}
      <div className="space-y-1.5 pt-3 border-t">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium flex items-center gap-1.5"><Undo2 className="w-3.5 h-3.5" /> Reconstrucciones anteriores ({rango.etiqueta})</span>
          <Button size="sm" variant="outline" onClick={buscarAnulados} className="h-7 text-xs">Buscar anuladas</Button>
        </div>
        {anulados !== null && (
          anulados.length === 0
            ? <p className="text-xs text-muted-foreground">No hay registros anulados por reconstrucción en este periodo.</p>
            : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {anulados.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs">
                    <div className="min-w-0">
                      <span className="font-mono text-primary">{r.numero_nota || '—'}</span>
                      <span className="ml-2 truncate">{r.nombre_comercio || '—'}</span>
                      {r.operario_name && <span className="text-muted-foreground"> · {r.operario_name}</span>}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" disabled={deshaciendo === r.id} onClick={() => deshacer(r)}>
                      {deshaciendo === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Deshacer
                    </Button>
                  </div>
                ))}
              </div>
            )
        )}
        <p className="text-[10px] text-muted-foreground">
          «Deshacer» anula los registros que creó la reconstrucción y devuelve el original a su estado anterior. Si alguno ya está aprobado o pagado, no se toca nada.
        </p>
      </div>
    </Card>
  );
}
