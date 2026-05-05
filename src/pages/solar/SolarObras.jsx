import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Zap, Loader2, Save, X, ChevronDown, ChevronUp, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState(null);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['solar_obras'],
    queryFn: () => base44.entities.SolarObra.list('-created_date', 300),
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ['solar_clientes'],
    queryFn: () => base44.entities.SolarCliente.list('name', 300),
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.SolarObra.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_obras'] }); toast.success('Obra solar creada'); close_(); },
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

  const open_ = (o = null) => {
    setEditing(o);
    setForm(o ? { ...o, budget: o.budget || '', potencia_kw: o.potencia_kw || '', num_paneles: o.num_paneles || '' } : emptyForm);
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleClientChange = id => {
    const c = clientes.find(c => c.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };

  const handleSave = () => {
    const data = {
      ...form,
      budget: form.budget ? parseFloat(form.budget) : null,
      potencia_kw: form.potencia_kw ? parseFloat(form.potencia_kw) : null,
      num_paneles: form.num_paneles ? parseInt(form.num_paneles) : null,
    };
    if (editing) updateM.mutate({ id: editing.id, d: data });
    else createM.mutate(data);
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

      {/* Summary badges */}
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
                  <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2 text-xs">
                    {o.description && <p className="text-muted-foreground italic">{o.description}</p>}
                    <div className="flex flex-wrap gap-4">
                      {o.budget > 0 && <span className="font-semibold text-primary">{o.budget?.toLocaleString('es-ES')} € presupuesto</span>}
                      {o.contact_person && <span className="flex items-center gap-1"><User className="w-3 h-3" />{o.contact_person}</span>}
                      {o.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{o.contact_phone}</span>}
                      {o.end_date && <span>Fin previsto: {format(parseISO(o.end_date), 'd MMM yyyy', { locale: es })}</span>}
                    </div>
                    {o.notes && <p className="text-muted-foreground">{o.notes}</p>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar obra solar' : 'Nueva obra solar'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
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