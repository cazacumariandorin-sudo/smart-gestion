import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Download, Trash2, Pencil, Save, Loader2, ClipboardList, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO, startOfWeek, getWeek, getYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const UNITS = ['m', 'm²', 'm³', 'ud', 'kg', 'l', 'h', 'ml', 'tn'];
const PERIOD_OPTIONS = [
  { value: 'dia', label: 'Por Día' },
  { value: 'semana', label: 'Por Semana' },
  { value: 'mes', label: 'Por Mes' },
  { value: 'anual', label: 'Anual' },
];

const emptyForm = {
  operario_id: '', operario_name: '', date: new Date().toISOString().split('T')[0],
  obra_name: '', concepto: '', unidad: 'ud', cantidad: '', precio_unitario: '', total: '', notas: '',
};

function drawTable(doc, headers, rows, startY, margin = 14) {
  const pageW = doc.internal.pageSize.getWidth();
  const colW = (pageW - margin * 2) / headers.length;
  const rowH = 7;
  let y = startY;

  doc.setFillColor(249, 115, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  headers.forEach((h, i) => {
    doc.rect(margin + i * colW, y, colW, rowH, 'F');
    doc.text(String(h), margin + i * colW + 2, y + 4.5);
  });
  y += rowH;

  doc.setFont(undefined, 'normal');
  doc.setTextColor(30, 30, 30);
  rows.forEach((row, ri) => {
    if (y > 275) { doc.addPage(); y = 20; }
    const bg = ri % 2 === 0 ? [255, 255, 255] : [250, 250, 252];
    doc.setFillColor(...bg);
    row.forEach((cell, i) => {
      doc.rect(margin + i * colW, y, colW, rowH, 'F');
      doc.text(String(cell ?? '—').substring(0, 22), margin + i * colW + 2, y + 4.5);
    });
    y += rowH;
  });

  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, startY, colW * headers.length, y - startY, 'S');
  return y + 4;
}

