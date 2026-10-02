import { useState } from 'react';
import { FileText, Eye, Maximize2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Panel "Documento original vs. líneas extraídas".
 * Muestra el archivo subido (foto/PDF) del pedido al lado de las líneas ya
 * normalizadas por la IA, para contraste visual directo en obra.
 *
 * Sólo se renderiza cuando el pedido tiene `file_url` (decisión E del análisis).
 */
export default function PedidoDocumentoOriginal({ fileUrl, items = [], showPrices = false }) {
  const [zoom, setZoom] = useState(false);

  if (!fileUrl) return null;

  const isPdf = /\.(pdf)$/i.test(fileUrl);
  const isImage = /\.(jpe?g|png|webp|gif|bmp)$/i.test(fileUrl);

  const lineas = Array.isArray(items) ? items : [];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Documento original */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {isPdf ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
            DOCUMENTO ORIGINAL
          </div>
          <span className="text-[10px] text-muted-foreground italic">tal como se pidió</span>
        </div>

        <div className="p-3 bg-muted/20">
          {isImage && (
            <div className="relative">
              <img
                src={fileUrl}
                alt="Documento original del pedido"
                className="w-full rounded-lg border border-border object-contain max-h-[420px] bg-white"
                onClick={() => setZoom(true)}
              />
              <button
                type="button"
                onClick={() => setZoom(true)}
                className="absolute top-2 right-2 bg-background/90 border border-border rounded-lg p-1.5 shadow-sm hover:bg-background"
                title="Ampliar"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {isPdf && (
            <object
              data={fileUrl}
              type="application/pdf"
              className="w-full h-[420px] rounded-lg border border-border bg-white"
            >
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <FileText className="w-8 h-8" />
                <p className="text-xs">No se puede previsualizar el PDF aquí.</p>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Abrir en pestaña nueva
                  </Button>
                </a>
              </div>
            </object>
          )}
          {!isImage && !isPdf && (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2 text-muted-foreground">
              <FileText className="w-8 h-8" />
              <p className="text-xs">Formato no previsualizable.</p>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Abrir documento
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Líneas extraídas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Eye className="w-3.5 h-3.5" />
            LÍNEAS EXTRAÍDAS POR IA
          </div>
          <span className="text-[10px] text-muted-foreground italic">normalizadas</span>
        </div>

        <div className="p-3 bg-muted/20 max-h-[480px] overflow-y-auto">
          {lineas.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Sin líneas extraídas.
            </p>
          ) : (
            <div className="space-y-1.5">
              {lineas.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-background rounded-lg px-3 py-2 border border-border/60">
                  <span className="font-medium flex-1 min-w-0 truncate pr-2">{item.nombre || '—'}</span>
                  <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                    <span>{item.cantidad || 0} {item.unidad || ''}</span>
                    {showPrices && item.precio > 0 && (
                      <span>{item.precio.toFixed(2)} €/{item.unidad || 'ud'}</span>
                    )}
                    {showPrices && (
                      <span className="font-semibold text-foreground">
                        {((item.cantidad || 0) * (item.precio || 0)).toFixed(2)} €
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zoom overlay */}
      {zoom && isImage && (
        <ImageLightbox
          url={fileUrl}
          nombre="Documento original del pedido"
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}