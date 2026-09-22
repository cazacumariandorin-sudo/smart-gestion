import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, FileText } from 'lucide-react';
import { formatVal } from '@/lib/ingenieriaDiff.jsx';

const DERIVABLE = new Set(['listado_puntos', 'lista_material', 'ficha_tecnica_equipo']);

function confianzaColor(c) {
  return c === 'alta' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : c === 'baja' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';
}

export default function DocumentoCard({ doc, onReprocesar, reprocesando }) {
  const [open, setOpen] = useState(false);
  const [derivados, setDerivados] = useState(null);
  const [loadingDeriv, setLoadingDeriv] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && derivados === null && DERIVABLE.has(doc.tipo)) {
      setLoadingDeriv(true);
      try {
        if (doc.tipo === 'ficha_tecnica_equipo') {
          const items = await base44.entities.FichaTecnicaEquipo.filter({ documento_origen_id: doc.id });
          setDerivados({ tipo: 'fichas', count: items.length, items });
        } else {
          const items = await base44.entities.ItemLista.filter({ documento_origen_id: doc.id });
          setDerivados({ tipo: 'items', count: items.length, items });
        }
      } catch { setDerivados({ tipo: 'error', count: 0, items: [] }); }
      finally { setLoadingDeriv(false); }
    }
  };

  const datos = doc.datos_extraidos || {};
  const entradas = Object.entries(datos).filter(([k]) => k !== '_file_sha256' && k !== 'ocr_raw');

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">{doc.tipo.replace(/_/g, ' ')}</span>
        {doc.revision && <span className="text-xs text-muted-foreground">Rev. {doc.revision}</span>}
        <span className={`text-xs px-1.5 py-0.5 rounded ${doc.estado === 'superseded' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{doc.estado}</span>
        {datos.confianza && <span className={`text-xs px-1.5 py-0.5 rounded border ${confianzaColor(datos.confianza)}`}>conf. {datos.confianza}</span>}
      </div>
      <div className="text-sm mt-1 font-medium">{doc.numero_documento || doc.proveedor_nombre || 'Documento sin número'}</div>
      <div className="text-xs text-muted-foreground">{doc.fecha_documento} · {doc.lineas_count || 0} líneas{doc.ingeniero_subido_por ? ` · subido por ${doc.ingeniero_subido_por}` : ''}</div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button onClick={toggle} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 min-h-[32px]">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {open ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
        <button onClick={onReprocesar} disabled={reprocesando || !doc.archivo_url_mejorado} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50 min-h-[32px]">
          {reprocesando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Precisión
        </button>
        {doc.archivo_url_mejorado && <a href={doc.archivo_url_mejorado} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">ver archivo</a>}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {DERIVABLE.has(doc.tipo) && (
            <div className="text-xs">
              {loadingDeriv ? <span className="text-muted-foreground inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Contando derivados…</span>
                : derivados?.tipo === 'items' ? <span className="text-teal-700 font-medium">{derivados.count} ítem(s) derivado(s) en Listado de Ítems</span>
                : derivados?.tipo === 'fichas' ? <span className="text-teal-700 font-medium">{derivados.count} ficha(s) técnica(s) derivada(s)</span>
                : derivados?.tipo === 'error' ? <span className="text-red-600">Error al cargar derivados</span>
                : <span className="text-muted-foreground">Sin derivados</span>}
            </div>
          )}
          <div className="rounded-lg border border-border bg-muted/30 p-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">Datos extraídos (OCR):</div>
            {entradas.length === 0 ? <div className="text-xs text-muted-foreground">Sin datos extraídos.</div> : (
              <dl className="grid grid-cols-1 gap-1 text-xs">
                {entradas.map(([k, v]) => (
                  <div key={k} className="flex gap-2 break-all">
                    <dt className="font-mono text-muted-foreground shrink-0">{k}:</dt>
                    <dd className="text-foreground">{formatVal(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {derivados?.items?.length > 0 && derivados.tipo === 'items' && (
            <div className="rounded-lg border border-border bg-background p-2 max-h-40 overflow-y-auto">
              <div className="text-xs font-medium text-muted-foreground mb-1">Ítems derivados ({derivados.items.length}):</div>
              <ul className="text-xs space-y-0.5">
                {derivados.items.slice(0, 50).map(it => (
                  <li key={it.id} className="break-all"><span className="font-mono">{it.tag || '—'}</span> · {it.descripcion || ''} {it.estado === 'pendiente_revision' && <span className="text-amber-600">(pend. rev.)</span>}</li>
                ))}
                {derivados.items.length > 50 && <li className="text-muted-foreground">… y {derivados.items.length - 50} más</li>}
              </ul>
            </div>
          )}
          {derivados?.items?.length > 0 && derivados.tipo === 'fichas' && (
            <div className="rounded-lg border border-border bg-background p-2">
              <div className="text-xs font-medium text-muted-foreground mb-1">Fichas derivadas:</div>
              <ul className="text-xs space-y-0.5">
                {derivados.items.map(f => (
                  <li key={f.id}><span className="font-mono">{f.tag_equipo || '—'}</span> · {f.equipo_tipo} · {f.fabricante || ''} {f.modelo || ''} · {f.compatibilidad_motor_variador}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}