import { useState, useCallback } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Trash2, Building2, Save, Loader2, Calendar, Euro, Package, X, Camera } from 'lucide-react';
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
import ObraMaterialesPanel from '@/components/obras/ObraMaterialesPanel';
import ObraFotosPanel from '@/components/obras/ObraFotosPanel';

const STATUS_CFG = {
  activa: { label: 'Activa', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pausada: { label: 'Pausada', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  finalizada: { label: 'Finalizada', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  presupuesto: { label: 'Presupuesto', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const empty = {
  name: '', code: '', client_id: '', client_name: '', address: '', start_date: '',
  end_date: '', status: 'activa', budget: '', description: '', contact_person: '',
  contact_phone: '', notes: '', type: 'civil',
};

export default function ObrasCiviles() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [detailObra, setDetailObra] = useState(null); // obra selected for detail panel

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['obras-civiles'] });
    qc.invalidateQueries({ queryKey: ['clients'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras-civiles'],
    queryFn: () => base44.entities.ObraCivil.list('-start_date', 300),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  const createM = useMutation({ mutationFn: d => base44.entities.ObraCivil.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['obras-civiles'] }); close_(); } });
  const updateM = useMutation({ mutationFn: ({ id, d }) => base44.entities.ObraCivil.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['obras-civiles'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.ObraCivil.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['obras-civiles'] }) });

  const open_ = (o = null) => { setEditing(o); setForm(o ? { ...o, budget: o.budget || '' } : empty); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleClientChange = (id) => {
    const c = clients.find(c => c.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };

  const handleSave = () => {
    const data = { ...form, budget: parseFloat(form.budget) || 0, type: 'civil' };
    editing ? updateM.mutate({ id: editing.id, d: data }) : createM.mutate(data);
  };

  const isPending = createM.isPending || updateM.isPending;

  const filtered = obras.filter(o => {
    const q = search.toLowerCase();
    const matchQ = !search || o.name?.toLowerCase().includes(q) || o.code?.toLowerCase().includes(q) || o.client_name?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || o.status === statusFilter;
    return matchQ && matchS;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Obras Civiles"
        subtitle={`${filtered.length} obras civiles`}
        hideBack={true}
        actions={<Button onClick={() => open_()} className="gap-2 shadow-sm" size="sm"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Nueva Obra</span></Button>}
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar obra, código, cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="Estado" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">Todos los estados</MobileSelectItem>
          {Object.entries(STATUS_CFG).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay obras civiles registradas</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> Nueva Obra</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(o => {
            const sc = STATUS_CFG[o.status] || STATUS_CFG.activa;
            return (
              <Card key={o.id} className="p-5 hover:shadow-md transition-shadow flex flex-col gap-3 cursor-pointer" onClick={() => setDetailObra(o)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm truncate">{o.name}</h3>
                      {o.code && <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{o.code}</span>}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${sc.className}`}>{sc.label}</Badge>
                  </div>
                  <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(o)}><Pencil className="w-3 h-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar obra?</AlertDialogTitle><AlertDialogDescription>"{o.name}" será eliminada permanentemente.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteM.mutate(o.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {o.client_name && <p className="font-medium text-foreground">{o.client_name}</p>}
                  {o.address && <p className="truncate">{o.address}</p>}
                  {(o.start_date || o.end_date) && (
                    <p className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 shrink-0" />
                      {o.start_date ? format(parseISO(o.start_date), 'd MMM yyyy', { locale: es }) : '—'}
                      {o.end_date ? ` → ${format(parseISO(o.end_date), 'd MMM yyyy', { locale: es })}` : ''}
                    </p>
                  )}
                  {o.budget > 0 && (
                    <p className="flex items-center gap-1 font-semibold text-primary">
                      <Euro className="w-3 h-3 shrink-0" /> {o.budget.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </p>
                  )}
                </div>

                {o.description && <p className="text-xs text-muted-foreground line-clamp-2">{o.description}</p>}
              </Card>
            );
          })}
        </div>
      )}

      </div>
      {/* Obra Detail Panel */}
      <Dialog open={!!detailObra} onOpenChange={v => { if (!v) setDetailObra(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pb-[env(keyboard-inset-height,0)]">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" /> {detailObra?.name}
                </DialogTitle>
                {detailObra?.client_name && <p className="text-xs text-muted-foreground mt-0.5">{detailObra.client_name}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setDetailObra(null); open_(detailObra); }}>
                  <Pencil className="w-3 h-3" /> Editar
                </Button>
              </div>
            </div>
          </DialogHeader>
          {detailObra && (
            <Tabs defaultValue="fotos">
              <TabsList className="mb-4">
                <TabsTrigger value="info" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Info</TabsTrigger>
                <TabsTrigger value="materiales" className="gap-1.5 text-xs"><Package className="w-3.5 h-3.5" /> Materiales</TabsTrigger>
                <TabsTrigger value="fotos" className="gap-1.5 text-xs"><Camera className="w-3.5 h-3.5" /> Fotos</TabsTrigger>
              </TabsList>
              <TabsContent value="info">
                <div className="space-y-2 text-sm">
                  {detailObra.address && <p><span className="text-muted-foreground">Dirección:</span> {detailObra.address}</p>}
                  {detailObra.start_date && <p><span className="text-muted-foreground">Inicio:</span> {format(parseISO(detailObra.start_date), 'd MMM yyyy', { locale: es })}</p>}
                  {detailObra.end_date && <p><span className="text-muted-foreground">Fin previsto:</span> {format(parseISO(detailObra.end_date), 'd MMM yyyy', { locale: es })}</p>}
                  {detailObra.budget > 0 && <p><span className="text-muted-foreground">Presupuesto:</span> <strong className="text-primary">{detailObra.budget.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong></p>}
                  {detailObra.contact_person && <p><span className="text-muted-foreground">Contacto:</span> {detailObra.contact_person} {detailObra.contact_phone && `· ${detailObra.contact_phone}`}</p>}
                  {detailObra.description && <p className="text-muted-foreground italic">{detailObra.description}</p>}
                  {detailObra.notes && <p className="text-muted-foreground">{detailObra.notes}</p>}
                </div>
              </TabsContent>
              <TabsContent value="materiales">
                <ObraMaterialesPanel obra={detailObra} />
              </TabsContent>
              <TabsContent value="fotos">
                <ObraFotosPanel obra={detailObra} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto pb-[env(keyboard-inset-height,0)]">
          <DialogHeader><DialogTitle>{editing ? 'Editar Obra Civil' : 'Nueva Obra Civil'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Nombre de la obra *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Reforma oficinas planta 2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código</Label>
                <Input value={form.code} onChange={e => set('code', e.target.value)} placeholder="OBR-001" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <MobileSelect value={form.status} onValueChange={v => set('status', v)} placeholder="Estado">
                  {Object.entries(STATUS_CFG).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Cliente</Label>
                <MobileSelect value={form.client_id} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
                  {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Dirección</Label>
                <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle, número, ciudad..." />
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
                <Label className="text-xs">Presupuesto (€)</Label>
                <Input type="number" min="0" step="0.01" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono contacto</Label>
                <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="600 000 000" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Persona de contacto</Label>
                <Input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Nombre del responsable en obra" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Descripción / alcance</Label>
                <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Observaciones</Label>
                <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
              </div>
            </div>
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
