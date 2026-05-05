import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { useI18n } from '@/lib/i18n';
import { Plus, Search, Pencil, Trash2, ShoppingCart, Loader2, Save, Truck, Package, Euro, X, ChevronDown, ChevronUp, Upload, FileText, ExternalLink, Sparkles, CheckCircle2 } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const statusCfg = {
  pendiente:   { label: 'Pendiente',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmado:  { label: 'Confirmado',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_transito: { label: 'En tránsito', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  entregado:   { label: 'Entregado',   className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelado:   { label: 'Cancelado',   className: 'bg-red-100 text-red-700 border-red-200' },
};

const emptyOrder = {
  order_number: '', client_id: '', client_name: '', project: '',
  date: new Date().toISOString().split('T')[0], expected_delivery: '',
  status: 'pendiente', supplier: '', items: [], notes: '', tracking_number: '', total_amount: 0,
};
const emptyItem = { material_id: '', material_name: '', quantity: 1, unit: '', unit_price: 0, total_price: 0 };

export default function Orders() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { role } = useUserRole();
  const showPrices = role === 'admin';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyOrder);
  const [expandedId, setExpandedId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => base44.entities.Order.list('-date', 300) });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('name', 200) });
  const { data: materials = [] } = useQuery({ queryKey: ['material_catalog'], queryFn: () => base44.entities.MaterialCatalog.list('name', 500) });

  const createM = useOptimisticMutation(
    d => base44.entities.Order.create(d),
    'orders',
    (prev, newOrder) => [...prev, { ...newOrder, id: `temp_${Date.now()}` }],
    () => close_()
  );
  const updateM = useOptimisticMutation(
    ({ id, d }) => base44.entities.Order.update(id, d),
    'orders',
    (prev, { id, d }) => prev.map(o => o.id === id ? { ...o, ...d } : o),
    () => close_()
  );
  const deleteM = useOptimisticMutation(
    id => base44.entities.Order.delete(id),
    'orders',
    (prev, id) => prev.filter(o => o.id !== id)
  );

  const handleOcrImport = async (file) => {
    if (!file) return;
    setOcrFile(file);
    setOcrLoading(true);
    setOcrDone(false);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Extrae todos los datos del siguiente documento de pedido/albarán/factura de compra.
Devuelve un JSON con exactamente esta estructura:
{
  "order_number": "número de pedido o albarán si existe, si no cadena vacía",
  "supplier": "nombre del proveedor/vendedor",
  "date": "fecha en formato YYYY-MM-DD, si no hay usa la fecha de hoy",
  "notes": "observaciones o comentarios relevantes",
  "items": [
    {
      "material_name": "descripción del artículo",
      "quantity": número,
      "unit": "unidad (ud, m, kg, etc)",
      "unit_price": número con decimales,
      "total_price": número con decimales
    }
  ]
}
Si no encuentras algún campo déjalo vacío/0. Extrae TODAS las líneas de artículos que aparezcan.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          order_number: { type: 'string' },
          supplier: { type: 'string' },
          date: { type: 'string' },
          notes: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                material_name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                unit_price: { type: 'number' },
                total_price: { type: 'number' },
              }
            }
          }
        }
      }
    });
    const data = result;
    const items = (data.items || []).map(it => ({
      material_id: '',
      material_name: it.material_name || '',
      quantity: it.quantity || 1,
      unit: it.unit || '',
      unit_price: it.unit_price || 0,
      total_price: it.total_price || (it.quantity * it.unit_price) || 0,
    }));
    const total_amount = items.reduce((s, it) => s + (it.total_price || 0), 0);
    setForm(p => ({
      ...p,
      order_number: data.order_number || p.order_number,
      supplier: data.supplier || p.supplier,
      date: data.date || p.date,
      notes: data.notes || p.notes,
      items,
      total_amount,
    }));
    setUploadedFiles(prev => [...prev, { name: file.name, url: file_url, type: file.name.split('.').pop()?.toLowerCase() }]);
    setOcrLoading(false);
    setOcrDone(true);
  };

  const open_ = (o = null) => { setEditing(o); setForm(o ? { ...o, items: o.items || [] } : emptyOrder); setUploadedFiles([]); setOcrFile(null); setOcrDone(false); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyOrder); };
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleClientChange = (id) => {
    const c = clients.find(c => c.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };

  // Items management
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { ...emptyItem }] }));
  const removeItem = (i) => setForm(p => {
    const items = p.items.filter((_, idx) => idx !== i);
    return { ...p, items, total_amount: items.reduce((s, it) => s + (it.total_price || 0), 0) };
  });
  const updateItem = (i, field, val) => setForm(p => {
    const items = [...p.items];
    items[i] = { ...items[i], [field]: val };
    if (field === 'quantity' || field === 'unit_price') {
      items[i].total_price = (parseFloat(items[i].quantity) || 0) * (parseFloat(items[i].unit_price) || 0);
    }
    const total_amount = items.reduce((s, it) => s + (it.total_price || 0), 0);
    return { ...p, items, total_amount };
  });
  const selectMaterial = (i, matId) => {
    const mat = materials.find(m => m.id === matId);
    if (!mat) return;
    setForm(p => {
      const items = [...p.items];
      items[i] = {
        ...items[i],
        material_id: mat.id,
        material_name: mat.name,
        unit: mat.unit || '',
        unit_price: mat.unit_price || 0,
        total_price: (parseFloat(items[i].quantity) || 1) * (mat.unit_price || 0),
      };
      return { ...p, items, total_amount: items.reduce((s, it) => s + (it.total_price || 0), 0) };
    });
  };

  const handleFileUpload = async (file) => {
    setUploadingFile(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const ext = file.name.split('.').pop()?.toLowerCase();
    setUploadedFiles(prev => [...prev, { name: file.name, url: file_url, type: ext }]);
    setUploadingFile(false);
  };

  const handleSave = () => {
    const data = {
      ...form,
      total_amount: form.items.reduce((s, it) => s + (it.total_price || 0), 0),
      attached_files: uploadedFiles,
    };
    if (editing) updateM.mutate({ id: editing.id, d: data });
    else createM.mutate(data);
  };

  const quickStatus = (order, newStatus) => {
    updateM.mutate({ id: order.id, d: { status: newStatus } });
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchQ = !search || o.project?.toLowerCase().includes(q) || o.client_name?.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q) || o.supplier?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || o.status === statusFilter;
    const matchC = clientFilter === 'all' || o.client_id === clientFilter;
    return matchQ && matchS && matchC;
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary" /> {t('orders')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} pedidos</p>
        </div>
        <Button onClick={() => open_()} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('new_order')}</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('search') + '...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={clientFilter} onValueChange={setClientFilter} placeholder={t('client')} triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">{t('all')}</MobileSelectItem>
          {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={statusFilter} onValueChange={setStatusFilter} placeholder={t('status')} triggerClassName="w-full sm:w-40">
          <MobileSelectItem value="all">{t('all')}</MobileSelectItem>
          {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap mb-6">
        {Object.entries(statusCfg).map(([k, v]) => {
          const count = orders.filter(o => o.status === k).length;
          if (!count) return null;
          return <Badge key={k} variant="outline" className={`${v.className} text-xs`}>{v.label}: {count}</Badge>;
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay pedidos</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> {t('new_order')}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = statusCfg[order.status] || statusCfg.pendiente;
            const isExpanded = expandedId === order.id;
            return (
              <Card key={order.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.order_number && <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{order.order_number}</span>}
                        <h3 className="font-semibold text-sm truncate">{order.project}</h3>
                        <Badge variant="outline" className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>{order.client_name}</span>
                        {order.supplier && <span>· {order.supplier}</span>}
                        {order.date && <span>· {format(parseISO(order.date), 'd MMM yyyy', { locale: es })}</span>}
                        {showPrices && order.total_amount > 0 && <span className="font-semibold text-foreground">· {order.total_amount.toFixed(2)} €</span>}
                      </div>
                      {order.tracking_number && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Truck className="w-3 h-3" /> {order.tracking_number}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick status change */}
                      <Select value={order.status} onValueChange={v => quickStatus(order, v)}>
                        <SelectTrigger className="h-7 w-32 text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusCfg).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(order)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle><AlertDialogDescription>El pedido será eliminado permanentemente.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(order.id)} className="bg-destructive text-destructive-foreground">{t('delete')}</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
                {/* Expanded items */}
                {isExpanded && order.items?.length > 0 && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">LÍNEAS DEL PEDIDO</p>
                    <div className="space-y-1.5">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                           <span className="font-medium">{item.material_name}</span>
                           <div className="flex items-center gap-4 text-muted-foreground">
                             <span>{item.quantity} {item.unit}</span>
                             {showPrices && item.unit_price > 0 && <span>{item.unit_price.toFixed(2)} €/{item.unit}</span>}
                             {showPrices && item.total_price > 0 && <span className="font-semibold text-foreground">{item.total_price.toFixed(2)} €</span>}
                           </div>
                         </div>
                      ))}
                    </div>
                    {order.notes && <p className="text-xs text-muted-foreground mt-2 italic">{order.notes}</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('edit') : t('new_order')}</DialogTitle></DialogHeader>
          <Tabs defaultValue="datos">
            <TabsList className="mb-4">
              <TabsTrigger value="datos">📋 Datos del pedido</TabsTrigger>
              <TabsTrigger value="importar">✨ Importar OCR</TabsTrigger>
              <TabsTrigger value="archivos">📎 Archivos</TabsTrigger>
            </TabsList>
          <TabsContent value="datos">
          <div className="space-y-4 py-2">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('order_number')}</Label>
                <Input value={form.order_number} onChange={e => setField('order_number', e.target.value)} placeholder="PED-001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('status')}</Label>
                <MobileSelect value={form.status} onValueChange={v => setField('status', v)} placeholder="Estado">
                  {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('client')} *</Label>
                <MobileSelect value={form.client_id} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
                  {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('project')} *</Label>
                <Input value={form.project} onChange={e => setField('project', e.target.value)} placeholder="Obra..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('date')}</Label>
                <Input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('expected_delivery')}</Label>
                <Input type="date" value={form.expected_delivery} onChange={e => setField('expected_delivery', e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">{t('supplier')}</Label>
                <Input value={form.supplier} onChange={e => setField('supplier', e.target.value)} placeholder="Nombre del proveedor" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">{t('tracking')}</Label>
                <Input value={form.tracking_number} onChange={e => setField('tracking_number', e.target.value)} placeholder="Número de seguimiento..." />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Líneas del pedido</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-8 text-xs gap-1"><Plus className="w-3 h-3" /> {t('add')}</Button>
              </div>
              {form.items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">Sin líneas. Pulsa "Añadir" para agregar materiales.</p>
              )}
              {form.items.map((item, i) => (
                <div key={i} className="bg-muted/40 rounded-lg p-3 space-y-2">
                  <div className="flex gap-2">
                    <MobileSelect value={item.material_id} onValueChange={v => selectMaterial(i, v)} placeholder="Material..." triggerClassName="flex-1 h-8 text-xs">
                      <MobileSelectItem value="_manual">— Introducir manualmente —</MobileSelectItem>
                      {materials.map(m => <MobileSelectItem key={m.id} value={m.id}>{m.name} {m.unit_price > 0 ? `(${m.unit_price}€/${m.unit})` : ''}</MobileSelectItem>)}
                    </MobileSelect>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeItem(i)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                  {(item.material_id === '_manual' || !item.material_id) && (
                    <Input placeholder="Nombre del material" value={item.material_name} onChange={e => updateItem(i, 'material_name', e.target.value)} className="h-8 text-xs" />
                  )}
                  <div className={`grid gap-2 ${showPrices ? 'grid-cols-4' : 'grid-cols-2'}`}>
                    <Input type="number" placeholder="Cant." value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="h-8 text-xs" min="0" step="0.01" />
                    <Input placeholder="Ud." value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} className="h-8 text-xs" />
                    {showPrices && <Input type="number" placeholder="€/ud" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} className="h-8 text-xs" min="0" step="0.01" />}
                    {showPrices && <div className="h-8 flex items-center justify-end text-xs font-semibold text-primary">{(item.total_price || 0).toFixed(2)} €</div>}
                  </div>
                </div>
              ))}
              {showPrices && form.items.length > 0 && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-lg font-bold text-primary">{form.total_amount?.toFixed(2) || '0.00'} €</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('notes')}</Label>
              <Textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
          </div>
          </TabsContent>

          <TabsContent value="importar">
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Importar pedido con OCR + IA</p>
                    <p className="text-xs text-muted-foreground mt-1">Sube una foto, PDF o imagen del pedido/albarán. La IA extraerá automáticamente los datos del pedido y todas las líneas de artículos.</p>
                  </div>
                </div>
              </div>
              <label className={`block border-2 border-dashed rounded-lg h-32 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${ocrLoading ? 'opacity-60 pointer-events-none' : 'hover:bg-muted/30'} ${ocrDone ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20' : 'border-primary/30'}`}>
                {ocrLoading ? (
                  <>
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                    <p className="text-xs text-primary font-medium">Analizando documento con IA...</p>
                    <p className="text-[10px] text-muted-foreground">Esto puede tardar unos segundos</p>
                  </>
                ) : ocrDone ? (
                  <>
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    <p className="text-xs text-emerald-700 font-semibold">¡Datos importados correctamente!</p>
                    <p className="text-[10px] text-muted-foreground">Revisa la pestaña "Datos del pedido"</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground font-medium">Subir foto o PDF del pedido</p>
                    <p className="text-[10px] text-muted-foreground">PDF, imagen (JPG, PNG), Excel</p>
                  </>
                )}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx" className="hidden"
                  onChange={e => e.target.files[0] && handleOcrImport(e.target.files[0])} />
              </label>
              {ocrFile && !ocrLoading && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> {ocrFile.name}
                </p>
              )}
              {ocrDone && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Resumen extraído:</p>
                  <p className="text-xs text-emerald-600">· {form.items.length} línea(s) de artículos</p>
                  {form.supplier && <p className="text-xs text-emerald-600">· Proveedor: {form.supplier}</p>}
                  {form.order_number && <p className="text-xs text-emerald-600">· Nº pedido: {form.order_number}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Puedes editar los datos en la pestaña "Datos del pedido".</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="archivos">
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Sube el pedido en formato PDF, Excel o Word.</p>
              <label className="block border-2 border-dashed rounded-lg h-28 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors">
                {uploadingFile ? <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /> : <Upload className="w-7 h-7 text-muted-foreground" />}
                <p className="text-xs text-muted-foreground">{uploadingFile ? 'Subiendo...' : 'Subir PDF, Excel (.xlsx), Word (.docx)'}</p>
                <input type="file" accept=".pdf,.xls,.xlsx,.doc,.docx" className="hidden"
                  onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
              </label>
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 border rounded-lg bg-muted/30">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs flex-1 font-medium truncate">{f.name}</span>
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                      </a>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {/* Show existing files if editing */}
              {editing?.attached_files?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Archivos existentes:</p>
                  {editing.attached_files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 border rounded-lg bg-muted/20">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-xs flex-1 truncate">{f.name}</span>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />Ver</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={!form.client_id || !form.project || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}