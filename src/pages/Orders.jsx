import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/layout/PageHeader';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { extraerDatosPedido, evaluarPrecisionPedido, reprocesarPrecisionPedido } from '@/lib/ocrPedidos';
import { toast } from 'sonner';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { useI18n } from '@/lib/i18n';
import { Plus, Search, Pencil, Trash2, ShoppingCart, Loader2, Save, Package, X, ChevronDown, ChevronUp, Upload, FileText, ExternalLink, Eye, Download, Sparkles, CheckCircle2 } from 'lucide-react';
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
import ObraSelector from '@/components/gastos/ObraSelector';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// Estados reales del esquema de la entidad Order (estado: pendiente, en_curso, entregado, cancelado)
const statusCfg = {
  pendiente: { label: 'Pendiente',  className: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_curso:  { label: 'En curso',   className: 'bg-blue-100 text-blue-700 border-blue-200' },
  entregado: { label: 'Entregado',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelado: { label: 'Cancelado',  className: 'bg-red-100 text-red-700 border-red-200' },
};

const emptyOrder = {
  title: '', obra_id: '', obra_name: '', proveedor: '',
  fecha_pedido: new Date().toISOString().split('T')[0], fecha_entrega: '',
  estado: 'pendiente', importe: 0, items: [], notas: '', file_url: '',
};
const emptyItem = { nombre: '', cantidad: 1, unidad: '', precio: 0 };

export default function Orders() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { role } = useUserRole();

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['obras'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);
  const showPrices = role === 'admin';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [obraFilter, setObraFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyOrder);
  const [expandedId, setExpandedId] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [ocrError, setOcrError] = useState('');

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['orders'], queryFn: () => base44.entities.Order.list('-fecha_pedido', 300) });
  const { data: materials = [] } = useQuery({ queryKey: ['material_catalog'], queryFn: () => base44.entities.MaterialCatalog.list('name', 500) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list('name', 300) });

  // Genera el código legible (PED-26-0000X) y lo guarda en el campo real del esquema: `title`
  const asignarIdOrder = async (id) => {
    try { await base44.functions.invoke('generarIdUnico', { entidad: 'Order', record_id: id, campo_id: 'title' }); } catch {}
    qc.invalidateQueries({ queryKey: ['orders'] });
  };
  const createM = useOptimisticMutation(
    d => base44.entities.Order.create(d),
    'orders',
    (prev, newOrder) => [...prev, { ...newOrder, id: `temp_${Date.now()}` }],
    (rec) => { if (rec?.id) asignarIdOrder(rec.id); close_(); }
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
    setOcrError('');
    try {
      // Subida nativa Base44 (Core.UploadFile, plan Starter) — mismo patrón que el módulo de gastos
      const subida = await base44.integrations.Core.UploadFile({ file });
      const file_url = subida?.file_url;
      if (!file_url) throw new Error('No se pudo subir el archivo al almacenamiento');

      // 1) Pasada primaria: InvokeLLM nativo (modelo por defecto, plan Starter, ~1 crédito)
      const primaria = await extraerDatosPedido(file_url);
      if (primaria.error) throw new Error(primaria.error);
      let data = primaria.datos;

      // 2) Evaluar si necesita refuerzo
      const { precisa, motivo } = evaluarPrecisionPedido(data);
      let usRefuerzo = false;
      if (precisa) {
        // 3) Refuerzo: modelo superior gemini_3_flash (plan superior, ~5 créditos)
        toast.info('Mejorando precisión con IA superior…');
        const refuerzo = await reprocesarPrecisionPedido(file_url);
        if (!refuerzo.error && refuerzo.datos) {
          data = refuerzo.datos;
          usRefuerzo = true;
        } else if (refuerzo.error) {
          // Si el refuerzo falla, nos quedamos con la pasada primaria
          console.warn('Refuerzo IA falló (' + motivo + '):', refuerzo.error);
        }
      }

      const items = (data.items || []).map(it => ({
        nombre: it.nombre || '',
        cantidad: it.cantidad || 1,
        unidad: it.unidad || '',
        precio: it.precio || 0,
      }));
      const importe = items.reduce((s, it) => s + ((it.cantidad || 0) * (it.precio || 0)), 0);
      setForm(p => ({
        ...p,
        title: data.order_number || p.title,
        proveedor: data.supplier || p.proveedor,
        fecha_pedido: data.date || p.fecha_pedido,
        notas: data.notes || p.notas,
        items,
        importe,
        file_url: file_url || p.file_url,
      }));
      setOcrDone(true);
    } catch (e) {
      console.error('OCR pedido error:', e);
      setOcrError(e?.message || 'Error al analizar el documento');
      toast.error('No se pudo procesar el documento: ' + (e?.message || 'error desconocido'));
    } finally {
      setOcrLoading(false);
    }
  };

  const open_ = (o = null) => { setEditing(o); setForm(o ? { ...o, items: o.items || [] } : emptyOrder); setOcrFile(null); setOcrDone(false); setOcrError(''); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyOrder); };
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Items management
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { ...emptyItem }] }));
  const removeItem = (i) => setForm(p => {
    const items = p.items.filter((_, idx) => idx !== i);
    return { ...p, items, importe: items.reduce((s, it) => s + ((it.cantidad || 0) * (it.precio || 0)), 0) };
  });
  const updateItem = (i, field, val) => setForm(p => {
    const items = [...p.items];
    items[i] = { ...items[i], [field]: val };
    const importe = items.reduce((s, it) => s + ((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0)), 0);
    return { ...p, items, importe };
  });
  const selectMaterial = (i, matId) => {
    const mat = materials.find(m => m.id === matId);
    if (!mat) return;
    setForm(p => {
      const items = [...p.items];
      items[i] = {
        ...items[i],
        nombre: mat.name,
        unidad: mat.unit || '',
        precio: mat.unit_price || 0,
      };
      return { ...p, items, importe: items.reduce((s, it) => s + ((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0)), 0) };
    });
  };

  const handleFileUpload = async (file) => {
    setUploadingFile(true);
    try {
      const subida = await base44.integrations.Core.UploadFile({ file });
      const file_url = subida?.file_url;
      if (!file_url) throw new Error('No se pudo subir el archivo');
      setForm(p => ({ ...p, file_url }));
      toast.success('Documento adjuntado');
    } catch (e) {
      console.error('Upload pedido error:', e);
      toast.error('No se pudo subir el documento: ' + (e?.message || 'error desconocido'));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSave = () => {
    const data = {
      ...form,
      items: form.items.map(it => ({
        nombre: it.nombre || '',
        cantidad: parseFloat(it.cantidad) || 0,
        unidad: it.unidad || '',
        precio: parseFloat(it.precio) || 0,
      })),
      importe: form.items.reduce((s, it) => s + ((parseFloat(it.cantidad) || 0) * (parseFloat(it.precio) || 0)), 0),
    };
    if (editing) updateM.mutate({ id: editing.id, d: data });
    else createM.mutate(data);
  };

  const quickStatus = (order, newStatus) => {
    updateM.mutate({ id: order.id, d: { estado: newStatus } });
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const matchQ = !search || o.title?.toLowerCase().includes(q) || o.obra_name?.toLowerCase().includes(q) || o.proveedor?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || o.estado === statusFilter;
    const matchO = obraFilter === 'all' || o.obra_name === obraFilter;
    return matchQ && matchS && matchO;
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t('orders')}
        subtitle={`${filtered.length} pedidos`}
        hideBack={true}
        actions={<Button onClick={() => open_()} size="sm" className="gap-2 shadow-sm"><Plus className="w-4 h-4" /><span className="hidden sm:inline">{t('new_order')}</span></Button>}
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('search') + '...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={obraFilter} onValueChange={setObraFilter} placeholder="Obra" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">{t('all')}</MobileSelectItem>
          {obras.map(o => <MobileSelectItem key={o.id} value={o.name}>{o.name}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={statusFilter} onValueChange={setStatusFilter} placeholder={t('status')} triggerClassName="w-full sm:w-40">
          <MobileSelectItem value="all">{t('all')}</MobileSelectItem>
          {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap mb-6">
        {Object.entries(statusCfg).map(([k, v]) => {
          const count = orders.filter(o => o.estado === k).length;
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
            const cfg = statusCfg[order.estado] || statusCfg.pendiente;
            const isExpanded = expandedId === order.id;
            const importeTotal = (order.items || []).reduce((s, it) => s + ((it.cantidad || 0) * (it.precio || 0)), 0) || order.importe || 0;
            return (
              <Card key={order.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {order.title && <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{order.title}</span>}
                        <h3 className="font-semibold text-sm truncate">{order.obra_name || <span className="text-muted-foreground italic">Sin obra</span>}</h3>
                        <Badge variant="outline" className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {order.proveedor && <span>{order.proveedor}</span>}
                        {order.fecha_pedido && <span>· {format(parseISO(order.fecha_pedido), 'd MMM yyyy', { locale: es })}</span>}
                        {showPrices && importeTotal > 0 && <span className="font-semibold text-foreground">· {importeTotal.toFixed(2)} €</span>}
                        {order.fecha_entrega && <span className="text-amber-600">· Entrega: {format(parseISO(order.fecha_entrega), 'd MMM yyyy', { locale: es })}</span>}
                      </div>
                      {order.notas && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{order.notas}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick status change */}
                      <Select value={order.estado} onValueChange={v => quickStatus(order, v)}>
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
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3">
                    {order.items?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">LÍNEAS DEL PEDIDO</p>
                        <div className="space-y-1.5">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-card rounded-lg px-3 py-2">
                              <span className="font-medium">{item.nombre || '—'}</span>
                              <div className="flex items-center gap-4 text-muted-foreground">
                                <span>{item.cantidad || 0} {item.unidad || ''}</span>
                                {showPrices && item.precio > 0 && <span>{item.precio.toFixed(2)} €/{item.unidad || 'ud'}</span>}
                                {showPrices && <span className="font-semibold text-foreground">{((item.cantidad || 0) * (item.precio || 0)).toFixed(2)} €</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {order.notas && <p className="text-xs text-muted-foreground italic">{order.notas}</p>}
                    {order.file_url && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">DOCUMENTO ADJUNTO</p>
                        <div className="flex items-center gap-2 text-xs bg-card rounded-lg px-3 py-2">
                          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="flex-1 truncate font-medium">Documento del pedido</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <a href={order.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Eye className="w-3 h-3" /> Ver
                            </a>
                            <a href={order.file_url} download className="flex items-center gap-1 text-muted-foreground hover:underline">
                              <Download className="w-3 h-3" /> Descargar
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      </div>
      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pb-[env(keyboard-inset-height,0)]">
          <DialogHeader><DialogTitle>{editing ? t('edit') : t('new_order')}</DialogTitle></DialogHeader>
          <Tabs defaultValue="datos">
            <TabsList className="mb-4">
              <TabsTrigger value="datos">📋 Datos del pedido</TabsTrigger>
              <TabsTrigger value="importar">✨ Importar OCR</TabsTrigger>
              <TabsTrigger value="archivos">📎 Archivo</TabsTrigger>
            </TabsList>
          <TabsContent value="datos">
          <div className="space-y-4 py-2">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nº de pedido</Label>
                <Input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="PED-001 (se autogenera si vacío)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('status')}</Label>
                <MobileSelect value={form.estado} onValueChange={v => setField('estado', v)} placeholder="Estado">
                  {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5 col-span-2">
                <ObraSelector
                  value={form.obra_id}
                  obraName={form.obra_name}
                  onChange={(o) => setForm(p => ({ ...p, obra_id: o.obra_id || '', obra_name: o.obra_name || '' }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha pedido</Label>
                <Input type="date" value={form.fecha_pedido} onChange={e => setField('fecha_pedido', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha entrega</Label>
                <Input type="date" value={form.fecha_entrega} onChange={e => setField('fecha_entrega', e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Proveedor</Label>
                <Input value={form.proveedor} onChange={e => setField('proveedor', e.target.value)} placeholder="Nombre del proveedor" />
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
                    <MobileSelect value={item.nombre} onValueChange={v => selectMaterial(i, v)} placeholder="Material..." triggerClassName="flex-1 h-8 text-xs">
                      <MobileSelectItem value="_manual">— Introducir manualmente —</MobileSelectItem>
                      {materials.map(m => <MobileSelectItem key={m.id} value={m.id}>{m.name} {m.unit_price > 0 ? `(${m.unit_price}€/${m.unit})` : ''}</MobileSelectItem>)}
                    </MobileSelect>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeItem(i)}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                  {(item.nombre === '_manual' || !item.nombre || !materials.find(m => m.id === item.nombre)) && (
                    <Input placeholder="Nombre del material" value={item.nombre === '_manual' ? '' : item.nombre} onChange={e => updateItem(i, 'nombre', e.target.value)} className="h-8 text-xs" />
                  )}
                  <div className={`grid gap-2 ${showPrices ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <Input type="number" placeholder="Cant." value={item.cantidad} onChange={e => updateItem(i, 'cantidad', e.target.value)} className="h-8 text-xs" min="0" step="0.01" />
                    <Input placeholder="Ud." value={item.unidad} onChange={e => updateItem(i, 'unidad', e.target.value)} className="h-8 text-xs" />
                    {showPrices && <Input type="number" placeholder="€/ud" value={item.precio} onChange={e => updateItem(i, 'precio', e.target.value)} className="h-8 text-xs" min="0" step="0.01" />}
                  </div>
                </div>
              ))}
              {showPrices && form.items.length > 0 && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <span className="text-sm text-muted-foreground">Total:</span>
                  <span className="text-lg font-bold text-primary">{form.importe?.toFixed(2) || '0.00'} €</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t('notes')}</Label>
              <Textarea value={form.notas} onChange={e => setField('notas', e.target.value)} rows={2} placeholder="Observaciones..." />
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
              {ocrError && !ocrLoading && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-0.5">No se pudo procesar el documento</p>
                  <p className="text-xs text-red-600">{ocrError}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Prueba con otra imagen/PDF o rellena los datos manualmente.</p>
                </div>
              )}
              {ocrDone && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Resumen extraído:</p>
                  <p className="text-xs text-emerald-600">· {form.items.length} línea(s) de artículos</p>
                  {form.proveedor && <p className="text-xs text-emerald-600">· Proveedor: {form.proveedor}</p>}
                  {form.title && <p className="text-xs text-emerald-600">· Nº pedido: {form.title}</p>}
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
              {form.file_url && (
                <div className="flex items-center gap-3 p-2.5 border rounded-lg bg-muted/30">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs flex-1 font-medium truncate">Documento adjunto</span>
                  <a href={form.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setForm(p => ({ ...p, file_url: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={!form.title || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}