import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Camera, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extraerDatosGasto, evaluarPrecision } from '@/lib/ocrGastos';

export default function OcrUploader({ onDatosExtraidos, onArchivoSubido }) {
  const [estado, setEstado] = useState('idle'); // idle | uploading | procesando | ok | error
  const [mensaje, setMensaje] = useState('');
  const inputRef = useRef(null);

  const procesarArchivo = async (file) => {
    setEstado('uploading');
    setMensaje('Subiendo archivo...');
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onArchivoSubido({ url: file_url, nombre: file.name, tipo: file.type, fecha_subida: new Date().toISOString() });

      setEstado('procesando');
      setMensaje('Extrayendo datos con OCR+IA...');

      // OCR primario vía InvokeLLM (modelo por defecto, ~1 crédito).
      // Funciona en el plan Starter — no requiere función backend.
      const { datos, error } = await extraerDatosGasto(file_url);
      if (datos && !error) {
        const { precisa, motivo } = evaluarPrecision(datos);
        onDatosExtraidos({ ...datos, precisa_precision: precisa, precision_motivo: motivo });
        const conf = typeof datos.confianza === 'number' ? Math.round(datos.confianza * 100) : 'media';
        setEstado('ok');
        setMensaje(precisa
          ? `Datos extraídos · precisan revisión (${conf}%): ${motivo}`
          : `Datos extraídos (confianza: ${conf}%)`);
      } else {
        console.warn('OCR InvokeLLM no devolvió datos:', error);
        setEstado('ok');
        setMensaje('Foto adjuntada · rellena los datos a mano (OCR no disponible)');
      }
    } catch (e) {
      setEstado('error');
      setMensaje('Error al procesar: ' + e.message);
    }
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
          estado === 'ok' ? 'border-green-400 bg-green-50 dark:bg-green-950/20' :
          estado === 'error' ? 'border-red-300 bg-red-50 dark:bg-red-950/20' :
          'border-border hover:border-primary hover:bg-accent/30'
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleChange}
        />

        {estado === 'uploading' || estado === 'procesando' ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-primary">{mensaje}</p>
          </div>
        ) : estado === 'ok' ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">{mensaje}</p>
            <p className="text-xs text-muted-foreground">Toca para añadir otro archivo</p>
          </div>
        ) : estado === 'error' ? (
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm font-medium text-red-600">{mensaje}</p>
            <p className="text-xs text-muted-foreground">Toca para reintentar</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-3 justify-center">
              <Camera className="w-7 h-7 text-muted-foreground" />
              <FileText className="w-7 h-7 text-muted-foreground" />
              <Upload className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Subir ticket, factura o documento</p>
              <p className="text-xs text-muted-foreground mt-1">Foto, PDF, Word, Excel — extracción automática con IA</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}