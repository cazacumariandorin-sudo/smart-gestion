/**
 * ObraSeguimientoPanel — BLOQUE 3
 * Pestaña de seguimiento para una obra civil o solar.
 * Props: obra (objeto Obra o SolarObra), obraTipo ('civil' | 'solar')
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import ObraSelectorObras from '@/components/obras/ObraSelectorObras';
import { Plus, Pencil, CheckCircle2, BarChart3, Clock, ClipboardList, Loader2, Save, AlertTriangle } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { mensajeConflictoAusencia } from '@/lib/conflictoAusencias';
import { Link } from 'react-router-dom';

const SEMAFORO = {
  verde:     { color: '#1D9E75', bg: '#E1F5EE', label: 'En plazo' },
  amarillo:  { color: '#BA7517', bg: '#FAEEDA', label: 'Atención' },
  rojo:      { color: '#E24B4A', bg: '#FCEBEB', label: 'Retraso' },
  sin_datos: { color: '#888780', bg: '#F2F2F2', label: 'Sin datos' },
};

function BarraProgreso({ pct, color, label }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function emptyPrevision(obraId, obraName) {
  return { obra_id: obraId, obra_name: obraName, fecha_inicio: '', fecha_fin: '', horas_totales_previstas: '', notas: '', operarios_asignados: [] };
}

export default function ObraSeguimientoPanel({ obra, obraTipo = 'civil' }) {
  const qc = useQueryClient();
  const { isAdmin, isJefeObra } = useUserRole();
  const canManage = isAdmin || isJefeObra;
  const [previsionModal, setPrevisionModal] = useState(false);
  const [apunteModal, setApunteModal] = useState(false);
  const [prevForm, setPrevForm] = useState(null);
  const [apunteForm, setApunteForm] = useState({ operario_id: '', operario_name: '', date: new Date().toISOString().split('T')[0], concepto: '', cantidad: '', unidad: 'ud', precio_unitario: '', obra_id: obra.id, obra_name: obra.name });

  const { data: previsions = [], isLoading: loadingPrev } = useQuery({
    queryKey: ['prevision', obra.id],
    queryFn: () => base44.entities.PrevisionObra.filter({ obra_id: obra.id }),
  });
  const { data: fichajes = [] } = useQuery({
    queryKey: ['fichajes-obra', obra.id],
    queryFn: () => base44.entities.Fichaje.filter({ obra_id: obra.id }),
  });
  const { data: apuntes = [] } = useQuery({
    queryKey: ['apuntes-obra', obra.id],
    queryFn: () => base44.entities.ApunteHorario.filter({ obra_id: obra.id }),
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
    staleTime: 5 * 60 * 1000,
  });

  const createPrevM = useMutation({
    mutationFn: d => base44.entities.PrevisionObra.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prevision', obra.id] }); setPrevisionModal(false); }
  });
  const updatePrevM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.PrevisionObra.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prevision', obra.id] }); setPrevisionModal(false); }
  });
  const updateObraM = useMutation({
    mutationFn: ({ id, d }) => obraTipo === 'civil'
      ? base44.entities.Obra.update(id, d)
      : base44.entities.SolarObra.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['obras-civiles'] }); qc.invalidateQueries({ queryKey: ['solar-obras'] }); }
  });
  const createApunteM = useMutation({
    mutationFn: d => base44.entities.ApunteHorario.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apuntes-obra', obra.id] }); setApunteModal(false); }
  });

  const prevision = previsions[0] || null;

  // Calcular progreso tiempo
  let pctTiempo = 0;
  let diasRestantes = null;
  if (prevision?.fecha_inicio && prevision?.fecha_fin) {
    const inicio = new Date(prevision.fecha_inicio);
    const fin = new Date(prevision.fecha_fin);
    const hoy = new Date();
    const diasTotales = Math.max(1, differenceInDays(fin, inicio));
    const diasTrans = Math.max(0, differenceInDays(hoy, inicio));
    pctTiempo = Math.min(100, Math.round((diasTrans / diasTotales) * 100));
    diasRestantes = differenceInDays(fin, hoy);
  }

  const semCfg = SEMAFORO[prevision?.status_semaforo || 'sin_datos'];

  // Tabla operarios
  const operariosAsignados = prevision?.operarios_asignados || [];
  const fichajesByOp = {};
  fichajes.forEach(f => {
    if (!f.operario_id) return;
    if (!fichajesByOp[f.operario_id]) fichajesByOp[f.operario_id] = { horas: 0, fechas: [] };
    fichajesByOp[f.operario_id].horas += f.horas_trabajadas || 0;
    fichajesByOp[f.operario_id].fechas.push(f.date);
  });
  const hoyStr = new Date().toISOString().split('T')[0];
  const operariosActivosHoy = new Set(prevision?.operarios_activos_hoy || []);

  // Agrupar apuntes por semana
  const apuntesByWeek = {};
  apuntes.forEach(a => {
    if (!a.date) return;
    const d = parseISO(a.date);
    const weekStart = format(d, "yyyy-'W'ww");
    if (!apuntesByWeek[weekStart]) apuntesByWeek[weekStart] = [];
    apuntesByWeek[weekStart].push(a);
  });
  const sortedWeeks = Object.keys(apuntesByWeek).sort().reverse();

  const fichajosRecientes = [...fichajes].sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1).slice(0, 10);

  const openPrevForm = (p = null) => {
    setPrevForm(p ? { ...p } : emptyPrevision(obra.id, obra.name));
    setPrevisionModal(true);
  };

  const handleSavePrev = () => {
    const d = {
      ...prevForm,
      horas_totales_previstas: parseFloat(prevForm.horas_totales_previstas) || 0,
    };
    prevision ? updatePrevM.mutate({ id: prevision.id, d }) : createPrevM.mutate(d);
  };

  const handleMarcarCompletada = async () => {
    await updateObraM.mutateAsync({ id: obra.id, d: { status: 'finalizada' } });
    if (prevision) await updatePrevM.mutateAsync({ id: prevision.id, d: { status: 'completada' } });
  };

  const handleSaveApunte = async () => {
    const conflicto = await mensajeConflictoAusencia(apunteForm.operario_id, apunteForm.date);
    if (conflicto) { toast.error(conflicto); return; }
    const d = { ...apunteForm, cantidad: parseFloat(apunteForm.cantidad) || 0, precio_unitario: parseFloat(apunteForm.precio_unitario) || undefined };
    createApunteM.mutate(d);
  };

  if (loadingPrev) return <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      {/* A) CABECERA */}
      {!prevision ? (
        <Card className="p-5 text-center border-dashed">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Sin previsión registrada para esta obra</p>
          {canManage && (
            <Button size="sm" onClick={() => openPrevForm()} className="gap-2">
              <Plus className="w-4 h-4" /> Crear previsión
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-4 space-y-4">
          {/* Semáforo + fechas */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: semCfg.color }} />
              <span className="text-sm font-semibold" style={{ color: semCfg.color }}>{semCfg.label}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {prevision.fecha_inicio ? format(parseISO(prevision.fecha_inicio), 'd MMM yyyy', { locale: es }) : '—'}
              {prevision.fecha_fin && ` → ${format(parseISO(prevision.fecha_fin), 'd MMM yyyy', { locale: es })}`}
            </Badge>
            {diasRestantes !== null && (
              <Badge variant="outline" className={`text-xs ${diasRestantes < 0 ? 'bg-red-50 text-red-700 border-red-200' : diasRestantes <= 7 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {diasRestantes < 0 ? `${Math.abs(diasRestantes)}d vencido` : `${diasRestantes}d restantes`}
              </Badge>
            )}
          </div>
          {/* Barras */}
          <div className="space-y-3">
            <BarraProgreso pct={pctTiempo} color="#378ADD" label="Tiempo transcurrido" />
            <BarraProgreso pct={prevision.porcentaje_avance_horas || 0} color="#7F77DD" label="Horas ejecutadas" />
          </div>
          {/* Números */}
          <div className="text-xs flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span><strong className="text-foreground">{(prevision.horas_reales_acumuladas || 0).toFixed(1)}h</strong> reales</span>
            <span><strong className="text-foreground">{(prevision.horas_totales_previstas || 0).toFixed(1)}h</strong> previstas</span>
            <span>
              Desviación:{' '}
              <strong style={{ color: (prevision.desviacion_horas || 0) < 0 ? '#E24B4A' : '#1D9E75' }}>
                {(prevision.desviacion_horas || 0) >= 0 ? '+' : ''}{(prevision.desviacion_horas || 0).toFixed(1)}h
              </strong>
            </span>
            {prevision.ultimo_fichaje_fecha && (
              <span>Último fichaje: <strong className="text-foreground">{format(parseISO(prevision.ultimo_fichaje_fecha), 'd MMM', { locale: es })}</strong></span>
            )}
          </div>
          {/* Botones admin */}
          {canManage && (
            <div className="flex gap-2 flex-wrap pt-1 border-t border-border">
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => openPrevForm(prevision)}>
                <Pencil className="w-3 h-3" /> Editar previsión
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={handleMarcarCompletada}>
                <CheckCircle2 className="w-3 h-3" /> Marcar completada
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* B) TABLA OPERARIOS */}
      {operariosAsignados.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Operarios</h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {['Operario','H. prev.','H. reales','Desviación','Último fichaje','Hoy'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operariosAsignados.map((op, i) => {
                  const real = fichajesByOp[op.operario_id];
                  const horasReales = real?.horas || 0;
                  const desv = (op.horas_previstas || 0) - horasReales;
                  const fechasSorted = (real?.fechas || []).sort();
                  const ultFicha = fechasSorted[fechasSorted.length - 1];
                  const fichadoHoy = operariosActivosHoy.has(op.operario_id);
                  return (
                    <tr key={op.operario_id || i} className="border-t border-border hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{op.operario_name}</td>
                      <td className="px-3 py-2">{op.horas_previstas || 0}h</td>
                      <td className="px-3 py-2">{horasReales.toFixed(1)}h</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: desv < 0 ? '#E24B4A' : '#1D9E75' }}>
                        {desv >= 0 ? '+' : ''}{desv.toFixed(1)}h
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{ultFicha ? format(parseISO(ultFicha), 'd MMM', { locale: es }) : '—'}</td>
                      <td className="px-3 py-2">
                        {fichadoHoy
                          ? <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">✓ Fichado</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {/* Fila total */}
                <tr className="border-t-2 border-border bg-muted/60 font-bold">
                  <td className="px-3 py-2">TOTAL</td>
                  <td className="px-3 py-2">{operariosAsignados.reduce((s, o) => s + (o.horas_previstas || 0), 0)}h</td>
                  <td className="px-3 py-2">{Object.values(fichajesByOp).reduce((s, v) => s + v.horas, 0).toFixed(1)}h</td>
                  <td className="px-3 py-2" colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* C) ÚLTIMOS FICHAJES */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Últimos fichajes
        </h4>
        {fichajosRecientes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">No hay fichajes registrados en esta obra</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {['Fecha','Operario','Entrada','Salida','Horas'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fichajosRecientes.map(f => (
                  <tr key={f.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2">{f.date ? format(parseISO(f.date), 'dd/MM', { locale: es }) : '—'}</td>
                    <td className="px-3 py-2 font-medium">{f.operario_name}</td>
                    <td className="px-3 py-2">{f.hora_entrada || '—'}</td>
                    <td className="px-3 py-2">{f.hora_salida || '—'}</td>
                    <td className="px-3 py-2 font-semibold text-primary">{f.horas_trabajadas?.toFixed(1) || '—'}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link to="/control-horario" className="text-xs text-primary hover:underline mt-2 inline-block">
          Ver todos los fichajes →
        </Link>
      </div>

      {/* D) APUNTES POR SEMANA */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5" /> Registro de producción
          </h4>
          <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setApunteModal(true)}>
            <Plus className="w-3 h-3" /> Añadir apunte
          </Button>
        </div>
        {sortedWeeks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">No hay apuntes de producción</p>
        ) : (
          <div className="space-y-3">
            {sortedWeeks.map(week => {
              const items = apuntesByWeek[week];
              const totalSemana = items.reduce((s, a) => s + (a.total || 0), 0);
              return (
                <Card key={week} className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Semana {week.split('W')[1]} · {week.split('W')[0].replace('-', '')}</span>
                    {totalSemana > 0 && <span className="text-xs font-bold text-emerald-600">{totalSemana.toFixed(2)} €</span>}
                  </div>
                  <div className="space-y-1">
                    {items.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-xs py-1 border-b border-border last:border-0">
                        <span className="text-muted-foreground w-10 shrink-0">{a.date ? format(parseISO(a.date), 'dd/MM') : ''}</span>
                        <span className="font-medium w-16 shrink-0 truncate">{a.operario_name}</span>
                        <span className="flex-1 truncate text-muted-foreground">{a.concepto}</span>
                        <span className="font-semibold shrink-0">{a.cantidad} {a.unidad}</span>
                        {a.total > 0 && <span className="text-emerald-600 shrink-0">{a.total} €</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL — Previsión */}
      <Dialog open={previsionModal} onOpenChange={setPrevisionModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{prevision ? 'Editar previsión' : 'Nueva previsión'}</DialogTitle></DialogHeader>
          {prevForm && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha inicio *</Label>
                  <Input type="date" value={prevForm.fecha_inicio || ''} onChange={e => setPrevForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha fin prevista</Label>
                  <Input type="date" value={prevForm.fecha_fin || ''} onChange={e => setPrevForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Horas totales previstas</Label>
                  <Input type="number" min="0" value={prevForm.horas_totales_previstas || ''} onChange={e => setPrevForm(p => ({ ...p, horas_totales_previstas: e.target.value }))} placeholder="Ej: 480" />
                </div>
              </div>
              {/* Operarios */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Operarios asignados</Label>
                  <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => setPrevForm(p => ({ ...p, operarios_asignados: [...(p.operarios_asignados || []), { operario_id: '', operario_name: '', horas_previstas: '' }] }))}>
                    <Plus className="w-3 h-3" /> Añadir
                  </Button>
                </div>
                <div className="space-y-2">
                  {(prevForm.operarios_asignados || []).map((op, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-7">
                        <MobileSelect value={op.operario_id} onValueChange={v => {
                          const found = operarios.find(o => o.id === v);
                          setPrevForm(p => {
                            const arr = [...(p.operarios_asignados || [])];
                            arr[i] = { ...arr[i], operario_id: v, operario_name: found?.name || '' };
                            return { ...p, operarios_asignados: arr };
                          });
                        }} placeholder="Operario...">
                          {operarios.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
                        </MobileSelect>
                      </div>
                      <div className="col-span-4">
                        <Input type="number" placeholder="Horas" value={op.horas_previstas || ''} className="h-9 text-xs"
                          onChange={e => setPrevForm(p => {
                            const arr = [...(p.operarios_asignados || [])];
                            arr[i] = { ...arr[i], horas_previstas: parseFloat(e.target.value) || '' };
                            return { ...p, operarios_asignados: arr };
                          })} />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive col-span-1"
                        onClick={() => setPrevForm(p => ({ ...p, operarios_asignados: (p.operarios_asignados || []).filter((_, idx) => idx !== i) }))}>
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrevisionModal(false)}>Cancelar</Button>
            <Button onClick={handleSavePrev} disabled={!prevForm?.fecha_inicio || createPrevM.isPending || updatePrevM.isPending} className="gap-2">
              {(createPrevM.isPending || updatePrevM.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL — Nuevo apunte */}
      <Dialog open={apunteModal} onOpenChange={setApunteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuevo apunte de producción</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              <MobileSelect value={apunteForm.operario_id} onValueChange={v => {
                const op = operarios.find(o => o.id === v);
                setApunteForm(p => ({ ...p, operario_id: v, operario_name: op?.name || '' }));
              }} placeholder="Seleccionar...">
                {operarios.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha *</Label>
                <Input type="date" value={apunteForm.date} onChange={e => setApunteForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidad</Label>
                <MobileSelect value={apunteForm.unidad} onValueChange={v => setApunteForm(p => ({ ...p, unidad: v }))} placeholder="Ud">
                  {['m','m²','m³','ud','kg','l','h','ml','tn'].map(u => <MobileSelectItem key={u} value={u}>{u}</MobileSelectItem>)}
                </MobileSelect>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Concepto *</Label>
              <Input value={apunteForm.concepto} onChange={e => setApunteForm(p => ({ ...p, concepto: e.target.value }))} placeholder="Descripción del trabajo..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cantidad *</Label>
                <Input type="number" value={apunteForm.cantidad} onChange={e => setApunteForm(p => ({ ...p, cantidad: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">€/ud</Label>
                <Input type="number" value={apunteForm.precio_unitario} onChange={e => setApunteForm(p => ({ ...p, precio_unitario: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApunteModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveApunte} disabled={!apunteForm.operario_id || !apunteForm.concepto || !apunteForm.cantidad || createApunteM.isPending} className="gap-2">
              {createApunteM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}