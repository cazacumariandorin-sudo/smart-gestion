import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Plus, Trash2, Upload, Loader2, Save, ExternalLink, FileText,
  File, PenLine, CheckCircle2, Building2, User, Briefcase, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import DocSignaturePad from './DocSignaturePad';

const DOC_CATS_OPERARIO = ['DNI/NIE', 'Contrato', 'Certificado PRL', 'Carnet conducir', 'Aptitud médica', 'Formación', 'Otro'];
const DOC_CATS_OBRA     = ['Plano', 'Permiso obra', 'Proyecto', 'Acta', 'Medición', 'Otro'];
const DOC_CATS_EMPRESA  = ['Protocolo', 'Política empresa', 'Reglamento', 'Prevención riesgos', 'Formación obligatoria', 'Acuerdo', 'Otro'];

const empty = {
  operario_id: '', operario_name: '', obra_id: '', obra_name: '',
  tipo: 'doc_operario', categoria: '', title: '',
  date: new Date().toISOString().split('T')[0],
  expiry_date: '', file_url: '', firmado: false, firma_url: '', fecha_firma: '', notes: '',
};

function DocCard({ doc, onDelete, onSign, deleteLoading }) {
  const expired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
  const isEmpresa = doc.tipo === 'doc_empresa';

  const tipoBadge = {
    doc_operario: { label: 'Operario', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    doc_obra:     { label: 'Obra',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
    doc_empresa:  { label: 'Empresa',  cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  }[doc.tipo] || { label: doc.tipo, cls: '' };

  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isEmpresa ? 'bg-violet-50' : 'bg-muted'}`}>
        {doc.firmado
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          : isEmpresa
            ? <PenLine className="w-4 h-4 text-violet-500" />
            : <File className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{doc.title}</span>
          <Badge variant="outline" className={`text-[10px] ${tipoBadge.cls}`}>{tipoBadge.label}</Badge>
          {doc.categoria && <Badge variant="outline" className="text-[10px]">{doc.categoria}</Badge>}
          {expired && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">Caducado</Badge>}
          {isEmpresa && doc.firmado && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Firmado</Badge>}
          {isEmpresa && !doc.firmado && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Pendiente firma</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {doc.operario_name}{doc.obra_name ? ` · ${doc.obra_name}` : ''}
          {doc.date ? ` · ${format(parseISO(doc.date), 'd MMM yyyy', { locale: es })}` : ''}
          {doc.fecha_firma ? ` · Firmado: ${format(parseISO(doc.fecha_firma), 'd MMM yyyy', { locale: es })}` : ''}
          {doc.expiry_date ? ` · Vence: ${format(parseISO(doc.expiry_date), 'd MMM yyyy', { locale: es })}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* Sign button for empresa docs not yet signed */}
        {isEmpresa && !doc.firmado && (
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-violet-700 border-violet-300 hover:bg-violet-50" onClick={() => onSign(doc)}>
            <PenLine className="w-3 h-3" /> Firmar
          </Button>
        )}
        {/* Show existing signature */}
        {doc.firma_url && (
          <img src={doc.firma_url} alt="firma" className="h-8 w-16 object-contain border rounded cursor-pointer" onClick={() => window.open(doc.firma_url, '_blank')} />
        )}
        {doc.file_url && (
          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
          </a>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={deleteLoading}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle><AlertDialogDescription>"{doc.title}" será eliminado.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(doc.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}

export default function DocsList({ operarios = [], obras = [], defaultOperarioId = '' }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState('personal');
  const [operarioFilter, setOperarioFilter] = useState(defaultOperarioId || 'all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...empty, operario_id: defaultOperarioId || '' });
  const [uploading, setUploading] = useState(false);
  const [signingDoc, setSigningDoc] = useState(null); // doc being signed
  const [savingSig, setSavingSig] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['operario_docs'],
    queryFn: () => base44.entities.OperarioDoc.list('-date', 500),
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.OperarioDoc.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operario_docs'] }); close_(); toast.success('Documento guardado'); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.OperarioDoc.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operario_docs'] }); },
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.OperarioDoc.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operario_docs'] }),
  });

  const open_ = (tipo = 'doc_operario') => {
    setForm({ ...empty, operario_id: defaultOperarioId || '', tipo });
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setForm({ ...empty, operario_id: defaultOperarioId || '' }); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleOperarioChange = (id) => {
    const op = operarios.find(o => o.id === id);
    setForm(p => ({ ...p, operario_id: id, operario_name: op?.name || '' }));
  };
  const handleObraChange = (id) => {
    const ob = obras.find(o => o.id === id);
    setForm(p => ({ ...p, obra_id: id, obra_name: ob?.name || '' }));
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    setUploading(false);
    toast.success('Archivo subido');
  };

  const handleSave = () => createM.mutate(form);

  // Sign a doc: upload signature image and mark as signed
  const handleSignSave = async (dataUrl) => {
    if (!signingDoc) return;
    setSavingSig(true);
    try {
      // Convert dataUrl to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'firma.png', { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await updateM.mutateAsync({
        id: signingDoc.id,
        d: {
          firma_url: file_url,
          firmado: true,
          fecha_firma: new Date().toISOString().split('T')[0],
        }
      });
      qc.invalidateQueries({ queryKey: ['operario_docs'] });
      toast.success('Documento firmado correctamente');
      setSigningDoc(null);
    } catch {
      toast.error('Error al guardar la firma');
    }
    setSavingSig(false);
  };

  // Filter by operario
  const filtered = (tipo) => docs.filter(d =>
    d.tipo === tipo &&
    (operarioFilter === 'all' || d.operario_id === operarioFilter)
  );

  const docCats = form.tipo === 'doc_operario' ? DOC_CATS_OPERARIO
    : form.tipo === 'doc_empresa' ? DOC_CATS_EMPRESA
    : DOC_CATS_OBRA;

  return (
    <div>
      {/* Filters row */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {!defaultOperarioId && (
          <MobileSelect value={operarioFilter} onValueChange={setOperarioFilter} placeholder="Operario" triggerClassName="w-48">
            <MobileSelectItem value="all">Todos los operarios</MobileSelectItem>
            {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
          </MobileSelect>
        )}
        <div className="flex gap-2 ml-auto">
          <Button onClick={() => open_('doc_empresa')} variant="outline" size="sm" className="gap-1.5 text-violet-700 border-violet-300 hover:bg-violet-50">
            <Briefcase className="w-3.5 h-3.5" /> Doc. Empresa
          </Button>
          <Button onClick={() => open_('doc_obra')} variant="outline" size="sm" className="gap-1.5 text-orange-700 border-orange-300 hover:bg-orange-50">
            <Building2 className="w-3.5 h-3.5" /> Doc. Obra
          </Button>
          <Button onClick={() => open_('doc_operario')} size="sm" className="gap-1.5">
            <User className="w-3.5 h-3.5" /> Doc. Operario
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="personal" className="gap-1.5 text-xs">
            <User className="w-3.5 h-3.5" /> Personal ({filtered('doc_operario').length})
          </TabsTrigger>
          <TabsTrigger value="obra" className="gap-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5" /> Obra ({filtered('doc_obra').length})
          </TabsTrigger>
          <TabsTrigger value="empresa" className="gap-1.5 text-xs">
            <Briefcase className="w-3.5 h-3.5" /> Empresa ({filtered('doc_empresa').length})
            {filtered('doc_empresa').filter(d => !d.firmado).length > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                {filtered('doc_empresa').filter(d => !d.firmado).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {['personal', 'obra', 'empresa'].map(tabKey => {
          const tipoMap = { personal: 'doc_operario', obra: 'doc_obra', empresa: 'doc_empresa' };
          const list = filtered(tipoMap[tabKey]);
          return (
            <TabsContent key={tabKey} value={tabKey}>
              {isLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
              ) : list.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-xl">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No hay documentos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {list.map(d => (
                    <DocCard
                      key={d.id}
                      doc={d}
                      onDelete={(id) => deleteM.mutate(id)}
                      onSign={(doc) => setSigningDoc(doc)}
                      deleteLoading={deleteM.isPending && deleteM.variables === d.id}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Signature dialog */}
      <Dialog open={!!signingDoc} onOpenChange={v => { if (!v) setSigningDoc(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-violet-600" /> Firmar documento
            </DialogTitle>
            {signingDoc && <p className="text-sm text-muted-foreground mt-1">{signingDoc.title}</p>}
          </DialogHeader>
          {signingDoc && !savingSig && (
            <DocSignaturePad
              onSave={handleSignSave}
              onCancel={() => setSigningDoc(null)}
            />
          )}
          {savingSig && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Guardando firma...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add document dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.tipo === 'doc_empresa' ? '📋 Nuevo Doc. Empresa' : form.tipo === 'doc_obra' ? '🏗️ Nuevo Doc. Obra' : '👤 Nuevo Doc. Operario'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <MobileSelect value={form.tipo} onValueChange={v => set('tipo', v)} placeholder="Tipo">
                <MobileSelectItem value="doc_operario">Documentación Operario</MobileSelectItem>
                <MobileSelectItem value="doc_obra">Documentación Obra</MobileSelectItem>
                <MobileSelectItem value="doc_empresa">Documento Empresa (para firmar)</MobileSelectItem>
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              <MobileSelect value={form.operario_id} onValueChange={handleOperarioChange} placeholder="Seleccionar operario...">
                {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            {form.tipo === 'doc_obra' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Obra</Label>
                <MobileSelect value={form.obra_id} onValueChange={handleObraChange} placeholder="Seleccionar obra...">
                  {obras.map(ob => <MobileSelectItem key={ob.id} value={ob.id}>{ob.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <MobileSelect value={form.categoria} onValueChange={v => set('categoria', v)} placeholder="Categoría...">
                {docCats.map(c => <MobileSelectItem key={c} value={c}>{c}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: Protocolo de seguridad 2024" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha caducidad</Label>
                <Input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Archivo {form.tipo === 'doc_empresa' ? '(documento a firmar)' : '(opcional)'}</Label>
              <div className="flex gap-2">
                <Input value={form.file_url} onChange={e => set('file_url', e.target.value)} placeholder="URL o subir..." className="flex-1 text-xs" />
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={uploading} asChild>
                    <span>{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                  </Button>
                  <input type="file" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                </label>
              </div>
            </div>
            {form.tipo === 'doc_empresa' && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                <p className="text-xs text-violet-700 font-medium">📝 Este documento requerirá firma del operario</p>
                <p className="text-xs text-violet-600 mt-0.5">El operario podrá firmar desde la app con ratón o táctil.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.operario_id || !form.title || createM.isPending} className="gap-2 min-w-28">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}