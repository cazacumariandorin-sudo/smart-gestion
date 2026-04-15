import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { Plus, Search, Pencil, Trash2, FileImage, Upload, Loader2, Save, ExternalLink, Filter } from 'lucide-react';
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

const empty = { title: '', reference: '', client_id: '', client_name: '', project: '', date: new Date().toISOString().split('T')[0], version: '', file_url: '', notes: '' };

export default function Drawings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const { data: drawings = [], isLoading } = useQuery({ queryKey: ['drawings'], queryFn: () => base44.entities.Drawing.list('-date', 500) });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('name', 200) });

  const createM = useMutation({ mutationFn: d => base44.entities.Drawing.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['drawings'] }); close_(); } });
  const updateM = useMutation({ mutationFn: ({ id, d }) => base44.entities.Drawing.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['drawings'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.Drawing.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['drawings'] }) });

  const open_ = (d = null) => { setEditing(d); setForm(d ? { ...d } : empty); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleClientChange = (id) => {
    const c = clients.find(c => c.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    setUploading(false);
  };

  const handleSave = () => {
    if (editing) updateM.mutate({ id: editing.id, d: form });
    else createM.mutate(form);
  };

  const filtered = drawings.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !search || d.title?.toLowerCase().includes(q) || d.reference?.toLowerCase().includes(q) || d.project?.toLowerCase().includes(q);
    const matchC = clientFilter === 'all' || d.client_id === clientFilter;
    return matchQ && matchC;
  });

  const isPending = createM.isPending || updateM.isPending;
  const isImage = (url) => url && /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileImage className="w-7 h-7 text-primary" /> {t('drawings')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} {t('drawings').toLowerCase()}</p>
        </div>
        <Button onClick={() => open_()} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('new_drawing')}</span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('search') + '...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t('client')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')} {t('clients').toLowerCase()}</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map(i => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <FileImage className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay planos</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> {t('new_drawing')}</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(d => (
            <Card key={d.id} className="overflow-hidden hover:shadow-md transition-shadow">
              {/* Preview */}
              {d.file_url && isImage(d.file_url) ? (
                <div className="h-36 bg-muted cursor-pointer" onClick={() => setPreview(d)}>
                  <img src={d.file_url} alt={d.title} className="w-full h-full object-cover" />
                </div>
              ) : d.file_url ? (
                <div className="h-36 bg-muted/50 flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={() => window.open(d.file_url, '_blank')}>
                  <FileImage className="w-10 h-10 text-muted-foreground" />
                  <span className="text-xs text-primary flex items-center gap-1">Ver PDF <ExternalLink className="w-3 h-3" /></span>
                </div>
              ) : (
                <div className="h-36 bg-muted/30 flex items-center justify-center">
                  <FileImage className="w-10 h-10 text-muted-foreground/40" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{d.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.client_name}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(d)}><Pencil className="w-3 h-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar plano?</AlertDialogTitle><AlertDialogDescription>"{d.title}" será eliminado.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(d.id)} className="bg-destructive text-destructive-foreground">{t('delete')}</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {d.reference && <Badge variant="outline" className="text-[10px]">{d.reference}</Badge>}
                  {d.version && <Badge variant="outline" className="text-[10px]">v{d.version}</Badge>}
                  {d.project && <span className="text-xs text-muted-foreground truncate">{d.project}</span>}
                </div>
                {d.date && <p className="text-xs text-muted-foreground mt-1">{format(parseISO(d.date), "d MMM yyyy", { locale: es })}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('edit') : t('new_drawing')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('name')} *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Planta baja, Fachada norte..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('reference')}</Label>
                <Input value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="PL-001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('version')}</Label>
                <Input value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('client')} *</Label>
              <Select value={form.client_id} onValueChange={handleClientChange}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('project')}</Label>
                <Input value={form.project} onChange={e => set('project', e.target.value)} placeholder="Obra..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('date')}</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('file')} (PDF / imagen)</Label>
              <div className="flex gap-2">
                <Input value={form.file_url} onChange={e => set('file_url', e.target.value)} placeholder="https://..." className="flex-1" />
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={uploading} asChild>
                    <span>{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                  </Button>
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('notes')}</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.client_id || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview.file_url} alt={preview.title} className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-6 text-white text-center">
            <p className="font-semibold">{preview.title}</p>
            {preview.reference && <p className="text-sm text-white/70">{preview.reference}</p>}
          </div>
        </div>
      )}
    </div>
  );
}