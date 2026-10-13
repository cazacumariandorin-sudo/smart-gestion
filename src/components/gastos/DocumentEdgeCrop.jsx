/**
 * DocumentEdgeCrop — Enderezado y recorte de comprobantes (enfoque híbrido).
 *
 * 1. Auto-detección ligera del papel (mayor región brillante → trapecio
 *    aproximando la perspectiva) sobre una miniatura de 256px.
 * 2. Ajuste manual de las 4 esquinas arrastrables (respaldo cuando la
 *    auto-detección falla, papeles alargados, fondo claro, etc.).
 * 3. Warpeo por homografía real (perspectiva) a un rectángulo plano y
 *    recortado, listo para OCR.
 *
 * Sin dependencias externas: todo canvas + álgebra (homografía 8x8).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crop, RefreshCw, Check, X, Loader2 } from 'lucide-react';

const MAX_SRC = 2000; // lado máximo de la imagen fuente de muestreo (memoria)
const MAX_OUT = 3200; // lado máximo de salida: un ticket alargado necesita ancho suficiente para leerse

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(img.src); reject(e); };
    img.src = URL.createObjectURL(file);
  });
}

export function detectQuad(img) {
  const scale = Math.min(1, 256 / Math.max(img.width, img.height));
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);
  const gray = new Float32Array(sw * sh);
  let sum = 0;
  for (let p = 0, i = 0; p < sw * sh; i += 4, p++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = g; sum += g;
  }
  const mean = sum / gray.length;
  const thr = mean * 1.05 + 10;

  const rowMin = new Array(sh).fill(-1), rowMax = new Array(sh).fill(-1);
  let firstRow = -1, lastRow = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (gray[y * sw + x] > thr) {
        if (rowMin[y] < 0) rowMin[y] = x;
        rowMax[y] = x;
        if (firstRow < 0) firstRow = y;
        lastRow = y;
      }
    }
  }

  const sx = 1 / scale;
  const m = 0.1;
  const inset = [
    { x: img.width * m, y: img.height * m },
    { x: img.width * (1 - m), y: img.height * m },
    { x: img.width * (1 - m), y: img.height * (1 - m) },
    { x: img.width * m, y: img.height * (1 - m) },
  ];
  if (firstRow < 0) return { corners: inset, autoOk: false };

  const contentH = lastRow - firstRow + 1;
  const bandH = Math.max(1, Math.round(contentH * 0.35));
  const topEnd = firstRow + bandH;
  const botStart = Math.max(firstRow, lastRow - bandH + 1);
  let tMin = sw, tMax = 0, bMin = sw, bMax = 0;
  for (let y = firstRow; y <= topEnd; y++) {
    if (rowMin[y] >= 0) { tMin = Math.min(tMin, rowMin[y]); tMax = Math.max(tMax, rowMax[y]); }
  }
  for (let y = botStart; y <= lastRow; y++) {
    if (rowMin[y] >= 0) { bMin = Math.min(bMin, rowMin[y]); bMax = Math.max(bMax, rowMax[y]); }
  }
  if (tMax <= tMin || bMax <= bMin) return { corners: inset, autoOk: false };

  return {
    corners: [
      { x: tMin * sx, y: firstRow * sx },
      { x: tMax * sx, y: firstRow * sx },
      { x: bMax * sx, y: lastRow * sx },
      { x: bMin * sx, y: lastRow * sx },
    ],
    autoOk: true,
  };
}

function gauss(A, B) {
  const n = B.length;
  const M = A.map((row, i) => [...row, B[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const pc = M[col][col];
    if (Math.abs(pc) < 1e-9) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / pc;
      for (let cc = col; cc <= n; cc++) M[r][cc] -= f * M[col][cc];
    }
  }
  const x = new Array(n);
  for (let i = 0; i < n; i++) x[i] = M[i][n] / (M[i][i] || 1);
  return x;
}

// Resuelve H tal que src = H · dst (para muestrear el origen por pixel destino).
function solveHomography(dst, src) {
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i], { x: u, y: v } = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  return gauss(A, B);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function recortarConEsquinas(file, img, corners) {
  const sScale = Math.min(1, MAX_SRC / Math.max(img.width, img.height));
  const sw = Math.max(1, Math.round(img.width * sScale));
  const sh = Math.max(1, Math.round(img.height * sScale));
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = sw; srcCanvas.height = sh;
  const sctx = srcCanvas.getContext('2d');
  sctx.drawImage(img, 0, 0, sw, sh);
  const srcData = sctx.getImageData(0, 0, sw, sh);
  const sCorners = corners.map((c) => ({ x: c.x * sScale, y: c.y * sScale }));

  const w = (dist(sCorners[0], sCorners[1]) + dist(sCorners[3], sCorners[2])) / 2;
  const h = (dist(sCorners[0], sCorners[3]) + dist(sCorners[1], sCorners[2])) / 2;
  const outScale = Math.min(1, MAX_OUT / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * outScale));
  const outH = Math.max(1, Math.round(h * outScale));

  const dst = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }];
  const H = solveHomography(dst, sCorners);
  const [a, b, c, d, ee, f, g, hh] = H;
  const sd = srcData.data;
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const wd = g * x + hh * y + 1;
      const sxf = (a * x + b * y + c) / wd;
      const syf = (d * x + ee * y + f) / wd;
      const oi = (y * outW + x) * 4;
      const xi = Math.floor(sxf), yi = Math.floor(syf);
      if (xi < 0 || yi < 0 || xi + 1 >= sw || yi + 1 >= sh) {
        out[oi] = 255; out[oi + 1] = 255; out[oi + 2] = 255; out[oi + 3] = 255;
        continue;
      }
      const ddx = sxf - xi, ddy = syf - yi;
      const i00 = (yi * sw + xi) * 4, i10 = (yi * sw + xi + 1) * 4;
      const i01 = ((yi + 1) * sw + xi) * 4, i11 = ((yi + 1) * sw + xi + 1) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = sd[i00 + ch] * (1 - ddx) + sd[i10 + ch] * ddx;
        const bot = sd[i01 + ch] * (1 - ddx) + sd[i11 + ch] * ddx;
        out[oi + ch] = top * (1 - ddy) + bot * ddy;
      }
      out[oi + 3] = 255;
    }
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW; outCanvas.height = outH;
  outCanvas.getContext('2d').putImageData(new ImageData(out, outW, outH), 0, 0);

  const blob = await new Promise((res) => outCanvas.toBlob(res, 'image/jpeg', 0.85));
  const name = file.name.replace(/\.(jpe?g|png|gif|webp)$/i, '') + '_recortado.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

/**
 * Pipeline completo sin interfaz: detecta las 4 esquinas y recorta en un solo paso.
 * Lo usa el captador para aplicar el recorte EN SILENCIO cuando la detección es fiable
 * (ver decisionRecorte.debeAjustarManualmente); si no, se muestra el editor manual de abajo.
 * Devuelve { file, autoOk, corners, natural } — null si la imagen no se pudo leer.
 */
