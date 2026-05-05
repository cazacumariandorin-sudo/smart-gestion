import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Edit, Trash2, Package, Wrench, User, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import PageHeader from '@/components/layout/PageHeader';

const CATEGORIAS = {
  escalera: { label: 'Escalera', color: 'bg-orange-100 text-orange-700 border-orange-200', emoji: '🪜' },
  taladro: { label: 'Taladro', color: 'bg-blue-100 text-blue-700 border-blue-200', emoji: '🔨' },
  atornillador: { label: 'Atornillador', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', emoji: '🔩' },
  radial: { label: 'Radial', color: 'bg-red-100 text-red-700 border-red-200', emoji: '⚙️' },
  maquina_tiros: { label: 'Máquina Tiros', color: 'bg-purple-100 text-purple-700 border-purple-200', emoji: '⚡' },
  otros: { label: 'Otros', color: 'bg-slate-100 text-slate-700 border-slate-200', emoji: '📦' },
};

const ESTADOS = {
  disponible: { label: 'Disponible', color: 'bg-green-100 text-green-700' },
  en_uso: { label: 'En Uso', color: 'bg-blue-100 text-blue-700' },
  mantenimiento: { label: 'Mantenimiento', color: 'bg-yellow-100 text-yellow-700' },
  baja: { label: 'Baja', color: 'bg-red-100 text-red-700' },
};

const emptyHerramienta = { nombre: '', categoria: 'otros', modelo: '', numero_serie: '', estado: 'disponible', valor_compra: '', fecha_compra: '', ubicacion: '', notas: '' };
const emptyAsignacion = { herramienta_id: '', operario_id: '', fecha_asignacion: new Date().toISOString().split('T')[0], fecha_devolucion: '', estado_asignacion: 'asignada', obra_id: '', notas: '' };

export default function Inventario() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('herramientas');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyHerramienta);

  const { data: herramientas = [], isLoading: herramientasLoading, refetch: refetchH } = useQuery({
    queryKey: ['herramientas'],
    queryFn: () => base44.entities.Herramienta.list('-created_date', 300)
  });

  const { data: asignaciones = [], isLoading: asignacionesLoading, refetch: refetchA } = useQuery({
    queryKey: ['asignaciones_herramientas'],
    queryFn: () => base44.entities.AsignacionHerramienta.list('-fecha_asignacion', 500)
  });

  const onRefresh = useCallback(async () => { await Promise.all([refetchH(), refetchA()]); }, [refetchH, refetchA]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('name', 200)
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.Herramienta.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['herramientas'] }); close_(); }
  });

  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Herramienta.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['herramientas'] }); close_(); }
  });

  const deleteM = useMutation({
    mutationFn: id => base44.entities.Herramienta.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['herramientas'] })
  });

  const deleteAsignacionM = useMutation({
    mutationFn: id => base44.entities.AsignacionHerramienta.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asignaciones_herramientas'] })
  });

  const open_ = (item = null) => {
    setEditing(item);
    setForm(item || emptyHerramienta);
    setDialogOpen(true);
  };

  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyHerramienta); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.nombre || !form.categoria) return;
    editing ? updateM.mutate({ id: editing.id, d: form }) : createM.mutate(form);
  };

  const filteredHerramientas = useMemo(() => {
    const q = search.toLowerCase();
    return herramientas.filter(h => {
      const matchQ = !search || h.nombre?.toLowerCase().includes(q) || h.numero_serie?.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || h.categoria === categoryFilter;
      return matchQ && matchCat;
    });
  }, [herramientas, search, categoryFilter]);

  const asignacionesActivas = asignaciones.filter(a => a.estado_asignacion === 'asignada');
  const herramientasAsignadas = new Set(asignacionesActivas.map(a => a.herramienta_id));
  const herramientasDisponibles = herramientas.filter(h => !herramientasAsignadas.has(h.id) && h.estado === 'disponible');

  const countByCategory = useMemo(() => {
    const map = {};
    herramientas.forEach(h => {
      map[h.categoria] = (map[h.categoria] || 0) + 1;
    });
    return map;
  }, [herramientas]);

  return (
    <div className="max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <PageHeader
        title="Inventario"
        subtitle="Gestión de herramientas y maquinaria"
        backTo="/users"
        actions={
          <Button onClick={() => { setTab('herramientas'); open_(); }} className="gap-2 h-9">
            <Plus className="w-4 h-4" /> Nueva Herramienta
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="herramientas">Herramientas ({herramientas.length})</TabsTrigger>
            <TabsTrigger value="asignaciones">Asignaciones ({asignacionesActivas.length})</TabsTrigger>
          </TabsList>

          {/* HERRAMIENTAS */}
          <TabsContent value="herramientas" className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre o serie..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <MobileSelect value={categoryFilter} onValueChange={setCategoryFilter} placeholder="Categoría" triggerClassName="w-full sm:w-44">
                <MobileSelectItem value="all">Todas las categorías</MobileSelectItem>
                {Object.entries(CATEGORIAS).map(([key, cfg]) => (
                  <MobileSelectItem key={key} value={key}>{cfg.emoji} {cfg.label}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>

            {/* Stats by category */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Object.entries(CATEGORIAS).map(([key, cfg]) => (
                <Card key={key} className="p-3 text-center">
                  <p className="text-lg mb-1">{cfg.emoji}</p>
                  <p className="text-xs font-semibold text-foreground">{countByCategory[key] || 0}</p>
                  <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                </Card>
              ))}
            </div>

            {herramientasLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : filteredHerramientas.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay herramientas en esta categoría</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHerramientas.map(h => {
                  const asignada = asignacionesActivas.find(a => a.herramienta_id === h.id);
                  const catCfg = CATEGORIAS[h.categoria];
                  const estCfg = ESTADOS[h.estado];
                  return (
                    <Card key={h.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{catCfg.emoji}</span>
                            <p className="font-semibold text-sm">{h.nombre}</p>
                            <Badge className={estCfg.color} variant="outline">{estCfg.label}</Badge>
                            {asignada && (
                              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">
                                📦 {asignada.operario_name}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {h.numero_serie && <p>Serie: {h.numero_serie}</p>}
                            {h.modelo && <p>Modelo: {h.modelo}</p>}
                            {h.ubicacion && <p>📍 {h.ubicacion}</p>}
                            {h.valor_compra && <p>Valor: {h.valor_compra}€ {h.fecha_compra && `(${h.fecha_compra})`}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => open_(h)}><Edit className="w-3.5 h-3.5" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>¿Eliminar herramienta?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteM.mutate(h.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ASIGNACIONES */}
          <TabsContent value="asignaciones" className="mt-6 space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por operario o herramienta..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {asignacionesLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : asignacionesActivas.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl">
                <Wrench className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay asignaciones activas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {asignacionesActivas.filter(a => !search || a.operario_name?.toLowerCase().includes(search.toLowerCase()) || a.herramienta_nombre?.toLowerCase().includes(search.toLowerCase())).map(a => (
                  <Card key={a.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{CATEGORIAS[herramientas.find(h => h.id === a.herramienta_id)?.categoria]?.emoji || '📦'}</span>
                          <p className="font-semibold text-sm">{a.herramienta_nombre}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" /> {a.operario_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> {a.fecha_asignacion}
                          </div>
                          {a.obra_name && <div className="col-span-2">📍 {a.obra_name}</div>}
                          {a.notas && <div className="col-span-2 italic">{a.notas}</div>}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle><AlertDialogDescription>Se marcará como devuelta.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAsignacionM.mutate(a.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Quick assign button */}
            {herramientasDisponibles.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <Button
                  onClick={() => {
                    setTab('herramientas');
                    // Triggered assignment from herramientas tab
                  }}
                  className="gap-2 w-full"
                >
                  <Plus className="w-4 h-4" /> Asignar Herramienta
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog - Herramienta */}
      <Dialog open={dialogOpen && tab === 'herramientas'} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {editing ? 'Editar Herramienta' : 'Nueva Herramienta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre *</Label>
              <Input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Taladro Bosch..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría *</Label>
              <MobileSelect value={form.categoria} onValueChange={v => set('categoria', v)} placeholder="Seleccionar...">
                {Object.entries(CATEGORIAS).map(([key, cfg]) => (
                  <MobileSelectItem key={key} value={key}>{cfg.emoji} {cfg.label}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input value={form.modelo} onChange={e => set('modelo', e.target.value)} placeholder="Modelo..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Número Serie</Label>
                <Input value={form.numero_serie} onChange={e => set('numero_serie', e.target.value)} placeholder="Serie..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estado</Label>
              <MobileSelect value={form.estado} onValueChange={v => set('estado', v)} placeholder="Seleccionar...">
                {Object.entries(ESTADOS).map(([key, cfg]) => (
                  <MobileSelectItem key={key} value={key}>{cfg.label}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor Compra (€)</Label>
                <Input type="number" step="10" value={form.valor_compra} onChange={e => set('valor_compra', e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha Compra</Label>
                <Input type="date" value={form.fecha_compra} onChange={e => set('fecha_compra', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ubicación</Label>
              <Input value={form.ubicacion} onChange={e => set('ubicacion', e.target.value)} placeholder="Almacén, Obra, etc..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notas</Label>
              <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Observaciones..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nombre || !form.categoria || createM.isPending || updateM.isPending} className="gap-2 min-w-28">
              {createM.isPending || updateM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}