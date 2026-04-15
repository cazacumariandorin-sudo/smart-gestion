import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, Mail, MapPin, Pencil, Trash2, User, X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const emptyClient = { name: '', nif: '', contact_person: '', phone: '', email: '', address: '', notes: '', active: true };

export default function Clients() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyClient); setDialogOpen(true); };
  const openEdit = (client) => { setEditing(client); setForm({ ...client }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyClient); };

  const handleSave = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const filtered = clients.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_person?.toLowerCase().includes(search.toLowerCase())
  );

  const getOrderCount = (clientId) => workOrders.filter(o => o.client_id === clientId).length;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} clientes registrados</p>
        </div>
        <Button onClick={openCreate} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo Cliente</span>
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay clientes registrados</p>
          <Button variant="outline" size="sm" onClick={openCreate} className="gap-2">
            <Plus className="w-3.5 h-3.5" /> Añadir cliente
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(client => (
            <Card key={client.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{client.name}</h3>
                  {client.nif && <p className="text-xs font-mono text-muted-foreground mt-0.5">{client.nif}</p>}
                  {client.contact_person && (
                    <p className="text-xs text-muted-foreground mt-0.5">{client.contact_person}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Badge variant="outline" className="text-[10px]">
                    {getOrderCount(client.id)} partes
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                {client.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" /> {client.phone}
                  </p>
                )}
                {client.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 shrink-0" /> {client.email}
                  </p>
                )}
                {client.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 shrink-0" /> {client.address}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Link to={`/work-orders?client=${client.id}`} className="text-xs text-primary hover:underline font-medium">
                  Ver partes →
                </Link>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(client)}>
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
                        <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                        <AlertDialogDescription>Se eliminará el cliente "{client.name}". Los partes de trabajo existentes no se verán afectados.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(client.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre *</Label>
                <Input placeholder="Nombre del cliente" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NIF / CIF</Label>
                <Input placeholder="B12345678" value={form.nif || ''} onChange={e => setForm(p => ({...p, nif: e.target.value}))} className="font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Persona de contacto</Label>
              <Input placeholder="Contacto" value={form.contact_person} onChange={e => setForm(p => ({...p, contact_person: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono</Label>
                <Input placeholder="600 000 000" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input placeholder="email@ejemplo.com" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <Input placeholder="Calle, número, ciudad" value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <Textarea placeholder="Notas..." value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}