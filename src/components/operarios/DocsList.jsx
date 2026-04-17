import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Upload, Loader2, Save, ExternalLink, FileText, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const DOC_CATS_OPERARIO = ['DNI/NIE', 'Contrato', 'Certificado PRL', 'Carnet conducir', 'Aptitud médica', 'Formación', 'Otro'];
const DOC_CATS_OBRA = ['Plano', 'Permiso obra', 'Proyecto', 'Acta', 'Medición', 'Otro'];

const empty = { operario_id: '', operario_name: '', obra_id: '', obra_name: '', tipo: 'doc_operario', categoria: '', title: '', date: new Date().toISOString().split('T')[0], expiry_date: '', file_url: '', notes: '' };

export default function DocsList({ operarios = [], obras = [], defaultOperarioId = '', defaultObraId = '' }) {
  const qc = useQueryClient();
  const [operarioFilter, setOperarioFilter] = useState(defaultOperarioId || 'all');
  const [obraFilter, setObraFilter] = useState(defaultObraId || 'all');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...empty, operario_id: defaultOperarioId || '', tipo: 'doc_operario' });
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['operario_docs'],
    queryFn: () => base44.entities.OperarioDoc.list('-date', 500),
  });

  const createM = useMutation({ mutationFn: d => base44.entities.OperarioDoc.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['operario_docs'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.OperarioDoc.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['operario_docs'] }) });

  const open_ = () => setDialogOpen(true);
  const close_ = () => { setDialogOpen(false); setForm({ ...empty, operario_id: defaultOperarioId || '', tipo: 'doc_operario' }); };
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
  };

  const handleSave = () => createM.mutate(form);

  const filtered = docs.filter(d => {
    const matchOp = operarioFilter === 'all' || d.operario_id === operarioFilter;
    const matchOb = obraFilter === 'all' || d.obra_id === obraFilter;
    const matchT = tipoFilter === 'all' || d.tipo === tipoFilter;
    return matchOp && matchOb && matchT;
  });

  const isExpired = (date) => date && new Date(date) < new Date();

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="doc_operario">Doc. Operario</SelectItem>
            <SelectItem value="doc_obra">Doc. Obra</SelectItem>
          </SelectContent>
        </Select>
        {!defaultOperarioId && (
          <Select value={operarioFilter} onValueChange={setOperarioFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Operario" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los operarios</SelectItem>
              {operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={obraFilter} onValueChange={setObraFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Obra" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las obras</SelectItem>
            {obras.map(ob => <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={open_} className="gap-2 ml-auto shadow-sm" size="sm">
          <Plus className="w-3.5 h-3.5" /> Nuevo Documento
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No hay documentos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => {
            const expired = isExpired(d.expiry_date);
            return (
              <Card key={d.id} className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <File className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{d.title}</span>
                    <Badge variant="outline" className={`text-[10px] ${d.tipo === 'doc_operario' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                      {d.tipo === 'doc_operario' ? 'Operario' : 'Obra'}
                    </Badge>
                    {d.categoria && <Badge variant="outline" className="text-[10px]">{d.categoria}</Badge>}
                    {expired && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">Caducado</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.operario_name}{d.obra_name ? ` · ${d.obra_name}` : ''}
                    {d.date ? ` · ${format(parseISO(d.date), 'd MMM yyyy', { locale: es })}` : ''}
                    {d.expiry_date ? ` · Vence: ${format(parseISO(d.expiry_date), 'd MMM yyyy', { locale: es })}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                    </a>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle><AlertDialogDescription>"{d.title}" será eliminado.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteM.mutate(d.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo Documento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => set('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="doc_operario">Documentación Operario</SelectItem>
                  <SelectItem value="doc_obra">Documentación Obra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operario *</Label>
              <Select value={form.operario_id} onValueChange={handleOperarioChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar operario..." /></SelectTrigger>
                <SelectContent>{operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.tipo === 'doc_obra' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Obra</Label>
                <Select value={form.obra_id} onValueChange={handleObraChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar obra..." /></SelectTrigger>
                  <SelectContent>{obras.map(ob => <SelectItem key={ob.id} value={ob.id}>{ob.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <Select value={form.categoria} onValueChange={v => set('categoria', v)}>
                <SelectTrigger><SelectValue placeholder="Categoría..." /></SelectTrigger>
                <SelectContent>
                  {(form.tipo === 'doc_operario' ? DOC_CATS_OPERARIO : DOC_CATS_OBRA).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej: DNI de Juan García" />
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
              <Label className="text-xs">Archivo</Label>
              <div className="flex gap-2">
                <Input value={form.file_url} onChange={e => set('file_url', e.target.value)} placeholder="URL o subir..." className="flex-1" />
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={uploading} asChild>
                    <span>{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                  </Button>
                  <input type="file" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                </label>
              </div>
            </div>
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