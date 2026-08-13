import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardCopy, Download, Check, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { generarTextoInformePeriodo, calcularRangoPeriodo, fmtCortaFecha } from '@/lib/vigilanciaLog';

const LLAMAR = (action, payload = {}) =>
  base44.functions.invoke('gestionVigilanciaDiagnostico', { action, ...payload }).then(r => r?.data || r);

/**
 * Informe consolidado de vigilancia por periodo (semanal / mensual / rango
 * personalizado). Junta en un único documento los logs de todas las
 * vigilancias del periodo — se genera bajo demanda, a petición del gerente.
 */
export default function VigilanciaInformePeriodoDialog({ open, onClose }) {
  const [tipoPeriodo, setTipoPeriodo] = useState('semanal'); // 'semanal' | 'mensual' | 'personalizado'
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [informe, setInforme] = useState(null); // { texto, totalVigilancias, etiquetaPeriodo, fechaDesde, fechaHasta }
  const [copiado, setCopiado] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    if (!open) return;
    base44.auth.me().then(u => setCurrentUserEmail(u?.email || '')).catch(() => {});
  }, [open]);

  const reset = () => {
    setInforme(null);
    setCargando(false);
    setCopiado(false);
  };

  const generar = async () => {
    setCargando(true);
    try {
      let desde, hasta, etiqueta;
      if (tipoPeriodo === 'personalizado') {
        if (!fechaDesde || !fechaHasta) {
          toast.error('Indica ambas fechas del rango');
          setCargando(false);
          return;
        }
        desde = new Date(fechaDesde + 'T00:00:00').toISOString();
        hasta = new Date(fechaHasta + 'T23:59:59').toISOString();
        etiqueta = 'Personalizado';
      } else {
        const r = calcularRangoPeriodo(tipoPeriodo);
        desde = r.desde;
        hasta = r.hasta;
        etiqueta = tipoPeriodo === 'semanal' ? 'Semanal (últimos 7 días)' : 'Mensual (último mes)';
      }

      const resp = await LLAMAR('informe_periodo', { fecha_desde: desde, fecha_hasta: hasta });
      if (resp?.error) {
        toast.error(resp.error);
        setCargando(false);
        return;
      }

      const texto = generarTextoInformePeriodo({
        etiquetaPeriodo: etiqueta,
        fechaDesde: desde,
        fechaHasta: hasta,
        vigilancias: resp.vigilancias || [],
        generadoPor: currentUserEmail,
      });

      setInforme({
        texto,
        totalVigilancias: resp.total_vigilancias || 0,
        etiquetaPeriodo: etiqueta,
        fechaDesde: desde,
        fechaHasta: hasta,
      });
    } catch (e) {
      console.error('Error generando informe de periodo:', e);
      toast.error('No se pudo generar el informe');
    } finally {
      setCargando(false);
    }
  };

  const copiar = async () => {
    if (!informe) return;
    try {
      await navigator.clipboard.writeText(informe.texto);
      setCopiado(true);
      toast.success('Informe copiado ✓');
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      console.error('Error copiando informe:', e);
      toast.error('No se pudo copiar. Prueba a descargarlo.');
    }
  };

  const descargar = () => {
    if (!informe) return;
    const blob = new Blob([informe.texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const sufijo = `${fmtCortaFecha(informe.fechaDesde).replace(/\//g, '-')}_${fmtCortaFecha(informe.fechaHasta).replace(/\//g, '-')}`;
    a.href = url;
    a.download = `informe_vigilancia_${tipoPeriodo}_${sufijo}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Informe descargado');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose?.(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarRange className="w-4 h-4" /> Informe de vigilancia por periodo</DialogTitle>
          <DialogDescription>
            Junta en un solo documento los logs de todas las vigilancias del periodo elegido, listo para copiar/pegar o descargar.
          </DialogDescription>
        </DialogHeader>

        {!informe && (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              {[
                { v: 'semanal', label: 'Semanal' },
                { v: 'mensual', label: 'Mensual' },
                { v: 'personalizado', label: 'Rango personalizado' },
              ].map(op => (
                <Button key={op.v} size="sm" variant={tipoPeriodo === op.v ? 'default' : 'outline'}
                  className="h-8 text-xs" onClick={() => setTipoPeriodo(op.v)}>
                  {op.label}
                </Button>
              ))}
            </div>

            {tipoPeriodo === 'personalizado' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={generar} disabled={cargando}>
                {cargando ? 'Generando…' : 'Generar informe'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {informe && (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {informe.etiquetaPeriodo} · {informe.totalVigilancias} vigilancia(s) incluida(s)
            </div>
            <pre className="text-[10px] bg-muted/50 rounded-md p-2 max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words">
              {informe.texto}
            </pre>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>Volver</Button>
              <Button variant="outline" onClick={descargar}><Download className="w-3.5 h-3.5 mr-1" /> .txt</Button>
              <Button onClick={copiar}>
                {copiado ? <Check className="w-3.5 h-3.5 mr-1" /> : <ClipboardCopy className="w-3.5 h-3.5 mr-1" />}
                {copiado ? 'Copiado' : 'Copiar informe'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
