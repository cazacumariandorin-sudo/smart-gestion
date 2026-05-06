import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import PageHeader from '@/components/layout/PageHeader';
import { base44 } from '@/api/base44Client';
import { useI18n } from '@/lib/i18n';
import { Plus, Search, Pencil, Trash2, Package, ExternalLink, Upload, Loader2, Save } from 'lucide-react';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const empty = { name: '', code: '', category: '', unit: '', unit_price: '', supplier: '', description: '', manual_url: '', active: true };

export default function MaterialCatalog() {
  const { t } = useI18n();
  const qc = useQueryClient();

  const onRefresh = useCallback(() => qc.invalidateQueries({ queryKey: ['material_catalog'] }), [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [uploadingManual, setUploadingManual] = useState(false);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['material_catalog'],
    queryFn: () => base44.entities.MaterialCatalog.list('name', 500),
  });

  const createM = useMutation({ mutationFn: d => base44.entities.MaterialCatalog.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['material_catalog'] }); close_(); } });
  const updateM = useMutation({ mutationFn: ({ id, d }) => base44.entities.MaterialCatalog.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['material_catalog'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.MaterialCatalog.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['material_catalog'] }) });

  const open_ = (mat = null) => { setEditing(mat); setForm(mat ? { ...mat } : empty); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    const data = { ...form, unit_price: parseFloat(form.unit_price) || 0 };
    if (editing) updateM.mutate({ id: editing.id, d: data });
    else createM.mutate(data);
  };

  const handleManualUpload = async (file) => {
    setUploadingManual(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('manual_url', file_url);
    setUploadingManual(false);
  };

  const categories = [...new Set(materials.map(m => m.category).filter(Boolean))].sort();
  const filtered = materials.filter(m => {
    const q = search.toLowerCase();
    const matchQ = !search || m.name?.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q) || m.supplier?.toLowerCase().includes(q);
    const matchC = catFilter === 'all' || m.category === catFilter;
    return matchQ && matchC;
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={t('material_catalog')}
        subtitle={`${filtered.length} ${t('materials').toLowerCase()}`}
        hideBack={true}
        actions={<Button onClick={() => open_()} size="sm" className="gap-2 shadow-sm"><Plus className="w-4 h-4" /><span className="hidden sm:inline">{t('new_material')}</span></Button>}
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={t('search') + '...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <VoiceInputButton onResult={txt => setSearch(txt)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', ...categories].map(c => (
            <Button key={c} size="sm" variant={catFilter === c ? 'default' : 'outline'} onClick={() => setCatFilter(c)} className="h-9">
              {c === 'all' ? t('all') : c}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay materiales</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> {t('new_material')}</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(mat => (
            <Card key={mat.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{mat.name}</h3>
                  {mat.code && <p className="text-xs text-muted-foreground font-mono mt-0.5">{mat.code}</p>}
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(mat)}><Pencil className="w-3 h-3" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Eliminar material?</AlertDialogTitle><AlertDialogDescription>"{mat.name}" será eliminado.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(mat.id)} className="bg-destructive text-destructive-foreground">{t('delete')}</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {mat.category && <Badge variant="outline" className="text-[10px]">{mat.category}</Badge>}
                {mat.unit && <Badge variant="outline" className="text-[10px]">{mat.unit}</Badge>}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  {mat.unit_price > 0 && (
                    <p className="text-sm font-semibold text-primary">{mat.unit_price.toFixed(2)} €/{mat.unit || 'ud'}</p>
                  )}
                  {mat.supplier && <p className="text-xs text-muted-foreground">{mat.supplier}</p>}
                </div>
                {mat.manual_url && (
                  <a href={mat.manual_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Manual
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      </div>
      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? t('edit') : t('new_material')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">{t('name')} *</Label>
                <div className="flex gap-1">
                  <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Cemento Portland..." />
                  <VoiceInputButton onResult={txt => set('name', txt)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('code')}</Label>
                <Input value={form.code} onChange={e => set('code', e.target.value)} placeholder="MAT-001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('category')}</Label>
                <Input value={form.category} onChange={e => set('category', e.target.value)} placeholder="Cemento, Ferralla..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('unit')}</Label>
                <Input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="kg, m³, ud..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('unit_price')}</Label>
                <Input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">{t('supplier')}</Label>
                <div className="flex gap-1">
                  <Input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Nombre del proveedor" />
                  <VoiceInputButton onResult={txt => set('supplier', txt)} />
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">{t('description')}</Label>
                <div className="flex gap-1 items-start">
                  <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} placeholder="Especificaciones técnicas..." className="flex-1" />
                  <VoiceInputButton onResult={txt => set('description', form.description ? form.description + ' ' + txt : txt)} />
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">{t('manual')} (PDF / URL)</Label>
                <div className="flex gap-2">
                  <Input value={form.manual_url} onChange={e => set('manual_url', e.target.value)} placeholder="https://... o subir archivo" className="flex-1" />
                  <label className="cursor-pointer">
                    <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={uploadingManual} asChild>
                      <span>{uploadingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                    </Button>
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files[0] && handleManualUpload(e.target.files[0])} />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={!form.name || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}