import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Package, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const categoriaCfg = {
  panel:        { label: '🔆 Panel',       className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  inversor:     { label: '⚡ Inversor',     className: 'bg-blue-100 text-blue-700 border-blue-200' },
  bateria:      { label: '🔋 Batería',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  estructura:   { label: '🏗️ Estructura',   className: 'bg-slate-100 text-slate-700 border-slate-200' },
  cableado:     { label: '🔌 Cableado',     className: 'bg-orange-100 text-orange-700 border-orange-200' },
  protecciones: { label: '🛡️ Protecciones', className: 'bg-red-100 text-red-700 border-red-200' },
  monitor:      { label: '📊 Monitor',      className: 'bg-violet-100 text-violet-700 border-violet-200' },
  otros:        { label: '📦 Otros',        className: 'bg-muted text-muted-foreground border-border' },
};

const emptyForm = { name: '', categoria: 'panel', marca: '', modelo: '', unit: 'ud', unit_price: '', stock: '', potencia_w: '', notas: '' };

export default function SolarMateriales() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: materiales = [], isLoading } = useQuery({
    queryKey: ['solar_materiales'],
    queryFn: () => base44.entities.SolarMaterial.list('name', 500),
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.SolarMaterial.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_materiales'] }); toast.success('Material creado'); close_(); },
    onError: () => toast.error('Error al crear el material'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.SolarMaterial.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_materiales'] }); toast.success('Material actualizado'); close_(); },
    onError: () => toast.error('Error al guardar'),
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.SolarMaterial.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_materiales'] }); toast.success('Material eliminado'); },
  });

  const open_ = (m = null) => {
    setEditing(m);
    setForm(m ? { ...m, unit_price: m.unit_price || '', stock: m.stock || '', potencia_w: m.potencia_w || '' } : emptyForm);
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    const data = {
      ...form,
      unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      stock: form.stock ? parseInt(form.stock) : null,
      potencia_w: form.potencia_w ? parseFloat(form.potencia_w) : null,
    };
    if (editing) updateM.mutate({ id: editing.id, d: data });
    else createM.mutate(data);
  };

  const filtered = materiales.filter(m => {
    const q = search.toLowerCase();
    const matchQ = !search || m.name?.toLowerCase().includes(q) || m.marca?.toLowerCase().includes(q) || m.modelo?.toLowerCase().includes(q);
    const matchC = catFilter === 'all' || m.categoria === catFilter;
    return matchQ && matchC;
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} materiales</p>
        <Button onClick={() => open_()} className="gap-2 shadow-sm" size="sm">
          <Plus className="w-4 h-4" /> Nuevo material
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={catFilter} onValueChange={setCatFilter} placeholder="Categoría" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">Todas</MobileSelectItem>
          {Object.entries(categoriaCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No hay materiales solares</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> Nuevo material</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const cfg = categoriaCfg[m.categoria] || categoriaCfg.otros;
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{m.name}</h3>
                      <Badge variant="outline" className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {m.marca && <span>{m.marca}</span>}
                      {m.modelo && <span>· Ref: {m.modelo}</span>}
                      {m.potencia_w && <span>· {m.potencia_w} W</span>}
                      {m.unit_price > 0 && <span className="font-semibold text-foreground">· {m.unit_price?.toFixed(2)} €/{m.unit || 'ud'}</span>}
                      {m.stock != null && <span>· Stock: {m.stock} {m.unit || 'ud'}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(m)}><Pencil className="w-3 h-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar material?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(m.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar material' : 'Nuevo material solar'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Nombre *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del material" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría *</Label>
                <MobileSelect value={form.categoria} onValueChange={v => set('categoria', v)} placeholder="Categoría">
                  {Object.entries(categoriaCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidad</Label>
                <Input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="ud" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Marca</Label>
                <Input value={form.marca} onChange={e => set('marca', e.target.value)} placeholder="Marca..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo / Ref</Label>
                <Input value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Referencia..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Precio unitario (€)</Label>
                <Input type="number" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stock</Label>
                <Input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Potencia (W) — si aplica</Label>
                <Input type="number" value={form.potencia_w} onChange={e => set('potencia_w', e.target.value)} placeholder="0" min="0" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Observaciones</Label>
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Notas..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.categoria || isPending} className="gap-2 min-w-24">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}