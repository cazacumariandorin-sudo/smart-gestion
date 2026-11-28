import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bell, BellRing, Loader2, CheckCircle2, XCircle, MinusCircle, Lock } from 'lucide-react';

const PASOS = [
  'Crear el proyecto en Firebase y registrar la app Android.',
  'Descargar google-services.json y la clave de la cuenta de servicio.',
  'En el editor: Publish → Mobile app → Build Stores Files → Create Google Play files.',
  'Activar «Add push notifications» y subir los dos archivos.',
  'Generate Files → descargar el AAB y subir la nueva versión a Google Play.',
];

const ESTADO = {
  enviado: { label: 'Enviado', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icono: CheckCircle2 },
  omitido: { label: 'Omitido', clase: 'bg-slate-50 text-slate-600 border-slate-200', Icono: MinusCircle },
  error: { label: 'Error', clase: 'bg-red-50 text-red-700 border-red-200', Icono: XCircle },
};

const TIPO = {
  mensaje: 'Mensaje',
  aviso: 'Aviso',
  solicitud: 'Solicitud',
  prueba: 'Prueba',
};

const fecha = (valor) =>
  valor ? new Date(valor).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export default function PushDiagnosticoPanel() {
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['push-log'],
    queryFn: () =>
      base44.entities.NotificacionPushLog
        .filter({}, { sort: '-created_date', limit: 25 })
        .then((r) => (Array.isArray(r) ? r : r?.items || [])),
  });

  const enviarPrueba = async () => {
    setEnviando(true);
    try {
      const res = await base44.functions.invoke('notificarPush', { tipo: 'prueba' });
      const datos = res?.data || {};
      if (datos.enviados > 0) {
        toast.success('Notificación enviada a tu dispositivo');
      } else {
        toast.warning('No se pudo enviar', {
          description: 'Revisa que la app esté instalada en el móvil y que Firebase esté configurado.',
        });
      }
      qc.invalidateQueries({ queryKey: ['push-log'] });
    } catch (e) {
      toast.error('Error al enviar la prueba: ' + e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="border-slate-200">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-semibold">Configurar las notificaciones push</h3>
          </div>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
            {PASOS.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-start gap-1.5">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            La clave de la cuenta de servicio es privada: solo se sube en el generador de archivos, nunca se comparte.
          </p>
          <Button size="sm" variant="outline" onClick={enviarPrueba} disabled={enviando} className="w-full">
            {enviando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <BellRing className="w-4 h-4 mr-1.5" />}
            Enviar notificación de prueba
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-muted-foreground">Últimos envíos</h3>
        <span className="text-[11px] text-muted-foreground">{registros.length} registros</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : registros.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-xs text-muted-foreground">
            Todavía no se ha enviado ninguna notificación.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {registros.map((r) => {
            const estado = ESTADO[r.estado] || ESTADO.omitido;
            return (
              <Card key={r.id} className="border-slate-200">
                <CardContent className="p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{r.titulo || 'Notificación'}</span>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${estado.clase}`}>
                      <estado.Icono className="w-3 h-3 mr-1" />
                      {estado.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{TIPO[r.tipo] || r.tipo}</span>
                    <span>·</span>
                    <span className="truncate">{r.user_email || 'sin usuario'}</span>
                    <span>·</span>
                    <span className="shrink-0">{fecha(r.enviado_en || r.created_date)}</span>
                  </div>
                  {r.motivo && <p className="text-[11px] text-muted-foreground">{r.motivo}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}