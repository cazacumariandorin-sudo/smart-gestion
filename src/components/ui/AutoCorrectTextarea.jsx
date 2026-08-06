import { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { corregirTextoIA, MIN_LEN_AUTOCORRECCION } from '@/lib/correction';

/**
 * Textarea que corrige automáticamente ortografía/gramática en español al perder el foco.
 * La corrección es silenciosa: solo reemplaza el texto si la IA devuelve algo distinto,
 * y nunca interrumpe al usuario con toasts ni errores visibles.
 *
 * Props estándar de <Textarea> + opcional `correctorDisabled` (para desactivar en campos concretos).
 */
export default function AutoCorrectTextarea({ value, onChange, correctorDisabled, onBlur, placeholder, ...props }) {
  const [corrigiendo, setCorrigiendo] = useState(false);
  const ref = useRef(null);

  const handleBlur = async (e) => {
    // Corrección automática: solo en textos suficientemente largos
    const txt = typeof value === 'string' ? value : '';
    if (!correctorDisabled && txt.trim().length >= MIN_LEN_AUTOCORRECCION) {
      try {
        setCorrigiendo(true);
        const corregido = await corregirTextoIA(txt);
        if (corregido && corregido !== txt) {
          onChange?.({ target: { value: corregido } });
        }
      } catch { /* silencioso: no molestar al técnico */ } finally {
        setCorrigiendo(false);
      }
    }
    onBlur?.(e);
  };

  return (
    <div className="relative flex-1">
      <Textarea ref={ref} value={value} onChange={onChange} onBlur={handleBlur} placeholder={placeholder} {...props} />
      {corrigiendo && (
        <div className="absolute right-2 top-2 pointer-events-none">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}