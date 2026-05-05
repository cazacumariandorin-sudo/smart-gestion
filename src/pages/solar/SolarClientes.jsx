import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Users, Loader2, Save, X, Mail, Phone, Building2, Database, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const tipoCfg = {
  particular: { label: 'Particular', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  empresa:    { label: 'Empresa',    className: 'bg-violet-100 text-violet-700 border-violet-200' },
  comunidad:  { label: 'Comunidad',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const emptyForm = { name: '', nif: '', address: '', postal_code: '', phone: '', email: '', tipo: 'particular', active: true, notes: '' };

export default function SolarClientes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  // 'select' = picker from obras clients | 'manual' = manual form
  const [mode, setMode] = useState('select');
  const [clientSearch, setClientSearch] = useState('');

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['solar_clientes'],
    queryFn: () => base44.entities.SolarCliente.list('name', 300),
  });

  const { data: obrasClientes = [] } = useQuery({
    queryKey: ['clients_obras'],
    queryFn: () => base44.entities.Client.list('name', 300),
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.SolarCliente.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_clientes'] }); toast.success('Cliente solar creado'); close_(); },
    onError: () => toast.error('Error al crear el cliente'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.SolarCliente.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_clientes'] }); toast.success('Cliente actualizado'); close_(); },
    onError: () => toast.error('Error al guardar'),
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.SolarCliente.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_clientes'] }); toast.success('Cliente eliminado'); },
  });

  const open_ = (c = null) => {
    setEditing(c);
    setForm(c ? { ...c } : emptyForm);
    setMode(c ? 'manual' : 'select');
    setClientSearch('');
    setDialogOpen(true);
  };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); setClientSearch(''); };

  const importFromObrasClient = (oc) => {
    setForm({
      name: oc.name || '',
      nif: oc.nif || '',
      address: oc.address || '',
      postal_code: oc.postal_code || '',
      phone: oc.contacto_admin?.telefono || (oc.tecnicos?.[0]?.telefono) || '',
      email: oc.contacto_admin?.email || (oc.tecnicos?.[0]?.email) || '',
      tipo: 'empresa',
      active: true,
      notes: '',
    });
    setMode('manual');
  };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (editing) updateM.mutate({ id: editing.id, d: form });
    else createM.mutate(form);
  };

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase();
    return !search || c.name?.toLowerCase().includes(q) || c.nif?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} clientes</p>
        <Button onClick={() => open_()} className="gap-2 shadow-sm" size="sm">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No hay clientes solares</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> Nuevo cliente</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const cfg = tipoCfg[c.tipo] || tipoCfg.particular;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{c.name}</h3>
                      <Badge variant="outline" className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                      {!c.active && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-600 border-red-200">Inactivo</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {c.nif && <span>NIF: {c.nif}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                    </div>
                    {c.address && <p className="text-xs text-muted-foreground mt-0.5">{c.address}{c.postal_code ? ` · ${c.postal_code}` : ''}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(c)}><Pencil className="w-3 h-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(c.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
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
          <DialogHeader><DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente solar'}</DialogTitle></DialogHeader>

          {/* Mode selector — only on new */}
          {!editing && (
            <div className="flex gap-2 -mt-1">
              <button
                type="button"
                onClick={() => setMode('select')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${mode === 'select' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`}
              >
                <Database className="w-4 h-4" /> Desde base de datos
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'}`}
              >
                <PenLine className="w-4 h-4" /> Añadir manualmente
              </button>
            </div>
          )}

          {/* SELECT FROM OBRAS DB */}
          {mode === 'select' && !editing && (
            <div className="space-y-3 py-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar en clientes de obras..."
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {obrasClientes
                  .filter(oc => {
                    if (!clientSearch) return true;
                    const q = clientSearch.toLowerCase();
                    return oc.name?.toLowerCase().includes(q) || oc.nif?.toLowerCase().includes(q);
                  })
                  .map(oc => (
                    <button
                      key={oc.id}
                      type="button"
                      onClick={() => importFromObrasClient(oc)}
                      className="w-full text-left rounded-xl border border-border hover:border-primary hover:bg-accent/40 transition-colors px-4 py-3 group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm group-hover:text-primary">{oc.name}</p>
                          <p className="text-xs text-muted-foreground">{oc.nif || ''}{oc.nif && oc.address ? ' · ' : ''}{oc.address || ''}</p>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                      </div>
                    </button>
                  ))}
                {obrasClientes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No hay clientes en la base de datos de obras</p>
                )}
              </div>
              <div className="pt-1 border-t border-border">
                <button type="button" onClick={() => setMode('manual')} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <PenLine className="w-3 h-3" /> ¿No está en la lista? Añadir manualmente
                </button>
              </div>
            </div>
          )}

          {/* MANUAL FORM */}
          {(mode === 'manual' || editing) && (
          <div className="space-y-4 py-2">
            {form.name && !editing && (
              <div className="flex items-center gap-2 text-xs bg-accent/50 text-accent-foreground rounded-lg px-3 py-2">
                <Database className="w-3.5 h-3.5 shrink-0 text-primary" />
                Datos importados de la BD — revisa y guarda
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Nombre *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NIF / CIF</Label>
                <Input value={form.nif} onChange={e => set('nif', e.target.value)} placeholder="12345678A" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <MobileSelect value={form.tipo} onValueChange={v => set('tipo', v)} placeholder="Tipo">
                  {Object.entries(tipoCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+34 600..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@..." />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Dirección</Label>
                <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Calle..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código postal</Label>
                <Input value={form.postal_code} onChange={e => set('postal_code', e.target.value)} placeholder="28001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <MobileSelect value={form.active ? 'activo' : 'inactivo'} onValueChange={v => set('active', v === 'activo')} placeholder="Estado">
                  <MobileSelectItem value="activo">Activo</MobileSelectItem>
                  <MobileSelectItem value="inactivo">Inactivo</MobileSelectItem>
                </MobileSelect>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Observaciones</Label>
                <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Notas..." />
              </div>
            </div>
          </div>
          )}

          {(mode === 'manual' || editing) && (
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || isPending} className="gap-2 min-w-24">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}