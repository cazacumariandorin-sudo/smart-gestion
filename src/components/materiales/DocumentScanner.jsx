import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, RefreshCw, Check, Loader2, ScanLine } from 'lucide-react';
import { limpiarPdfSiNecesario } from '@/lib/limpiarPdf';

/**
 * DocumentScanner — captura/recorte tipo CamScanner (cliente, canvas):
 *  - Carga imagen (cámara o upload) a un canvas interno (máx 1400px).
 *  - Muestra preview con 4 esquinas arrastrables (inset automático inicial).
 *  - Al confirmar, aplica warp bilinear TL/TR/BR/BL → canvas out rectangular,
 *    pasa a escala de grises, estira contraste por percentiles (p2/p98).
 *  - Devuelve un File JPEG (0.85) listo para subir + preview dataURL.
 */

const MAX_SRC = 1400;
const MAX_OUT = 1400;

function loadImgFromFile(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = e.target.result;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

function warpToCanvas(srcCanvas, corners) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
  const minX = Math.max(0, Math.min(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxX = Math.min(w, Math.max(...xs));
  const maxY = Math.min(h, Math.max(...ys));
  let outW = maxX - minX, outH = maxY - minY;
  const scale = Math.min(1, MAX_OUT / Math.max(outW, outH));
  outW = Math.max(1, Math.round(outW * scale));
  outH = Math.max(1, Math.round(outH * scale));

  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const dst = out.getContext('2d');
  const srcCtx = srcCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, w, h).data;
  const dstImage = dst.createImageData(outW, outH);
  const dstData = dstImage.data;

  const [TL, TR, BR, BL] = corners;

  for (let y = 0; y < outH; y++) {
    const v = outH > 1 ? y / (outH - 1) : 0;
    // Borde izquierdo TL→BL, derecho TR→BR
    const leftX = TL.x * (1 - v) + BL.x * v;
    const leftY = TL.y * (1 - v) + BL.y * v;
    const rightX = TR.x * (1 - v) + BR.x * v;
    const rightY = TR.y * (1 - v) + BR.y * v;
    for (let x = 0; x < outW; x++) {
      const u = outW > 1 ? x / (outW - 1) : 0;
      const sx = leftX * (1 - u) + rightX * u;
      const sy = leftY * (1 - u) + rightY * u;
      const ix = Math.round(sx), iy = Math.round(sy);
      if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
        const si = (iy * w + ix) * 4;
        const di = (y * outW + x) * 4;
        const gray = (srcData[si] * 0.299 + srcData[si + 1] * 0.587 + srcData[si + 2] * 0.114) | 0;
        dstData[di] = gray;
        dstData[di + 1] = gray;
        dstData[di + 2] = gray;
        dstData[di + 3] = 255;
      }
    }
  }

  // Auto-contraste por percentiles p2/p98
  const hist = new Array(256).fill(0);
  for (let i = 0; i < dstData.length; i += 4) hist[dstData[i]]++;
  const total = dstData.length / 4;
  let acc = 0, p2 = 0, p98 = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc < total * 0.02) p2 = v;
    if (acc < total * 0.98) p98 = v;
  }
  if (p98 - p2 < 8) p98 = Math.min(255, p2 + 8);
  for (let i = 0; i < dstData.length; i += 4) {
    const g = dstData[i] <= p2 ? 0 : (dstData[i] >= p98 ? 255 : Math.round(((dstData[i] - p2) / (p98 - p2)) * 255));
    dstData[i] = g; dstData[i + 1] = g; dstData[i + 2] = g;
  }

  dst.putImageData(dstImage, 0, 0);
  return out;
}

function canvasToFile(canvas, name = 'documento_escaneado.jpg') {
  return new Promise(res => canvas.toBlob(b => {
    res(new File([b], name, { type: 'image/jpeg' }));
  }, 'image/jpeg', 0.85));
}

