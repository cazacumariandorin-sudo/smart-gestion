import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sellarEmpresa } from '@/lib/empresaActiva';
import { Plus, Search, Edit, Trash2, Lock, Eye, EyeOff, Loader2, Play, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, History } from 'lucide-react';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const emptyUsuario = {
  user_email: '', user_id: '', operario_id: '', operario_name: '',
  dni_nie: '', num_afiliacion_ss: '', cuenta_bancaria_iban: '',
  coste_hora: '', salario_bruto_mensual: '', categoria_laboral: '',
  fecha_alta_empresa: '', notas_confidenciales: ''
};
const emptyCliente = {
  cliente_id: '', cliente_nombre: '', numero_cuenta_bancaria: '',
  datos_fiscales: '', contacto_principal_personal: '', precio_especial: '',
  condiciones_pago: '', notas_confidenciales: ''
};

const SENSITIVE_FIELDS = {
  usuarios: ['dni_nie', 'num_afiliacion_ss', 'cuenta_bancaria_iban', 'coste_hora', 'salario_bruto_mensual', 'notas_confidenciales'],
  clientes: ['numero_cuenta_bancaria', 'datos_fiscales', 'contacto_principal_personal', 'precio_especial', 'notas_confidenciales'],
};

export default function DatosSensibles() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('usuarios');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyUsuario);
  const [showSensitive, setShowSensitive] = useState({});
  const [decryptedCache, setDecryptedCache] = useState({});
  const [decrypting, setDecrypting] = useState({});
  const [encrypting, setEncrypting] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrationPreview, setMigrationPreview] = useState(null);

  const { data: usuarios = [], isLoading: usuariosLoading } = useQuery({
    queryKey: ['datos_sensibles_usuarios'],
    queryFn: () => base44.entities.DatosSensiblesUsuario.list('-created_date', 200)
  });

  const { data: clientes = [], isLoading: clientesLoading } = useQuery({
    queryKey: ['datos_sensibles_clientes'],
    queryFn: () => base44.entities.DatosSensiblesCliente.list('-created_date', 200)
  });

  const { data: accessLogs = [] } = useQuery({
    queryKey: ['datos_sensibles_access_logs'],
    queryFn: () => base44.entities.DatosSensiblesAccessLog.list('-fecha', 50),
    enabled: tab === 'auditoria',
  });

  const createM = useMutation({
    mutationFn: d => tab === 'usuarios' ? base44.entities.DatosSensiblesUsuario.create(sellarEmpresa(d)) : base44.entities.DatosSensiblesCliente.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: tab === 'usuarios' ? ['datos_sensibles_usuarios'] : ['datos_sensibles_clientes'] }); close_(); }
  });

  const updateM = useMutation({
    mutationFn: ({ id, d }) => tab === 'usuarios' ? base44.entities.DatosSensiblesUsuario.update(id, d) : base44.entities.DatosSensiblesCliente.update(id, d),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: tab === 'usuarios' ? ['datos_sensibles_usuarios'] : ['datos_sensibles_clientes'] });
      setDecryptedCache(p => { const n = { ...p }; delete n[vars.id]; return n; });
      close_();
    }
  });

  const deleteM = useMutation({
    mutationFn: id => tab === 'usuarios' ? base44.entities.DatosSensiblesUsuario.delete(id) : base44.entities.DatosSensiblesCliente.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tab === 'usuarios' ? ['datos_sensibles_usuarios'] : ['datos_sensibles_clientes'] })
  });

  const migracionPreviewM = useMutation({
    mutationFn: () => base44.functions.invoke('migrarDatosSensibles', { modo: 'preview' }),
    onSuccess: (res) => setMigrationPreview(res.data)
  });

  const migracionEjecutarM = useMutation({
    mutationFn: () => base44.functions.invoke('migrarDatosSensibles', { modo: 'ejecutar' }),
    onSuccess: (res) => {
      setMigrationResult(res.data);
      setMigrationPreview(null);
      qc.invalidateQueries({ queryKey: ['datos_sensibles_usuarios'] });
    }
  });

  const decryptItem = async (item) => {
    if (decryptedCache[item.id]) return decryptedCache[item.id];
    setDecrypting(p => ({ ...p, [item.id]: true }));
    try {
      const sensitiveKeys = SENSITIVE_FIELDS[tab];
      const fields = {};
      sensitiveKeys.forEach(k => { fields[k] = item[k] || ''; });
      const nombre = tab === 'usuarios' ? item.user_email : item.cliente_nombre;
      const res = await base44.functions.invoke('datosSensiblesCrypto', {
        action: 'decrypt', tipo: tab === 'usuarios' ? 'usuario' : 'cliente',
        registro_id: item.id, registro_nombre: nombre, fields,
      });
      setDecryptedCache(p => ({ ...p, [item.id]: res.data.decrypted }));
      return res.data.decrypted;
    } finally {
      setDecrypting(p => ({ ...p, [item.id]: false }));
    }
  };

  const toggleSensitive = async (item) => {
    if (showSensitive[item.id]) { setShowSensitive(p => ({ ...p, [item.id]: false })); return; }
    await decryptItem(item);
    setShowSensitive(p => ({ ...p, [item.id]: true }));
  };

  const open_ = async (item = null) => {
    setEditing(item);
    if (item) {
      const decrypted = await decryptItem(item);
      setForm(tab === 'usuarios' ? {
        user_email: item.user_email || '', user_id: item.user_id || '',
        operario_id: item.operario_id || '', operario_name: item.operario_name || '',
        dni_nie: decrypted.dni_nie || '', num_afiliacion_ss: decrypted.num_afiliacion_ss || '',
        cuenta_bancaria_iban: decrypted.cuenta_bancaria_iban || '',
        coste_hora: decrypted.coste_hora || '', salario_bruto_mensual: decrypted.salario_bruto_mensual || '',
        categoria_laboral: item.categoria_laboral || '', fecha_alta_empresa: item.fecha_alta_empresa || '',
        notas_confidenciales: decrypted.notas_confidenciales || ''
      } : {
        cliente_id: item.cliente_id || '', cliente_nombre: item.cliente_nombre || '',
        numero_cuenta_bancaria: decrypted.numero_cuenta_bancaria || '',
        datos_fiscales: decrypted.datos_fiscales || '', contacto_principal_personal: decrypted.contacto_principal_personal || '',
        precio_especial: decrypted.precio_especial || '', condiciones_pago: item.condiciones_pago || '',
        notas_confidenciales: decrypted.notas_confidenciales || ''
      });
    } else {
      setForm(tab === 'usuarios' ? emptyUsuario : emptyCliente);
    }
    setDialogOpen(true);
  };

  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(tab === 'usuarios' ? emptyUsuario : emptyCliente); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (tab === 'usuarios' && !form.user_email) return;
    if (tab === 'clientes' && (!form.cliente_id || !form.cliente_nombre)) return;
    setEncrypting(true);
    try {
      const sensitiveKeys = SENSITIVE_FIELDS[tab];
      const fields = {};
      sensitiveKeys.forEach(k => { fields[k] = form[k] ?? ''; });
      const res = await base44.functions.invoke('datosSensiblesCrypto', { action: 'encrypt', fields });
      const payload = { ...form, ...res.data.encrypted };
      if (editing) updateM.mutate({ id: editing.id, d: payload });
      else createM.mutate(payload);
    } finally {
      setEncrypting(false);
    }
  };

  const filteredUsuarios = useMemo(() => {
    const q = search.toLowerCase();
    return usuarios.filter(u => u.user_email?.toLowerCase().includes(q) || u.operario_name?.toLowerCase().includes(q));
  }, [usuarios, search]);

  const filteredClientes = useMemo(() => {
    const q = search.toLowerCase();
    return clientes.filter(c => c.cliente_nombre?.toLowerCase().includes(q) || c.cliente_id?.toLowerCase().includes(q));
  }, [clientes, search]);

  const dv = (item, field, suffix = '') => {
    const val = decryptedCache[item.id]?.[field];
    return val ? `${val}${suffix}` : '';
  };

  const MaskField = ({ value, show }) => {
    if (!show) return <span className="text-muted-foreground text-sm flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Protegido</span>;
    if (!value) return <span className="text-muted-foreground text-sm">—</span>;
    return <span className="font-mono text-xs break-all">{value}</span>;
  };

  const resumen = migrationPreview?.resumen || migrationResult?.resumen;
  const isMigrating = migracionPreviewM.isPending || migracionEjecutarM.isPending;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Datos Sensibles"
        subtitle="Cifrado AES-256-GCM + auditoría de accesos — Solo Admin"
        backTo="/users"
        actions={
          tab !== 'auditoria' && (
            <Button onClick={() => open_()} className="gap-2 h-9">
              <Plus className="w-4 h-4" /> Nuevo
            </Button>
          )
        }
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        <Card className="p-3 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Los campos sensibles se cifran (AES-256-GCM) antes de guardarse y se descifran solo bajo demanda; cada descifrado queda registrado en Auditoría.
          </p>
        </Card>

        {/* ── Panel de Migración Fase 0 ───────────────────────────────────── */}
        <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Migración Fase 0 — Datos Sensibles desde Operario</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Importa DNI, coste/hora y categoría laboral desde la entidad Operario hacia DatosSensiblesUsuario. Operación idempotente.
              </p>

              {resumen && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {[
                    { label: 'Operarios', val: resumen.total_operarios },
                    { label: 'Con email', val: resumen.con_email_vinculado },
                    { label: 'Ya migrados', val: resumen.ya_migrados },
                    { label: 'A crear', val: resumen.a_crear_preview ?? resumen.creados },
                    { label: 'A actualizar', val: resumen.a_actualizar_preview ?? resumen.actualizados },
                    { label: 'Sin datos', val: resumen.omitidos_sin_datos },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-white dark:bg-amber-900/30 rounded p-1.5 text-center">
                      <p className="font-bold text-amber-900 dark:text-amber-200">{val ?? '—'}</p>
                      <p className="text-amber-600 dark:text-amber-400">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {migrationResult?.ejecutado && (
                <div className="mt-3 flex items-center gap-2 text-green-700 dark:text-green-400 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  Migración ejecutada correctamente. {migrationResult.resumen?.creados ?? 0} creados, {migrationResult.resumen?.actualizados ?? 0} actualizados.
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                  onClick={() => migracionPreviewM.mutate()}
                  disabled={isMigrating}
                >
                  {migracionPreviewM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Vista previa
                </Button>
                {migrationPreview && !migrationResult?.ejecutado && (
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => migracionEjecutarM.mutate()}
                    disabled={isMigrating}
                  >
                    {migracionEjecutarM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Ejecutar migración ({migrationPreview.resumen?.a_crear_preview ?? 0} registros)
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Tabs principal ──────────────────────────────────────────────── */}
        <Tabs value={tab} onValueChange={v => { setTab(v); setSearch(''); }}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="usuarios">Técnicos / Usuarios</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          </TabsList>

          {/* ── TAB USUARIOS ── */}
          <TabsContent value="usuarios" className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por email o nombre..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {usuariosLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : filteredUsuarios.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl">
                <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hay datos sensibles de usuarios</p>
                <p className="text-xs text-muted-foreground mt-1">Usa la migración para importar desde Operario</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsuarios.map(u => (
                  <Card key={u.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">Usuario</Badge>
                          <span className="truncate">{u.user_email}</span>
                          {u.migrado_desde_operario && <Badge variant="secondary" className="text-[10px]">Migrado</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{u.operario_name || '—'}</p>
                        {u.categoria_laboral && <Badge variant="outline" className="text-[10px] mt-1">{u.categoria_laboral}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSensitive(u)} disabled={decrypting[u.id]}>
                          {decrypting[u.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : showSensitive[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                        <p className="text-muted-foreground mb-1">DNI / NIE</p>
                        <MaskField value={dv(u, 'dni_nie')} show={showSensitive[u.id]} />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Coste/hora</p>
                        <MaskField value={dv(u, 'coste_hora', ' €/h')} show={showSensitive[u.id]} />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Salario Bruto</p>
                        <MaskField value={dv(u, 'salario_bruto_mensual', ' €/mes')} show={showSensitive[u.id]} />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Afiliación SS</p>
                        <MaskField value={dv(u, 'num_afiliacion_ss')} show={showSensitive[u.id]} />
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">IBAN</p>
                        <MaskField value={dv(u, 'cuenta_bancaria_iban')} show={showSensitive[u.id]} />
                      </div>
                      {showSensitive[u.id] && dv(u, 'notas_confidenciales') && (
                        <div className="col-span-2"><p className="text-muted-foreground mb-1">Notas internas</p><p className="text-xs italic text-foreground line-clamp-2">{dv(u, 'notas_confidenciales')}</p></div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── TAB CLIENTES ── */}
          <TabsContent value="clientes" className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre o ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>

            {clientesLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSensitive(c)} disabled={decrypting[c.id]}>
                          {decrypting[c.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : showSensitive[c.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                        <MaskField value={dv(c, 'precio_especial', ' €')} show={showSensitive[c.id]} />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Contacto Personal</p>
                        <MaskField value={dv(c, 'contacto_principal_personal')} show={showSensitive[c.id]} />
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-1">Cuenta Bancaria</p>
                        <MaskField value={dv(c, 'numero_cuenta_bancaria')} show={showSensitive[c.id]} />
                      </div>
                      {showSensitive[c.id] && dv(c, 'notas_confidenciales') && (
                        <div className="col-span-2"><p className="text-muted-foreground mb-1">Notas</p><p className="text-xs italic text-foreground line-clamp-2">{dv(c, 'notas_confidenciales')}</p></div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── TAB AUDITORÍA ── */}
          <TabsContent value="auditoria" className="mt-6 space-y-2">
            {accessLogs.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl">
                <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Todavía no hay accesos registrados</p>
              </div>
            ) : (
              accessLogs.map(log => (
                <Card key={log.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{log.registro_nombre || log.registro_id}</p>
                    <p className="text-xs text-muted-foreground">{log.usuario_email} · {log.entidad_tipo}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{format(new Date(log.fecha), 'dd MMM HH:mm', { locale: es })}</span>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialog crear/editar ─────────────────────────────────────────── */}
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
                  <Label className="text-xs">Email del usuario (ancla) *</Label>
                  <Input value={form.user_email} onChange={e => set('user_email', e.target.value)} placeholder="usuario@email.com" disabled={!!editing} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">DNI / NIE</Label>
                    <Input value={form.dni_nie} onChange={e => set('dni_nie', e.target.value)} placeholder="12345678A" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoría laboral</Label>
                    <select
                      value={form.categoria_laboral}
                      onChange={e => set('categoria_laboral', e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                    >
                      <option value="">Sin categoría</option>
                      {['oficial_primera','oficial_segunda','peon','encargado','tecnico_solar','administrativo','subcontrata','temporal'].map(c => (
                        <option key={c} value={c}>{c.replace('_',' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Coste/hora (€)</Label>
                    <Input type="number" step="0.5" value={form.coste_hora} onChange={e => set('coste_hora', e.target.value)} placeholder="18.50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Salario bruto/mes (€)</Label>
                    <Input type="number" step="100" value={form.salario_bruto_mensual} onChange={e => set('salario_bruto_mensual', e.target.value)} placeholder="2500" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Núm. Afiliación SS</Label>
                  <Input value={form.num_afiliacion_ss} onChange={e => set('num_afiliacion_ss', e.target.value)} placeholder="28/12345678/00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">IBAN Cuenta Bancaria</Label>
                  <Input value={form.cuenta_bancaria_iban} onChange={e => set('cuenta_bancaria_iban', e.target.value)} placeholder="ES12345678901234567890" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fecha alta empresa</Label>
                  <Input type="date" value={form.fecha_alta_empresa} onChange={e => set('fecha_alta_empresa', e.target.value)} />
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
                  <Label className="text-xs">IBAN Cuenta Bancaria</Label>
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
                (tab === 'usuarios' && !form.user_email) ||
                (tab === 'clientes' && (!form.cliente_id || !form.cliente_nombre)) ||
                encrypting || createM.isPending || updateM.isPending
              }
              className="gap-2 min-w-28"
            >
              {(encrypting || createM.isPending || updateM.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}