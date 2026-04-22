import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Trash2, Factory, Save, Loader2, Globe, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const empty = { name: '', pais: '', web: '', telefono: '', email: '', categorias: '', notas: '' };

export default function Fabricantes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const { data: fabricantes = [], isLoading } = useQuery({
    queryKey: ['fabricantes'],
    queryFn: () => base44.entities.Fabricante.list('name', 300),
  });

  const createM = useMutation({ mutationFn: d => base44.entities.Fabricante.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fabricantes'] }); close_(); } });
  const updateM = useMutation({ mutationFn: ({ id, d }) => base44.entities.Fabricante.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fabricantes'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.Fabricante.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['fabricantes'] }) });

  const open_ = (f = null) => { setEditing(f); setForm(f ? { ...f } : empty); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = () => editing ? updateM.mutate({ id: editing.id, d: form }) : createM.mutate(form);
  const isPending = createM.isPending || updateM.isPending;

  const filtered = fabricantes.filter(f => !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.categorias?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="w-7 h-7 text-primary" /> Fabricantes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} fabricantes</p>
        </div>
        <Button onClick={() => open_()} className="gap-2 shadow-sm"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo Fabricante</span></Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar fabricante..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Factory className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay fabricantes</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" />Añadir fabricante</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(f => (
            <Card key={f.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{f.name}</h3>
                  {f.pais && <p className="text-xs text-muted-foreground">{f.pais}</p>}
                  {f.categorias && <p className="text-xs text-primary mt-0.5">{f.categorias}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(f)}><Pencil className="w-3 h-3" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Eliminar fabricante?</AlertDialogTitle><AlertDialogDescription>"{f.name}" será eliminado.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(f.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="space-y-1">
                {f.telefono && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" />{f.telefono}</p>}
                {f.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" />{f.email}</p>}
                {f.web && <a href={f.web} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1.5 hover:underline"><Globe className="w-3 h-3" />{f.web}</a>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Fabricante' : 'Nuevo Fabricante'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label className="text-xs">Nombre *</Label><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del fabricante" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">País</Label><Input value={form.pais} onChange={e => set('pais', e.target.value)} placeholder="España" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Categorías</Label><Input value={form.categorias} onChange={e => set('categorias', e.target.value)} placeholder="Paneles, inversores..." /></div>
              <div className="space-y-1.5"><Label className="text-xs">Teléfono</Label><Input value={form.telefono} onChange={e => set('telefono', e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => set('email', e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Web</Label><Input value={form.web} onChange={e => set('web', e.target.value)} placeholder="https://..." /></div>
            <div className="space-y-1.5"><Label className="text-xs">Observaciones</Label><Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}