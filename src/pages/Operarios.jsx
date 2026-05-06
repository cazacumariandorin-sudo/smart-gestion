import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/layout/PageHeader';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Trash2, User, Phone, Mail, CreditCard, Save, Loader2, FileText, Link2 } from 'lucide-react';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DocsList from '@/components/operarios/DocsList';

const empty = { name: '', dni: '', email: '', phone: '', role: '', active: true, user_email: '', user_id: '' };

export default function Operarios() {
  const qc = useQueryClient();
  const defaultTab = typeof window !== 'undefined' && typeof window.location !== 'undefined' && window.location.pathname.includes('documentacion') ? 'documentacion' : 'operarios';
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['operarios'] });
    qc.invalidateQueries({ queryKey: ['obras'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: operarios = [], isLoading } = useQuery({
    queryKey: ['operarios'],
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operarios'] }); close_(); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.Operario.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operarios'] }); close_(); },
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.Operario.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios'] }),
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
      user_id: op.user_id || ''
    } : empty);
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handleSave = () => editing ? updateM.mutate({ id: editing.id, d: form }) : createM.mutate(form);
  const isPending = createM.isPending || updateM.isPending;

  const filtered = operarios.filter(op => {
    const q = search.toLowerCase();
    return !search || op.name?.toLowerCase().includes(q) || op.dni?.toLowerCase().includes(q) || op.email?.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Operarios"
        subtitle={`${operarios.length} operarios registrados`}
        hideBack={true}
        actions={
          <Button onClick={() => open_()} className="gap-2 shadow-sm" size="sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo Operario</span>
          </Button>
        }
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="operarios" className="gap-2">
              <User className="w-4 h-4" /> Operarios
            </TabsTrigger>
            <TabsTrigger value="documentacion" className="gap-2">
              <FileText className="w-4 h-4" /> Documentacion
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operarios">
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar operario..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-xl">
                <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No hay operarios registrados</p>
                <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2">
                  <Plus className="w-3.5 h-3.5" /> Anadir operario
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(op => (
                  <Card key={op.id} className="p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{op.name}</h3>
                        {op.role && <p className="text-xs text-muted-foreground mt-0.5">{op.role}</p>}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(op)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar operario?</AlertDialogTitle>
                              <AlertDialogDescription>"{op.name}" sera eliminado permanentemente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteM.mutate(op.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
                      {op.user_email ? (
                        <p className="text-xs text-green-600 flex items-center gap-1.5 truncate">
                          <Link2 className="w-3 h-3 shrink-0" /> {op.user_email}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-500 flex items-center gap-1.5">
                          <Link2 className="w-3 h-3 shrink-0" /> Sin usuario vinculado
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documentacion">
            <DocsList operarios={operarios} obras={obras} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Operario' : 'Nuevo Operario'}</DialogTitle>
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
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="operario@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Puesto / Categoria</Label>
              <Input value={form.role} onChange={e => set('role', e.target.value)} placeholder="Oficial, Peon, Encargado..." />
            </div>
            <div className="space-y-1.5 pt-1 border-t border-border mt-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-primary" /> Usuario de la app vinculado
              </Label>
              <p className="text-xs text-muted-foreground">
                Asocia este operario a un usuario que hace login.
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