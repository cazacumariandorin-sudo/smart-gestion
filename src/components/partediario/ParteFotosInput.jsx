import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import ImageCompressorInput from '@/components/ui/ImageCompressorInput';
import { Camera, X, Loader2 } from 'lucide-react';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

export default function ParteFotosInput({ fotos, onChange }) {
  const [subiendo, setSubiendo] = useState(false);

  const handleFile = async (result) => {
    setSubiendo(true);
    try {
      const base64 = await fileToBase64(result.file);
      const now = new Date();
      const res = await base44.functions.invoke('subirArchivoConFallback', {
        file_base64: base64,
        ruta_drive: `Partes_Diarios/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`,
        entidad_tipo: 'ParteDiarioObra',
      });
      onChange([...fotos, { url: res.data.file_url, storage: res.data.storage, drive_file_id: res.data.drive_file_id }]);
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = (idx) => onChange(fotos.filter((_, i) => i !== idx));

  return (
    <div className="grid grid-cols-4 gap-2">
      {fotos.map((foto, idx) => (
        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
          <img src={foto.url} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => eliminar(idx)} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ))}
      <ImageCompressorInput onFile={handleFile}>
        <div className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/30 transition-colors">
          {subiendo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
          <span className="text-[10px]">Añadir</span>
        </div>
      </ImageCompressorInput>
    </div>
  );
}