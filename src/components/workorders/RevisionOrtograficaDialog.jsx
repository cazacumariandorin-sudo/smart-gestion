import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, SpellCheck, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { revisarParte, extraerTextos } from '@/lib/ortografiaPartes';
import { fechaES } from '@/lib/fechaES';

const CONCURRENCIA = 3;

/**
 * Revisión ortográfica de partes YA registrados.
 * 1) Analiza los partes recibidos (en lotes de 3) → 2) muestra las correcciones propuestas
 * (antes/después, con casilla por parte) → 3) aplica solo las marcadas.
 * Las correcciones pasan por `cambioSeguro` (no tocan cifras ni reescriben).
 */
export default function RevisionOrtograficaDialog({ open, onOpenChange, orders = [] }) {
  const queryClient = useQueryClient();
  const [fase, setFase] = useState('inicio'); // inicio | analizando | revision | aplicando | fin
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });
  const [propuestas, setPropuestas] = useState([]); // [{ order, cambios, patch }]
  const [limpios, setLimpios] = useState([]);        // partes revisados sin cambios
  const [sinRevisar, setSinRevisar] = useState(0);   // la IA no respondió (timeout/error)
  const [marcados, setMarcados] = useState({});
  const [incluirRevisados, setIncluirRevisados] = useState(false);
  const [resultado, setResultado] = useState(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (open) {
      cancelRef.current = false;
      setFase('inicio'); setPropuestas([]); setLimpios([]); setMarcados({}); setResultado(null); setSinRevisar(0);
    } else {
      cancelRef.current = true;
    }
  }, [open]);

  const candidatos = orders.filter(o =>
    Object.keys(extraerTextos(o)).length > 0 && (incluirRevisados || !o.ortografia_revisada_en)
  );

  const analizar = async () => {
    cancelRef.current = false;
    setFase('analizando');
    setProgreso({ hecho: 0, total: candidatos.length });
    const props = []; const clean = []; let fallidos = 0; let i = 0; let hecho = 0;

    const worker = async () => {
      while (!cancelRef.current) {
        const idx = i++;
        if (idx >= candidatos.length) return;
        const order = candidatos[idx];
        const r = await revisarParte(order, { timeoutMs: 25000 });
        if (!r.ok) fallidos++;
        else if (r.cambios.length) props.push({ order, cambios: r.cambios, patch: r.patch });
        else clean.push(order);
        hecho++;
        setProgreso({ hecho, total: candidatos.length });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCIA }, worker));
    if (cancelRef.current) return;

    props.sort((a, b) => (b.order.date || '').localeCompare(a.order.date || ''));
    setPropuestas(props);
    setLimpios(clean);
    setSinRevisar(fallidos);
    setMarcados(Object.fromEntries(props.map(p => [p.order.id, true])));
    setFase('revision');
  };

  const actualizar = async (id, data) => {
    const ahora = new Date().toISOString();
    try {
      return await base44.entities.WorkOrder.update(id, { ...data, ortografia_revisada_en: ahora });
    } catch (err) {
      // El campo de control puede no estar desplegado aún: reintenta solo con las correcciones
      if (Object.keys(data).length === 0) throw err;
      return await base44.entities.WorkOrder.update(id, data);
    }
  };

  const aplicar = async () => {
    const elegidas = propuestas.filter(p => marcados[p.order.id]);
    setFase('aplicando');
    let ok = 0; let fallos = 0;
    for (const p of elegidas) {
      try { await actualizar(p.order.id, p.patch); ok++; } catch (e) { console.error('[Ortografía] update', p.order.id, e); fallos++; }
    }
    // Marca como revisados los partes sin cambios (evita volver a analizarlos); se ignora si falla
    for (const o of limpios) {
      try { await base44.entities.WorkOrder.update(o.id, { ortografia_revisada_en: new Date().toISOString() }); } catch { break; }
    }
    queryClient.invalidateQueries({ queryKey: ['workorders'] });
    elegidas.forEach(p => queryClient.invalidateQueries({ queryKey: ['workorder', p.order.id] }));
    setResultado({ ok, fallos });
    setFase('fin');
    if (fallos) toast.error(`${fallos} parte(s) no se pudieron actualizar (permisos o conexión).`);
    else toast.success(`Corrección aplicada en ${ok} parte(s)`);
  };

  const nMarcados = propuestas.filter(p => marcados[p.order.id]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><SpellCheck className="w-5 h-5" /> Revisión ortográfica</DialogTitle>
          <DialogDescription>
            Revisa descripción, observaciones, materiales y conceptos. No se modifican cifras ni referencias.
          </DialogDescription>
        </DialogHeader>

        {fase === 'inicio' && (
          <div className="space-y-4 text-sm">
            <p>Se van a revisar <b>{candidatos.length}</b> de {orders.length} parte(s){orders.length > 1 ? ' (según los filtros actuales)' : ''}.</p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={incluirRevisados} onCheckedChange={(v) => setIncluirRevisados(!!v)} />
              Incluir partes ya revisados anteriormente
            </label>
            <p className="text-xs text-muted-foreground">Antes de aplicar nada verás las correcciones propuestas y podrás desmarcar las que no quieras.</p>
          </div>
        )}

        {fase === 'analizando' && (
          <div className="space-y-3 py-4">
            <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Revisando {progreso.hecho}/{progreso.total}…</p>
            <Progress value={progreso.total ? (progreso.hecho / progreso.total) * 100 : 0} />
          </div>
        )}

        {fase === 'revision' && (
          <div className="flex-1 min-h-0 space-y-3">
            <p className="text-sm">
              {propuestas.length === 0
                ? 'No se han encontrado errores que corregir.'
                : <>Correcciones propuestas en <b>{propuestas.length}</b> parte(s). Desmarca las que no quieras aplicar.</>}
              {sinRevisar > 0 && <span className="text-amber-600"> · {sinRevisar} parte(s) no se pudieron revisar (conexión); repite la revisión más tarde.</span>}
            </p>
            <div className="overflow-y-auto max-h-[50vh] space-y-3 pr-1">
              {propuestas.map(({ order, cambios }) => (
                <div key={order.id} className="border rounded-lg p-3 space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox checked={!!marcados[order.id]} onCheckedChange={(v) => setMarcados(m => ({ ...m, [order.id]: !!v }))} className="mt-0.5" />
                    <span className="text-sm font-medium">
                      {numeroParteVisible(order) ? `${numeroParteVisible(order)} · ` : ''}{order.project} <span className="text-muted-foreground font-normal">· · {fechaES(order.date)}</span>
                    </span>
                  </label>
                  {cambios.map(c => (
                    <div key={c.clave} className="ml-6 text-xs space-y-0.5">
                      <p className="text-muted-foreground font-medium">{c.etiqueta}</p>
                      <p className="text-red-600 line-through whitespace-pre-wrap">{c.antes}</p>
                      <p className="text-green-700 whitespace-pre-wrap">{c.despues}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {fase === 'aplicando' && (
          <p className="text-sm flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Aplicando correcciones…</p>
        )}

        {fase === 'fin' && resultado && (
          <p className="text-sm flex items-center gap-2 py-4">
            <Check className="w-4 h-4 text-green-600" /> {resultado.ok} parte(s) corregido(s){resultado.fallos ? `, ${resultado.fallos} con error` : ''}.
          </p>
        )}

        <DialogFooter className="gap-2">
          {fase === 'inicio' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={analizar} disabled={candidatos.length === 0}>Analizar</Button>
            </>
          )}
          {fase === 'analizando' && <Button variant="outline" onClick={() => { cancelRef.current = true; onOpenChange(false); }}>Cancelar</Button>}
          {fase === 'revision' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
              {propuestas.length > 0 && <Button onClick={aplicar} disabled={nMarcados === 0}>Aplicar ({nMarcados})</Button>}
            </>
          )}
          {fase === 'fin' && <Button onClick={() => onOpenChange(false)}>Cerrar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
