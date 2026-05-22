import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Copy, Check } from 'lucide-react';

export default function DemoInvitationsModal({ open, onOpenChange, users, onSuccess }) {
  const [emailDestino, setEmailDestino] = useState('');
  const [duracion, setDuracion] = useState('30');
  const [error, setError] = useState('');
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Validación: Email ya existe (si se especificó)
      if (emailDestino) {
        const existingUser = users.find(u => u.email?.toLowerCase() === emailDestino.toLowerCase());
        if (existingUser) {
          throw new Error('Este email ya tiene cuenta activa');
        }
      }

      const now = new Date();
      const dias = parseInt(duracion);
      const expira = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000);
      const codigo = crypto.randomUUID();
      const currentUser = await base44.auth.me();

      const invitacion = {
        codigo,
        generada_por_email: currentUser.email,
        generada_por_nombre: currentUser.full_name || currentUser.email,
        email_destino: emailDestino || '',
        duracion_dias: dias,
        fecha_generacion: now.toISOString(),
        fecha_expiracion: expira.toISOString(),
        usada: false,
        activa: true,
      };

      await base44.entities.InvitacionDemo.create(invitacion);

      const link = `${window.location.origin}/demo-join?codigo=${codigo}`;
      return { codigo, link };
    },
    onSuccess: (result) => {
      setGeneratedLink(result);
      setError('');
      toast.success('✓ Invitación generada correctamente');
    },
    onError: (err) => {
      setError(err.message || 'Error al generar la invitación. Inténtalo de nuevo.');
    },
  });

  const handleGenerate = () => {
    setError('');
    generateMutation.mutate();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink.link);
    setCopied(true);
    toast.success('¡Copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setEmailDestino('');
    setDuracion('30');
    setError('');
    setCopied(false);
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generar invitación demo</DialogTitle>
        </DialogHeader>

        {!generatedLink ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs">Email destino (opcional)</Label>
                <Input
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={emailDestino}
                  onChange={(e) => setEmailDestino(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si lo dejas vacío, el link puede usarlo cualquier persona.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Duración del acceso</Label>
                <MobileSelect value={duracion} onValueChange={setDuracion} placeholder="Duración">
                  <MobileSelectItem value="7">7 días</MobileSelectItem>
                  <MobileSelectItem value="15">15 días</MobileSelectItem>
                  <MobileSelectItem value="30">30 días</MobileSelectItem>
                  <MobileSelectItem value="60">60 días</MobileSelectItem>
                </MobileSelect>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
                {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Generar link
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  ✓ Invitación generada correctamente
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Link de invitación</Label>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink.link}
                    readOnly
                    className="text-xs bg-muted"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}