import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Edit, Trash2, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/layout/PageHeader';

const emptyUsuario = { usuario_id: '', usuario_email: '', numero_afiliacion: '', numero_cuenta_bancaria: '', contrato_url: '', datos_personales: '', salario_bruto: '', notas_confidenciales: '' };
const emptyCliente = { cliente_id: '', cliente_nombre: '', numero_cuenta_bancaria: '', datos_fiscales: '', contacto_principal_personal: '', precio_especial: '', condiciones_pago: '', notas_confidenciales: '' };

export default function DatosSensibles() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('usuarios');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyUsuario);
  const [showSensitive, setShowSensitive] = useState({});

  const { data: usuarios = [], isLoading: usuariosLoading } = useQuery({
    queryKey: ['datos_sensibles_usuarios'],
    queryFn: () => base44.entities.DatosSensiblesUsuario.list('-created_date', 200)
  });

  const { data: clientes = [], isLoading: clientesLoading } = useQuery({
    queryKey: ['datos_sensibles_clientes'],
    queryFn: () => base44.entities.DatosSensiblesCliente.list('-created_date', 200)
  });

  const { data: usuariosApp = [] } = useQuery({
    queryKey: ['usuarios_app'],
    queryFn: () => base44.entities.User.list('email', 200)
  });

  const { data: clientesApp = [] } = useQuery({
    queryKey: ['clientes_app'],
    queryFn: () => base44.entities.Client.list('name', 200)
  });

  const createM = useMutation({
    mutationFn: d => tab === 'usuarios' ? base44.entities.DatosSensiblesUsuario.create(d) : base44.entities.DatosSensiblesCliente.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: tab === 'usuarios' ? ['datos_sensibles_usuarios'] : ['datos_sensibles_clientes'] }); close_(); }
  });

  const updateM = useMutation({
    mutationFn: ({ id, d }) => tab === 'usuarios' ? base44.entities.DatosSensiblesUsuario.update(id, d) : base44.entities.DatosSensiblesCliente.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: tab === 'usuarios' ? ['datos_sensibles_usuarios'] : ['datos_sensibles_clientes'] }); close_(); }
  });

  const deleteM = useMutation({
    mutationFn: id => tab === 'usuarios' ? base44.entities.DatosSensiblesUsuario.delete(id) : base44.entities.DatosSensiblesCliente.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tab === 'usuarios' ? ['datos_sensibles_usuarios'] : ['datos_sensibles_clientes'] })
  });

  const open_ = (item = null) => {
    setEditing(item);
    setForm(item || (tab === 'usuarios' ? emptyUsuario : emptyCliente));
    setShowSensitive({});
    setDialogOpen(true);
  };

  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(tab === 'usuarios' ? emptyUsuario : emptyCliente); };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (tab === 'usuarios') {
      if (!form.usuario_id || !form.usuario_email) return;
    } else {
      if (!form.cliente_id || !form.cliente_nombre) return;
    }
    editing ? updateM.mutate({ id: editing.id, d: form }) : createM.mutate(form);
  };

  const filteredUsuarios = useMemo(() => {
    const q = search.toLowerCase();
    return usuarios.filter(u => u.usuario_email?.toLowerCase().includes(q) || u.usuario_id?.toLowerCase().includes(q));
  }, [usuarios, search, tab]);

  const filteredClientes = useMemo(() => {
    const q = search.toLowerCase();
    return clientes.filter(c => c.cliente_nombre?.toLowerCase().includes(q) || c.cliente_id?.toLowerCase().includes(q));
  }, [clientes, search, tab]);

  const toggleSensitive = (id) => setShowSensitive(p => ({ ...p, [id]: !p[id] }));

  const MaskField = ({ value, id, show }) => {
    if (!value) return <span className="text-muted-foreground text-sm">—</span>;
    return show ? <span className="font-mono text-xs">{value}</span> : <span className="text-muted-foreground text-sm flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Protegido</span>;
  };

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Datos Sensibles"
        subtitle="Gestión encriptada de información confidencial - Solo Admin"
        backTo="/users"
        actions={
          <Button onClick={() => open_()} className="gap-2 h-9">
            <Plus className="w-4 h-4" /> Nuevo
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className="grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios" className="mt-6 space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por email o ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {usuariosLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : filteredUsuarios.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl">
                <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay datos sensibles de usuarios</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsuarios.map(u => (
                  <Card key={u.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">Usuario</Badge>
                          {u.usuario_email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">ID: {u.usuario_id}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSensitive(u.id)}>
                          {showSensitive[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => open_(u)}><Edit className="w-3.5 h-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteM.mutate(u.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1">Afiliación SS</p>
                        <MaskField value={u.numero_afiliacion} id={u.id} show={showSensitive[u.id]} />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Salario Bruto</p>
                        <MaskField value={u.salario_bruto ? `${u.salario_bruto}€` : ''} id={u.id} show={showSensitive[u.id]} />
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">Cuenta Bancaria</p>
                        <MaskField value={u.numero_cuenta_bancaria} id={u.id} show={showSensitive[u.id]} />
                      </div>
                      {u.notas_confidenciales && <div className="col-span-2"><p className="text-muted-foreground mb-1">Notas</p><p className="text-xs italic text-foreground line-clamp-2">{u.notas_confidenciales}</p></div>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="clientes" className="mt-6 space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {clientesLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : filteredClientes.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl">
                <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay datos sensibles de clientes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClientes.map(c => (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-sm flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">Cliente</Badge>
                          {c.cliente_nombre}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">ID: {c.cliente_id}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSensitive(c.id)}>
                          {showSensitive[c.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => open_(c)}><Edit className="w-3.5 h-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteM.mutate(c.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1">Precio Especial</p>
                        <MaskField value={c.precio_especial ? `${c.precio_especial}€` : ''} id={c.id} show={showSensitive[c.id]} />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Contacto Personal</p>
                        <MaskField value={c.contacto_principal_personal} id={c.id} show={showSensitive[c.id]} />
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">Cuenta Bancaria</p>
                        <MaskField value={c.numero_cuenta_bancaria} id={c.id} show={showSensitive[c.id]} />
                      </div>
                      {c.notas_confidenciales && <div className="col-span-2"><p className="text-muted-foreground mb-1">Notas</p><p className="text-xs italic text-foreground line-clamp-2">{c.notas_confidenciales}</p></div>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              {editing ? 'Editar Datos Sensibles' : 'Nuevo Registro'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {tab === 'usuarios' ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Usuario (Email) *</Label>
                  <Input
                    value={form.usuario_email}
                    onChange={e => set('usuario_email', e.target.value)}
                    placeholder="usuario@email.com"
                    disabled={!!editing}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ID Usuario *</Label>
                  <Input value={form.usuario_id} onChange={e => set('usuario_id', e.target.value)} placeholder="ID único..." disabled={!!editing} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número Afiliación SS</Label>
                  <Input value={form.numero_afiliacion} onChange={e => set('numero_afiliacion', e.target.value)} placeholder="Ej: 12345678901234567890" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número Cuenta Bancaria (IBAN)</Label>
                  <Input value={form.numero_cuenta_bancaria} onChange={e => set('numero_cuenta_bancaria', e.target.value)} placeholder="ES12345678901234567890" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Salario Bruto (€)</Label>
                  <Input type="number" step="100" value={form.salario_bruto} onChange={e => set('salario_bruto', e.target.value)} placeholder="2500" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Datos Personales (DNI, Domicilio, etc.)</Label>
                  <Textarea value={form.datos_personales} onChange={e => set('datos_personales', e.target.value)} rows={2} placeholder="Información personal sensible..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contrato (URL)</Label>
                  <Input value={form.contrato_url} onChange={e => set('contrato_url', e.target.value)} placeholder="https://..." />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cliente (Nombre) *</Label>
                  <Input value={form.cliente_nombre} onChange={e => set('cliente_nombre', e.target.value)} placeholder="Nombre cliente..." disabled={!!editing} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ID Cliente *</Label>
                  <Input value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} placeholder="ID único..." disabled={!!editing} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número Cuenta Bancaria (IBAN)</Label>
                  <Input value={form.numero_cuenta_bancaria} onChange={e => set('numero_cuenta_bancaria', e.target.value)} placeholder="ES12345678901234567890" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Precio Especial (€)</Label>
                  <Input type="number" step="10" value={form.precio_especial} onChange={e => set('precio_especial', e.target.value)} placeholder="15000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contacto Principal (Teléfono/Email Personal)</Label>
                  <Input value={form.contacto_principal_personal} onChange={e => set('contacto_principal_personal', e.target.value)} placeholder="+34 612 345 678" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Datos Fiscales</Label>
                  <Textarea value={form.datos_fiscales} onChange={e => set('datos_fiscales', e.target.value)} rows={2} placeholder="Domicilio fiscal, información impuestos..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Condiciones de Pago</Label>
                  <Textarea value={form.condiciones_pago} onChange={e => set('condiciones_pago', e.target.value)} rows={2} placeholder="Plazos especiales, formas de pago..." />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Notas Confidenciales</Label>
              <Textarea value={form.notas_confidenciales} onChange={e => set('notas_confidenciales', e.target.value)} rows={2} placeholder="Información interna sensible..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={
                (tab === 'usuarios' && (!form.usuario_id || !form.usuario_email)) ||
                (tab === 'clientes' && (!form.cliente_id || !form.cliente_nombre)) ||
                createM.isPending ||
                updateM.isPending
              }
              className="gap-2 min-w-28"
            >
              {createM.isPending || updateM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}