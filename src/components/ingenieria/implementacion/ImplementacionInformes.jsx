import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import SinDatos from './SinDatos';
import { fechaCorta } from '@/lib/fechaCorta';

export default function ImplementacionInformes({ partes, documentos }) {
  return (
    <div className="space-y-4">
      <section className="bg-card border border-border rounded-xl">
        <h3 className="font-semibold text-sm p-3 border-b border-border">Partes diarios de la obra</h3>
        {partes.length === 0 ? (
          <SinDatos mensaje="Sin partes diarios" detalle="Los informes de campo de esta obra aún no están cargados." />
        ) : (
          <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
            {partes.map((p) => (
              <div key={p.id} className="p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium">{fechaCorta(p.fecha)}</span>
                  <span className="text-xs text-muted-foreground">{p.tecnico_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${p.estado === 'cerrado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    {p.estado === 'cerrado' ? 'Cerrado' : 'Borrador'}
                  </span>
                  {p.fotos?.length > 0 && <span className="text-xs text-muted-foreground">{p.fotos.length} foto(s)</span>}
                  {p.firma_url && <span className="text-xs text-emerald-700 dark:text-emerald-400">Firmado</span>}
                </div>
                {p.trabajos_realizados && <p className="text-sm line-clamp-3 whitespace-pre-line">{p.trabajos_realizados}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border border-border rounded-xl">
        <h3 className="font-semibold text-sm p-3 border-b border-border">Documentos de ingeniería</h3>
        {documentos.length === 0 ? (
          <SinDatos mensaje="Sin documentos cargados" detalle="No hay documentos técnicos asociados a este proyecto en el módulo de Ingeniería." />
        ) : (
          <div className="divide-y divide-border">
            {documentos.map((d) => (
              <div key={d.id} className="p-3 flex items-start gap-3">
                <FileText className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium break-words">
                    {String(d.tipo || 'Documento').replace(/_/g, ' ')}
                    {d.numero_documento ? ` · ${d.numero_documento}` : ''}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-muted-foreground">
                    {d.revision && <span>Rev. {d.revision}</span>}
                    {d.fecha_documento && <span>{fechaCorta(d.fecha_documento)}</span>}
                    {d.estado && <span>{String(d.estado).replace(/_/g, ' ')}</span>}
                    {d.lineas_count != null && <span>{d.lineas_count} línea(s)</span>}
                  </div>
                </div>
                {(d.archivo_url_mejorado || d.archivo_url_original) && (
                  <a href={d.archivo_url_mejorado || d.archivo_url_original} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 shrink-0">
                    Abrir <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}