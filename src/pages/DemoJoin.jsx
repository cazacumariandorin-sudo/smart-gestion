import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FlaskConical, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { isPast } from 'date-fns';
import { toast } from 'sonner';

export default function DemoJoin() {
  const urlParams = new URLSearchParams(window.location.search);
  const codigo = urlParams.get('codigo');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: invitaciones = [], isLoading: loadingInv } = useQuery({
    queryKey: ['inv-demo-public', codigo],
    queryFn: () => base44.entities.InvitacionDemo.filter({ codigo }),
    enabled: !!codigo,
  });

  const invitacion = invitaciones[0];
  const isValid = invitacion && invitacion.activa && !invitacion.usada && !isPast(new Date(invitacion.fecha_expiracion));

  const joinMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg('');
      
      // Validaciones
      if (password.length < 8) {
        throw new Error('La contraseña debe tener al menos 8 caracteres');
      }
      if (password !== confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }
      if (!accepted) {
        throw new Error('Debes aceptar las condiciones de uso demo');
      }
      
      // Verificar email único
      const existingUsers = await base44.entities.User.filter({ email });
      if (existingUsers.length > 0) {
        throw new Error('Este email ya tiene una cuenta activa en la plataforma.');
      }
      
      // Verificar email destino si aplica
      if (invitacion.email_destino && invitacion.email_destino !== email) {
        throw new Error('Esta invitación está reservada para otro email.');
      }

      const expiresAt = new Date(invitacion.fecha_expiracion).toISOString();

      // Invitar usuario con rol demo
      await base44.users.inviteUser(email, 'usuario_demo');

      // Actualizar usuario con datos demo
      const users = await base44.entities.User.filter({ email });
      if (users.length > 0) {
        await base44.entities.User.update(users[0].id, {
          tipo_cuenta: 'demo',
          demo_expires_at: expiresAt,
          invitado_por: invitacion.generada_por_email,
        });
      }

      // Marcar invitación como usada
      await base44.entities.InvitacionDemo.update(invitacion.id, {
        usada: true,
        fecha_uso: new Date().toISOString(),
        demo_user_email: email,
      });

      setDone(true);
      toast.success('¡Cuenta demo creada! Redirigiendo al login...');
      
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    },
    onError: (err) => {
      console.error('Error al crear demo:', err);
      setErrorMsg(err.message || 'Error al procesar la invitación');
    },
  });

  if (!codigo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-2">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Link inválido</h1>
          <p className="text-sm text-muted-foreground">Este link de invitación no es válido.</p>
        </div>
      </div>
    );
  }

  if (loadingInv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-3 max-w-sm">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-lg font-semibold">Invitación no válida</h1>
          <p className="text-sm text-muted-foreground">
            {!invitacion
              ? 'Esta invitación no existe.'
              : invitacion.usada
              ? 'Esta invitación ya fue utilizada.'
              : !invitacion.activa
              ? 'Esta invitación fue revocada.'
              : 'Esta invitación ha expirado.'}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold">¡Invitación aceptada!</h1>
          <p className="text-sm text-muted-foreground">
            Recibirás un email en <strong>{email}</strong> para activar tu cuenta demo.
            Tu acceso estará disponible hasta el{' '}
            <strong>{format(new Date(invitacion.fecha_expiracion), 'd MMMM yyyy', { locale: es })}</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Accede con tu email y contraseña para empezar a usar la versión demo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <FlaskConical className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Acceso Demo</h1>
          <p className="text-sm text-muted-foreground">
            Has sido invitado a probar SIMANTEC en modo demo.
            Tendrás acceso durante <strong>{invitacion.duracion_dias} días</strong>.
          </p>
        </div>

        <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              placeholder="email@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={!!invitacion.email_destino}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Contraseña</Label>
            <Input
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Repetir contraseña</Label>
            <Input
              type="password"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2 pt-2">
            <input
              type="checkbox"
              id="accept"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <Label htmlFor="accept" className="text-xs font-normal cursor-pointer">
              Acepto que mis datos demo son independientes y se eliminarán al expirar el acceso
            </Label>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          <Button
            className="w-full gap-2"
            onClick={() => joinMutation.mutate()}
            disabled={!email || !password || !accepted || joinMutation.isPending}
          >
            {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            Crear cuenta demo
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Al activar el acceso, todos los datos que crees serán exclusivos de tu entorno demo
          y nunca se mezclarán con los datos reales.
        </p>
      </div>
    </div>
  );
}