export default function DocumentScanner({ onDone, onSkip }) {
  const [estado, setEstado] = useState('idle'); // idle | ready | processing
  const [img, setImg] = useState(null);
  const srcCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const [cornersDisplay, setCornersDisplay] = useState(null); // en coords del preview
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });
  const dragIdx = useRef(-1);

  // Init working canvas when image loads
  useEffect(() => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    let w = img.width, h = img.height;
    const scale = Math.min(1, MAX_SRC / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    srcCanvasRef.current = canvas;
    // Inicializar corners al inset 6%
    const px = w * 0.06, py = h * 0.06;
    setEstado('ready');
    setCornersDisplay([
      { x: px, y: py },               // TL
      { x: w - px, y: py },            // TR
      { x: w - px, y: h - py },        // BR
      { x: px, y: h - py },            // BL
    ]);
    setPreviewSize({ w, h });
  }, [img]);

  const handleFile = async (file) => {
    if (!file) return;
    // Los PDF no pueden pasar por el canvas/recorte (solo imágenes). Se suben directo al OCR.
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const limpio = await limpiarPdfSiNecesario(file);
      onDone({ file: limpio, preview: null });
      return;
    }
    setEstado('processing');
    try {
      const loaded = await loadImgFromFile(file);
      setImg(loaded);
    } catch {
      setEstado('idle');
    }
  };

  const startDrag = (idx) => (e) => {
    e.preventDefault();
    dragIdx.current = idx;
  };

  const onPointerMove = (e) => {
    if (dragIdx.current < 0 || !cornersDisplay) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = previewSize.w / rect.width;
    const scaleY = previewSize.h / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setCornersDisplay(prev => prev.map((c, i) => i === dragIdx.current
      ? { x: Math.max(0, Math.min(previewSize.w, x)), y: Math.max(0, Math.min(previewSize.h, y)) }
      : c));
  };

  const endDrag = () => { dragIdx.current = -1; };

  useEffect(() => {
    if (estado !== 'ready') return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
    };
  }, [estado, previewSize, cornersDisplay]);

  const procesarYEnviar = async () => {
    if (!srcCanvasRef.current || !cornersDisplay) return;
    setEstado('processing');
    try {
      const out = warpToCanvas(srcCanvasRef.current, cornersDisplay);
      const file = await canvasToFile(out, `scan_${Date.now()}.jpg`);
      const preview = out.toDataURL('image/jpeg', 0.85);
      onDone({ archivo: { url: null, nombre: file.name, tipo: 'image/jpeg', storage: 'cdn-pending' }, file, preview, ocr_ok: true });
    } catch {
      setEstado('ready');
    }
  };

  if (estado === 'processing') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Procesando imagen…</p>
      </div>
    );
  }

  if (estado === 'ready' && cornersDisplay) {
    const factor = containerRef.current
      ? previewSize.w / containerRef.current.getBoundingClientRect().width
      : 1; // para mapear estilo CSS px
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-center text-muted-foreground">
          Ajusta las 4 esquinas al documento. Se recortará, enderezará y mejorará contraste automáticamente.
        </p>
        <div
          ref={containerRef}
          className="relative mx-auto bg-muted rounded-lg overflow-hidden border"
          style={{ maxWidth: 460, lineHeight: 0 }}
        >
          {img && (
            <img
              src={img.src}
              alt="preview"
              className="w-full block select-none pointer-events-none"
              draggable={false}
            />
          )}
          {/* Líneas entre corners */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${previewSize.w} ${previewSize.h}`} preserveAspectRatio="none">
            <polygon
              points={cornersDisplay.map(c => `${c.x},${c.y}`).join(' ')}
              fill="rgba(59,130,246,0.12)"
              stroke="rgba(59,130,246,0.95)"
              strokeWidth={Math.max(2, previewSize.w * 0.005)}
              strokeDasharray={`${previewSize.w * 0.015} ${previewSize.w * 0.01}`}
            />
          </svg>
          {/* Corners arrastrables (estilo en % relativo al preview) */}
          {cornersDisplay.map((c, i) => (
            <div
              key={i}
              onPointerDown={startDrag(i)}
              className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-white border-2 border-blue-500 shadow-md cursor-grab active:cursor-grabbing touch-none"
              style={{
                left: `${(c.x / previewSize.w) * 100}%`,
                top: `${(c.y / previewSize.h) * 100}%`,
              }}
            />
          ))}
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => { setEstado('idle'); setImg(null); srcCanvasRef.current = null; }} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Cambiar imagen
          </Button>
          <Button size="sm" onClick={procesarYEnviar} className="gap-1.5">
            <ScanLine className="w-3.5 h-3.5" /> Procesar y extraer
          </Button>
        </div>
      </div>
    );
  }

  const isMobile = 'ontouchstart' in window;
  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-center text-muted-foreground">Fotografía o sube una factura / albarán / ticket de proveedor.</p>
      <p className="text-[11px] text-center text-muted-foreground opacity-70">El sistema recorta, endereza y mejora el contraste antes del OCR (tipo CamScanner).</p>
      {isMobile ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
            <Camera className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium text-primary">Hacer foto</span>
            <input type="file" accept="image/*" capture="environment" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </label>
          <label className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-accent/20 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Subir archivo</span>
            <input type="file" accept="image/*,.pdf" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </label>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
          <Upload className="w-10 h-10 text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium text-primary">Selecciona o arrastra el documento</p>
            <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, PDF</p>
          </div>
          <input type="file" accept="image/*,.pdf" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        </label>
      )}
      <Button variant="ghost" size="sm" onClick={onSkip} className="w-full gap-1.5 text-muted-foreground text-xs">
        Saltar mejora — subir directa
      </Button>
    </div>
  );
}