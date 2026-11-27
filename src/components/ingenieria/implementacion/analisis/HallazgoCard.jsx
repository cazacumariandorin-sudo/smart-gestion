import { useState } from 'react';
import { Check, X, Pencil, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TIPO = {
  hecho: {
    label: 'Hecho registrado',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  inferencia: {
    label: 'Inferencia',
    cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  },
  pendiente: {
    label: 'Pendiente de verificar',
    cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
  },
};

const REVISION = {
  confirmada: 'Confirmada',
  descartada: 'Descartada',
  corregida: 'Corregida',
};

/**
 * Una observación del análisis: clasificación, evidencias navegables y
 * decisión de revisión humana (confirmar, corregir con nota o descartar).
 */
export default function HallazgoCard({ hallazgo, onRevisar, onIrA, guardando }) {
  const [editandoNota, setEditandoNota] = useState(false);
  const [nota, setNota] = useState(hallazgo.nota_revision || '');
  const tipo = TIPO[hallazgo.tipo] || TIPO.inferencia;
  const revisado = hallazgo.estado_revision && hallazgo.estado_revision !== 'pendiente';

  const guardarNota = () => {
    onRevisar({ estado_revision: 'corregida', nota_revision: nota.trim() });
    setEditandoNota(false);
  };

  return (
    <div
      className={`rounded-xl border p-3 space-y-2 ${
        revisado ? 'border-border bg-muted/30' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium break-words">{hallazgo.titulo}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className={`text-[11px] px-2 py-0.5 rounded border ${tipo.cls}`}>{tipo.label}</span>
            <span className="text-[11px] text-muted-foreground">
              Confianza {Math.round((Number(hallazgo.confianza) || 0) * 100)} %
            </span>
            {REVISION[hallazgo.estado_revision] && (
              <span className="text-[11px] px-2 py-0.5 rounded border border-teal-200 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900">
                {REVISION[hallazgo.estado_revision]}
              </span>
            )}
          </div>
        </div>
      </div>

      {hallazgo.detalle && <p className="text-xs text-muted-foreground whitespace-pre-line">{hallazgo.detalle}</p>}

      {(hallazgo.evidencias || []).length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">Evidencias</p>
          <div className="flex flex-wrap gap-1.5">
            {hallazgo.evidencias.map((e, i) => {
              const contenido = (
                <>
                  <span className="truncate max-w-[240px]">{e.etiqueta || e.entidad}</span>
                  {e.url ? <ExternalLink className="w-3 h-3 shrink-0" /> : <ArrowRight className="w-3 h-3 shrink-0" />}
                </>
              );
              const clase =
                'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border bg-background hover:border-teal-300 max-w-full';
              return e.url ? (
                <a key={`${e.registro_id}-${i}`} href={e.url} target="_blank" rel="noreferrer" className={clase}>
                  {contenido}
                </a>
              ) : (
                <button
                  key={`${e.registro_id}-${i}`}
                  type="button"
                  onClick={() => onIrA && onIrA(e.pestana || 'resumen')}
                  className={clase}
                >
                  {contenido}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Sin evidencia directa: requiere verificación en obra antes de darla por buena.
        </p>
      )}

      {hallazgo.nota_revision && !editandoNota && (
        <p className="text-[11px] text-muted-foreground">Nota de revisión: {hallazgo.nota_revision}</p>
      )}

      {editandoNota ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Matiz o corrección de la observación"
            className="h-9 text-xs"
          />
          <Button size="sm" onClick={guardarNota} disabled={guardando}>
            Guardar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditandoNota(false)} disabled={guardando}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={hallazgo.estado_revision === 'confirmada' ? 'default' : 'outline'}
            onClick={() => onRevisar({ estado_revision: 'confirmada', nota_revision: hallazgo.nota_revision || '' })}
            disabled={guardando}
            className="gap-1"
          >
            <Check className="w-3.5 h-3.5" /> Confirmar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditandoNota(true)} disabled={guardando} className="gap-1">
            <Pencil className="w-3.5 h-3.5" /> Corregir
          </Button>
          <Button
            size="sm"
            variant={hallazgo.estado_revision === 'descartada' ? 'default' : 'ghost'}
            onClick={() => onRevisar({ estado_revision: 'descartada', nota_revision: hallazgo.nota_revision || '' })}
            disabled={guardando}
            className="gap-1"
          >
            <X className="w-3.5 h-3.5" /> Descartar
          </Button>
        </div>
      )}
    </div>
  );
}