export async function autoCropFile(file) {
  try {
    const img = await loadImage(file);
    const natural = { w: img.width, h: img.height };
    const d = detectQuad(img);
    const croppedFile = await recortarConEsquinas(file, img, d.corners);
    return { file: croppedFile, autoOk: d.autoOk, corners: d.corners, natural };
  } catch (e) {
    console.warn('autoCropFile falló', e);
    return null;
  }
}

export default function DocumentEdgeCrop({ file, onConfirm, onSkip, onCancel }) {
  const [natural, setNatural] = useState(null);
  const [corners, setCorners] = useState(null);
  const [autoOk, setAutoOk] = useState(true);
  const [applying, setApplying] = useState(false);
  const imgRef = useRef(null);
  const dragRef = useRef(null); // { idx, rect }

  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  useEffect(() => {
    let alive = true;
    loadImage(file).then((img) => {
      if (!alive) return;
      setNatural({ w: img.width, h: img.height });
      const d = detectQuad(img);
      setCorners(d.corners);
      setAutoOk(d.autoOk);
    }).catch(() => { if (alive) setAutoOk(false); });
    return () => { alive = false; };
  }, [file]);

  const onHandleDown = (e, idx) => {
    e.preventDefault();
    const rect = imgRef.current.getBoundingClientRect();
    dragRef.current = { idx, rect };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e) => {
    const d = dragRef.current;
    if (!d || !natural) return;
    const rect = d.rect;
    const px = (e.clientX - rect.left) / rect.width * natural.w;
    const py = (e.clientY - rect.top) / rect.height * natural.h;
    setCorners((prev) => prev.map((c, i) => i === d.idx
      ? { x: Math.max(0, Math.min(natural.w, px)), y: Math.max(0, Math.min(natural.h, py)) }
      : c));
  };

  const onHandleUp = (e) => {
    if (dragRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
    dragRef.current = null;
  };

  const reDetect = async () => {
    const img = await loadImage(file);
    const d = detectQuad(img);
    setCorners(d.corners);
    setAutoOk(d.autoOk);
  };

  const aplicar = async () => {
    if (!natural || !corners) return;
    setApplying(true);
    try {
      const img = await loadImage(file);
      const outFile = await recortarConEsquinas(file, img, corners);
      onConfirm?.(outFile);
    } catch (e) {
      console.warn('Edge crop falló, usando original', e);
      onSkip?.();
    } finally {
      setApplying(false);
    }
  };

  if (!corners) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Analizando documento…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Crop className="w-4 h-4 text-primary" />
        <span className="font-medium">Centra el papel</span>
        {!autoOk && <span className="text-[11px] text-amber-600 ml-auto">Detección manual — ajusta las esquinas</span>}
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1">
        Arrastra las 4 esquinas para encuadrar el ticket sin fondo. Ideal para papeles alargados.
      </p>

      <div className="relative w-full max-w-md mx-auto select-none touch-none rounded-xl overflow-hidden border bg-muted">
        <img
          ref={imgRef}
          src={previewUrl}
          alt="comprobante"
          className="block w-full h-auto"
          draggable={false}
        />
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${natural.w} ${natural.h}`}
          preserveAspectRatio="none"
        >
          <polygon
            points={`${corners.map((c) => `${c.x},${c.y}`).join(' ')}`}
            fill="rgba(59,130,246,0.12)"
            stroke="rgb(59,130,246)"
            strokeWidth={Math.max(2, natural.w / 200)}
          />
        </svg>
        {corners.map((c, i) => (
          <button
            key={i}
            type="button"
            onPointerDown={(e) => onHandleDown(e, i)}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-white border-2 border-primary shadow-md cursor-grab active:cursor-grabbing"
            style={{ left: `${(c.x / natural.w) * 100}%`, top: `${(c.y / natural.h) * 100}%`, touchAction: 'none' }}
            aria-label={`Esquina ${i + 1}`}
          />
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={reDetect} disabled={applying} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Re-detectar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onSkip?.()} disabled={applying} className="gap-1.5">
          <X className="w-3.5 h-3.5" /> Usar original
        </Button>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={() => onCancel?.()} disabled={applying} className="gap-1.5">
            Cancelar
          </Button>
        )}
        <Button size="sm" onClick={aplicar} disabled={applying} className="gap-1.5 ml-auto">
          {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {applying ? 'Procesando…' : 'Aplicar recorte'}
        </Button>
      </div>
    </div>
  );
}
