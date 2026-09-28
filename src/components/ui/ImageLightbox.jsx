import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

/**
 * Visor de imagen compartido con zoom real (rueda del ratón, pellizco táctil,
 * doble clic/doble toque) + arrastre cuando está ampliada, y descarga directa
 * del archivo original.
 *
 * Pensado para dos usos ya identificados en la app:
 * - Tickets/facturas de gasto (NotaGastoDetalle) — ampliar ayuda a comprobar
 *   importes/datos difíciles de leer; descargar ayuda a que contabilidad
 *   externa se lo guarde en su propio sistema.
 * - Fotos de obra (ObraFotosPanel, GaleriaFotos, etc.) — mismo criterio.
 *
 * Uso: <ImageLightbox url={...} nombre={...} onClose={...} /> — se monta
 * solo cuando hay una imagen seleccionada (el padre controla el estado open).
 */
export default function ImageLightbox({ url, nombre, subtitulo, onClose, extra }) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragState = useRef(null);

  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const resetView = useCallback(() => { setZoom(1); setPos({ x: 0, y: 0 }); }, []);

  // Cerrar con Escape (el visor puede abrirse encima de un Dialog modal, cuyo
  // propio Escape se desactiva mientras el visor está abierto).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom(z => {
      const nz = clampZoom(z + delta);
      if (nz === 1) setPos({ x: 0, y: 0 });
      return nz;
    });
  };

  const handleDoubleClick = () => {
    setZoom(z => (z > 1 ? 1 : 2.5));
    setPos({ x: 0, y: 0 });
  };

  const handlePointerDown = (e) => {
    if (zoom <= 1) return;
    dragState.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!dragState.current) return;
    setPos({ x: e.clientX - dragState.current.startX, y: e.clientY - dragState.current.startY });
  };
  const handlePointerUp = () => { dragState.current = null; };

  // Pellizco táctil (dos dedos) — cálculo simple de distancia entre puntos
  const pinchState = useRef(null);
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchState.current = {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        zoom,
      };
    }
  };
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / pinchState.current.dist;
      setZoom(clampZoom(pinchState.current.zoom * ratio));
    }
  };
  const handleTouchEnd = () => { pinchState.current = null; };

  const handleDownload = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = nombre || 'imagen';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: si el fetch falla (CORS del proveedor de almacenamiento),
      // al menos abrir en pestaña nueva para que el usuario lo guarde a mano.
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  if (!url) return null;

  // Portal a document.body + pointer-events explícito: si el visor se abre desde
  // un Dialog modal de Radix, el body queda con pointer-events:none y el visor,
  // al estar fuera del contenido del Dialog, no recibiría clics ni rueda.
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col" style={{ pointerEvents: 'auto' }} onClick={onClose}>
      <div className="flex items-center justify-between gap-2 p-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 text-white">
          {nombre && <p className="text-sm font-medium truncate">{nombre}</p>}
          {subtitulo && <p className="text-xs text-white/60 truncate">{subtitulo}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setZoom(z => clampZoom(z - 0.5))} title="Reducir">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-white text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setZoom(z => clampZoom(z + 0.5))} title="Ampliar">
            <ZoomIn className="w-4 h-4" />
          </Button>
          {zoom !== 1 && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={resetView} title="Restablecer">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={handleDownload} title="Descargar">
            <Download className="w-4 h-4" />
          </Button>
          {extra}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={onClose} title="Cerrar">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        className="flex-1 overflow-hidden flex items-center justify-center select-none"
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
        style={{ cursor: zoom > 1 ? 'grab' : 'zoom-in', touchAction: 'none' }}
      >
        <img
          src={url}
          alt={nombre || 'Imagen'}
          draggable={false}
          className="max-w-full max-h-full object-contain transition-transform duration-100"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}
        />
      </div>
      <p className="text-center text-white/40 text-[10px] pb-2 hidden sm:block">
        Rueda del ratón o doble clic para ampliar · arrastra para mover · Esc para cerrar
      </p>
    </div>,
    document.body
  );
}
