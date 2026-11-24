import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Loader2, Sparkles, CheckCircle2, AlertCircle, Save, FileText, Calculator, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import InformeTecnicoResumen from './InformeTecnicoResumen';
import InformesTecnicosPresupuesto from './InformesTecnicosPresupuesto';

const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Fase 2 — Análisis interno de precios e informe técnico de un presupuesto.
 * Propone precios con desglose (materiales, mano de obra, dietas, desplazamiento)
 * y guarda el informe como documentación interna. Nunca modifica el PDF del cliente.
 */
export default function AnalisisTecnicoPresupuesto({
  open, onClose, clienteId, clienteName, obraId, obraName, presupuesto, conceptos, onAplicarPrecios,
}) {
  const [margen, setMargen] = useState(25);
  const [estado, setEstado] = useState('idle'); // idle | cargando | listo | error
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null); // { partidas, informe, base }
  const [precios, setPrecios] = useState({});       // indice -> precio editable
  const [tab, setTab] = useState('precios');
  const [guardando, setGuardando] = useState(false);
  const [guardados, setGuardados] = useState([]);
  const [maximizado, setMaximizado] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEstado('idle'); setResultado(null); setError(''); setPrecios({}); setTab('precios');
    if (!presupuesto?.id) { setGuardados([]); return; }
    base44.entities.InformeTecnicoPresupuesto.filter({ presupuesto_id: presupuesto.id }, '-created_date', 20)
      .then((rows) => setGuardados(Array.isArray(rows) ? rows : []))
      .catch(() => setGuardados([]));
  }, [open, presupuesto?.id]);

  const recalcularConMargen = (m) => {
    setMargen(m);
    if (!resultado) return;
    const nuevos = {};
    resultado.partidas.forEach((p) => { nuevos[p.indice] = r2(p.coste_total * (1 + m / 100)); });
    setPrecios(nuevos);
  };

  const analizar = async () => {
    setEstado('cargando'); setError(''); setResultado(null);
    try {
      const res = await base44.functions.invoke('analizarPresupuestoIngenieria', {
        conceptos: conceptos.map((c) => ({
          tipo: c.tipo, descripcion: c.descripcion, detalle: c.detalle,
          cantidad: c.cantidad, unidad: c.unidad, precio_unitario: c.precio_unitario,
        })),
        cliente_id: clienteId,
        cliente_name: clienteName,
        obra_id: obraId,
        obra_name: obraName,
        presupuesto_id: presupuesto?.id,
        presupuesto_codigo: presupuesto?.codigo_registro,
        margen_pct: margen,
      });
      const data = res?.data || {};
      if (data.error) throw new Error(data.error);
      setResultado(data);
      const nuevos = {};
      (data.partidas || []).forEach((p) => { nuevos[p.indice] = p.precio_sugerido; });
      setPrecios(nuevos);
      setEstado('listo');
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo analizar el presupuesto');
      setEstado('error');
    }
  };

  const aplicarPrecios = () => {
    // Solo se aplican las partidas que el análisis ha podido valorar
    const lista = resultado.partidas
      .filter((p) => p.coste_total > 0)
      .map((p) => ({ indice: p.indice, precio_unitario: Number(precios[p.indice]) || 0 }));
    onAplicarPrecios(lista);
    toast.success('Precios aplicados al presupuesto (puedes seguir editándolos)');
    onClose();
  };

  const guardarInforme = async () => {
    if (!presupuesto?.id || !resultado) return;
    setGuardando(true);
    try {
      const informe = resultado.informe;
      const precioTotal = r2(Object.values(precios).reduce((s, v) => s + (Number(v) || 0), 0));
      const partidas = informe.partidas.map((p) => ({ ...p, precio_sugerido: Number(precios[p.indice]) || 0 }));
      const creado = await base44.entities.InformeTecnicoPresupuesto.create({
        ...informe,
        presupuesto_id: presupuesto.id,
        presupuesto_codigo: presupuesto.codigo_registro || informe.presupuesto_codigo || '',
        obra_id: presupuesto.obra_id || obraId || '',          // permite listarlo en Ingeniería
        obra_name: presupuesto.obra_name || obraName || informe.obra_name || '',
        cliente_name: presupuesto.cliente_name || clienteName || informe.cliente_name || '',
        partidas,
        totales: {
          ...informe.totales,
          precio_propuesto: precioTotal,
          margen_importe: r2(precioTotal - informe.desglose.coste_total),
          margen_pct: margen,
        },
        estado: 'archivado',
        version: (guardados?.[0]?.version || 0) + 1,
      });
      setGuardados((prev) => [creado, ...prev]);
      toast.success('Informe técnico archivado con este presupuesto');
    } catch (e) {
      toast.error('No se pudo guardar el informe: ' + (e?.response?.data?.error || e?.message || 'sin permiso'));
    } finally {
      setGuardando(false);
    }
  };

  if (!open) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-[60] ${maximizado ? 'p-0' : 'p-2 sm:p-4'}`}>
      <div className={`flex flex-col overflow-hidden bg-card border border-border shadow-xl ${maximizado ? 'h-screen w-screen rounded-none' : 'h-[94vh] w-[96vw] max-w-[1600px] rounded-xl'}`}>
        <div className="bg-background border-b px-4 py-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Calculator className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">Análisis interno de precios</p>
              <p className="text-[11px] text-muted-foreground truncate">Documento de dirección · no se envía al cliente</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => setMaximizado((v) => !v)}
              title={maximizado ? 'Reducir ventana' : 'Ampliar a pantalla completa'}>
              {maximizado ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {estado === 'idle' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Se analizan las partidas junto con la documentación de obra de Ingeniería y se propone un precio con su desglose
                interno: materiales, mano de obra, dietas y desplazamiento. Los precios son una propuesta editable.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-32">
                  <Label className="text-xs">Margen objetivo (%)</Label>
                  <Input type="number" step="any" value={margen} onChange={(e) => setMargen(parseFloat(e.target.value) || 0)} />
                </div>
                <Button onClick={analizar} className="gap-1.5"><Sparkles className="w-4 h-4" /> Analizar y proponer precios</Button>
                {!obraId && <span className="text-[11px] text-amber-700 dark:text-amber-400">Sin obra asignada: no se usará documentación de Ingeniería.</span>}
              </div>
            </div>
          )}

          {estado === 'cargando' && (
            <div className="flex flex-col items-center gap-2 py-12">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <p className="text-sm font-medium text-primary">Analizando partidas y documentación…</p>
            </div>
          )}

          {estado === 'error' && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <Button size="sm" variant="outline" onClick={() => setEstado('idle')}>Volver</Button>
              </div>
            </div>
          )}

          {estado === 'listo' && resultado && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setTab('precios')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${tab === 'precios' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'}`}>
                  Propuesta de precios
                </button>
                <button type="button" onClick={() => setTab('informe')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${tab === 'informe' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'}`}>
                  Informe técnico
                </button>
                <div className="ml-auto flex items-end gap-2">
                  <div className="w-24">
                    <Label className="text-[10px]">Margen %</Label>
                    <Input className="h-8 text-xs" type="number" step="any" value={margen} onChange={(e) => recalcularConMargen(parseFloat(e.target.value) || 0)} />
                  </div>
                  <Button size="sm" variant="outline" onClick={analizar} className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Analizar de nuevo</Button>
                </div>
              </div>

              {tab === 'precios' ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="text-left p-2">Partida</th>
                          <th className="text-right p-2">Materiales</th>
                          <th className="text-right p-2">Horas</th>
                          <th className="text-right p-2">M. obra</th>
                          <th className="text-right p-2">Dietas</th>
                          <th className="text-right p-2">Despl.</th>
                          <th className="text-right p-2">Coste</th>
                          <th className="text-right p-2">Precio propuesto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {resultado.partidas.map((p) => (
                          <tr key={p.indice} className={p.coste_total === 0 ? 'opacity-60' : ''}>
                            <td className="p-2 max-w-[220px]">
                              <p className="truncate">{p.descripcion || '—'}</p>
                              {p.supuesto && <p className="text-[10px] text-muted-foreground line-clamp-1">{p.supuesto}</p>}
                            </td>
                            <td className="p-2 text-right whitespace-nowrap">{eur(p.coste_materiales)}</td>
                            <td className="p-2 text-right">{p.horas_estimadas || 0}</td>
                            <td className="p-2 text-right whitespace-nowrap">{eur(p.coste_mano_obra)}</td>
                            <td className="p-2 text-right whitespace-nowrap">{eur(p.dietas)}</td>
                            <td className="p-2 text-right whitespace-nowrap">{eur(p.desplazamiento)}</td>
                            <td className="p-2 text-right font-medium whitespace-nowrap">{eur(p.coste_total)}</td>
                            <td className="p-2 text-right">
                              <Input className="h-7 text-xs text-right w-24 ml-auto" type="number" step="0.01"
                                value={precios[p.indice] ?? ''} onChange={(e) => setPrecios((prev) => ({ ...prev, [p.indice]: e.target.value }))}
                                disabled={p.coste_total === 0} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
                    <span>Coste interno: <strong>{eur(resultado.informe.desglose.coste_total)}</strong></span>
                    <span>Precio propuesto: <strong>{eur(Object.values(precios).reduce((s, v) => s + (Number(v) || 0), 0))}</strong></span>
                    <Button size="sm" className="gap-1.5" onClick={aplicarPrecios}><CheckCircle2 className="w-3.5 h-3.5" /> Aplicar precios al presupuesto</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <InformeTecnicoResumen informe={resultado.informe} />
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={guardarInforme} disabled={guardando || !presupuesto?.id}
                      title={presupuesto?.id ? 'Archiva este informe con el presupuesto y la obra' : 'Guarda primero el presupuesto para poder archivar el informe'}>
                      {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar informe
                    </Button>
                    {!presupuesto?.id && <span className="text-[11px] text-muted-foreground">Guarda el presupuesto para poder archivar el informe.</span>}
                  </div>
                </div>
              )}

              {presupuesto?.id && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Informes archivados</p>
                  <InformesTecnicosPresupuesto key={guardados.length} presupuestoId={presupuesto.id} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}