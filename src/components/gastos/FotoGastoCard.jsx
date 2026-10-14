import { useState, useEffect } from 'react';
import { Receipt, Loader2 } from 'lucide-react';
import { renderPdfPrimeraPagina } from '@/lib/pdfPreview';
import { cn } from '@/lib/utils';
import ImageLightbox from '@/components/ui/ImageLightbox';
import MejorarFotoButton from '@/components/gastos/MejorarFotoButton';

const CAT_COLORS = {
  combustible: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border-blue-300/30',
  peaje: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 border-indigo-300/30',
  parking: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200 border-cyan-300/30',
  comida: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border-orange-300/30',
  material: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300/30',
  otros: 'bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200 border-slate-300/30',
};

function esImagen(archivo) {
  const tipo = (archivo?.tipo || '').toLowerCase();
  return tipo.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(archivo?.nombre || archivo?.url || '');
}

function esPdf(archivo) {
  const tipo = (archivo?.tipo || '').toLowerCase();
  return tipo === 'application/pdf' || /\.pdf$/i.test(archivo?.nombre || archivo?.url || '');
}

/**
 * Miniatura de la primera página de un PDF. Si no se puede renderizar (archivo roto,
 * protegido, sin conexión…) cae al icono genérico de siempre: nunca deja la tarjeta vacía.
 */
function PdfThumbnail({ archivo }) {
  const [estado, setEstado] = useState('cargando'); // cargando | ok | error
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let vivo = true;
    setEstado('cargando');
    renderPdfPrimeraPagina(archivo?.url, 400).then((d) => {
      if (!vivo) return;
      if (d) { setDataUrl(d); setEstado('ok'); } else { setEstado('error'); }
    });
    return () => { vivo = false; };
  }, [archivo?.url]);

  if (estado === 'ok' && dataUrl) {
    return <img src={dataUrl} alt={archivo?.nombre || 'PDF'} className="w-full h-full object-cover" loading="lazy" />;
  }
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center px-2">
        {estado === 'cargando' ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" /> : <div className="text-3xl">📄</div>}
        <p className="text-[10px] font-mono mt-1 truncate max-w-full">{archivo?.nombre || 'PDF'}</p>
      </div>
    </div>
  );
}

export default function FotoGastoCard({ foto }) {
  const [verImagen, setVerImagen] = useState(false);
  const esImg = esImagen(foto.archivo);

  const abrirUrl = () => {
    if (!foto.archivo?.url) return;
    // Imágenes: visor propio con zoom/descarga. PDF y otros: pestaña nueva.
    if (esImg) setVerImagen(true);
    else window.open(foto.archivo.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
    <button
      type="button"
      onClick={abrirUrl}
      className="group flex flex-col text-left rounded-xl border bg-card overflow-hidden hover:shadow-md hover:border-primary/40 transition-all"
      title={foto.archivo?.nombre || 'Abrir archivo'}
    >
      <div className="relative aspect-square bg-muted">
        {esImagen(foto.archivo) ? (
          <img
            src={foto.archivo.url}
            alt={foto.nombre_comercio || foto.archivo?.nombre || 'ticket'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : esPdf(foto.archivo) ? (
          <PdfThumbnail archivo={foto.archivo} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Receipt className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        {foto.categoria && (
          <span className={cn(
            'absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
            CAT_COLORS[foto.categoria] || 'bg-slate-100 text-slate-800 dark:bg-slate-800/40 dark:text-slate-200 border-slate-300/30'
          )}>
            {foto.categoria.charAt(0).toUpperCase() + foto.categoria.slice(1)}
          </span>
        )}
      </div>
      <div className="p-2 space-y-0.5 text-xs">
        <div className="flex items-center justify-between gap-1">
          <span className="font-mono text-[10px] text-muted-foreground truncate">{foto.numero_nota || foto.archivo?.nombre || '—'}</span>
          <span className="font-bold text-sm shrink-0">{Number(foto.importe || 0).toFixed(2)} €</span>
        </div>
        {foto.nombre_comercio && (
          <p className="font-medium truncate text-foreground text-xs">{foto.nombre_comercio}</p>
        )}
        <p className="text-[10px] text-muted-foreground truncate">{foto.fecha_documento || '—'}</p>
        {foto.numero_factura && (
          <p className="text-[10px] text-blue-600 dark:text-blue-400 truncate">Nº {foto.numero_factura}</p>
        )}
      </div>
        </button>
    {esImg && <MejorarFotoButton foto={foto} />}

    {verImagen && esImg && (
      <ImageLightbox
        url={foto.archivo.url}
        nombre={foto.archivo?.nombre || foto.numero_nota}
        subtitulo={[foto.nombre_comercio, foto.fecha_documento, foto.importe != null ? `${Number(foto.importe).toFixed(2)} €` : null].filter(Boolean).join(' · ')}
        onClose={() => setVerImagen(false)}
      />
    )}
    </>
  );
}