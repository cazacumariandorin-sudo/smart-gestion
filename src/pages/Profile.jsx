import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  User, Mail, Shield, LogOut, Trash2, ChevronRight, HelpCircle,
  FileText, Scale, Info, Phone, Briefcase, Pencil, Save, X, Hash, ShieldCheck, Link2, Cloud, Loader2,
  Mic, MicOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTecnicoName } from '@/hooks/useTecnicoName';
import { isMicDesactivado } from '@/hooks/useSpeechInput';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { ROLE_LABELS } from '@/lib/roleLabels';

/** Genera iniciales desde el nombre completo (2 letras) */
function buildInitials(fullName, email) {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email || '?').slice(0, 2).toUpperCase();
}

/** Genera User ID con formato MMYY## */
function generateUserId(createdDate, counter = 1) {
  const d = new Date(createdDate || Date.now());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const nn = String(counter).padStart(2, '0');
  return `User-${mm}${yy}${nn}`;
}

export default function Profile() {
  const queryClient = useQueryClient();
  const { getTecnicoName, tecnicos } = useTecnicoName();
  const [legalDialog, setLegalDialog] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', position: '', department: '', avatar_initials: '' });
  const [gdriveConnecting, setGdriveConnecting] = useState(false);
  const [gdriveDialog, setGdriveDialog] = useState(false);
  const appVersion = '1.0.05';
  const CONNECTOR_ID = '69dfc310ad25fc28aa873104'; // SIMANTEC DRIVE  APP
  const [micDesactivado, setMicDesactivado] = useState(() => isMicDesactivado());

  const toggleMic = () => {
    if (micDesactivado) {
      try { localStorage.removeItem('smartgestion_voz_desactivada'); } catch {}
      setMicDesactivado(false);
      toast.success('Micrófono reactivado — los botones de voz volverán a aparecer');
    } else {
      try { localStorage.setItem('smartgestion_voz_desactivada', 'true'); } catch {}
      setMicDesactivado(true);
      toast.info('Micrófono desactivado en la app');
    }
  };

  const handleConnectGdrive = async () => {
    try {
      setGdriveConnecting(true);
      setGdriveDialog(false);
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      const popup = window.open(url, '_blank', 'width=600,height=800');
      
      // Poll until popup closes, then refresh and run setup
      const timer = setInterval(async () => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          toast.success('Google Drive conectado!');
          // Run folder structure setup
          await base44.functions.invoke('createGdriveFolderStructure', {});
          toast.success('Carpetas creadas en Google Drive');
        }
      }, 500);
    } catch (error) {
      toast.error(error.message || 'Error conectando Google Drive');
    } finally {
      setGdriveConnecting(false);
    }
  };

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  // Count existing users to assign a sequential number for new User IDs
  const { data: allUsers } = useQuery({
    queryKey: ['users-count'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!me && !me?.user_id_code,
  });

  // Auto-generate user_id_code if missing
  const updateMeMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
    },
  });

  useEffect(() => {
    if (me && !me.user_id_code && allUsers) {
      const counter = (allUsers.length || 0) + 1;
      const code = generateUserId(me.created_date, counter);
      updateMeMutation.mutate({ user_id_code: code });
    }
  }, [me, allUsers]);

  useEffect(() => {
    if (me) {
      setForm({
        phone: me.phone || '',
        position: me.position || '',
        department: me.department || '',
        avatar_initials: me.avatar_initials || '',
      });
    }
  }, [me]);

  const role = me?.role || 'operario';
  const roleCfg = ROLE_LABELS[role] || { label: role, className: 'bg-gray-100 text-gray-700 border-gray-200' };

  const deleteMutation = useMutation({
    mutationFn: () => base44.functions.invoke('requestAccountDeletion', {}),
    onSuccess: () => {
      base44.auth.logout();
    },
    onError: (err) => {
      const msg = err?.response?.data?.error || err?.message || 'inténtalo de nuevo';
      toast.error(`No se pudo eliminar la cuenta: ${msg}`, { duration: 9000 });
    },
  });

  // Check if this user has a linked tecnico record
  const miTecnico = tecnicos.find(op => op.user_email === me?.email);

  const displayInitials = me?.avatar_initials
    ? me.avatar_initials.toUpperCase()
    : buildInitials(me?.full_name, me?.email);

  const handleSave = () => {
    const updates = { ...form };
    // Auto-set initials from name if user left it blank
    if (!updates.avatar_initials.trim()) {
      updates.avatar_initials = buildInitials(me?.full_name, me?.email);
    }
    updateMeMutation.mutate(updates);
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Mi Perfil</h1>

        {/* Avatar + identity */}
        <Card className="p-6 mb-4 flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 border-2 ${roleCfg.className}`}
          >
            {displayInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base truncate">
              {miTecnico ? miTecnico.name : (me?.full_name || '—')}
            </p>
            {miTecnico && (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                <Link2 className="w-3 h-3" /> Técnico vinculado
              </p>
            )}
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
              <Mail className="w-3.5 h-3.5 shrink-0" /> {me?.email}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={`${roleCfg.className} text-xs`}>
                <Shield className="w-3 h-3 mr-1" /> {roleCfg.label}
              </Badge>
              {me?.user_id_code && (
                <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-200 font-mono">
                  <Hash className="w-3 h-3 mr-1" /> {me.user_id_code}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Editable personal data */}
        <Card className="mb-4 overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between border-b border-border bg-muted/30">
            <p className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> Mis datos
            </p>
            {!editing ? (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={() => setEditing(false)}>
                  <X className="w-3.5 h-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={updateMeMutation.isPending}>
                  {updateMeMutation.isPending ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Guardar
                </Button>
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Read-only name from authentication */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Nombre completo
                <span className="text-[10px] italic text-gray-500 ml-auto">Datos de autenticación</span>
              </Label>
              <p className="text-sm font-medium mt-1">{me?.full_name || '—'}</p>
            </div>

            {/* Read-only email */}
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium mt-1">{me?.email || '—'}</p>
            </div>

            <hr className="border-border" />

            {/* Editable fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Teléfono
                </Label>
                {editing ? (
                  <Input
                    id="phone"
                    placeholder="+34 600 000 000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm min-h-[2rem] flex items-center">{form.phone || <span className="text-muted-foreground italic">Sin rellenar</span>}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="position" className="text-xs flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Cargo
                </Label>
                {editing ? (
                  <Input
                    id="position"
                    placeholder="p.ej. Instalador"
                    value={form.position}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm min-h-[2rem] flex items-center">{form.position || <span className="text-muted-foreground italic">Sin rellenar</span>}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="department" className="text-xs flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" /> Departamento
                </Label>
                {editing ? (
                  <Input
                    id="department"
                    placeholder="p.ej. Mantenimiento"
                    value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm min-h-[2rem] flex items-center">{form.department || <span className="text-muted-foreground italic">Sin rellenar</span>}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="initials" className="text-xs flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" /> Iniciales avatar
                  <span className="text-muted-foreground">(máx. 2)</span>
                </Label>
                {editing ? (
                  <Input
                    id="initials"
                    placeholder={buildInitials(me?.full_name, me?.email)}
                    maxLength={2}
                    value={form.avatar_initials}
                    onChange={e => setForm(f => ({ ...f, avatar_initials: e.target.value.toUpperCase() }))}
                  />
                ) : (
                  <p className="text-sm min-h-[2rem] flex items-center font-mono font-bold">
                    {displayInitials || <span className="text-muted-foreground italic">Auto</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Security info */}
        <Card className="mb-4 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">Seguridad de la cuenta</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Puedes iniciar sesión con <strong>email + contraseña</strong>, <strong>Google</strong> o <strong>Apple ID</strong>.
                Se recomienda activar la <strong>autenticación en 2 pasos (2FA)</strong> desde la configuración de tu cuenta de Google o Apple para mayor seguridad.
              </p>
            </div>
          </div>
        </Card>

        {/* Preferencia de dictado por voz */}
        <Card className="mb-4 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {micDesactivado
                ? <MicOff className="w-4 h-4 text-muted-foreground" />
                : <Mic className="w-4 h-4 text-primary" />}
              <div>
                <p className="text-sm font-medium">Dictado por voz</p>
                <p className="text-xs text-muted-foreground">
                  {micDesactivado ? 'Desactivado — los botones de micrófono están ocultos' : 'Activo — pulsa el icono 🎤 en cualquier campo para dictar'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleMic}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors shrink-0',
                micDesactivado ? 'bg-muted' : 'bg-primary'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                micDesactivado ? 'left-0.5' : 'left-5'
              )} />
            </button>
          </div>
        </Card>

        {/* Google Drive integration */}
        <Card className="mb-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <Cloud className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold mb-1">Google Drive</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Conecta tu Google Drive para almacenar y gestionar archivos de pedidos, obras, gastos y partes de trabajo.
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={() => setGdriveDialog(true)}
              disabled={gdriveConnecting}
              className="gap-2 shrink-0"
            >
              {gdriveConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
              {gdriveConnecting ? 'Conectando...' : 'Conectar'}
            </Button>
          </div>
        </Card>

        {/* Google Drive connection dialog */}
        <Dialog open={gdriveDialog} onOpenChange={setGdriveDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-500" /> Conectar Google Drive
              </DialogTitle>
              <DialogDescription>
                Elige la cuenta Google a conectar
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                Se abrirá Google en una ventana emergente. En el popup, haz clic en "Usar otra cuenta" para seleccionar la cuenta comercial que prefieras.
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                  📝 Pasos:
                </p>
                <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1 ml-3 list-decimal">
                  <li>Haz clic en "Continuar"</li>
                  <li>En el popup, selecciona "Usar otra cuenta"</li>
                  <li>Elige tu cuenta Google comercial</li>
                  <li>Autoriza el acceso a Google Drive</li>
                </ol>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  💡 <strong>Recomendación:</strong> Usa una cuenta comercial compartida (ej: drive@simantec.com) para que todo el equipo tenga acceso.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setGdriveDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConnectGdrive}
                disabled={gdriveConnecting}
                className="flex-1 gap-2"
              >
                {gdriveConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                {gdriveConnecting ? 'Conectando...' : 'Continuar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Actions */}
        <Card className="divide-y divide-border overflow-hidden mb-4">
          <button
            onClick={() => base44.auth.logout()}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </Card>

        {/* Help & Legal */}
        <Card className="divide-y divide-border overflow-hidden mb-4">
          {[
            { key: 'help', icon: HelpCircle, label: 'Centro de Ayudas' },
            { key: 'legal', icon: FileText, label: 'Aviso Legal' },
            { key: 'gdpr', icon: Scale, label: 'Política GDPR' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setLegalDialog(key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/30 overflow-hidden">
          <div className="px-5 py-3 bg-destructive/5 border-b border-destructive/20">
            <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Zona de peligro</p>
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Eliminar cuenta</p>
              <p className="text-xs text-muted-foreground mt-0.5">Esta acción es permanente e irreversible</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Eliminar mi cuenta"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción es permanente e irreversible. Se cerrará tu sesión inmediatamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5 my-2">
                  <li>Se borra tu acceso a la app: no podrás volver a entrar con este email.</li>
                  <li>Tu ficha de técnico u operario se desvincula, no se borra.</li>
                  <li>Los registros laborales (fichajes, partes, nóminas) se conservan por obligación legal.</li>
                  <li>Si eres la única cuenta de administrador, el sistema impedirá el borrado.</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Si solo quieres dejar de usar la app, usa «Cerrar sesión» en lugar de eliminar la cuenta.
                </p>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteMutation.mutate();
                    }}
                    disabled={deleteMutation.isPending}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar mi cuenta'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-6">
          <Info className="w-3.5 h-3.5" />
          <span>Versión {appVersion}</span>
        </div>
      </div>

      {/* Legal dialogs */}
      <Dialog open={legalDialog === 'help'} onOpenChange={o => setLegalDialog(o ? 'help' : null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5 text-primary" /> Centro de Ayudas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {[
              ['📋 Partes de Trabajo', 'Registra el trabajo realizado, incluyendo operarios, materiales y firmas.'],
              ['🕐 Control Horario', 'Fichajes diarios con entrada, salida y pausa. Informes por operario, semana o mes.'],
              ['🏢 Clientes y Obras', 'Gestiona clientes, contactos técnicos y obras asociadas.'],
              ['🧾 Gastos Operarios', 'Registra gastos con foto de ticket. Sistema OCR automático.'],
              ['⚙️ Soporte Técnico', 'Contacta al equipo de administración o revisa la sección de Manuales.'],
            ].map(([title, text]) => (
              <div key={title}><h4 className="font-semibold mb-1">{title}</h4><p className="text-muted-foreground">{text}</p></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={legalDialog === 'legal'} onOpenChange={o => setLegalDialog(o ? 'legal' : null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Aviso Legal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
            {[
              ['1. Titularidad', 'Esta aplicación y todos sus contenidos son propiedad intelectual de la empresa titular.'],
              ['2. Aceptación de Términos', 'El acceso implica la aceptación de estos términos.'],
              ['3. Responsabilidad', 'La empresa no se responsabiliza por daños indirectos o pérdida de datos.'],
              ['4. Licencia de Uso', 'Se concede una licencia personal, intransferible y revocable.'],
              ['5. Cambios en los Términos', 'La empresa se reserva el derecho de modificar estos términos.'],
            ].map(([title, text]) => (
              <div key={title}><h4 className="font-semibold text-foreground mb-1">{title}</h4><p>{text}</p></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={legalDialog === 'gdpr'} onOpenChange={o => setLegalDialog(o ? 'gdpr' : null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="w-5 h-5 text-primary" /> Política GDPR</DialogTitle>
            <DialogDescription>Reglamento General de Protección de Datos (UE) 2016/679</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
            {[
              ['📊 Datos Recopilados', 'Email, nombre, fichajes, gastos y documentación laboral.'],
              ['🔒 Seguridad de Datos', 'Servidores seguros con encriptación y medidas técnicas anti-acceso.'],
              ['📋 Derechos del Usuario', 'Acceso, corrección, borrado y portabilidad de datos. Contacta a administración.'],
              ['🕐 Conservación de Datos', 'Período de relación laboral/comercial y según ley vigente.'],
              ['👥 Compartición de Datos', 'Solo internamente entre roles autorizados. No se ceden a terceros.'],
              ['⚠️ Cookies y Análisis', 'Cookies esenciales de sesión y análisis anónimos de uso.'],
            ].map(([title, text]) => (
              <div key={title}><h4 className="font-semibold text-foreground mb-1">{title}</h4><p>{text}</p></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}