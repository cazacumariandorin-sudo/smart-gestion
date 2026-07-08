import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/layout/PageHeader';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Plus, Search, Pencil, Trash2, User, Phone, Mail, CreditCard, Save, Loader2, FileText, Link2, CheckCircle2, BadgeCheck } from 'lucide-react';
import AltaUnificadaDialog from '@/components/tecnicos/AltaUnificadaDialog';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DocsList from '@/components/operarios/DocsList';
import QueryErrorFallback from '@/components/QueryErrorFallback';

const CATEGORIAS = [
  { value: 'oficial_primera', label: 'Oficial Primera' },
  { value: 'oficial_segunda', label: 'Oficial Segunda' },
  { value: 'peon', label: 'Peón' },
  { value: 'encargado', label: 'Encargado' },
  { value: 'tecnico_solar', label: 'Técnico Solar' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'subcontrata', label: 'Subcontrata' },
  { value: 'temporal', label: 'Temporal' },
];

const empty = { name: '', dni: '', email: '', phone: '', role: '', active: true, user_email: '', user_id: '', categoria: '', especialidad: '', coste_hora: '' };

export default function Tecnicos() {
  const qc = useQueryClient();
  const { isAdmin, isJefeObra, isGerencia, role } = useUserRole();
  const showUserCol = isAdmin || isGerencia;
  const canCreate = isAdmin || isGerencia || role === 'director_comercial';
  const canDelete = isAdmin;
  const defaultTab = typeof window !== 'undefined' && typeof window.location !== 'undefined' && window.location.pathname.includes('documentacion') ? 'documentacion' : 'tecnicos';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [altaUnificadaOpen, setAltaUnificadaOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['tecnicos'] });
    qc.invalidateQueries({ queryKey: ['obras'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: tecnicos = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['tecnicos'],
    queryFn: () => base44.entities.Operario.list('name', 200),
  });

  const { data: appUsers = [] } = useQuery({
    queryKey: ['app_users_list'],
    queryFn: () => base44.entities.User.list('full_name', 200),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('name', 300),
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.Operario.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tecnicos'] }); close_(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Operario.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tecnicos'] }); close_(); },
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.Operario.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tecnicos'] }),
  });

  const open_ = (op = null) => {
    setEditing(op);
    setForm(op ? {
      name: op.name || '',
      dni: op.dni || '',
      email: op.email || '',
      phone: op.phone || '',
      role: op.role || '',
      active: op.active !== false,
      user_email: op.user_email || '',
      user_id: op.user_id || '',
      categoria: op.categoria || '',
      especialidad: op.especialidad || '',
      coste_hora: op.coste_hora || '',
    } : empty);
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = () => editing ? updateM.mutate({ id: editing.id, d: form }) : createM.mutate(form);
  const isPending = createM.isPending || updateM.isPending;

  const filtered = tecnicos.filter(op => {
    const q = search.toLowerCase();
    return !search || op.name?.toLowerCase().includes(q) || op.dni?.toLowerCase().includes(q) || op.email?.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Técnicos"
        subtitle={`${tecnicos.length} técnicos registrados`}
        hideBack={true}
        actions={canCreate && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAltaUnificadaOpen(true)} className="gap-2 shadow-sm" size="sm">
              <BadgeCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Alta Unificada</span>
            </Button>
            <Button onClick={() => open_()} className="gap-2 shadow-sm" size="sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Técnico</span>
            </Button>
          </div>
        )}
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { value: 'tecnicos',     label: 'Técnicos',  icon: User,     color: 'bg-teal-500 hover:bg-teal-600 border-teal-600 shadow-teal-200' },
              { value: 'documentacion', label: 'Documentación', icon: FileText, color: 'bg-indigo-500 hover:bg-indigo-600 border-indigo-600 shadow-indigo-200' },
            ].map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={[
                  'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm text-white shadow-md',
                  'transition-all duration-150 hover:scale-105 hover:shadow-lg active:scale-95',
                  color,
                  activeTab === value ? 'ring-2 ring-offset-2 ring-current scale-105 shadow-lg' : 'opacity-80',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <TabsList className="hidden">
            <TabsTrigger value="tecnicos" />
            <TabsTrigger value="documentacion" />
          </TabsList>

          <TabsContent value="tecnicos">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar técnico..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading || isError || filtered.length === 0 ? (
              <>
                <QueryErrorFallback
                  isLoading={isLoading}
                  error={isError ? error : null}
                  isEmpty={!isLoading && !isError && filtered.length === 0}
                  retryFn={refetch}
                  emptyMessage="No hay técnicos registrados"
                />
                {!isLoading && !isError && filtered.length === 0 && canCreate && (
                  <div className="text-center -mt-6">
                    <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2">
                      <Plus className="w-3.5 h-3.5" /> Añadir técnico
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(op => (
                  <Card key={op.id} className="p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{op.name}</h3>
                        {op.num_empleado && (
                          <span className="inline-block text-[10px] font-mono bg-primary/10 text-primary rounded px-1.5 py-0.5 mt-0.5">{op.num_empleado}</span>
                        )}
                        {op.role && <p className="text-xs text-muted-foreground mt-0.5">{op.role}</p>}
                      </div>
                      <div className="flex gap-1 ml-2">
                        {canCreate && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(op)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar técnico?</AlertDialogTitle>
                                <AlertDialogDescription>"{op.name}" (Técnico) será eliminado permanentemente.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteM.mutate(op.id)} className="bg-destructive text-destructive-foreground">
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {op.dni && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <CreditCard className="w-3 h-3 shrink-0" /> {op.dni}
                        </p>
                      )}
                      {op.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Phone className="w-3 h-3 shrink-0" /> {op.phone}
                        </p>
                      )}
                      {op.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 shrink-0" /> {op.email}
                        </p>
                      )}
                      {showUserCol && (
                        op.user_email ? (
                          <p className="text-xs text-green-600 flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> {op.user_email}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-500 flex items-center gap-1.5">
                            <Link2 className="w-3 h-3 shrink-0" /> Sin usuario vinculado
                          </p>
                        )
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documentacion">
            <DocsList operarios={tecnicos} obras={obras} />
          </TabsContent>
        </Tabs>
      </div>

      <AltaUnificadaDialog open={altaUnificadaOpen} onOpenChange={setAltaUnificadaOpen} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Técnico' : 'Nuevo Técnico'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre completo *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre y apellidos" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">DNI / NIE</Label>
                <Input value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="12345678A" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefono</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="600 000 000" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="tecnico@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Puesto / Cargo</Label>
              <Input value={form.role} onChange={e => set('role', e.target.value)} placeholder="Cargo descriptivo..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría profesional</Label>
              <MobileSelect value={form.categoria || ''} onValueChange={v => set('categoria', v)} placeholder="Seleccionar categoría...">
                <MobileSelectItem value="">Sin categoría</MobileSelectItem>
                {CATEGORIAS.map(c => <MobileSelectItem key={c.value} value={c.value}>{c.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Especialidad técnica</Label>
                <Input value={form.especialidad} onChange={e => set('especialidad', e.target.value)} placeholder="Fotovoltaica, electricidad..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Coste/hora (€)</Label>
                <Input type="number" value={form.coste_hora} onChange={e => set('coste_hora', parseFloat(e.target.value) || '')} placeholder="0.00" min="0" step="0.5" />
              </div>
            </div>
            {(isAdmin || isGerencia) && (
              <div className="space-y-1.5 pt-1 border-t border-border mt-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-primary" /> Usuario de la app vinculado
                </Label>
                <p className="text-xs text-muted-foreground">
                  Asocia este técnico a un usuario que hace login.
                </p>
                <MobileSelect
                  value={form.user_email}
                  onValueChange={(val) => {
                    const u = appUsers.find(u => u.email === val);
                    set('user_email', val);
                    set('user_id', u?.id || '');
                  }}
                  placeholder="Sin usuario vinculado"
                >
                  <MobileSelectItem value="">Sin usuario vinculado</MobileSelectItem>
                  {appUsers.map(u => (
                    <MobileSelectItem key={u.id} value={u.email}>
                      {u.full_name || u.email}
                    </MobileSelectItem>
                  ))}
                </MobileSelect>
                {form.user_email && (
                  <p className="text-xs text-green-600 font-medium">Vinculado: {form.user_email}</p>
                )}
              </div>
            )}
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