import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Split, Sparkles, AlertTriangle, CheckCircle2, Image as ImageIcon, SearchCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useUserRole } from '@/lib/useUserRole';

const MESES = [
  ['1', 'Enero'], ['2', 'Febrero'], ['3', 'Marzo'], ['4', 'Abril'], ['5', 'Mayo'], ['6', 'Junio'],
  ['7', 'Julio'], ['8', 'Agosto'], ['9', 'Septiembre'], ['10', 'Octubre'], ['11', 'Noviembre'], ['12', 'Diciembre'],
];

/**
 * Herramienta de Precisión "Re-OCR multi-ticket" — reconstruye un registro mal
 * creado (varios justificantes colapsados en un solo importe) re-procesando cada
 * foto con el flujo multi-ticket y creando un registro real por ticket.
 *
 * Selección por filtro (operario + año + mes), NO por ID manual: se listan los
 * candidatos reales de ese periodo — RegistroGasto con más de una foto adjunta,
 * que es el síntoma del problema — para elegir con un clic. El ID en bruto es
 * impracticable para un usuario no técnico.
 *
 * Acceso: gerencia, administración, admin. Se invoca desde el panel de Precisión
 * (Contabilidad) o desde el botón de precisión en Gestión Gastos.
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
  const [candidatos, setCandidatos] = useState(null); // null = aún no se ha buscado
  const [registroSel, setRegistroSel] = useState(null); // el elegido para reconstruir

  const [precision, setPrecision] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    base44.entities.Operario.filter({ active: true }, 'name', 200).then(setOperarios).catch(() => setOperarios([]));
  }, []);

  const rango = useMemo(() => {
    const m = String(selMes).padStart(2, '0');
    const ultimoDia = new Date(Number(selAnio), Number(selMes), 0).getDate();
    return { desde: `${selAnio}-${m}-01`, hasta: `${selAnio}-${m}-${String(ultimoDia).padStart(2, '0')}`, etiqueta: `${m}/${selAnio}` };
  }, [selAnio, selMes]);

  const buscar = async () => {
    setBuscando(true);
    setCandidatos(null);
    setRegistroSel(null);
    setResultado(null);
    try {
      const filtro = {
        fecha_documento: { $gte: rango.desde, $lte: rango.hasta },
      };
      if (operarioId !== 'todos') filtro.operario_id = operarioId;
      const regs = await base44.entities.RegistroGasto.filter(filtro, '-fecha_documento', 300);
      // Candidato a "varios tickets colapsados": más de una foto adjunta en el mismo registro.
      const conVariasFotos = (regs || []).filter(r => (r.archivos?.length || 0) > 1);
      setCandidatos(conVariasFotos);
      if (!conVariasFotos.length) toast.info('Sin candidatos con más de una foto en ese periodo');
    } catch (e) {
      toast.error(`Error buscando candidatos: ${e?.message || 'fallo'}`);
    } finally {
      setBuscando(false);
    }
  };

  const ejecutar = async () => {
    if (!registroSel) { toast.error('Elige primero un registro de la lista'); return; }
    setEjecutando(true);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('reconstruirRegistroMultiTicket', {
        registro_id: registroSel.id,
        precision,
      });
      const data = res?.data || res;
      if (data?.success === false) throw new Error(data?.error || 'Error');
      setResultado(data);
      toast.success(`${data.total_creados} registro(s) creados desde ${data.total_archivos_procesados} foto(s)`);
      // Quitar el reconstruido de la lista de candidatos (ya está resuelto)
      setCandidatos(cs => (cs || []).filter(c => c.id !== registroSel.id));
      setRegistroSel(null);
      qc.invalidateQueries({ queryKey: ['notas_gasto'] });
      qc.invalidateQueries({ queryKey: ['conciliacion-gastos'] });
      qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
    } catch (e) {
      toast.error(`Error: ${e?.message || 'fallo'}`);
    } finally {
      setEjecutando(false);
    }
  };

  if (!puede) {
    return <Card className="p-6 text-center text-muted-foreground text-sm">Solo gerencia, administración o admin pueden reconstruir registros.</Card>;
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Split className="w-4 h-4 text-primary" />
        <span className="font-medium">Re-OCR multi-ticket — reconstruir registro</span>
        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Herramienta de precisión</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Cuando un técnico subió varios justificantes como "páginas" de un único gasto y el sistema los colapsó en un solo importe, esta herramienta re-procesa CADA foto con el flujo multi-ticket y crea un registro real por ticket detectado (con su foto, su importe y su fecha reales). El registro original se anula (no se borra) como auditoría.
      </p>

      {/* Paso 1: filtrar por operario/año/mes para encontrar el registro, sin ID manual */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Año</Label>
          <Input type="number" min="2000" max="2100" value={selAnio} onChange={e => setSelAnio(e.target.value)} className="w-24" />
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
            {operarios.map(op => (
              <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
            ))}
          </MobileSelect>
        </div>
        <Button onClick={buscar} disabled={buscando} variant="outline" className="gap-2">
          {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchCheck className="w-4 h-4" />}
          {buscando ? 'Buscando…' : 'Buscar candidatos'}
        </Button>
      </div>

      {/* Paso 2: elegir de la lista encontrada */}
      {candidatos !== null && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs text-muted-foreground">
            {candidatos.length === 0
              ? `Sin registros con más de una foto en ${rango.etiqueta}.`
              : `${candidatos.length} registro(s) con varias fotos en ${rango.etiqueta} — elige cuál reconstruir:`}
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {candidatos.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setRegistroSel(c)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors ${registroSel?.id === c.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'}`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-primary shrink-0">{c.numero_nota || '—'}</span>
                  <span className="truncate font-medium">{c.nombre_comercio || '—'}</span>
                  {c.operario_name && <span className="text-muted-foreground shrink-0">· {c.operario_name}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className="text-[9px] bg-slate-100 text-slate-600">{c.archivos.length} fotos</Badge>
                  <span className="font-bold">{Number(c.importe || 0).toFixed(2)} €</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 3: confirmar y ejecutar sobre el elegido */}
      {registroSel && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
          <span className="text-xs">
            Reconstruir: <span className="font-mono font-bold text-primary">{registroSel.numero_nota}</span> ({registroSel.archivos.length} fotos, {Number(registroSel.importe || 0).toFixed(2)} €)
          </span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
            <input
              type="checkbox"
              id="precision-chk"
              checked={precision}
              onChange={e => setPrecision(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="precision-chk" className="text-xs cursor-pointer flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Alta precisión (gemini, +créditos)
            </Label>
          </div>
          <Button onClick={ejecutar} disabled={ejecutando} className="gap-2">
            {ejecutando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4" />}
            {ejecutando ? 'Reconstruyendo…' : 'Reconstruir'}
          </Button>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Coste aprox: ~1 crédito de integración por foto (automático) o ~5 créditos/foto (alta precisión). El registro original pasa a estado "rechazada" y conserva sus fotos como auditoría.
      </p>

      {resultado && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {resultado.total_creados > 0 ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-medium">{resultado.total_creados} registro(s) creado(s)</span></>
            ) : (
              <><AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="font-medium">No se creó ningún registro</span></>
            )}
            {resultado.total_omitidos > 0 && (
              <span className="text-xs text-amber-600">· {resultado.total_omitidos} foto(s) omitida(s)</span>
            )}
            <span className="text-xs text-muted-foreground">· {resultado.total_archivos_procesados} foto(s) procesada(s)</span>
          </div>
          {resultado.registros_creados?.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
              {resultado.registros_creados.map((r, i) => (
                <div key={r.id || i} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded border bg-card">
                  <div className="min-w-0">
                    <span className="font-medium truncate">{r.nombre_comercio || '—'}</span>
                    <span className="text-muted-foreground ml-1">· {r.fecha_documento}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.precisa_precision && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    <span className="font-bold">{Number(r.importe || 0).toFixed(2)} €</span>
                    <Badge className="text-[9px] bg-slate-100 text-slate-600">{r.ciclo_mes}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {resultado.errores?.length > 0 && (
            <details className="text-xs text-red-600">
              <summary className="cursor-pointer">{resultado.errores.length} error(es)</summary>
              <ul className="pl-4 list-disc">{resultado.errores.map((e, i) => <li key={i}>{e.foto}: {e.error}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
