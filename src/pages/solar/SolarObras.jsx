import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { toast } from 'sonner';
import {
  Plus, Search, Pencil, Trash2, Zap, Loader2, Save, X,
  ChevronDown, ChevronUp, Phone, User, Upload, FileText,
  ExternalLink, Sparkles, CheckCircle2, Power
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const statusCfg = {
  presupuesto: { label: 'Presupuesto', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  activa:      { label: 'Activa',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pausada:     { label: 'Pausada',     className: 'bg-amber-100 text-amber-700 border-amber-200' },
  finalizada:  { label: 'Finalizada',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const tipoInstalacion = {
  autoconsumo: 'Autoconsumo',
  vertido_red: 'Vertido a red',
  aislada: 'Aislada',
  hibrida: 'Híbrida',
};

const emptyForm = {
  name: '', code: '', client_id: '', client_name: '', address: '',
  potencia_kw: '', num_paneles: '', tipo_instalacion: 'autoconsumo',
  start_date: '', end_date: '', status: 'presupuesto', budget: '',
  contact_person: '', contact_phone: '', description: '', notes: '',
};

export default function SolarObras() {
  const qc = useQueryClient();
  const { isAdmin, isGerencia } = useUserRole();
  const podeToggleActivo = isAdmin || isGerencia;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['solar_obras'],
    queryFn: () => base44.entities.SolarObra.list('-created_date', 300),
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ['solar_clientes'],
    queryFn: () => base44.entities.SolarCliente.list('name', 300),
  });

  const asignarIdSolar = async (id) => {
    try { await base44.functions.invoke('generarIdUnico', { entidad: 'SolarObra', record_id: id, campo_id: 'codigo_registro' }); } catch {}
    qc.invalidateQueries({ queryKey: ['solar_obras'] });
  };
  const createM = useMutation({
    mutationFn: d => base44.entities.SolarObra.create(d),
    onSuccess: (rec) => { asignarIdSolar(rec.id); toast.success('Obra solar creada'); close_(); },
    onError: () => toast.error('Error al crear la obra'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.SolarObra.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_obras'] }); toast.success('Obra actualizada'); close_(); },
    onError: () => toast.error('Error al guardar'),
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.SolarObra.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_obras'] }); toast.success('Obra eliminada'); },
  });
  const toggleActivoM = useMutation({
    mutationFn: ({ id, value }) => base44.entities.SolarObra.update(id, { activo: value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_obras'] }); qc.invalidateQueries({ queryKey: ['obras-activas-map-solar'] }); },
    onError: () => toast.error('No se pudo cambiar el estado de la obra'),
  });

  const open_ = (o = null) => {
    setEditing(o);
    setForm(o ? { ...o, budget: o.budget || '', potencia_kw: o.potencia_kw || '', num_paneles: o.num_paneles || '' } : emptyForm);
    setUploadedFiles(o?.attached_files || []);
    setOcrFile(null);
    setOcrDone(false);
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); setUploadedFiles([]); setOcrFile(null); setOcrDone(false); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleClientChange = id => {
    const c = clientes.find(c => c.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };

  // OCR import
  const handleOcrImport = async (file) => {
    setOcrFile(file);
    setOcrLoading(true);
    setOcrDone(false);
    const uploadRes = await base44.functions.invoke('subirArchivoConFallback', {
      file_base64: file,
      ruta_drive: 'Obras_Solar/Documentos',
      entidad_tipo: 'SolarObra',
      entidad_id: null,
    });
    const file_url = uploadRes.data?.cdn_url_para_llm || uploadRes.data?.file_url;
    const data = await base44.integrations.Core.InvokeLLM({
      prompt: `Extrae los datos del siguiente documento de obra/instalación solar o presupuesto.
Devuelve un JSON con esta estructura:
{
  "name": "nombre del proyecto/obra",
  "code": "código o referencia si existe",
  "client_name": "nombre del cliente",
  "address": "dirección de la instalación",
  "potencia_kw": número (potencia en kW, si aparece),
  "num_paneles": número entero (número de paneles, si aparece),
  "tipo_instalacion": "autoconsumo|vertido_red|aislada|hibrida (el que mejor corresponda)",
  "budget": número (importe total o presupuesto en euros, si aparece),
  "contact_person": "nombre del contacto si aparece",
  "contact_phone": "teléfono de contacto si aparece",
  "description": "descripción breve del proyecto",
  "notes": "otras observaciones relevantes"
}
Si un campo no aparece, déjalo como null o cadena vacía.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' }, code: { type: 'string' },
          client_name: { type: 'string' }, address: { type: 'string' },
          potencia_kw: { type: 'number' }, num_paneles: { type: 'number' },
          tipo_instalacion: { type: 'string' }, budget: { type: 'number' },
          contact_person: { type: 'string' }, contact_phone: { type: 'string' },
          description: { type: 'string' }, notes: { type: 'string' },
        }
      }
    });
    setForm(p => ({
      ...p,
      name: data.name || p.name,
      code: data.code || p.code,
      client_name: data.client_name || p.client_name,
      address: data.address || p.address,
      potencia_kw: data.potencia_kw || p.potencia_kw,
      num_paneles: data.num_paneles || p.num_paneles,
      tipo_instalacion: data.tipo_instalacion && tipoInstalacion[data.tipo_instalacion] ? data.tipo_instalacion : p.tipo_instalacion,
      budget: data.budget || p.budget,
      contact_person: data.contact_person || p.contact_person,
      contact_phone: data.contact_phone || p.contact_phone,
      description: data.description || p.description,
      notes: data.notes || p.notes,
    }));
    // Save file as attachment too
    const ext = file.name.split('.').pop()?.toLowerCase();
    setUploadedFiles(prev => [...prev, { name: file.name, url: file_url, type: ext }]);
    setOcrLoading(false);
    setOcrDone(true);
  };

  const handleFileUpload = async (file) => {
    setUploadingFile(true);
    const uploadRes = await base44.functions.invoke('subirArchivoConFallback', {
      file_base64: file,
      ruta_drive: 'Obras_Solar/Documentos',
      entidad_tipo: 'SolarObra',
      entidad_id: null,
    });
    const file_url = uploadRes.data?.cdn_url_para_llm || uploadRes.data?.file_url;
    const ext = file.name.split('.').pop()?.toLowerCase();
    setUploadedFiles(prev => [...prev, { name: file.name, url: file_url, type: ext }]);
    setUploadingFile(false);
    toast.success('Archivo subido');
  };

  const handleSave = async () => {
    const data = {
      ...form,
      budget: form.budget ? parseFloat(form.budget) : null,
      potencia_kw: form.potencia_kw ? parseFloat(form.potencia_kw) : null,
      num_paneles: form.num_paneles ? parseInt(form.num_paneles) : null,
      attached_files: uploadedFiles,
    };
    const newName = (form.name || '').trim();
    const oldName = editing?.name;
    if (editing) {
      try {
        await updateM.mutateAsync({ id: editing.id, d: data });
        // Si cambió el nombre, sincroniza en documentos, partes, materiales y fotos
        if (oldName && newName && oldName.trim() !== newName) {
          base44.functions.invoke('propagarRenameObra', {
            obra_id: editing.id, obra_tipo: 'solar', nuevo_nombre: newName,
          }).then((r) => {
            const total = r?.data?.total_modificados || 0;
            if (total > 0) toast.success(`Nombre sincronizado en ${total} registros relacionados (documentos, partes, fotos)`);
          }).catch(() => toast.error('No se pudo sincronizar el nombre en los registros relacionados'));
        }
      } catch (_) { /* onError del mutation ya gestiona el error */ }
    } else {
      createM.mutate(data);
    }
  };

  const filtered = obras.filter(o => {
    const q = search.toLowerCase();
    const matchQ = !search || o.name?.toLowerCase().includes(q) || o.client_name?.toLowerCase().includes(q) || o.code?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || o.status === statusFilter;
    return matchQ && matchS;
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} obras</p>
        <Button onClick={() => open_()} className="gap-2 shadow-sm" size="sm">
          <Plus className="w-4 h-4" /> Nueva obra
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar obra..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="Estado" triggerClassName="w-full sm:w-40">
          <MobileSelectItem value="all">Todos</MobileSelectItem>
          {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusCfg).map(([k, v]) => {
          const count = obras.filter(o => o.status === k).length;
          if (!count) return null;
          return <Badge key={k} variant="outline" className={`${v.className} text-xs`}>{v.label}: {count}</Badge>;
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No hay obras solares</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> Nueva obra</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const cfg = statusCfg[o.status] || statusCfg.presupuesto;
            const isExpanded = expandedId === o.id;
            return (
              <Card key={o.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {o.code && <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{o.code}</span>}
                        <h3 className="font-semibold text-sm">{o.name}</h3>
                        <Badge variant="outline" className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                        {o.activo === false && <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Inactiva</Badge>}
                        {o.attached_files?.length > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
                            <FileText className="w-2.5 h-2.5 mr-1" />{o.attached_files.length} archivo{o.attached_files.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {o.client_name && <span>{o.client_name}</span>}
                        {o.potencia_kw && <span>· {o.potencia_kw} kW</span>}
                        {o.num_paneles && <span>· {o.num_paneles} paneles</span>}
                        {o.tipo_instalacion && <span>· {tipoInstalacion[o.tipo_instalacion]}</span>}
                        {o.start_date && <span>· {format(parseISO(o.start_date), 'd MMM yyyy', { locale: es })}</span>}
                      </div>
                      {o.address && <p className="text-xs text-muted-foreground mt-0.5">{o.address}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {podeToggleActivo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${o.activo === false ? 'text-amber-500' : 'text-emerald-600'}`}
                          title={o.activo === false ? 'Reactivar obra' : 'Marcar obra inactiva (oculta sus documentos)'}
                          onClick={() => toggleActivoM.mutate({ id: o.id, value: o.activo === false })}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(o)}><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar obra?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(o.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-3 text-xs">
                    {o.description && <p className="text-muted-foreground italic">{o.description}</p>}
                    <div className="flex flex-wrap gap-4">
                      {o.budget > 0 && <span className="font-semibold text-primary">{o.budget?.toLocaleString('es-ES')} € presupuesto</span>}
                      {o.contact_person && <span className="flex items-center gap-1"><User className="w-3 h-3" />{o.contact_person}</span>}
                      {o.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{o.contact_phone}</span>}
                      {o.end_date && <span>Fin previsto: {format(parseISO(o.end_date), 'd MMM yyyy', { locale: es })}</span>}
                    </div>
                    {o.notes && <p className="text-muted-foreground">{o.notes}</p>}

                    {/* Archivos adjuntos */}
                    {o.attached_files?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5">ARCHIVOS ADJUNTOS</p>
                        <div className="space-y-1.5">
                          {o.attached_files.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 border border-border">
                              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="flex-1 truncate font-medium">{f.name}</span>
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={f.name}
                                className="flex items-center gap-1 text-primary hover:underline shrink-0"
                              >
                                <ExternalLink className="w-3 h-3" /> Ver / Descargar
                              </a>
                            </div>
                          ))}
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar obra solar' : 'Nueva obra solar'}</DialogTitle></DialogHeader>

          <Tabs defaultValue="datos">
            <TabsList className="mb-4">
              <TabsTrigger value="datos">📋 Datos</TabsTrigger>
              <TabsTrigger value="ocr">✨ Importar OCR</TabsTrigger>
              <TabsTrigger value="archivos">📎 Archivos</TabsTrigger>
            </TabsList>

            {/* DATOS */}
            <TabsContent value="datos">
              <div className="space-y-3 py-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Nombre *</Label>
                    <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre de la obra" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Código</Label>
                    <Input value={form.code} onChange={e => set('code', e.target.value)} placeholder="SOL-001" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Estado</Label>
                    <MobileSelect value={form.status} onValueChange={v => set('status', v)} placeholder="Estado">
                      {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                    </MobileSelect>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Cliente solar</Label>
                    <MobileSelect value={form.client_id} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
                      {clientes.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
                    </MobileSelect>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Dirección instalación</Label>
                    <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo instalación</Label>
                    <MobileSelect value={form.tipo_instalacion} onValueChange={v => set('tipo_instalacion', v)} placeholder="Tipo">
                      {Object.entries(tipoInstalacion).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v}</MobileSelectItem>)}
                    </MobileSelect>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Presupuesto (€)</Label>
                    <Input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0" min="0" step="0.01" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Potencia (kW)</Label>
                    <Input type="number" value={form.potencia_kw} onChange={e => set('potencia_kw', e.target.value)} placeholder="0" min="0" step="0.01" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nº paneles</Label>
                    <Input type="number" value={form.num_paneles} onChange={e => set('num_paneles', e.target.value)} placeholder="0" min="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha inicio</Label>
                    <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha fin prevista</Label>
                    <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Persona contacto</Label>
                    <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Nombre..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Teléfono contacto</Label>
                    <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+34..." />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Descripción</Label>
                    <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Descripción del proyecto..." />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Observaciones</Label>
                    <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Notas..." />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* OCR */}
            <TabsContent value="ocr">
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">Importar datos con OCR + IA</p>
                      <p className="text-xs text-muted-foreground mt-1">Sube un presupuesto, proyecto técnico o cualquier documento de la obra solar. La IA extraerá automáticamente todos los datos disponibles.</p>
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
                      <p className="text-[10px] text-muted-foreground">Revisa y completa en la pestaña "Datos"</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground font-medium">Subir presupuesto o proyecto técnico</p>
                      <p className="text-[10px] text-muted-foreground">PDF, imagen (JPG, PNG), Excel, Word</p>
                    </>
                  )}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx" className="hidden"
                    onChange={e => e.target.files[0] && handleOcrImport(e.target.files[0])} />
                </label>

                {ocrFile && !ocrLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> {ocrFile.name}
                  </p>
                )}

                {ocrDone && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-1">
                    <p className="text-xs font-semibold text-emerald-700">Datos extraídos:</p>
                    {form.name && <p className="text-xs text-emerald-600">· Obra: {form.name}</p>}
                    {form.client_name && <p className="text-xs text-emerald-600">· Cliente: {form.client_name}</p>}
                    {form.potencia_kw && <p className="text-xs text-emerald-600">· Potencia: {form.potencia_kw} kW</p>}
                    {form.budget && <p className="text-xs text-emerald-600">· Presupuesto: {form.budget} €</p>}
                    <p className="text-xs text-muted-foreground mt-1">El archivo también se ha añadido como adjunto.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ARCHIVOS */}
            <TabsContent value="archivos">
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">Adjunta documentos relacionados con la obra (presupuestos, planos, contratos...).</p>
                <label className="block border-2 border-dashed rounded-lg h-24 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors">
                  {uploadingFile ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
                  <p className="text-xs text-muted-foreground">{uploadingFile ? 'Subiendo...' : 'Subir archivo (PDF, imagen, Excel...)'}</p>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx" className="hidden"
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
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || isPending} className="gap-2 min-w-24">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}