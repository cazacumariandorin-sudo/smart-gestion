
import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check } from 'lucide-react';

const W = 300;
const H = 120;

/**
 * Firma manuscrita. Usa Pointer Events (táctil + ratón + lápiz) y confirma la
 * firma AUTOMÁTICAMENTE al levantar el dedo: ya no hace falta pulsar ningún botón.
 */
export default function SignatureCanvas({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const movedRef = useRef(false);
  const lastValueRef = useRef(value || '');
  const [hasSig, setHasSig] = useState(!!value);

  const pintar = (dataUrl) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, W, H);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
    };
    img.src = dataUrl;
  };

  useEffect(() => { pintar(value); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Valor cambiado desde fuera (borrador recuperado, carga de edición)
  useEffect(() => {
    const v = value || '';
    if (v !== lastValueRef.current) {
      lastValueRef.current = v;
      pintar(v);
      setHasSig(!!v);
    }
  }, [value]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
  };

  const onDown = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture?.(e.pointerId);
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
    movedRef.current = false;
  };

  const onMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    movedRef.current = true;
  };

  const onUp = (e) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try { canvasRef.current.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    if (!movedRef.current) return; // toque suelto: no es firma
    let dataUrl = '';
    try { dataUrl = canvasRef.current.toDataURL('image/png'); } catch (err) { console.error('[Firma] toDataURL', err); }
    if (!dataUrl || dataUrl === 'data:,') return;
    lastValueRef.current = dataUrl;
    setHasSig(true);
    onChange(dataUrl);
  };

  const clear = () => {
    canvasRef.current?.getContext('2d').clearRect(0, 0, W, H);
    lastValueRef.current = '';
    setHasSig(false);
    onChange('');
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs" onClick={clear}>
          <Eraser className="w-3.5 h-3.5" /> Borrar
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full border border-input rounded-lg bg-white cursor-crosshair touch-none"
        style={{ aspectRatio: `${W} / ${H}`, touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      {hasSig && value && (
        <p className="text-[10px] text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Firma guardada</p>
      )}
    </div>
  );
}
