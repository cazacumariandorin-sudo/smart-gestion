import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { useToast } from '@/components/ui/use-toast';
import { Download, FileText, Info } from 'lucide-react';
import {
  rangoDePeriodo, etiquetaPeriodo, filtrarFichajes, filtrarAusencias,
  exportarHorarioPdf, exportarHorarioExcel, exportarHorarioCsv, minutosATexto, calcularMinutosFichaje,
} from '@/lib/horarioExport';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Diálogo único de exportación del control horario (operativa: PDF, Excel o CSV). */
export default function ExportarHorarioDialog({
  open, onOpenChange, fichajes = [], ausencias = [], operarios = [],
  mesInicial, canSeeAll, usuario,
}) {
  const { toast } = useToast();
  const hoy = new Date();
  const [anio, setAnio] = useState(Number(String(mesInicial || '').slice(0, 4)) || hoy.getFullYear());
  const [mes, setMes] = useState(Number(String(mesInicial || '').slice(5, 7)) || hoy.getMonth() + 1);
  const [modoPeriodo, setModoPeriodo] = useState('mes');
  const [desde, setDesde] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`);
  const [hasta, setHasta] = useState(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().slice(0, 10));
  const [contenido, setContenido] = useState('fichajes');
  const [agrupacion, setAgrupacion] = useState('trabajador');
  const [formato, setFormato] = useState('pdf');
  const [operarioId, setOperarioId] = useState('');
  const [busy, setBusy] = useState(false);

  const rango = useMemo(
    () => rangoDePeriodo(modoPeriodo, { anio, mes, desde, hasta }),
    [modoPeriodo, anio, mes, desde, hasta],
  );

  const filtro = { ...rango, operarioId };
  const regs = useMemo(
    () => (contenido === 'ausencias' ? [] : filtrarFichajes(fichajes, filtro)),
    [fichajes, contenido, rango.desde, rango.hasta, operarioId],
  );
  const aus = useMemo(
    () => (contenido === 'fichajes' ? [] : filtrarAusencias(ausencias, filtro)),
    [ausencias, contenido, rango.desde, rango.hasta, operarioId],
  );

  const totalMin = regs.reduce((s, f) => s + calcularMinutosFichaje(f), 0);
  const sinDatos = regs.length === 0 && aus.length === 0;
  const operarioNombre = operarios.find((o) => o.id === operarioId)?.name || '';

  const exportar = () => {
    setBusy(true);
    try {
      const datos = { fichajes, ausencias, ...rango, contenido, agrupacion, usuario, operarioNombre };
      const filename = formato === 'pdf'
        ? exportarHorarioPdf(datos)
        : formato === 'excel'
          ? exportarHorarioExcel(datos)
          : exportarHorarioCsv(datos);
      toast({ title: 'Archivo generado', description: filename });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'No se pudo exportar', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const campo = (label, control) => (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {control}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar control horario</DialogTitle>
          <DialogDescription className="text-xs">
            Descarga exactamente el periodo y los trabajadores seleccionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {campo('Periodo', (
              <MobileSelect value={modoPeriodo} onValueChange={setModoPeriodo} placeholder="Periodo">
                <MobileSelectItem value="mes">Mes</MobileSelectItem>
                <MobileSelectItem value="rango">Rango de fechas</MobileSelectItem>
                <MobileSelectItem value="anio">Año completo</MobileSelectItem>
              </MobileSelect>
            ))}
            {campo('Contenido', (
              <MobileSelect value={contenido} onValueChange={setContenido} placeholder="Contenido">
                <MobileSelectItem value="fichajes">Solo fichajes</MobileSelectItem>
                <MobileSelectItem value="ambos">Fichajes y ausencias</MobileSelectItem>
                <MobileSelectItem value="ausencias">Solo ausencias</MobileSelectItem>
              </MobileSelect>
            ))}
          </div>

          {modoPeriodo === 'mes' ? (
            <div className="grid grid-cols-2 gap-2">
              {campo('Año', <Input type="number" min="2000" max="2100" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />)}
              {campo('Mes', (
                <MobileSelect value={String(mes)} onValueChange={(v) => setMes(Number(v))} placeholder="Mes">
                  {MESES.map((m, i) => <MobileSelectItem key={m} value={String(i + 1)}>{m}</MobileSelectItem>)}
                </MobileSelect>
              ))}
            </div>
          ) : modoPeriodo === 'rango' ? (
            <div className="grid grid-cols-2 gap-2">
              {campo('Desde', <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />)}
              {campo('Hasta', <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />)}
            </div>
          ) : (
            campo('Año', <Input type="number" min="2000" max="2100" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />)
          )}

          {canSeeAll && (
            <div className="grid grid-cols-2 gap-2">
              {campo('Trabajador', (
                <MobileSelect value={operarioId || 'todos'} onValueChange={(v) => setOperarioId(v === 'todos' ? '' : v)} placeholder="Trabajador">
                  <MobileSelectItem value="todos">Todos</MobileSelectItem>
                  {operarios.map((o) => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
                </MobileSelect>
              ))}
              {contenido !== 'ausencias' && campo('Agrupación del PDF', (
                <MobileSelect value={agrupacion} onValueChange={setAgrupacion} placeholder="Agrupación">
                  <MobileSelectItem value="trabajador">Por trabajador</MobileSelectItem>
                  <MobileSelectItem value="cronologico">Cronológica</MobileSelectItem>
                </MobileSelect>
              ))}
            </div>
          )}

          {contenido === 'ambos' && !canSeeAll && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Agrupación del PDF</p>
              <MobileSelect value={agrupacion} onValueChange={setAgrupacion} placeholder="Agrupación">
                <MobileSelectItem value="trabajador">Por trabajador</MobileSelectItem>
                <MobileSelectItem value="cronologico">Cronológica</MobileSelectItem>
              </MobileSelect>
            </div>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
            <p className="font-semibold text-foreground">{etiquetaPeriodo(rango)}</p>
            <p className="text-muted-foreground">
              {regs.length} fichaje{regs.length !== 1 ? 's' : ''} · {minutosATexto(totalMin)}
              {aus.length > 0 && ` · ${aus.length} ausencia${aus.length !== 1 ? 's' : ''}`}
              {operarioNombre && ` · ${operarioNombre}`}
            </p>
            {sinDatos && <p className="text-amber-600 dark:text-amber-400">No hay registros en ese periodo.</p>}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>Documento operativo: no acredita el registro legal de jornada, que solo genera y valida administración.</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'pdf', label: 'PDF' },
              { key: 'excel', label: 'Excel' },
              { key: 'csv', label: 'CSV' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormato(f.key)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${formato === f.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={exportar} disabled={busy || sinDatos} className="gap-1.5">
            {formato === 'pdf' ? <FileText className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {busy ? 'Generando…' : 'Descargar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}