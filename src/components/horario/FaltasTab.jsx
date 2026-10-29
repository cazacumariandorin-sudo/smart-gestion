import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';
import {
  Plus, Search, Trash2, Pencil, Save, Loader2, UserX, ChevronLeft, ChevronRight,
  FileCheck2, FileX2, Clock, BookOpen, X, Paperclip, Eye, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import QueryErrorFallback from '@/components/QueryErrorFallback';
import { format, parseISO, addMonths, subMonths, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPOS = [
  { value: 'permiso_retribuido', label: 'Permiso retribuido (Art. 26)', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'baja_medica', label: 'Baja médica', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'ausencia_justificada', label: 'Ausencia justificada', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'ausencia_injustificada', label: 'Ausencia injustificada (Art. 27)', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'permiso_sin_sueldo', label: 'Permiso sin sueldo', color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

const MOTIVOS_PERMISO = [
  { value: 'matrimonio', label: 'Matrimonio (15 días naturales)' },
  { value: 'nacimiento_fallecimiento', label: 'Nacimiento/fallecimiento/enfermedad grave familiar (3 días, 5 si desplazamiento)' },
  { value: 'traslado_domicilio', label: 'Traslado domicilio habitual (1 día)' },
  { value: 'deber_publico', label: 'Deber inexcusable de carácter público' },
  { value: 'funciones_sindicales', label: 'Funciones sindicales o de representación' },
  { value: 'examenes', label: 'Exámenes académicos' },
  { value: 'otro', label: 'Otro' },
];

const GRAVEDAD = [
  { value: 'leve', label: 'Leve', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'grave', label: 'Grave', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'muy_grave', label: 'Muy grave', color: 'bg-red-100 text-red-700 border-red-200' },
];

const ESTADOS = [
  { value: 'pendiente_revision', label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'justificada', label: 'Justificada', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'injustificada', label: 'Injustificada', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'sancionada', label: 'Sancionada', color: 'bg-slate-200 text-slate-700 border-slate-300' },
];

const labelOf = (arr, v) => arr.find(x => x.value === v)?.label || v;
const colorOf = (arr, v) => arr.find(x => x.value === v)?.color || 'bg-muted text-muted-foreground';

const emptyForm = {
  operario_id: '', operario_name: '',
  fecha_inicio: new Date().toISOString().split('T')[0],
  fecha_fin: '', tipo: 'permiso_retribuido', motivo_permiso: 'matrimonio',
  gravedad: '', comunicado_24h: false, justificado: false,
  justificante_url: '', justificante_nombre: '', observaciones: '',
};

// Convenio reference (Art. 26 + Art. 27) — Sector del Metal Madrid 2024-2026
function ConvenioPanel() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          <BookOpen className="w-4 h-4" /> Convenio del Metal Madrid 2024-2026 — Faltas de asistencia
        </span>
        <span className="text-xs text-indigo-600 dark:text-indigo-400">{open ? 'Ocultar' : 'Ver resumen'}</span>
      </button>
      {open && (
        <div className="p-4 space-y-3 text-xs">
          <div>
            <p className="font-bold text-foreground mb-1">Art. 26 — Licencias retribuidas (con derecho a remuneración, avisando con antelación y justificando):</p>
            <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
              <li><strong>15 días naturales</strong> por matrimonio.</li>
              <li><strong>3 días</strong> por nacimiento de hijo, fallecimiento, accidente o enfermedad graves, hospitalización o intervención quirúrgica de parientes hasta 2º grado (<strong>5 días</strong> si requiere desplazamiento).</li>
              <li><strong>1 día</strong> por traslado del domicilio habitual.</li>
              <li>Tiempo indispensable para cumplimiento de un deber inexcusable de carácter público y personal.</li>
              <li>Funciones sindicales o de representación del personal.</li>
              <li>Tiempo necesario para concurrir a exámenes (estudios reglados para titulación académica/profesional).</li>
            </ul>
          </div>
          <div className="border-t border-border pt-2">
            <p className="font-bold text-foreground mb-1">Art. 27 — Faltas y sanciones:</p>
            <p className="text-muted-foreground mb-1">Se consideran <strong>faltas de asistencia injustificadas</strong> las ausencias no comunicadas en un plazo de <strong>24 horas</strong> y sin justificación médica o legal.</p>
            <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
              <li><strong>Leves:</strong> faltas de puntualidad injustificadas inferiores a 30 minutos al mes.</li>
              <li><strong>Graves:</strong> más de 3 faltas de asistencia o puntualidad injustificadas en un mes.</li>
              <li><strong>Muy graves:</strong> faltas reiteradas y continuadas de asistencia o puntualidad injustificadas.</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function FaltasTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isGerencia, isAdministracion } = useUserRole();
  const canManage = isAdmin || isGerencia || isAdministracion;
  // Roles restringidos: solo ven sus propias faltas
  const isOwnDataOnly = ['operario', 'control_horario', 'técnico', 'usuario_demo', 'cliente_obra'].includes(user?.role);

  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const { data: faltas = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['faltas-asistencia'],
    queryFn: () => base44.entities.FaltaAsistencia.list('-fecha_inicio', 500),
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });

  const myOperario = isOwnDataOnly
    ? (operarios.find(o => o.user_email === user?.email) || operarios.find(o => o.email === user?.email) || operarios.find(o => o.user_id === user?.id))
    : null;

  const createM = useMutation({
    mutationFn: d => base44.entities.FaltaAsistencia.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faltas-asistencia'] }); close_(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.FaltaAsistencia.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faltas-asistencia'] }); close_(); },
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.FaltaAsistencia.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faltas-asistencia'] }),
  });

  const open_ = (f = null) => {
    setEditing(f);
    if (f) {
      setForm({ ...f });
    } else if (isOwnDataOnly) {
      setForm({ ...emptyForm, operario_id: myOperario?.id || '', operario_name: myOperario?.name || user?.full_name || '' });
    } else {
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleOpChange = id => {
    const op = operarios.find(o => o.id === id);
    setForm(p => ({ ...p, operario_id: id, operario_name: op?.name || '' }));
  };

  const calcDias = (fi, ff) => {
    if (!fi) return 1;
    const end = ff || fi;
    return differenceInCalendarDays(parseISO(end), parseISO(fi)) + 1;
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setForm(p => ({ ...p, justificante_url: file_uri, justificante_nombre: file.name, justificado: true }));
    } catch (err) {
      console.error('Error subiendo justificante:', err);
    } finally {
      setUploading(false);
    }
  };

  const verJustificante = async (url) => {
    if (!url) return;
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: url, expires_in: 300 });
      window.open(signed_url, '_blank');
    } catch (err) {
      console.error('Error generando enlace del justificante:', err);
    }
  };

  const handleSave = () => {
    const dias = calcDias(form.fecha_inicio, form.fecha_fin);
    const data = {
      ...form,
      fecha_fin: form.fecha_fin || form.fecha_inicio,
      dias,
      motivo_permiso: form.tipo === 'permiso_retribuido' ? form.motivo_permiso : undefined,
      gravedad: form.tipo === 'ausencia_injustificada' ? (form.gravedad || 'leve') : undefined,
      creado_por: editing?.creado_por || user?.email,
    };
    editing ? updateM.mutate({ id: editing.id, d: data }) : createM.mutate(data);
  };

  // Resolver una falta (gerencia/administración)
  const resolver = (f, estado) => {
    updateM.mutate({
      id: f.id,
      d: { estado, justificado: estado === 'justificada', resuelto_por: user?.email, fecha_resolucion: new Date().toISOString() },
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return faltas.filter(f => {
      if (isOwnDataOnly && (!myOperario || f.operario_id !== myOperario.id)) return false;
      const mQ = !search || f.operario_name?.toLowerCase().includes(q);
      const mOp = opFilter === 'all' || f.operario_id === opFilter;
      const mMonth = !monthFilter || (f.fecha_inicio?.startsWith(monthFilter) || f.fecha_fin?.startsWith(monthFilter));
      return mQ && mOp && mMonth;
    });
  }, [faltas, search, opFilter, monthFilter, isOwnDataOnly, myOperario]);

  const counts = useMemo(() => ({
    total: filtered.length,
    justificadas: filtered.filter(f => f.estado === 'justificada').length,
    injustificadas: filtered.filter(f => f.estado === 'injustificada').length,
    pendientes: filtered.filter(f => f.estado === 'pendiente_revision').length,
  }), [filtered]);

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="flex flex-col gap-4 p-4">
      <ConvenioPanel />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar operario..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setMonthFilter(prev => format(subMonths(parseISO((prev || monthFilter) + '-01'), 1), 'yyyy-MM'))} title="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full sm:w-40 text-center" />
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setMonthFilter(prev => format(addMonths(parseISO((prev || monthFilter) + '-01'), 1), 'yyyy-MM'))} title="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        {!isOwnDataOnly && (
          <MobileSelect value={opFilter} onValueChange={setOpFilter} placeholder="Operario" triggerClassName="w-full sm:w-44">
            <MobileSelectItem value="all">Todos</MobileSelectItem>
            {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
          </MobileSelect>
        )}
        <Button onClick={() => open_()} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Registrar falta
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total faltas</p>
          <p className="text-2xl font-bold">{counts.total}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Justificadas</p>
          <p className="text-2xl font-bold text-emerald-600">{counts.justificadas}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Injustificadas</p>
          <p className="text-2xl font-bold text-red-600">{counts.injustificadas}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Pendientes</p>
          <p className="text-2xl font-bold text-amber-600">{counts.pendientes}</p>
        </Card>
      </div>

      {/* List */}
      {isLoading || isError ? (
        <QueryErrorFallback
          isLoading={isLoading}
          error={isError ? error : null}
          isEmpty={false}
          retryFn={refetch}
          emptyMessage="No hay faltas registradas"
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <UserX className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay faltas de asistencia en este período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => {
            const esRango = f.fecha_fin && f.fecha_fin !== f.fecha_inicio;
            const canEditThis = canManage || (isOwnDataOnly && f.creado_por === user?.email && f.estado === 'pendiente_revision');
            const canDeleteThis = canManage;
            return (
              <Card key={f.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 text-center shrink-0">
                    <p className="text-xs font-bold text-primary">{f.fecha_inicio ? format(parseISO(f.fecha_inicio), 'dd') : '--'}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{f.fecha_inicio ? format(parseISO(f.fecha_inicio), 'EEE', { locale: es }) : '--'}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{f.operario_name}</span>
                      <Badge variant="outline" className={`text-[10px] border ${colorOf(TIPOS, f.tipo)}`}>{labelOf(TIPOS, f.tipo)}</Badge>
                      {f.motivo_permiso && f.tipo === 'permiso_retribuido' && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">{labelOf(MOTIVOS_PERMISO, f.motivo_permiso)}</Badge>
                      )}
                      {f.gravedad && f.tipo === 'ausencia_injustificada' && (
                        <Badge variant="outline" className={`text-[10px] border ${colorOf(GRAVEDAD, f.gravedad)}`}>{labelOf(GRAVEDAD, f.gravedad)}</Badge>
                      )}
                      <Badge variant="outline" className={`text-[10px] border ${colorOf(ESTADOS, f.estado)}`}>{labelOf(ESTADOS, f.estado)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {esRango
                        ? `${format(parseISO(f.fecha_inicio), 'dd/MM', { locale: es })} → ${format(parseISO(f.fecha_fin), 'dd/MM', { locale: es })} · ${f.dias || calcDias(f.fecha_inicio, f.fecha_fin)} días`
                        : `${f.fecha_inicio ? format(parseISO(f.fecha_inicio), 'dd/MM/yyyy', { locale: es }) : '--'} · 1 día`}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {f.comunicado_24h ? (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Avisado en 24 h</span>
                      ) : (
                        <span className="text-[10px] text-red-600 flex items-center gap-1"><Clock className="w-3 h-3" /> Sin aviso 24 h</span>
                      )}
                      {f.justificante_url && (
                        <button onClick={() => verJustificante(f.justificante_url)} className="text-[10px] text-blue-600 flex items-center gap-1 hover:underline">
                          <Eye className="w-3 h-3" /> Ver justificante
                        </button>
                      )}
                    </div>
                    {f.observaciones && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.observaciones}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {canManage && f.estado === 'pendiente_revision' && (
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => resolver(f, 'justificada')}>
                          <FileCheck2 className="w-3 h-3" /> Justificar
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 border-red-300 text-red-700 hover:bg-red-50" onClick={() => resolver(f, 'injustificada')}>
                          <FileX2 className="w-3 h-3" /> Injustificada
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-1">
                      {canEditThis && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(f)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                      {canDeleteThis && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar falta de asistencia?</AlertDialogTitle>
                              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteM.mutate(f.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) close_(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar falta de asistencia' : 'Registrar falta de asistencia'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              {isOwnDataOnly ? (
                <div className="flex h-auto w-full flex-col items-start rounded-md border border-input bg-muted px-3 py-2 text-sm">
                  {myOperario ? (
                    <span className="text-foreground font-medium">{myOperario.name}</span>
                  ) : (
                    <span className="text-amber-700 font-semibold text-xs">⚠️ Tu perfil de operario no está vinculado</span>
                  )}
                </div>
              ) : (
                <MobileSelect value={form.operario_id} onValueChange={handleOpChange} placeholder="Seleccionar operario...">
                  {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
                </MobileSelect>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha inicio *</Label>
                <Input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha fin (opcional)</Label>
                <Input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} min={form.fecha_inicio} />
              </div>
            </div>
            {form.fecha_inicio && (
              <div className="bg-primary/5 rounded-lg px-3 py-1.5 text-xs text-center">
                📅 <strong>{calcDias(form.fecha_inicio, form.fecha_fin)}</strong> día(s) de ausencia
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de ausencia *</Label>
              <MobileSelect value={form.tipo} onValueChange={v => set('tipo', v)} placeholder="Seleccionar tipo...">
                {TIPOS.map(t => <MobileSelectItem key={t.value} value={t.value}>{t.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>

            {form.tipo === 'permiso_retribuido' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Motivo del permiso (Art. 26) *</Label>
                <MobileSelect value={form.motivo_permiso} onValueChange={v => set('motivo_permiso', v)} placeholder="Seleccionar motivo...">
                  {MOTIVOS_PERMISO.map(m => <MobileSelectItem key={m.value} value={m.value}>{m.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
            )}

            {form.tipo === 'ausencia_injustificada' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Gravedad (Art. 27) *</Label>
                <MobileSelect value={form.gravedad || 'leve'} onValueChange={v => set('gravedad', v)} placeholder="Seleccionar gravedad...">
                  {GRAVEDAD.map(g => <MobileSelectItem key={g.value} value={g.value}>{g.label}</MobileSelectItem>)}
                </MobileSelect>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Leve (menos de 30 min/mes) · Grave (más de 3 faltas/mes) · Muy grave (reiteradas)
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 px-3 py-2">
              <input
                type="checkbox"
                id="comunicado_24h"
                checked={!!form.comunicado_24h}
                onChange={e => set('comunicado_24h', e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="comunicado_24h" className="text-xs text-amber-800 dark:text-amber-200 cursor-pointer">
                Avisado en un plazo de 24 h (Art. 27)
              </label>
            </div>

            {/* Justificante */}
            <div className="space-y-1.5">
              <Label className="text-xs">Justificante (parte médico / documento oficial)</Label>
              {form.justificante_url ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-700 flex-1 truncate">{form.justificante_nombre || 'Justificante adjunto'}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => verJustificante(form.justificante_url)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setForm(p => ({ ...p, justificante_url: '', justificante_nombre: '', justificado: false }))}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  {uploading ? 'Subiendo...' : 'Adjuntar justificante (stored privately)'}
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <Textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2} placeholder="Motivo detallado, contacto, notas..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.operario_id || !form.fecha_inicio || isPending}
              className="gap-2 min-w-28"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}