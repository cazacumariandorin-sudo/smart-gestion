import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldAlert, KeyRound } from 'lucide-react';

/**
 * Diálogo de continuidad de cifrado del chat.
 *
 * modo = 'crear_respaldo'
 *   Se está generando una clave RSA por primera vez en este dispositivo (o no
 *   había respaldo). Se pide un PIN para poder recuperar el acceso a los
 *   mensajes desde otro dispositivo/navegador en el futuro.
 *
 * modo = 'recuperar'
 *   Ya existe una clave pública activa en el servidor (con respaldo) para
 *   este usuario, pero este dispositivo no tiene la clave privada local.
 *   Se pide el PIN para descifrar el respaldo y restaurar el acceso sin
 *   perder los mensajes antiguos.
 *
 * modo = 'confirmar_sobrescritura'
 *   Ya existe una clave pública activa pero SIN respaldo disponible (p.ej.
 *   se generó antes de esta función). El usuario debe decidir explícitamente
 *   si continúa: los mensajes antiguos cifrados con la clave anterior
 *   quedarán ilegibles de forma permanente en cualquier dispositivo.
 */
export default function ChatRecuperarClaveDialog({ open, modo, onRecuperar, onCrearConPIN, onContinuarSinRecuperar, onCancelar }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  const reset = () => { setPin(''); setPin2(''); setError(''); setProcesando(false); };

  const handleRecuperar = async () => {
    if (pin.length < 4) { setError('El PIN debe tener al menos 4 caracteres'); return; }
    setProcesando(true);
    setError('');
    const ok = await onRecuperar(pin);
    setProcesando(false);
    if (!ok) {
      setError('PIN incorrecto o respaldo dañado. Inténtalo de nuevo.');
    } else {
      reset();
    }
  };

  const handleCrear = async () => {
    if (pin.length < 4) { setError('Elige un PIN de al menos 4 caracteres'); return; }
    if (pin !== pin2) { setError('Los dos PIN no coinciden'); return; }
    setProcesando(true);
    setError('');
    await onCrearConPIN(pin);
    setProcesando(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onCancelar?.(); } }}>
      <DialogContent className="sm:max-w-md">
        {modo === 'recuperar' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Recuperar acceso al chat cifrado</DialogTitle>
              <DialogDescription>
                Este dispositivo aún no tiene tu clave de cifrado. Introduce tu PIN de recuperación
                para restaurar el acceso a tus conversaciones sin perder los mensajes antiguos.
              </DialogDescription>
            </DialogHeader>
            <Input type="password" inputMode="numeric" placeholder="PIN de recuperación" value={pin}
              onChange={(e) => setPin(e.target.value)} autoFocus />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { reset(); onCancelar?.(); }}>Cancelar</Button>
              <Button onClick={handleRecuperar} disabled={procesando}>{procesando ? 'Comprobando...' : 'Recuperar'}</Button>
            </DialogFooter>
          </>
        )}

        {modo === 'crear_respaldo' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Protege el acceso a tu chat</DialogTitle>
              <DialogDescription>
                Elige un PIN de recuperación. Lo necesitarás si entras al chat desde otro dispositivo
                o navegador — sin él, los mensajes cifrados solo se podrán leer desde aquí.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Input type="password" inputMode="numeric" placeholder="Nuevo PIN (mín. 4 caracteres)" value={pin}
                onChange={(e) => setPin(e.target.value)} autoFocus />
              <Input type="password" inputMode="numeric" placeholder="Repite el PIN" value={pin2}
                onChange={(e) => setPin2(e.target.value)} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => { reset(); onContinuarSinRecuperar?.(); }}>Ahora no</Button>
              <Button onClick={handleCrear} disabled={procesando}>{procesando ? 'Guardando...' : 'Guardar PIN'}</Button>
            </DialogFooter>
          </>
        )}

        {modo === 'confirmar_sobrescritura' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600"><ShieldAlert className="w-4 h-4" /> Aviso: clave de cifrado distinta</DialogTitle>
              <DialogDescription>
                Ya tienes una clave de cifrado activa registrada, pero este dispositivo no la tiene y
                no hay un PIN de recuperación guardado. Si continúas, se creará una clave nueva y
                <b> los mensajes cifrados anteriores dejarán de poder leerse</b>, en cualquier dispositivo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { reset(); onCancelar?.(); }}>Cancelar</Button>
              <Button variant="destructive" onClick={() => { reset(); onContinuarSinRecuperar?.(); }}>
                Entiendo, crear clave nueva
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
