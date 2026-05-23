import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Key, Shield, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function CifradoInfo({ open, onClose }) {
  const [claveInfo, setClaveInfo] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [regenerando, setRegenerando] = useState(false);

  useEffect(() => {
    if (open) {
      cargarClaves();
    }
  }, [open]);

  const cargarClaves = async () => {
    try {
      const user = await base44.auth.me();
      const claves = await base44.entities.ChatClavePublica.filter({ 
        user_email: user.email,
        activa: true 
      });
      
      if (claves.length > 0) {
        setClaveInfo(claves[0]);
      }
    } catch (error) {
      console.error('Error cargando claves:', error);
    }
  };

  const handleRegenerar = async () => {
    setRegenerando(true);
    try {
      // La regeneración se hace automáticamente en el Chat al cargar
      toast.info('Las claves se regeneran automáticamente al iniciar sesión');
      onClose();
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setRegenerando(false);
    }
  };

  const handleCopiarHuella = () => {
    if (claveInfo?.huella_digital) {
      navigator.clipboard.writeText(claveInfo.huella_digital);
      setCopiado(true);
      toast.success('Huella copiada');
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Cifrado de Mensajes
          </DialogTitle>
          <DialogDescription>
            Información sobre tus claves de cifrado E2E
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!claveInfo ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Sin claves registradas
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    No tienes claves de cifrado activas. Se generarán automáticamente cuando envíes tu primer mensaje.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800 dark:text-green-200">
                    Claves activas
                  </span>
                </div>
                <div className="space-y-2 text-xs text-green-700 dark:text-green-300">
                  <div className="flex justify-between">
                    <span>Algoritmo:</span>
                    <span className="font-mono">{claveInfo.algoritmo || 'RSA-OAEP-2048'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Creadas:</span>
                    <span>{claveInfo.fecha_creacion ? new Date(claveInfo.fecha_creacion).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {claveInfo.huella_digital && (
                <div className="space-y-2">
                  <label className="text-xs font-medium">Huella digital (fingerprint)</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono truncate">
                      {claveInfo.huella_digital}
                    </code>
                    <Button
                      size="icon"
                      variant="outline"
                      className="shrink-0"
                      onClick={handleCopiarHuella}
                    >
                      {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Comparte esta huella con otros usuarios para verificar tu identidad
                  </p>
                </div>
              )}
            </>
          )}

          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">
              ¿Cómo funciona?
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>Tus mensajes se cifran con AES-256-GCM</li>
              <li>La clave AES se cifra con RSA del destinatario</li>
              <li>Solo tú y el destinatario podéis leer los mensajes</li>
              <li>Las claves privadas nunca salen de tu dispositivo</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleRegenerar} disabled={regenerando}>
            {regenerando ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            Regenerar claves
          </Button>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}