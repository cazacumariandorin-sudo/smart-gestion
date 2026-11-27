import { useState } from 'react';
import { FileDown, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { descargarInformeAnalisisPdf } from '@/lib/informeAnalisisPdf';
import { fechaHoraES } from '@/lib/fechaES';

const SECCIONES = [
  { id: 'avance', label: 'Avance observado' },
  { id: 'incidencia', label: 'Posibles incidencias' },
  { id: 'trabajo_extra', label: 'Posibles trabajos extra' },
];

const TIPOS = { hecho: 'Hecho registrado', inferencia: 'Inferencia', pendiente: 'Pendiente de verificar' };
const REVISION = { pendiente: 'Sin revisar', confirmada: 'Confirmada', descartada: 'Descartada', corregida: 'Corregida' };

export default function InformeAnalisisDialog({ open, onOpenChange, analisis, obra }) {
  const [generando, setGenerando] = useState(false);

  if (!analisis) return null;

  const descargar = async () => {
    setGenerando(true);
    try {
      await descargarInformeAnalisisPdf(analisis, obra);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Informe de seguimiento</DialogTitle>
          <DialogDescription>
            {analisis.obra_name || obra?.name} · {fechaHoraES(analisis.generado_en)}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain-y pr-1">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm whitespace-pre-line">{analisis.resumen}</p>
            <p className="text-[11px] text-muted-foreground mt-2">
              Confianza global {Math.round((Number(analisis.confianza) || 0) * 100)} % ·{' '}
              {Number(analisis.fotos_analizadas) || 0} foto(s) analizada(s) · {analisis.generado_por_nombre || 'análisis automático'}
            </p>
          </div>

          {SECCIONES.map((s) => {
            const items = (analisis.hallazgos || []).filter((h) => h.seccion === s.id);
            if (!items.length) return null;
            return (
              <div key={s.id} className="space-y-2">
                <p className="text-sm font-semibold">{s.label}</p>
                {items.map((h) => (
                  <div key={h.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{h.titulo}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                        {TIPOS[h.tipo] || h.tipo}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                        {REVISION[h.estado_revision] || 'Sin revisar'}
                      </span>
                    </div>
                    {h.detalle && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{h.detalle}</p>}
                    <ul className="mt-1 space-y-0.5">
                      {(h.evidencias || []).map((e, i) => (
                        <li key={`${e.registro_id}-${i}`} className="text-[11px] text-muted-foreground">
                          • {e.etiqueta || e.entidad}
                          {e.fecha ? ` (${String(e.fecha).slice(0, 10)})` : ''}
                        </li>
                      ))}
                      {!(h.evidencias || []).length && (
                        <li className="text-[11px] text-amber-700 dark:text-amber-400">• Sin evidencia directa</li>
                      )}
                    </ul>
                    {h.nota_revision && (
                      <p className="text-[11px] text-muted-foreground mt-1">Nota: {h.nota_revision}</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {(analisis.datos_no_disponibles || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">Datos no disponibles</p>
              <ul className="space-y-0.5">
                {analisis.datos_no_disponibles.map((d, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(analisis.recomendaciones || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-semibold">Comprobaciones recomendadas</p>
              <ul className="space-y-0.5">
                {analisis.recomendaciones.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Documento de apoyo interno. Las observaciones son propuestas asistidas por IA y no confirman por sí mismas
              defectos, avances ni trabajos extra: requieren validación humana.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={descargar} disabled={generando} className="gap-2">
            {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Descargar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}