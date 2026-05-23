/**
 * compressImageToWebP — Comprime imágenes en el cliente usando Canvas API.
 * Convierte a WebP para máximo ahorro. Imágenes <200KB se pasan sin comprimir.
 */
export async function compressImageToWebP(file, maxWidthPx = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    // No comprimir si es pequeña o no es imagen
    if (file.size < 200 * 1024 || !file.type.startsWith('image/')) {
      resolve({
        file,
        compressed: false,
        originalSize: file.size,
        finalSize: file.size,
        savingPercent: 0,
      });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxWidthPx / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve({ file, compressed: false, originalSize: file.size, finalSize: file.size, savingPercent: 0 });
            return;
          }
          const webpFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.webp'),
            { type: 'image/webp' }
          );
          const savingPercent = Math.round((1 - webpFile.size / file.size) * 100);
          resolve({
            file: webpFile,
            compressed: true,
            originalSize: file.size,
            finalSize: webpFile.size,
            savingPercent,
          });
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ file, compressed: false, originalSize: file.size, finalSize: file.size, savingPercent: 0 });
    };

    img.src = url;
  });
}

/**
 * Formatea bytes a KB o MB legible
 */
export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}