/**
 * Vista Calendario de Obras — especificación completa del manual v2.0
 * Muestra cuadrícula mensual con registros diarios + panel de detalle inline + formulario de apunte
 */
import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, format, getDay, parseISO, isWithinInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Plus, Save, Pencil, ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

// ── Tipos de registro ────────────────────────────────────────────────────────
const TIPO_CFG = {
  trabajo:    { label: 'Trabajo realizado', color: '#378ADD', bg: '#378ADD20' },
  materiales: { label: 'Materiales',        color: '#BA7517', bg: '#BA751720' },
  visita:     { label: 'Visita',            color: '#7F77DD', bg: '#7F77DD20' },
  incidencia: { label: 'Incidencia',        color: '#D85A30', bg: '#D85A3020' },
  prevision:  { label: 'Previsión',         color: '#1D9E75', bg: '#1D9E7520' },
  nota:       { label: 'Nota',              color: '#888780', bg: '#88878020' },
};

// Color semántico del resultado
function resultColor(resultado) {
  if (!resultado) return '';
  const r = resultado.toLowerCase();
  if (['favorable', 'conforme', 'aprobado', 'completado'].some(k => r.includes(k))) return '#0F6E56';
  if (['pendiente', 'previsto', 'en tramitación', 'tramitación'].some(k => r.includes(k))) return '#BA7517';
  return '';
}

