import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, Mail, MapPin, Pencil, Trash2, User, Save, Loader2, ChevronDown, ChevronUp, Building, CreditCard, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const emptyContacto = { nombre: '', telefono: '', email: '' };
const emptyTecnico = { nombre: '', telefono: '', email: '', cargo: '' };
const emptyClient = {
  name: '', nif: '', address: '', postal_code: '', notes: '', active: true,
  contacto_admin: { ...emptyContacto },
  contacto_facturacion: { ...emptyContacto },
  tecnicos: [{ ...emptyTecnico }, { ...emptyTecnico }, { ...emptyTecnico }, { ...emptyTecnico }],
};

/**
 * Genera Client ID: PP + YY + XXX
 * PP  = 2 primeros dígitos del código postal
 * YY  = 2 últimos dígitos del año de registro
 * XXX = 3 últimos dígitos numéricos del NIF/CIF/DNI/NIE
 */
function generateClientId(postalCode, nif, registrationDate) {
  const pp = (postalCode || '').replace(/\D/g, '').slice(0, 2).padStart(2, '0');
  const yy = String(new Date(registrationDate || Date.now()).getFullYear()).slice(-2);
  const xxx = (nif || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
  return `Client Id-${pp}${yy}${xxx}`;
}

function ContactRow({ label, data, icon: Icon, color }) {
  if (!data?.nombre && !data?.telefono && !data?.email) return null;
  return (
    <div className={`rounded-lg p-2.5 border ${color || 'bg-muted/30 border-border'} mb-2`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </p>
      {data.nombre && <p className="text-xs font-medium">{data.nombre}</p>}
      <div className="flex flex-wrap gap-3 mt-1">
        {data.telefono && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{data.telefono}</p>}
        {data.email && <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{data.email}</p>}
      </div>
    </div>
  );
}

function ContactInput({ label, value, onChange, showCargo = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="grid grid-cols-1 gap-2">
        <Input placeholder="Nombre" value={value?.nombre || ''} onChange={e => set('nombre', e.target.value)} className="h-8 text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Teléfono" value={value?.telefono || ''} onChange={e => set('telefono', e.target.value)} className="h-8 text-xs" />
          <Input placeholder="Email" value={value?.email || ''} onChange={e => set('email', e.target.value)} className="h-8 text-xs" />
        </div>
        {showCargo && <Input placeholder="Cargo / especialidad" value={value?.cargo || ''} onChange={e => set('cargo', e.target.value)} className="h-8 text-xs" />}
      </div>
    </div>
  );
}

export default function Clients() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const [expandedCard, setExpandedCard] = useState(null);
  const queryClient = useQueryClient();

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['workorders'] });
  }, [queryClient]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: clients = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('name', 200) });
  const { data: workOrders = [] } = useQuery({ queryKey: ['workorders'], queryFn: () => base44.entities.WorkOrder.list('-date', 500) });

  const createMutation = useMutation({ mutationFn: d => base44.entities.Client.create(d), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); closeDialog(); } });
  const updateMutation = useMutation({ mutationFn: ({ id, data }) => base44.entities.Client.update(id, data), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); closeDialog(); } });
  const deleteMutation = useMutation({ mutationFn: id => base44.entities.Client.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }) });

  const openCreate = () => { setEditing(null); setForm({ ...emptyClient, tecnicos: [{ ...emptyTecnico }, { ...emptyTecnico }, { ...emptyTecnico }, { ...emptyTecnico }] }); setDialogOpen(true); };
  const openEdit = (client) => {
    setEditing(client);
    setForm({
      ...emptyClient, ...client,
      contacto_admin: client.contacto_admin || { ...emptyContacto },
      contacto_facturacion: client.contacto_facturacion || { ...emptyContacto },
      tecnicos: [...(client.tecnicos || []), emptyTecnico, emptyTecnico, emptyTecnico, emptyTecnico].slice(0, 4),
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyClient); };

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setTecnico = (idx, v) => setForm(p => { const t = [...p.tecnicos]; t[idx] = v; return { ...p, tecnicos: t }; });

  const handleSave = () => {
    const data = { ...form };
    // Generate client_id_code only on creation (or if missing)
    if (!editing && !data.client_id_code) {
      data.client_id_code = generateClientId(data.postal_code, data.nif, new Date());
    }
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = clients.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()));
  const getOrderCount = id => workOrders.filter(o => o.client_id === id).length;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} clientes</p>
        </div>
        <Button onClick={openCreate} className="gap-2 shadow-sm"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo Cliente</span></Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay clientes</p>
          <Button variant="outline" size="sm" onClick={openCreate} className="gap-2"><Plus className="w-3.5 h-3.5" />Añadir cliente</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(client => {
            const expanded = expandedCard === client.id;
            const hasTecnicos = client.tecnicos?.some(t => t.nombre);
            return (
              <Card key={client.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{client.name}</h3>
                    {client.nif && <p className="text-xs font-mono text-muted-foreground">{client.nif}</p>}
                    {client.client_id_code && (
                      <p className="text-[10px] font-mono text-primary/70 font-semibold mt-0.5">{client.client_id_code}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Badge variant="outline" className="text-[10px]">{getOrderCount(client.id)} partes</Badge>
                  </div>
                </div>

                {client.address && <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2"><MapPin className="w-3 h-3 shrink-0" />{client.address}</p>}

                <ContactRow label="Administración" data={client.contacto_admin} icon={Building} color="bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30" />
                <ContactRow label="Facturación" data={client.contacto_facturacion} icon={CreditCard} color="bg-green-50 border-green-100 dark:bg-green-950/20 dark:border-green-900/30" />

                {hasTecnicos && (
                  <div>
                    <button onClick={() => setExpandedCard(expanded ? null : client.id)} className="text-[10px] text-primary font-medium flex items-center gap-1 mb-2">
                      <Wrench className="w-3 h-3" /> Técnicos {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {expanded && client.tecnicos?.filter(t => t.nombre).map((t, i) => (
                      <div key={i} className="bg-amber-50 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 rounded-lg p-2 mb-1">
                        <p className="text-xs font-medium">{t.nombre} {t.cargo && <span className="text-muted-foreground">— {t.cargo}</span>}</p>
                        <div className="flex gap-3 mt-0.5">
                          {t.telefono && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{t.telefono}</p>}
                          {t.email && <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{t.email}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
                  <Link to={`/work-orders?client=${client.id}`} className="text-xs text-primary hover:underline font-medium">Ver partes →</Link>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(client)}><Pencil className="w-3 h-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle><AlertDialogDescription>Se eliminará "{client.name}".</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(client.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle></DialogHeader>
          <Tabs defaultValue="general">
            <TabsList className="mb-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="contactos">Contactos</TabsTrigger>
              <TabsTrigger value="tecnicos">Técnicos</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre *</Label>
                  <Input placeholder="Nombre del cliente" value={form.name} onChange={e => setF('name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">NIF / CIF</Label>
                  <Input placeholder="B12345678" value={form.nif || ''} onChange={e => setF('nif', e.target.value)} className="font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">Dirección</Label>
                  <Input placeholder="Calle, número, ciudad" value={form.address || ''} onChange={e => setF('address', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Código Postal</Label>
                  <Input placeholder="28001" value={form.postal_code || ''} onChange={e => setF('postal_code', e.target.value)} className="font-mono" maxLength={5} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Observaciones</Label>
                <Textarea placeholder="Notas..." value={form.notes || ''} onChange={e => setF('notes', e.target.value)} rows={2} />
              </div>
            </TabsContent>

            <TabsContent value="contactos" className="space-y-4">
              <ContactInput label="📋 Administración" value={form.contacto_admin} onChange={v => setF('contacto_admin', v)} />
              <ContactInput label="💶 Facturación" value={form.contacto_facturacion} onChange={v => setF('contacto_facturacion', v)} />
            </TabsContent>

            <TabsContent value="tecnicos" className="space-y-3">
              {[0,1,2,3].map(i => (
                <ContactInput key={i} label={`🔧 Técnico ${i + 1}`} value={form.tecnicos?.[i] || emptyTecnico} onChange={v => setTecnico(i, v)} showCargo />
              ))}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}