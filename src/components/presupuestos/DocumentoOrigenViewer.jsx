import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Word/Excel/PDF se muestran con el visor de Google; imágenes, directamente.
const visorUrl = (url, tipo) => {
  if (!url) return '';
  if (String(tipo || '').startsWith('image/')) return url;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
};

const esUrlPublica = (url) => /^https?:\/\//i.test(String(url || ''));

/**
 * Ventana del documento de origen del presupuesto, redimensionable:
 * se puede ampliar a pantalla completa y restaurar sin cerrarla.
 * Los archivos guardados en almacenamiento privado se abren con URL firmada.
 */
export default function DocumentoOrigenViewer({ doc, onClose }) {
  const [ampliado, setAmpliado] = useState(false);
  const [url, setUrl] = useState(doc?.url || '');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const original = doc?.url || '';
    if (!original || esUrlPublica(original)) {
      setUrl(original);
      return undefined;
    }
    let cancelado = false;
    setCargando(true);
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: original, expires_in: 3600 })
      .then(({ signed_url }) => { if (!cancelado) setUrl(signed_url); })
      .catch(() => { if (!cancelado) setUrl(''); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [doc?.url]);

  if (!doc) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-3" onClick={onClose}>
      <div
        className={cn(
          'bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden transition-all duration-200',
          ampliado ? 'w-[97vw] h-[94vh]' : 'w-full max-w-4xl h-[75vh]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm font-semibold truncate flex-1">{doc.nombre || 'Documento'}</p>
          <Button type="button" variant="ghost" size="icon" onClick={() => setAmpliado(v => !v)}
            title={ampliado ? 'Restaurar ventana' : 'Ampliar ventana'}>
            {ampliado ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent"
              title="Abrir en una pestaña nueva">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={onClose} title="Cerrar"><X className="w-4 h-4" /></Button>
        </div>
        {cargando ? (
          <div className="flex-1 flex items-center justify-center bg-background">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <iframe
            key={ampliado ? 'ampliado' : 'normal'}
            src={visorUrl(url, doc.tipo)}
            title={doc.nombre || 'Documento de origen'}
            className="flex-1 w-full border-0 bg-white"
          />
        )}
      </div>
    </div>
  );
}