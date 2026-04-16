import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plus, Search, Trash2, Receipt, Upload, Loader2, Save, Camera,
  X, ChevronDown, ChevronUp, Fuel, ShoppingCart, Layers, Navigation, ParkingCircle, Wallet, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const CATEGORIAS = [
  { key: 'combustible', label: 'Combustible', icon: Fuel, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'material', label: 'Material', icon: ShoppingCart, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'varios', label: 'Varios', icon: Layers, color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { key: 'peaje', label: 'Peaje', icon: Navigation, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'parking', label: 'Parking', icon: ParkingCircle, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { key: 'adelanto', label: 'Adelanto', icon: Wallet, color: 'bg-red-100 text-red-700 border-red-200' },
];

const catCfg = Object.fromEntries(CATEGORIAS.map(c => [c.key, c]));

const emptyGasto = {
  operario_id: '', operario_name: '', date: new Date().toISOString().split('T')[0],
  categoria: '', importe: '', descripcion: '', proveedor: '', ticket_url: '', ocr_raw: '', project: '',
};

export default function GastosOperarios() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [search, setSearch] = useState('');
  const [operarioFilter, setOperarioFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyGasto);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ticketPreview, setTicketPreview] = useState(null);

  // Read operario param from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const opId = params.get('operario');
    if (opId) setOperarioFilter(opId);
  }, []);

  const { data: gastos = [], isLoading } = useQuery({ queryKey: ['gastos_operarios'], queryFn: () => base44.entities.GastoOperario.list('-date', 500) });
  const { data: operarios = [] } = useQuery({ queryKey: ['operarios'], queryFn: () => base44.entities.Operario.list('name', 200) });

  const createM = useMutation({ mutationFn: d => base44.entities.GastoOperario.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['gastos_operarios'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.GastoOperario.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['gastos_operarios'] }) });

  const open_ = () => { setForm(emptyGasto); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setForm(emptyGasto); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleOperarioChange = (id) => {
    const op = operarios.find(o => o.id === id);
    setForm(p => ({ ...p, operario_id: id, operario_name: op?.name || '' }));
  };

  // Upload ticket and run OCR
  const handleTicketUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('ticket_url', file_url);
    setUploading(false);

    // Run OCR via LLM
    setOcrLoading(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Analiza este ticket o factura y extrae la información. Devuelve un JSON con estos campos:
- importe: número con el total a pagar (solo el número, sin símbolo)
- proveedor: nombre del establecimiento o empresa
- fecha: fecha en formato YYYY-MM-DD (si aparece)
- descripcion: descripción breve del concepto o artículos
- categoria: una de estas opciones según el tipo de gasto: combustible, material, varios, peaje, parking, adelanto

Si no puedes extraer algún campo, ponlo como null.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          importe: { type: 'number' },
          proveedor: { type: 'string' },
          fecha: { type: 'string' },
          descripcion: { type: 'string' },
          categoria: { type: 'string' },
        }
      }
    });

    setForm(p => ({
      ...p,
      ticket_url: file_url,
      importe: res.importe || p.importe,
      proveedor: res.proveedor || p.proveedor,
      date: res.fecha || p.date,
      descripcion: res.descripcion || p.descripcion,
      categoria: res.categoria && CATEGORIAS.find(c => c.key === res.categoria) ? res.categoria : p.categoria,
    }));
    setOcrLoading(false);
  };

  const handleSave = () => {
    createM.mutate({ ...form, importe: parseFloat(form.importe) || 0 });
  };

  // Filtered gastos
  const filtered = useMemo(() => gastos.filter(g => {
    const q = search.toLowerCase();
    const matchQ = !search || g.operario_name?.toLowerCase().includes(q) || g.descripcion?.toLowerCase().includes(q) || g.proveedor?.toLowerCase().includes(q);
    const matchOp = operarioFilter === 'all' || g.operario_id === operarioFilter;
    const matchCat = catFilter === 'all' || g.categoria === catFilter;
    const matchMonth = !monthFilter || (g.date && g.date.startsWith(monthFilter));
    return matchQ && matchOp && matchCat && matchMonth;
  }), [gastos, search, operarioFilter, catFilter, monthFilter]);

  // Totals by category
  const totalesPorCategoria = useMemo(() => {
    const totals = {};
    CATEGORIAS.forEach(c => { totals[c.key] = 0; });
    filtered.forEach(g => { if (totals[g.categoria] !== undefined) totals[g.categoria] += g.importe || 0; });
    return totals;
  }, [filtered]);

  const totalGeneral = Object.values(totalesPorCategoria).reduce((s, v) => s + v, 0);

  // Totals by operario (for filtered)
  const totalesPorOperario = useMemo(() => {
    const map = {};
    filtered.forEach(g => {
      if (!map[g.operario_id]) map[g.operario_id] = { name: g.operario_name, total: 0, categorias: {} };
      map[g.operario_id].total += g.importe || 0;
      map[g.operario_id].categorias[g.categoria] = (map[g.operario_id].categorias[g.categoria] || 0) + (g.importe || 0);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const isPending = createM.isPending;

  // Month navigation
  const prevMonth = () => {
    const [y, m] = monthFilter.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonthFilter(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = monthFilter.split('-').map(Number);
    const d = new Date(y, m, 1);
    setMonthFilter(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/operarios">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="w-7 h-7 text-primary" /> Gastos Operarios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{filtered.length} gastos · {totalGeneral.toFixed(2)} €</p>
          </div>
        </div>
        <Button onClick={open_} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Gasto</span>
        </Button>
      </div>

      {/* Month nav */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" size="icon" onClick={prevMonth}><ChevronDown className="w-4 h-4 rotate-90" /></Button>
        <span className="font-semibold capitalize min-w-36 text-center">
          {monthFilter ? format(parseISO(monthFilter + '-01'), 'MMMM yyyy', { locale: es }) : 'Todos'}
        </span>
        <Button variant="outline" size="icon" onClick={nextMonth}><ChevronUp className="w-4 h-4 rotate-90" /></Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setMonthFilter('')}>Ver todo</Button>
      </div>

      {/* Summary table by category */}
      <Card className="p-4 mb-6 overflow-x-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumen por categoría</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {CATEGORIAS.map(cat => {
            const Icon = cat.icon;
            const total = totalesPorCategoria[cat.key] || 0;
            return (
              <div
                key={cat.key}
                onClick={() => setCatFilter(catFilter === cat.key ? 'all' : cat.key)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border cursor-pointer transition-all ${catFilter === cat.key ? cat.color + ' font-semibold' : 'border-border hover:bg-muted/50'}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] text-center font-medium">{cat.label}</span>
                <span className="text-sm font-bold">{total.toFixed(2)}€</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
          <span className="text-sm font-semibold">TOTAL</span>
          <span className="text-xl font-bold text-primary">{totalGeneral.toFixed(2)} €</span>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={operarioFilter} onValueChange={setOperarioFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Operario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los operarios</SelectItem>
            {operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* By operario summary */}
      {totalesPorOperario.length > 1 && (
        <Card className="p-4 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Por operario</p>
          <div className="space-y-2">
            {totalesPorOperario.map(op => (
              <div key={op.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{op.name}</span>
                <span className="font-bold text-primary">{op.total.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Gastos list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay gastos registrados</p>
          <Button variant="outline" size="sm" onClick={open_} className="gap-2"><Plus className="w-3.5 h-3.5" /> Añadir gasto</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(g => {
            const cat = catCfg[g.categoria];
            const Icon = cat?.icon || Receipt;
            return (
              <Card key={g.id} className="p-4 flex items-center gap-4">
                {/* Ticket thumbnail */}
                {g.ticket_url ? (
                  <img
                    src={g.ticket_url}
                    alt="ticket"
                    className="w-12 h-12 rounded-lg object-cover cursor-pointer shrink-0"
                    onClick={() => setTicketPreview(g.ticket_url)}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{g.operario_name}</span>
                    {cat && <Badge variant="outline" className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{g.descripcion || g.proveedor || '—'}</p>
                  <p className="text-xs text-muted-foreground">{g.date ? format(parseISO(g.date), 'd MMM yyyy', { locale: es }) : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-primary">{(g.importe || 0).toFixed(2)} €</p>
                  {g.project && <p className="text-xs text-muted-foreground">{g.project}</p>}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteM.mutate(g.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ticket lightbox */}
      {ticketPreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setTicketPreview(null)}>
          <button className="absolute top-4 right-4 text-white"><X className="w-7 h-7" /></button>
          <img src={ticketPreview} alt="Ticket" className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* New gasto dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo Gasto</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {/* Ticket upload + OCR */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-2"><Camera className="w-3.5 h-3.5 text-primary" /> Foto ticket / factura (OCR automático)</Label>
              {form.ticket_url ? (
                <div className="relative">
                  <img src={form.ticket_url} alt="ticket" className="w-full h-40 object-cover rounded-lg" />
                  <button onClick={() => set('ticket_url', '')} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  {ocrLoading && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg gap-2">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                      <p className="text-white text-xs">Analizando ticket con IA...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg h-32 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <Camera className="w-8 h-8 text-muted-foreground" />}
                  <p className="text-xs text-muted-foreground">{uploading ? 'Subiendo...' : 'Subir foto de ticket o factura'}</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => e.target.files[0] && handleTicketUpload(e.target.files[0])} />
            </div>

            {ocrLoading && (
              <div className="flex items-center gap-2 text-xs text-primary bg-accent/50 rounded-lg px-3 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extrayendo datos del ticket con IA...
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Operario *</Label>
                <Select value={form.operario_id} onValueChange={handleOperarioChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar operario..." /></SelectTrigger>
                  <SelectContent>{operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría *</Label>
                <Select value={form.categoria} onValueChange={v => set('categoria', v)}>
                  <SelectTrigger><SelectValue placeholder="Categoría..." /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Importe (€) *</Label>
                <Input type="number" min="0" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Proveedor</Label>
                <Input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Nombre establecimiento" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Descripción / Concepto</Label>
                <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} placeholder="Detalle del gasto..." />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Obra (opcional)</Label>
                <Input value={form.project} onChange={e => set('project', e.target.value)} placeholder="Nombre de la obra..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.operario_id || !form.categoria || !form.importe || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}