// ── Formulario de apunte inline ───────────────────────────────────────────────
function FormularioApunte({ fecha, obras, onSave, onCancel }) {
  const [form, setForm] = useState({ tipo: 'prevision', obra_id: '', resp: '', hora: '', desc: '', notas: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.desc.trim()) { alert('Por favor, añade una descripción.'); return; }
    if (!form.obra_id) { alert('Por favor, selecciona una obra.'); return; }
    const obraName = obras.find(o => o.id === form.obra_id)?.name || '';
    const resultado = form.tipo === 'prevision' ? 'Previsto' : 'Pendiente';
    onSave({
      ...form,
      obra_name: obraName,
      fecha: format(fecha, 'yyyy-MM-dd'),
      resp: form.resp || '—',
      hora: form.hora || '—',
      resultado,
    });
  };

  return (
    <div className="mt-3 p-3 border border-dashed border-primary/40 rounded-xl bg-primary/5 space-y-2">
      <p className="text-xs font-semibold text-primary">Nuevo apunte de previsión</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <Label className="text-xs">Tipo de apunte</Label>
          <MobileSelect value={form.tipo} onValueChange={v => set('tipo', v)} placeholder="Tipo de apunte">
            {Object.entries(TIPO_CFG).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
          </MobileSelect>
        </div>
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <Label className="text-xs">Obra asociada *</Label>
          <MobileSelect value={form.obra_id} onValueChange={v => set('obra_id', v)} placeholder="— Seleccionar obra —">
            {obras.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
          </MobileSelect>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsable</Label>
          <Input placeholder="—" value={form.resp} onChange={e => set('resp', e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hora prevista</Label>
          <Input placeholder="09:00–11:00" value={form.hora} onChange={e => set('hora', e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Descripción *</Label>
          <Textarea placeholder="Descripción de la actividad..." value={form.desc} onChange={e => set('desc', e.target.value)} rows={2} className="text-xs" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Notas adicionales</Label>
          <Input placeholder="Observaciones opcionales" value={form.notas} onChange={e => set('notas', e.target.value)} className="h-8 text-xs" />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave}>
          <Save className="w-3 h-3" /> Guardar apunte
        </Button>
      </div>
    </div>
  );
}

// ── Formulario de edición inline de previsión ─────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'planificada', label: 'Planificada' },
  { value: 'en_curso',    label: 'En curso' },
  { value: 'completada',  label: 'Completada' },
  { value: 'cancelada',   label: 'Cancelada' },
];

function FormularioEdicion({ prevision, onSave, onCancel, isSaving, onDelete, isDeleting, esRangoMultidia }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    fecha_inicio:            prevision.fecha_inicio || '',
    fecha_fin:               prevision.fecha_fin    || '',
    status:                  prevision.status       || 'planificada',
    horas_totales_previstas: prevision.horas_totales_previstas ?? '',
    notas:                   prevision.notas        || '',
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.fecha_inicio) { alert('La fecha de inicio es obligatoria.'); return; }
    onSave({
      id: prevision.id,
      data: {
        ...form,
        horas_totales_previstas: form.horas_totales_previstas !== ''
          ? parseFloat(form.horas_totales_previstas)
          : null,
      },
    });
  };

  return (
    <div className="mt-3 p-3 border border-dashed border-primary/50 rounded-xl bg-primary/5 space-y-2.5">
      <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
        <Pencil className="w-3 h-3" /> Editando previsión: {prevision.obra_name}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {/* Fecha inicio */}
        <div className="space-y-1">
          <Label className="text-xs">Fecha inicio *</Label>
          <Input
            type="date"
            value={form.fecha_inicio}
            onChange={e => set('fecha_inicio', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Fecha fin */}
        <div className="space-y-1">
          <Label className="text-xs">Fecha fin</Label>
          <Input
            type="date"
            value={form.fecha_fin}
            onChange={e => set('fecha_fin', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Estado */}
        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <MobileSelect value={form.status} onValueChange={v => set('status', v)} placeholder="Estado">
            {STATUS_OPTIONS.map(o => (
              <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>
            ))}
          </MobileSelect>
        </div>

        {/* Horas previstas */}
        <div className="space-y-1">
          <Label className="text-xs">Horas previstas</Label>
          <Input
            type="number"
            min="0"
            step="0.5"
            placeholder="0"
            value={form.horas_totales_previstas}
            onChange={e => set('horas_totales_previstas', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        {/* Notas — ocupa las 2 columnas */}
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Notas / Observaciones</Label>
          <Textarea
            placeholder="Observaciones sobre esta previsión..."
            value={form.notas}
            onChange={e => set('notas', e.target.value)}
            rows={2}
            className="text-xs"
          />
        </div>
      </div>

      {/* Botones acción */}
      {confirmDelete ? (
        <div className="p-2.5 border border-destructive/40 rounded-lg bg-destructive/5 space-y-2">
          <p className="text-[11px] font-medium text-destructive">¿Qué deseas eliminar?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => { setConfirmDelete(false); onDelete('dia'); }}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null} Solo este día
            </Button>
            {esRangoMultidia && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] text-destructive hover:text-destructive"
                onClick={() => { setConfirmDelete(false); onDelete('todo'); }}
                disabled={isDeleting}
              >
                Todo el periodo
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 justify-between pt-1">
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={isSaving || isDeleting}
            >
              <X className="w-3 h-3" /> Eliminar
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onCancel}
              disabled={isSaving || isDeleting}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleSave}
              disabled={isSaving || isDeleting}
            >
              {isSaving
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Guardando…</>
                : <><Save className="w-3 h-3" /> Guardar cambios</>
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel de detalle del día ──────────────────────────────────────────────────
function PanelDetalle({ day, registros, obras, onClose, onSaveApunte, canEdit, onEditPrevision, onDeletePrevision }) {
  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState(null); // id de la previsión en edición
  const [isSaving, setIsSaving]       = useState(false);
  const [deletingId, setDeletingId]   = useState(null);

  const handleSaveEdit = async (payload) => {
    setIsSaving(true);
    try {
      await onEditPrevision(payload);
    } finally {
      setIsSaving(false);
      setEditingId(null);
    }
  };

  const handleDelete = async (prevision, modo) => {
    setDeletingId(prevision.id);
    try {
      await onDeletePrevision(prevision, format(day, 'yyyy-MM-dd'), modo);
    } finally {
      setDeletingId(null);
      setEditingId(null);
    }
  };

  if (!day) return null;

  const ahora = new Date();
  const esPasada = day < ahora && !isToday(day);
  const esHoy = isToday(day);

  const handleSave = (data) => {
    onSaveApunte(data);
    setShowForm(false);
  };

  return (
    <div className="mt-4 border border-border rounded-xl bg-card shadow-sm overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div>
          <p className="font-semibold text-sm capitalize">
            {format(day, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <span>{registros.length} registro{registros.length !== 1 ? 's' : ''}</span>
            {esHoy && <Badge className="h-4 text-[9px] bg-primary text-white">Hoy</Badge>}
            {esPasada && <span className="text-muted-foreground text-[10px]">Fecha pasada</span>}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      <div className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
        {/* Botón añadir apunte */}
        {!showForm && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Añadir apunte de previsión
          </Button>
        )}

        {/* Formulario inline */}
        {showForm && (
          <FormularioApunte fecha={day} obras={obras} onSave={handleSave} onCancel={() => setShowForm(false)} />
        )}

        {/* Estado vacío */}
        {registros.length === 0 && !showForm && (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin registros este día</p>
            <p className="text-xs">Pulsa "Añadir apunte de previsión" para registrar actividad.</p>
          </div>
        )}

        {/* Tarjetas de registro */}
        {registros.map((r, idx) => {
          const tcfg = TIPO_CFG[r.tipo] || TIPO_CFG.nota;
          const esPrev = r.tipo === 'prevision';
          const resColor = resultColor(r.resultado);
          return (
            <Card
              key={r.id || idx}
              className="p-3 text-xs"
              style={{ borderLeft: `3px solid ${tcfg.color}`, ...(esPrev ? { borderStyle: 'dashed' } : {}) }}
            >
              {/* Badges tipo + obra */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-medium text-[10px]"
                  style={{ backgroundColor: tcfg.color }}>
                  {tcfg.label}
                </span>
                {r.obra_name && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                    {r.obra_name}
                  </span>
                )}
                {esPrev && <span className="text-[9px] text-muted-foreground italic">· Previsión</span>}
              </div>
              {/* 7 campos en grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{tcfg.label}</span></div>
                <div><span className="text-muted-foreground">Hora:</span> <span className="font-medium">{r.hora || '—'}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Descripción:</span> <span className="font-medium">{r.desc || r.descripcion || '—'}</span></div>
                <div><span className="text-muted-foreground">Responsable:</span> <span className="font-medium">{r.resp || r.responsable || '—'}</span></div>
                <div>
                  <span className="text-muted-foreground">Resultado:</span>{' '}
                  <span className="font-medium" style={resColor ? { color: resColor } : {}}>{r.resultado || '—'}</span>
                </div>
                {r.notas && <div className="col-span-2"><span className="text-muted-foreground">Notas:</span> <span className="italic">{r.notas}</span></div>}
              </div>

              {/* Botón Editar — solo para admin/gerencia y solo en registros
                  de tipo previsión que vienen de la entidad (tienen id real) */}
              {canEdit && r.id && !r.id.toString().startsWith('extra_') && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  {editingId === r.id ? (
                    <FormularioEdicion
                      prevision={r}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditingId(null)}
                      isSaving={isSaving}
                      onDelete={onDeletePrevision ? (modo) => handleDelete(r, modo) : undefined}
                      isDeleting={deletingId === r.id}
                      esRangoMultidia={!!(r.fecha_fin && r.fecha_inicio && r.fecha_fin !== r.fecha_inicio)}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                      onClick={() => setEditingId(r.id)}
                    >
                      <Pencil className="w-2.5 h-2.5" /> Editar previsión
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendario mensual principal ──────────────────────────────────────────────
export default function CalendarioObras({ previsiones, month, onMonthChange, obras, canEdit = false, onEditPrevision, onDeletePrevision }) {
  const isMobile = useIsMobile();
  const [selectedDay, setSelectedDay] = useState(null);
  const [extraRegistros, setExtraRegistros] = useState([]); // apuntes añadidos inline

  const days = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  // Indexar previsiones de Obra (cobertura por rango)
  const prevIndex = useMemo(() => {
    const map = {};
    days.forEach(day => {
      const ds = format(day, 'yyyy-MM-dd');
      map[ds] = previsiones.filter(p => {
        if (!p.fecha_inicio) return false;
        const s = parseISO(p.fecha_inicio);
        const e = p.fecha_fin ? parseISO(p.fecha_fin) : s;
        return isWithinInterval(parseISO(ds), { start: s, end: e });
      });
    });
    return map;
  }, [days, previsiones]);

  // Combinar con apuntes inline
  const allIndex = useMemo(() => {
    const combined = { ...prevIndex };
    extraRegistros.forEach(r => {
      if (!combined[r.fecha]) combined[r.fecha] = [];
      combined[r.fecha] = [...combined[r.fecha], r];
    });
    return combined;
  }, [prevIndex, extraRegistros]);

  const getRegistrosDia = (day) => {
    const ds = format(day, 'yyyy-MM-dd');
    const prevs = (allIndex[ds] || []).map(p => ({
      ...p,
      tipo: p._tipo || 'prevision',
      desc: p.notas || p.descripcion || '',
      resp: p.responsable || '—',
      hora: '—',
      resultado: p.status === 'en_curso' ? 'En curso' : p.status === 'completada' ? 'Completado' : 'Previsto',
      notas: '',
    }));
    return prevs;
  };

  const handleDayClick = (day) => {
    if (selectedDay && format(selectedDay, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
  };

  const handleMonthChange = (dir) => {
    setSelectedDay(null);
    onMonthChange(dir);
  };

  const handleSaveApunte = (data) => {
    setExtraRegistros(prev => [...prev, { ...data, id: `extra_${Date.now()}`, _tipo: data.tipo }]);
  };

  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const selectedRegistros = selectedDay ? getRegistrosDia(selectedDay) : [];
  // Para el panel combinamos también los extra directamente
  const selectedExtra = selectedDay
    ? extraRegistros.filter(r => r.fecha === format(selectedDay, 'yyyy-MM-dd'))
    : [];
  const panelRegistros = selectedDay ? [...getRegistrosDia(selectedDay), ...selectedExtra.map(r => ({
    ...r, tipo: r._tipo || r.tipo,
  }))] : [];

  // Eliminar duplicados por id
  const seen = new Set();
  const panelFinal = panelRegistros.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return (
    <div>
      {/* Navegación de mes */}
      <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-2.5 mb-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <p className="text-sm font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: es })}</p>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleMonthChange(1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Cabecera días de semana */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1.5">{d}</div>
        ))}
      </div>

      {/* Cuadrícula */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {days.map(day => {
          const ds = format(day, 'yyyy-MM-dd');
          const items = allIndex[ds] || [];
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const dow = getDay(day);
          const isWeekend = dow === 0 || dow === 6;
          const isSelected = selectedDay && format(selectedDay, 'yyyy-MM-dd') === ds;
          const MAX_VISIBLE = 4;

          return (
            <div
              key={ds}
              className={[
                'min-h-[72px] p-1 cursor-pointer transition-colors flex flex-col gap-0.5 relative',
                inMonth ? (isWeekend ? 'bg-slate-50 dark:bg-slate-900/50' : 'bg-card') : 'bg-muted/20',
                isSelected ? 'bg-primary/10 ring-2 ring-inset ring-primary' : '',
                today && !isSelected ? 'ring-2 ring-inset ring-primary/40' : '',
                !isSelected ? 'hover:bg-primary/5' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleDayClick(day)}
            >
              {/* Número del día */}
              <div className="flex items-start justify-between mb-0.5">
                <div className={[
                  'text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full',
                  today ? 'bg-primary text-primary-foreground' : inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                ].join(' ')}>
                  {format(day, 'd')}
                </div>
                {/* Contador de registros en fechas pasadas */}
                {!today && day < new Date() && items.length > 0 && inMonth && (
                  <span className="text-[9px] text-muted-foreground bg-muted rounded-full px-1">{items.length}</span>
                )}
              </div>

              {/* Pills de registros */}
              {items.slice(0, MAX_VISIBLE).map((p, i) => {
                const isPrev = p._tipo === 'prevision' || p.tipo === 'prevision';
                return (
                  <div
                    key={p.id || i}
                    className={`text-[9px] truncate px-1 py-0.5 rounded font-medium leading-tight ${isPrev ? 'border border-dashed' : ''}`}
                    style={isPrev
                      ? { borderColor: '#1D9E75', color: '#1D9E75', backgroundColor: '#1D9E7515' }
                      : { backgroundColor: '#378ADD', color: 'white' }
                    }
                    title={p.obra_name}
                  >
                    {(p.obra_name || '').slice(0, 26)}
                  </div>
                );
              })}
              {items.length > MAX_VISIBLE && (
                <div className="text-[9px] text-muted-foreground px-1">+{items.length - MAX_VISIBLE} más</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Panel de detalle — Sheet en móvil, inline en desktop */}
      {isMobile ? (
        <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto p-0">
            <SheetHeader className="px-4 pt-4 pb-2 border-b">
              <SheetTitle className="text-sm capitalize">
                {selectedDay && format(selectedDay, "EEEE d 'de' MMMM yyyy", { locale: es })}
              </SheetTitle>
            </SheetHeader>
            {selectedDay && (
              <PanelDetalle
                day={selectedDay}
                registros={panelFinal}
                obras={obras}
                onClose={() => setSelectedDay(null)}
                onSaveApunte={handleSaveApunte}
                canEdit={canEdit}
                onEditPrevision={onEditPrevision}
                onDeletePrevision={onDeletePrevision}
              />
            )}
          </SheetContent>
        </Sheet>
      ) : (
        selectedDay && (
          <PanelDetalle
            day={selectedDay}
            registros={panelFinal}
            obras={obras}
            onClose={() => setSelectedDay(null)}
            onSaveApunte={handleSaveApunte}
            canEdit={canEdit}
            onEditPrevision={onEditPrevision}
            onDeletePrevision={onDeletePrevision}
          />
        )
      )}
    </div>
  );
}