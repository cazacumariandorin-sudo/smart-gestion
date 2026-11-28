import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const MIN_LARGO = 8;

export default function CambiarPasswordCard({ userId, email }) {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    if (guardando) return;
    setAbierto(false);
    setActual('');
    setNueva('');
    setRepetir('');
    setError('');
  };

  const guardar = async () => {
    setError('');
    if (nueva.length < MIN_LARGO) {
      setError(`La nueva contraseña debe tener al menos ${MIN_LARGO} caracteres.`);
      return;
    }
    if (nueva !== repetir) {
      setError('La nueva contraseña y su repetición no coinciden.');
      return;
    }
    if (!userId) {
      setError('No se pudo identificar tu cuenta. Vuelve a iniciar sesión.');
      return;
    }
    setGuardando(true);
    try {
      await base44.auth.changePassword({ userId, currentPassword: actual, newPassword: nueva });
      toast.success('Contraseña actualizada');
      cerrar();
    } catch (e) {
      const estado = e?.response?.status;
      const mensaje = e?.response?.data?.message || e?.response?.data?.error || e?.message;
      setError(
        estado === 400 || estado === 401
          ? 'La contraseña actual no es correcta. Si entras con Google, usa el enlace de restablecimiento para crear una contraseña.'
          : (mensaje || 'No se pudo cambiar la contraseña. Inténtalo de nuevo.'),
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="mb-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <KeyRound className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold mb-1">Contraseña</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cambia la contraseña con la que entras en la app. Te pediremos la actual para confirmarlo.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setAbierto(true)}>
          <KeyRound className="w-3.5 h-3.5" /> Cambiar
        </Button>
      </div>

      <Dialog open={abierto} onOpenChange={(o) => (o ? setAbierto(true) : cerrar())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" /> Cambiar contraseña
            </DialogTitle>
            <DialogDescription>
              {email ? `Cuenta: ${email}` : 'Introduce tu contraseña actual y la nueva.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pwd-actual" className="text-xs">Contraseña actual</Label>
              <Input
                id="pwd-actual"
                type="password"
                autoComplete="current-password"
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-nueva" className="text-xs">Nueva contraseña</Label>
              <Input
                id="pwd-nueva"
                type="password"
                autoComplete="new-password"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Mínimo {MIN_LARGO} caracteres.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd-repetir" className="text-xs">Repite la nueva contraseña</Label>
              <Input
                id="pwd-repetir"
                type="password"
                autoComplete="new-password"
                value={repetir}
                onChange={(e) => setRepetir(e.target.value)}
              />
            </div>

            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

            <p className="text-[11px] text-muted-foreground">
              ¿No recuerdas la actual?{' '}
              <Link to="/forgot-password" className="text-primary underline underline-offset-2" onClick={cerrar}>
                Restablécela por email
              </Link>.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={guardando}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando || !actual || !nueva || !repetir}>
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}