export default function ApuntesTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [period, setPeriod] = useState('mes');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [opFilter, setOpFilter] = useState('all');

  const { data: apuntes = [], isLoading } = useQuery({
    queryKey: ['apuntes'],
    queryFn: () => base44.entities.ApunteHorario.list('-date', 1000),
  });
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });

  const createM = useMutation({ mutationFn: d => base44.entities.ApunteHorario.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['apuntes'] }); close_(); } });
  const updateM = useMutation({ mutationFn: ({ id, d }) => base44.entities.ApunteHorario.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['apuntes'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.ApunteHorario.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['apuntes'] }) });

  const open_ = (a = null) => { setEditing(a); setForm(a ? { ...a } : emptyForm); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const set = (k, v) => setForm(p => {
    const next = { ...p, [k]: v };
    if (k === 'cantidad' || k === 'precio_unitario') {
      const qty = parseFloat(k === 'cantidad' ? v : p.cantidad) || 0;
      const price = parseFloat(k === 'precio_unitario' ? v : p.precio_unitario) || 0;
      next.total = qty && price ? +(qty * price).toFixed(2) : '';
    }
    return next;
  });

  const handleOpChange = id => {
    const op = operarios.find(o => o.id === id);
    setForm(p => ({ ...p, operario_id: id, operario_name: op?.name || '' }));
  };

  const handleSave = () => {
    const qty = parseFloat(form.cantidad) || 0;
    const price = parseFloat(form.precio_unitario) || 0;
    const data = { ...form, cantidad: qty, precio_unitario: price || undefined, total: qty && price ? +(qty * price).toFixed(2) : undefined };
    editing ? updateM.mutate({ id: editing.id, d: data }) : createM.mutate(data);
  };

  // Filter
  const filtered = useMemo(() => apuntes.filter(a => {
    const mOp = opFilter === 'all' || a.operario_id === opFilter;
    if (period === 'anual') return mOp && a.date?.startsWith(yearFilter);
    return mOp && a.date?.startsWith(monthFilter);
  }), [apuntes, opFilter, period, monthFilter, yearFilter]);

  // Group by period
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(a => {
      let key;
      if (period === 'dia') key = a.date;
      else if (period === 'semana') {
        const d = parseISO(a.date);
        key = `${getYear(d)}-S${String(getWeek(d, { weekStartsOn: 1 })).padStart(2, '0')}`;
      } else if (period === 'mes') key = a.date?.slice(0, 7);
      else key = a.date?.slice(0, 4);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered, period]);

  const totalCantidad = filtered.reduce((s, a) => s + (a.cantidad || 0), 0);
  const totalImporte = filtered.reduce((s, a) => s + (a.total || 0), 0);

  const periodLabel = (key) => {
    if (period === 'dia') return key ? format(parseISO(key), 'EEEE dd/MM/yyyy', { locale: es }) : key;
    if (period === 'semana') return `Semana ${key.split('-S')[1]} · ${key.split('-S')[0]}`;
    if (period === 'mes') {
      try { return format(parseISO(key + '-01'), 'MMMM yyyy', { locale: es }); } catch { return key; }
    }
    return `Año ${key}`;
  };

  // PDF
  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(30, 30, 30);
    doc.text('Apuntes de Cantidades', 14, 18);
    doc.setFontSize(11); doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${PERIOD_OPTIONS.find(p => p.value === period)?.label} | Filtro: ${period === 'anual' ? yearFilter : monthFilter}`, 14, 27);
    doc.setDrawColor(220, 220, 220); doc.line(14, 31, 196, 31);

    let y = 40;
    grouped.forEach(([key, items]) => {
      if (y > 250) { doc.addPage(); y = 20; }
      const kTotal = items.reduce((s, a) => s + (a.total || 0), 0);
      const kQty = items.reduce((s, a) => s + (a.cantidad || 0), 0);
      doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(30, 30, 30);
      doc.text(`${periodLabel(key)} — ${kQty.toFixed(2)} uds · ${kTotal > 0 ? kTotal.toFixed(2) + ' €' : ''}`, 14, y);
      doc.setFont(undefined, 'normal'); y += 5;
      const rows = items.map(a => [
        a.date ? format(parseISO(a.date), 'dd/MM/yy') : '',
        a.operario_name || '',
        (a.concepto || '').substring(0, 25),
        a.cantidad ?? '',
        a.unidad || '',
        a.precio_unitario ? a.precio_unitario + ' €' : '—',
        a.total ? a.total + ' €' : '—',
      ]);
      y = drawTable(doc, ['Fecha', 'Operario', 'Concepto', 'Cantidad', 'Ud', 'P.Unit', 'Total'], rows, y);
    });

    doc.setFontSize(9); doc.setTextColor(120);
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.text(`Total: ${totalCantidad.toFixed(2)} uds | Importe: ${totalImporte.toFixed(2)} € | ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Pág ${i}/${pages}`, 14, 290);
    }
    doc.save(`apuntes-cantidades-${monthFilter || yearFilter}.pdf`);
  };

  // Excel
  const generateExcel = () => {
    const rows = filtered.sort((a, b) => a.date > b.date ? 1 : -1).map(a => ({
      Fecha: a.date ? format(parseISO(a.date), 'dd/MM/yyyy') : '',
      Operario: a.operario_name || '',
      Obra: a.obra_name || '',
      Concepto: a.concepto || '',
      Cantidad: a.cantidad || 0,
      Unidad: a.unidad || '',
      'P. Unitario (€)': a.precio_unitario || '',
      'Total (€)': a.total || '',
      Notas: a.notas || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Apuntes');

    // Summary sheet by period
    const summary = grouped.map(([key, items]) => ({
      Período: periodLabel(key),
      'Nº Apuntes': items.length,
      'Total Cantidad': items.reduce((s, a) => s + (a.cantidad || 0), 0).toFixed(2),
      'Total Importe (€)': items.reduce((s, a) => s + (a.total || 0), 0).toFixed(2),
    }));
    const ws2 = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen');
    XLSX.writeFile(wb, `apuntes-cantidades-${monthFilter || yearFilter}.xlsx`);
  };

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div>
      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 flex-wrap">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {period === 'anual' ? (
          <Input type="number" min="2020" max="2099" value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="w-full sm:w-28" placeholder="Año" />
        ) : (
          <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full sm:w-40" />
        )}
        <Select value={opFilter} onValueChange={setOpFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Operario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los operarios</SelectItem>
            {operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => open_()} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nuevo Apunte
        </Button>
        <Button onClick={generatePDF} variant="outline" className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> PDF
        </Button>
        <Button onClick={generateExcel} variant="outline" className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> Excel
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Apuntes</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Cantidad</p>
          <p className="text-2xl font-bold text-primary">{totalCantidad.toFixed(2)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Importe Total</p>
          <p className="text-2xl font-bold text-emerald-600">{totalImporte > 0 ? totalImporte.toFixed(2) + ' €' : '—'}</p>
        </Card>
      </div>

      {/* Grouped list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay apuntes para este período</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([key, items]) => {
            const gQty = items.reduce((s, a) => s + (a.cantidad || 0), 0);
            const gTotal = items.reduce((s, a) => s + (a.total || 0), 0);
            return (
              <Card key={key} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold capitalize text-sm">{periodLabel(key)}</span>
                  <div className="flex items-center gap-3">
                    {gTotal > 0 && <span className="text-sm font-semibold text-emerald-600">{gTotal.toFixed(2)} €</span>}
                    <Badge variant="outline" className="text-[10px]">{gQty.toFixed(2)} uds</Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {items.sort((a, b) => a.date > b.date ? 1 : -1).map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0 gap-2">
                      <span className="text-muted-foreground w-14 shrink-0">
                        {a.date ? format(parseISO(a.date), 'dd/MM', { locale: es }) : '--'}
                      </span>
                      <span className="font-medium w-20 shrink-0 truncate">{a.operario_name}</span>
                      <span className="flex-1 truncate text-muted-foreground">{a.concepto}</span>
                      <span className="font-semibold shrink-0">{a.cantidad} {a.unidad}</span>
                      {a.total > 0 && <span className="text-emerald-600 shrink-0">{a.total} €</span>}
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(a)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar apunte?</AlertDialogTitle>
                              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteM.mutate(a.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Apunte' : 'Nuevo Apunte de Cantidad'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Operario *</Label>
                <Select value={form.operario_id} onValueChange={handleOpChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha *</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Obra</Label>
                <Input value={form.obra_name} onChange={e => set('obra_name', e.target.value)} placeholder="Nombre obra..." />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Concepto *</Label>
                <Input value={form.concepto} onChange={e => set('concepto', e.target.value)} placeholder="Descripción del trabajo..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cantidad *</Label>
                <Input type="number" step="0.01" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidad</Label>
                <Select value={form.unidad} onValueChange={v => set('unidad', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Precio unitario (€)</Label>
                <Input type="number" step="0.01" value={form.precio_unitario} onChange={e => set('precio_unitario', e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Total (€)</Label>
                <Input value={form.total || ''} readOnly className="bg-muted" placeholder="Calculado" />
              </div>
            </div>
            {form.total > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-center text-emerald-700 font-semibold">
                💶 Total: {form.total} €
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.operario_id || !form.concepto || !form.cantidad || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}