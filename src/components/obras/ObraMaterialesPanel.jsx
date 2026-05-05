import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Plus, Trash2, Loader2, Save, Upload, Sparkles, CheckCircle2,
  FileText, X, ExternalLink, Package, Wrench, Truck, HardHat,
  MoreHorizontal, ChevronDown, ChevronUp, Terminal, Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPOS = [
  { key: 'material',     label: 'Material',      icon: Package,      color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'herramienta',  label: 'Herramienta',   icon: Wrench,       color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'maquinaria',   label: 'Maquinaria',    icon: HardHat,      color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'subcontrata',  label: 'Subcontrata',   icon: HardHat,      color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'transporte',   label: 'Transporte',    icon: Truck,        color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { key: 'varios',       label: 'Varios',        icon: MoreHorizontal, color: 'bg-gray-50 text-gray-700 border-gray-200' },
];
const tipoCfg = Object.fromEntries(TIPOS.map(t => [t.key, t]));

const emptyForm = {
  tipo: 'material', nombre: '', referencia: '', proveedor: '',
  cantidad: '', unidad: 'ud', precio_unidad: '', precio_total: '',
  fecha: new Date().toISOString().split('T')[0], num_documento: '',
  file_url: '', notas: '',
};

export default function ObraMaterialesPanel({ obra }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [cmdInput, setCmdInput] = useState('');
  const [cmdLoading, setCmdLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [inputMode, setInputMode] = useState('form'); // 'form' | 'ocr' | 'cmd'

  const { data: materiales = [], isLoading } = useQuery({
    queryKey: ['obra_materiales', obra.id],
    queryFn: () => base44.entities.ObraMaterial.filter({ obra_id: obra.id }, '-fecha', 500),
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.ObraMaterial.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['obra_materiales', obra.id] }); toast.success('Material añadido'); closeDialog(); },
    onError: () => toast.error('Error al guardar'),
  });
  const createBulkM = useMutation({
    mutationFn: items => base44.entities.ObraMaterial.bulkCreate(items),
    onSuccess: (_, items) => { qc.invalidateQueries({ queryKey: ['obra_materiales', obra.id] }); toast.success(`${items.length} partidas añadidas`); closeDialog(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.ObraMaterial.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['obra_materiales', obra.id] }); toast.success('Actualizado'); closeDialog(); },
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.ObraMaterial.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['obra_materiales', obra.id] }),
  });

  const openDialog = (item = null) => {
    setEditing(item);
    setForm(item ? { ...item, cantidad: item.cantidad || '', precio_unidad: item.precio_unidad || '', precio_total: item.precio_total || '' } : emptyForm);
    setOcrDone(false);
    setInputMode('form');
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); setOcrDone(false); setCmdInput(''); };
  const set = (k, v) => setForm(p => {
    const upd = { ...p, [k]: v };
    // Auto-calc total
    if (k === 'cantidad' || k === 'precio_unidad') {
      const q = parseFloat(k === 'cantidad' ? v : upd.cantidad) || 0;
      const pu = parseFloat(k === 'precio_unidad' ? v : upd.precio_unidad) || 0;
      if (q && pu) upd.precio_total = (q * pu).toFixed(2);
    }
    return upd;
  });

  // OCR from file/photo
  const handleOcrUpload = async (file) => {
    setUploading(true); setOcrDone(false);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    setUploading(false);
    setOcrLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analiza este documento (albarán, presupuesto o factura de obra) y extrae TODAS las líneas de materiales/partidas.
Para cada partida devuelve un objeto con:
- nombre: descripción del material o servicio
- referencia: código/referencia si aparece (null si no)
- proveedor: nombre del proveedor/empresa emisora del documento (null si no)
- cantidad: número (null si no aparece)
- unidad: unidad de medida (ud, m, m², kg, l, etc.) o "ud" por defecto
- precio_unidad: precio unitario en euros como número (null si no)
- precio_total: precio total de la línea en euros como número (null si no)
- tipo: uno de: material, herramienta, maquinaria, subcontrata, transporte, varios (el más apropiado)
- fecha: fecha del documento en formato YYYY-MM-DD (null si no)
- num_documento: número de albarán/factura/presupuesto (null si no)

Si es un documento con una sola partida, devuelve un array con un elemento.
Devuelve SOLO el JSON, sin texto adicional.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            partidas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nombre: { type: 'string' }, referencia: { type: 'string' },
                  proveedor: { type: 'string' }, cantidad: { type: 'number' },
                  unidad: { type: 'string' }, precio_unidad: { type: 'number' },
                  precio_total: { type: 'number' }, tipo: { type: 'string' },
                  fecha: { type: 'string' }, num_documento: { type: 'string' },
                }
              }
            }
          }
        }
      });
      const partidas = res.partidas || [];
      if (partidas.length === 1) {
        const p = partidas[0];
        setForm(prev => ({
          ...prev,
          file_url,
          nombre: p.nombre || prev.nombre,
          referencia: p.referencia || prev.referencia,
          proveedor: p.proveedor || prev.proveedor,
          cantidad: p.cantidad ?? prev.cantidad,
          unidad: p.unidad || prev.unidad,
          precio_unidad: p.precio_unidad ?? prev.precio_unidad,
          precio_total: p.precio_total ?? (p.cantidad && p.precio_unidad ? p.cantidad * p.precio_unidad : prev.precio_total),
          tipo: p.tipo && tipoCfg[p.tipo] ? p.tipo : prev.tipo,
          fecha: p.fecha || prev.fecha,
          num_documento: p.num_documento || prev.num_documento,
        }));
        toast.success('Datos extraídos — revisa y guarda');
      } else if (partidas.length > 1) {
        // Multiple: store them for bulk confirm
        setForm(prev => ({ ...prev, file_url, _bulk: partidas }));
        toast.success(`${partidas.length} partidas detectadas — confirma para guardar todas`);
      }
      setOcrDone(true);
    } catch {
      toast.error('No se pudo extraer datos del documento');
    }
    setOcrLoading(false);
  };

  // Natural language command
  const handleCmd = async () => {
    if (!cmdInput.trim()) return;
    setCmdLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `El usuario quiere añadir un material a una obra de construcción. Su descripción es:
"${cmdInput}"

Extrae los datos y devuelve un JSON con:
- nombre: descripción clara del material (requerido)
- tipo: uno de: material, herramienta, maquinaria, subcontrata, transporte, varios
- referencia: código si se menciona (null si no)
- proveedor: proveedor si se menciona (null si no)
- cantidad: número (null si no se menciona)
- unidad: ud, m, m², kg, l, etc. (null si no se menciona)
- precio_unidad: precio unitario en euros (null si no se menciona)
- precio_total: precio total en euros (null si no se menciona)
- notas: cualquier info adicional no encajada en los otros campos`,
        response_json_schema: {
          type: 'object',
          properties: {
            nombre: { type: 'string' }, tipo: { type: 'string' },
            referencia: { type: 'string' }, proveedor: { type: 'string' },
            cantidad: { type: 'number' }, unidad: { type: 'string' },
            precio_unidad: { type: 'number' }, precio_total: { type: 'number' },
            notas: { type: 'string' },
          }
        }
      });
      setForm(prev => ({
        ...prev,
        nombre: res.nombre || prev.nombre,
        tipo: res.tipo && tipoCfg[res.tipo] ? res.tipo : prev.tipo,
        referencia: res.referencia || prev.referencia,
        proveedor: res.proveedor || prev.proveedor,
        cantidad: res.cantidad ?? prev.cantidad,
        unidad: res.unidad || prev.unidad,
        precio_unidad: res.precio_unidad ?? prev.precio_unidad,
        precio_total: res.precio_total ?? (res.cantidad && res.precio_unidad ? res.cantidad * res.precio_unidad : prev.precio_total),
        notas: res.notas || prev.notas,
      }));
      setInputMode('form');
      toast.success('Datos interpretados — revisa y guarda');
    } catch {
      toast.error('No se pudo interpretar el comando');
    }
    setCmdLoading(false);
  };

  const handleSave = () => {
    // Bulk save from OCR
    if (form._bulk) {
      const items = form._bulk.map(p => ({
        obra_id: obra.id, obra_name: obra.name,
        nombre: p.nombre, tipo: tipoCfg[p.tipo] ? p.tipo : 'material',
        referencia: p.referencia || '', proveedor: p.proveedor || '',
        cantidad: p.cantidad || null, unidad: p.unidad || 'ud',
        precio_unidad: p.precio_unidad || null,
        precio_total: p.precio_total || (p.cantidad && p.precio_unidad ? p.cantidad * p.precio_unidad : null),
        fecha: p.fecha || form.fecha, num_documento: p.num_documento || '',
        file_url: form.file_url, notas: '',
      }));
      createBulkM.mutate(items);
      return;
    }
    const data = {
      obra_id: obra.id, obra_name: obra.name,
      ...form,
      cantidad: parseFloat(form.cantidad) || null,
      precio_unidad: parseFloat(form.precio_unidad) || null,
      precio_total: parseFloat(form.precio_total) || null,
    };
    if (editing) updateM.mutate({ id: editing.id, d: data });
    else createM.mutate(data);
  };

  // Group by tipo for tab display
  const byTipo = TIPOS.reduce((acc, t) => {
    acc[t.key] = materiales.filter(m => m.tipo === t.key);
    return acc;
  }, {});

  const displayList = activeTab === 'all' ? materiales : (byTipo[activeTab] || []);

  const totalCost = materiales.reduce((s, m) => s + (m.precio_total || 0), 0);
  const tipesWithItems = TIPOS.filter(t => byTipo[t.key]?.length > 0);

  const isPending = createM.isPending || updateM.isPending || createBulkM.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{materiales.length} partidas</p>
          {totalCost > 0 && <span className="text-sm font-semibold text-primary">{totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € total</span>}
        </div>
        <Button onClick={() => openDialog()} size="sm" className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Añadir material
        </Button>
      </div>

      {/* Category tabs */}
      {tipesWithItems.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all" className="text-xs h-7">Todos ({materiales.length})</TabsTrigger>
            {tipesWithItems.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs h-7">
                {t.label} ({byTipo[t.key].length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Subtotal by tipo */}
      {tipesWithItems.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {tipesWithItems.map(t => {
            const sub = byTipo[t.key].reduce((s, m) => s + (m.precio_total || 0), 0);
            if (!sub) return null;
            return (
              <Badge key={t.key} variant="outline" className={`text-xs ${t.color}`}>
                {t.label}: {sub.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </Badge>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-2">Sin materiales registrados</p>
          <Button variant="outline" size="sm" onClick={() => openDialog()} className="gap-2"><Plus className="w-3.5 h-3.5" /> Añadir</Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden divide-y divide-border">
          {displayList.map(m => {
            const tc = tipoCfg[m.tipo] || tipoCfg.varios;
            const Icon = tc.icon;
            const isExp = expandedId === m.id;
            return (
              <div key={m.id} className="bg-card hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${tc.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{m.nombre}</span>
                      {m.referencia && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{m.referencia}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.proveedor && <span>{m.proveedor}</span>}
                      {m.cantidad && <span className="ml-1">· {m.cantidad} {m.unidad}</span>}
                      {m.fecha && <span className="ml-1">· {format(parseISO(m.fecha), 'd MMM yyyy', { locale: es })}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.precio_total > 0 && <span className="text-sm font-bold text-primary">{m.precio_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(isExp ? null : m.id)}>
                      {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog(m)}>
                      <FileText className="w-3 h-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar partida?</AlertDialogTitle><AlertDialogDescription>"{m.nombre}" será eliminada permanentemente.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteM.mutate(m.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {isExp && (
                  <div className="px-4 pb-3 pt-0 bg-muted/20 text-xs space-y-1 text-muted-foreground">
                    {m.num_documento && <p>Documento: <span className="font-medium text-foreground">{m.num_documento}</span></p>}
                    {m.precio_unidad > 0 && <p>Precio unitario: <span className="font-medium text-foreground">{m.precio_unidad.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/{m.unidad}</span></p>}
                    {m.notas && <p className="italic">{m.notas}</p>}
                    {m.file_url && (
                      <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
                        <ExternalLink className="w-3 h-3" /> Ver documento adjunto
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Total footer */}
          {totalCost > 0 && (
            <div className="flex justify-between items-center px-4 py-2.5 bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground">TOTAL MATERIALES</span>
              <span className="text-base font-bold text-primary">{totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
          )}
        </div>
      )}

      {/* DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar partida' : 'Añadir material / partida'}</DialogTitle>
          </DialogHeader>

          {!editing && (
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant={inputMode === 'form' ? 'default' : 'outline'} className="flex-1 gap-1.5 h-8 text-xs" onClick={() => setInputMode('form')}>
                <FileText className="w-3.5 h-3.5" /> Manual
              </Button>
              <Button size="sm" variant={inputMode === 'cmd' ? 'default' : 'outline'} className="flex-1 gap-1.5 h-8 text-xs" onClick={() => setInputMode('cmd')}>
                <Terminal className="w-3.5 h-3.5" /> Comando
              </Button>
              <Button size="sm" variant={inputMode === 'ocr' ? 'default' : 'outline'} className="flex-1 gap-1.5 h-8 text-xs" onClick={() => setInputMode('ocr')}>
                <Sparkles className="w-3.5 h-3.5" /> OCR
              </Button>
            </div>
          )}

          {/* CMD MODE */}
          {inputMode === 'cmd' && (
            <div className="space-y-3 pb-1">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold mb-1">Describe el material en lenguaje natural</p>
                <p className="text-xs text-muted-foreground">Ej: "100 m² de panel sandwich 80mm a 32€/m² de Isover" o "alquiler retroexcavadora 3 días a 250€/día"</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={cmdInput}
                  onChange={e => setCmdInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCmd()}
                  placeholder="Describe el material..."
                  className="flex-1"
                  autoFocus
                />
                <Button onClick={handleCmd} disabled={cmdLoading || !cmdInput.trim()} className="gap-1.5 shrink-0">
                  {cmdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* OCR MODE */}
          {inputMode === 'ocr' && (
            <div className="space-y-3 pb-1">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold">Sube albarán, presupuesto o factura</p>
                <p className="text-xs text-muted-foreground mt-0.5">La IA extraerá automáticamente todas las partidas con precios.</p>
              </div>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg h-28 cursor-pointer transition-colors ${uploading || ocrLoading ? 'opacity-60 pointer-events-none' : 'hover:bg-muted/30'} ${ocrDone ? 'border-emerald-400 bg-emerald-50/50' : 'border-primary/30'}`}>
                {uploading ? (
                  <><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /><p className="text-xs text-muted-foreground">Subiendo...</p></>
                ) : ocrLoading ? (
                  <><Loader2 className="w-6 h-6 animate-spin text-primary" /><p className="text-xs text-primary font-medium">Analizando con IA...</p></>
                ) : ocrDone ? (
                  <><CheckCircle2 className="w-7 h-7 text-emerald-600" /><p className="text-xs text-emerald-700 font-semibold">¡Datos extraídos! Revisa abajo.</p></>
                ) : (
                  <><Camera className="w-7 h-7 text-muted-foreground" /><p className="text-xs text-muted-foreground text-center">Foto o PDF de albarán / factura / presupuesto</p></>
                )}
                <input ref={fileRef} type="file" accept="image/*,application/pdf,.xlsx,.xls" className="hidden"
                  onChange={e => e.target.files[0] && handleOcrUpload(e.target.files[0])} />
              </label>
              {form._bulk && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                  <p className="text-xs font-semibold text-emerald-700">Se guardarán {form._bulk.length} partidas:</p>
                  {form._bulk.slice(0, 5).map((p, i) => (
                    <p key={i} className="text-xs text-emerald-600">· {p.nombre}{p.precio_total ? ` — ${p.precio_total} €` : ''}</p>
                  ))}
                  {form._bulk.length > 5 && <p className="text-xs text-muted-foreground">... y {form._bulk.length - 5} más</p>}
                </div>
              )}
            </div>
          )}

          {/* FORM (always shown, pre-filled after cmd/ocr) */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Nombre / descripción *</Label>
                <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Cemento Portland CEM II..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo *</Label>
                <MobileSelect value={form.tipo} onValueChange={v => set('tipo', v)} placeholder="Tipo">
                  {TIPOS.map(t => <MobileSelectItem key={t.key} value={t.key}>{t.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Referencia</Label>
                <Input value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="Cód. ref." className="font-mono" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Proveedor</Label>
                <Input value={form.proveedor} onChange={e => set('proveedor', e.target.value)} placeholder="Nombre del proveedor" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cantidad</Label>
                <Input type="number" min="0" step="any" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidad</Label>
                <Input value={form.unidad} onChange={e => set('unidad', e.target.value)} placeholder="ud, m, m², kg..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Precio unitario (€)</Label>
                <Input type="number" min="0" step="0.01" value={form.precio_unidad} onChange={e => set('precio_unidad', e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Precio total (€)</Label>
                <Input type="number" min="0" step="0.01" value={form.precio_total} onChange={e => set('precio_total', e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nº documento</Label>
                <Input value={form.num_documento} onChange={e => set('num_documento', e.target.value)} placeholder="Albarán / factura" />
              </div>
              {form.file_url && (
                <div className="col-span-2 flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs flex-1 truncate text-muted-foreground">Documento adjunto</span>
                  <a href={form.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => set('file_url', '')}><X className="w-3.5 h-3.5" /></Button>
                </div>
              )}
              {!form.file_url && !ocrDone && (
                <div className="col-span-2">
                  <Label className="text-xs">Adjuntar documento</Label>
                  <label className="mt-1.5 flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
                    <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{uploading ? 'Subiendo...' : 'Adjuntar albarán / factura (opcional)'}</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden"
                      onChange={async e => {
                        if (!e.target.files[0]) return;
                        setUploading(true);
                        const { file_url } = await base44.integrations.Core.UploadFile({ file: e.target.files[0] });
                        set('file_url', file_url);
                        setUploading(false);
                        toast.success('Archivo adjuntado');
                      }} />
                  </label>
                </div>
              )}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Notas</Label>
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Observaciones..." />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={(!form.nombre && !form._bulk) || isPending} className="gap-2 min-w-24">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {form._bulk ? `Guardar ${form._bulk.length} partidas` : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}