import React, { useState } from 'react';
import { AlertTriangle, Bug, X, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { recopilarTelemetria, enviarReporteDiagnostico } from '@/lib/diagnosticoUtils';
import { useAuth } from '@/lib/AuthContext';

/**
 * Botón discreto que permite a cualquier técnico/usuario reportar
 * manualmente un fallo (pantalla en blanco, botón que no funciona...).
 * El reporte captura user-agent, versión Android, red, etc.
 */
export default function ReportarFalloButton() {
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [notas, setNotas] = useState('');
  const [pasos, setPasos] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const handleEnviar = async () => {
    setEnviando(true);
    try {
      const r = await enviarReporteDiagnostico({
        tipo: 'reporte_manual',
        severidad: 'warning',
        mensaje_error: 'Reporte manual de incidencia por el usuario',
        notas_usuario: notas,
        pasos_reproducir: pasos,
        user_email: user?.email || '',
        user_id: user?.id || '',
        user_role: user?.role || ''
      });
      // Auto-cerrar el mensaje después de 5 segundos (en móvil se quedaba fijo arriba)
      const autoDismiss = (t) => { if (t?.dismiss) setTimeout(() => t.dismiss(), 5000); };

      if (r?.skipped) {
        autoDismiss(toast({ title: 'Reporte similar ya enviado', description: 'Gracias, ya tenemos un reporte similar reciente.' }));
      } else {
        autoDismiss(toast({ title: 'Reporte enviado ✓', description: 'El equipo de soporte puede revisarlo ahora.' }));
      }
      setNotas('');
      setPasos('');
      setOpen(false);
    } catch (e) {
      const t = toast({ variant: 'destructive', title: 'No se pudo enviar', description: e.message });
      setTimeout(() => t?.dismiss && t.dismiss(), 5000);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Reportar un fallo (captura datos de tu dispositivo)"
        className="fixed bottom-20 right-20 md:bottom-6 md:right-20 z-30 w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition"
        aria-label="Reportar un fallo"
      >
        <Bug className="w-5 h-5" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setNotas(''); setPasos(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Reportar un fallo en la app
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              Tu dispositivo se está comportando mal? Esta acción captura de forma automática
              <strong> modelo, versión de Android, navegador, calidad de red y última ruta</strong>
              {' '}para que nuestro equipo técnico pueda diagnosticarlo sin necesidad de presenciar el fallo.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="notas">¿Qué ha pasado?</Label>
              <Textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: La pantalla se queda en blanco cuando abro Planos..."
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pasos">Pasos para reproducirlo (opcional)</Label>
              <Textarea
                id="pasos"
                value={pasos}
                onChange={(e) => setPasos(e.target.value)}
                placeholder="1. Entré a Planos...&#10;2. Toqué en ..."
                rows={3}
              />
            </div>

            <DetallesTecnicos />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={enviando}>
              <X className="w-4 h-4" /> Cancelar
            </Button>
            <Button onClick={handleEnviar} disabled={enviando}>
              <Send className="w-4 h-4" /> {enviando ? 'Enviando...' : 'Enviar reporte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetallesTecnicos() {
  const [mostrar, setMostrar] = useState(false);
  const [datos, setDatos] = useState(null);

  React.useEffect(() => {
    if (mostrar && !datos) setDatos(recopilarTelemetria());
  }, [mostrar]);

  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <button
        className="text-xs font-semibold text-muted-foreground flex items-center gap-1 w-full justify-between"
        onClick={() => setMostrar(s => !s)}
      >
        <span>Datos técnicos capturados</span>
        <span>{mostrar ? '−' : '+'}</span>
      </button>
      {mostrar && datos && (
        <pre className="text-[10px] mt-1 overflow-x-auto text-muted-foreground leading-tight">
          {JSON.stringify({
            navegador: datos.navegador,
            sistema_operativo: datos.sistema_operativo,
            dispositivo_modelo: datos.dispositivo_modelo,
            resolucion_pantalla: datos.resolucion_pantalla,
            viewport: datos.viewport,
            calidad_red: datos.calidad_red || 'desconocida',
            rtt_ms: datos.rtt_ms,
            online: datos.online
          }, null, 2)}
        </pre>
      )}
    </div>
  );
}