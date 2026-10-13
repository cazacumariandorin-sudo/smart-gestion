import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Miniatura real de la primera página de un PDF, renderizada en cliente con
 * PDF.js (sin tocar backend ni el flujo de subida ya existente). Usada en las
 * tarjetas de justificantes (Fotos/Justificantes Contabilidad) para que un PDF
 * se vea igual de reconocible que una foto, en vez de un icono genérico.
 *
 * Si el PDF no se puede renderizar (corrupto, URL no accesible por CORS...),
 * cae a `onError` para que el componente que lo use muestre su icono de
 * respaldo — nunca deja una miniatura rota silenciosa.
 */
export default function PdfThumbnail({ url, width = 200, height = 250, onError }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    setImageSrc(null);

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(width / viewport.width, height / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (mounted) setImageSrc(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Error renderizando miniatura PDF:', err);
        if (mounted) {
          setError(true);
          onError?.();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [url, width, height]);

  if (loading) return <div className="bg-muted animate-pulse w-full h-full" />;
  if (error || !imageSrc) return null; // el padre muestra su icono de respaldo

  return (
    <img
      src={imageSrc}
      alt="Vista previa PDF"
      className="w-full h-full object-cover"
      loading="lazy"
    />
  );
}
