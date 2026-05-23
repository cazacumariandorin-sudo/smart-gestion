/**
 * ImageCompressorInput — Input de imagen con compresión automática a WebP vía Canvas.
 * Muestra feedback visual del ahorro de espacio conseguido.
 *
 * Props:
 *   onFile(result) — llamado con { file, compressed, originalSize, finalSize, savingPercent }
 *   accept — string de tipos aceptados (default "image/*")
 *   children — contenido del trigger (botón/label personalizado)
 *   className — clases del label wrapper
 */
import { useRef, useState } from 'react';
import { compressImageToWebP, formatFileSize } from '@/utils/imageCompressor';
import { Loader2 } from 'lucide-react';

export default function ImageCompressorInput({ onFile, accept = 'image/*', children, className = '' }) {
  const inputRef = useRef(null);
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState(null); // { saved, originalSize, finalSize }

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    setCompressionInfo(null);

    const result = await compressImageToWebP(file);

    setCompressing(false);

    if (result.compressed && result.savingPercent > 10) {
      setCompressionInfo({
        savingPercent: result.savingPercent,
        originalSize: result.originalSize,
        finalSize: result.finalSize,
      });
    }

    onFile(result);
    // Reset input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
  };

  return (
    <div>
      <label className={`cursor-pointer ${className}`} onClick={() => inputRef.current?.click()}>
        {children}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      {compressing && (
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          Optimizando imagen...
        </div>
      )}

      {compressionInfo && !compressing && (
        <div className="inline-flex items-center gap-1 mt-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
          ✓ Imagen optimizada — {formatFileSize(compressionInfo.originalSize)} → {formatFileSize(compressionInfo.finalSize)} (ahorro {compressionInfo.savingPercent}%)
        </div>
      )}
    </div>
  );
}