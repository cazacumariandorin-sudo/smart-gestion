import { useState } from 'react';
import { CheckCircle2, XCircle, Eye, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SEV_CONFIG = {
  critico: { label: 'Crítico', cls: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
  alto: { label: 'Alto', cls: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500' },
  medio: { label: 'Medio', cls: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
  bajo: { label: 'Bajo', cls: 'bg-sky-100 text-sky-700 border-sky-300', dot: 'bg-sky-500' },
};

function eur(n) {
  return (n == null ? 0 : n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export default function DuplicadoGrupoCard({ grupo, idx, onConsolidar, onFalsoPositivo, procesando }) {
  const sev = SEV_CONFIG[grupo.severidad] || SEV_CONFIG.bajo;
  const [conservarId, setConservarId] = useState(grupo.conservar_id);
  const conservado = grupo.miembros.find(m => m.id === conservarId);
  const aAnular = grupo.miembros.filter(m => m.id !== conservarId);
  const importeAnular = aAnular.reduce((s, m) => s + (m.importe || 0), 0);

  return (
    <div className={cn('border rounded-xl overflow-hidden', sev.cls.replace(/text-\S+/, ''))}>
      <div className={cn('px-4 py-2.5 flex items-center justify-between gap-2 border-b', sev.cls)}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-2.5 h-2.5 rounded-full', sev.dot)} />
          <span className="font-semibold text-sm">Grupo {idx + 1}</span>
          <Badge variant="outline" className="text-xs">{grupo.miembros.length} registros</Badge>
          <span className="text-xs opacity-80 hidden sm:inline">· {sev.label} · {Math.round(grupo.score_medio * 100)}% sim.</span>
        </div>
        <span className="text-xs font-semibold whitespace-nowrap">{eur(importeAnular)} a anular</span>
      </div>

      <div className="divide-y divide-border bg-card">
        {grupo.miembros.map(m => {
          const esConservar = m.id === conservarId;
          return (
            <div key={m.id} className={cn('p-3 flex gap-3 items-start', esConservar && 'bg-emerald-50 dark:bg-emerald-950/20')}>
              <button
                type="button"
                disabled={procesando}
                onClick={() => setConservarId(m.id)}
                className={cn(
                  'shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  esConservar ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40 hover:border-emerald-500'
                )}
                title={esConservar ? 'Conservar este' : 'Marcar para conservar'}
              >
                {esConservar && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>

              <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs">
                <div className="col-span-2 sm:col-span-1">
                  <p className="font-semibold truncate">{m.nombre || '(sin comercio)'}</p>
                  <p className="text-muted-foreground truncate">{m.entidad_label}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Importe</p>
                  <p className="font-semibold">{eur(m.importe)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p>{m.fecha || '—'}</p>
                  {m.hora && <p className="text-muted-foreground">{m.hora}</p>}
                </div>
                <div>
                  <p className="text-muted-foreground">CIF/NIF</p>
                  <p className="truncate">{m.cif || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Operario</p>
                  <p className="truncate">{m.operario_name || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Localidad</p>
                  <p className="truncate">{m.localidad || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Nº factura</p>
                  <p className="truncate">{m.numero_factura || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <p className="truncate">{m.estado || '—'}</p>
                </div>
              </div>

              {m.archivo_url && (
                <a href={m.archivo_url} target="_blank" rel="noreferrer" className="shrink-0 p-1.5 rounded-lg hover:bg-muted" title="Ver justificante">
                  <Eye className="w-4 h-4" />
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2.5 bg-muted/40 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Propuesta: conservar <strong>{conservado?.nombre || '—'}</strong> (calidad {Math.round(conservado?.calidad || 0)})
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={procesando} onClick={() => onFalsoPositivo(grupo)}>
            Falso positivo
          </Button>
          <Button size="sm" variant="outline" disabled={procesando || aAnular.length === 0} onClick={() => onConsolidar(grupo, conservarId, false)}>
            <XCircle className="w-3.5 h-3.5" /> Anular
          </Button>
          <Button size="sm" disabled={procesando || aAnular.length === 0} onClick={() => onConsolidar(grupo, conservarId, true)}>
            <Layers className="w-3.5 h-3.5" /> Fusionar y anular
          </Button>
        </div>
      </div>
    </div>
  );
}