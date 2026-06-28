import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Image, SkipForward, Loader2, CheckCircle2, AlertCircle, RefreshCw, ScanLine } from 'lucide-react';

const isMobile = () => 'ontouchstart' in window || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function TicketCapture({ onCaptured, onSkip }) {
  const [estado, setEstado] = useState('idle');
  const [mensaje, setMensaje] = useState('');
  const [preview, setPreview] = useState(null);
  const [stream, setStream] = useState(null);
  const [permisoCamara, setPermisoCamara] = useState('indeterminado');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const checkPermiso = async () => {
      try {
        if (!navigator.permissions) { setPermisoCamara('indeterminado'); return; }
        const result = await navigator.permissions.query({ name: 'camera' });
        setPermisoCamara(result.state);
        result.onchange = () => setPermisoCamara(result.state);
      } catch { setPermisoCamara('indeterminado'); }
    };
    checkPermiso();
  }, []);

  const subirArchivo = useCallback(async (file) => {
    setEstado('subiendo');
    setMensaje('Subiendo ticket…');
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader(); r.readAsDataURL(file);
        r.onload = () => res(r.result); r.onerror = rej;
      });
      let file_url = base64;
      let archivo = { url: base64, nombre: file.name, tipo: file.type, fecha_subida: new Date().toISOString(), storage: 'local' };
      try {
        setMensaje('Guardando en Drive…');
        const res = await base44.functions.invoke('uploadFileToGdrive', { file: base64, folder_path: 'Notas_Gastos' });
        file_url = res.data.file_url;
        archivo = { url: file_url, nombre: file.name, tipo: file.type, fecha_subida: new Date().toISOString(), storage: res.data.storage, drive_file_id: res.data.drive_file_id };
      } catch { archivo.storage = 'local_only'; }
      setEstado('ok');
      setMensaje(archivo.storage === 'local_only' ? 'Guardado localmente (sin Drive)' : 'Ticket subido ✓');
      onCaptured({ file_url, file_base64: base64, archivo, preview: previewUrl });
    } catch (e) {
      setEstado('error');
      setMensaje('Error al subir: ' + (e.message || ''));
    }
  }, [onCaptured]);

  const startWebcam = async () => {
    setEstado('webcam');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(s); if (videoRef.current) videoRef.current.srcObject = s;
    } catch { setEstado('error'); setMensaje('No se pudo acceder a la cámara'); }
  };
  const captureFrame = () => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stream?.getTracks().forEach(t => t.stop()); setStream(null);
    canvas.toBlob(blob => { if (blob) subirArchivo(new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.92);
  };
  const stopWebcam = () => { stream?.getTracks().forEach(t => t.stop()); setStream(null); setEstado('idle'); };
  const reset = () => { setEstado('idle'); setMensaje(''); setPreview(null); stream?.getTracks().forEach(t => t.stop()); setStream(null); };

  if (estado === 'webcam') {
    return (
      <div className="space-y-3">
        <div className="relative w-full rounded-xl border bg-black overflow-hidden">
          <video ref={videoRef} autoPlay playsInline className="w-full aspect-video object-cover" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 border-2 border-white/50 rounded-lg">
              <div className="absolute top-0 left-1/4 w-1/2 h-4 border-t-4 border-l-4 border-r-4 border-primary rounded-t-lg" />
              <div className="absolute bottom-0 left-1/4 w-1/2 h-4 border-b-4 border-l-4 border-r-4 border-primary rounded-b-lg" />
            </div>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
              <ScanLine className="w-3 h-3" /> Encuadra el documento
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <Button onClick={captureFrame} className="flex-1 gap-2"><Camera className="w-4 h-4" /> Capturar</Button>
          <Button variant="outline" onClick={stopWebcam}>Cancelar</Button>
        </div>
      </div>
    );
  }
  if (estado === 'subiendo') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        {preview && <img src={preview} alt="ticket" className="w-28 h-28 object-cover rounded-xl border shadow" />}
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
        <p className="text-sm text-primary font-medium">{mensaje}</p>
      </div>
    );
  }
  if (estado === 'ok') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        {preview && <img src={preview} alt="ticket" className="w-28 h-28 object-cover rounded-xl border shadow" />}
        <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-5 h-5" /><span className="text-sm font-medium">{mensaje}</span></div>
        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Cambiar imagen</Button>
      </div>
    );
  }
  if (estado === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600 text-center">{mensaje}</p>
        <Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>
      </div>
    );
  }
  const mobile = isMobile();
  return (
    <div className="space-y-3">
      <p className="text-xs text-center text-muted-foreground font-medium">Añade una foto del ticket o factura</p>
      {permisoCamara === 'denegado' && (
        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">Permiso de cámara denegado. Actívalo en los ajustes del navegador.</p>
        </div>
      )}
      {mobile ? (
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor="tc-camera" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer">
            <Camera className="w-7 h-7 text-primary" /><span className="text-xs font-semibold text-primary">Hacer foto</span>
          </label>
          <input id="tc-camera" type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f); e.target.value = ''; }} />
          <label htmlFor="tc-gallery" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/20 transition-colors cursor-pointer">
            <Image className="w-7 h-7 text-muted-foreground" /><span className="text-xs font-semibold text-muted-foreground">Galería</span>
          </label>
          <input id="tc-gallery" type="file" accept="image/*,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f); e.target.value = ''; }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={startWebcam} className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors">
            <Camera className="w-7 h-7 text-primary" /><span className="text-xs font-semibold text-primary">Webcam</span>
          </button>
          <canvas ref={canvasRef} className="hidden" />
          <label htmlFor="tc-file" className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/20 transition-colors cursor-pointer">
            <Upload className="w-7 h-7 text-muted-foreground" /><span className="text-xs font-semibold text-muted-foreground">Subir archivo</span>
          </label>
          <input id="tc-file" type="file" accept="image/*,.pdf" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f); e.target.value = ''; }} />
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onSkip} className="w-full gap-1.5 text-muted-foreground">
        <SkipForward className="w-3.5 h-3.5" /> Omitir ticket — rellenar manualmente
      </Button>
    </div>
  );
}