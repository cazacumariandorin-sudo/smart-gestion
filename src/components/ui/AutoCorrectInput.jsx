import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { corregirTextoIA, MIN_LEN_AUTOCORRECCION } from '@/lib/correction';

/**
 * Input que corrige automáticamente ortografía/gramática en español al perder el foco.
 * Corrección silenciosa: solo reemplaza si la IA devuelve algo distinto y nunca interrumpe.
 *
 * Props estándar de <Input> + opcional `correctorDisabled` (desactiva la corrección en campos
 * concretos como NIF, números o fechas) y `minLength` (umbral propio).
 */
export default function AutoCorrectInput({ value, onChange, correctorDisabled, minLength = MIN_LEN_AUTOCORRECCION, onBlur, className, wrapperClassName, ...props }) {
  const [corrigiendo, setCorrigiendo] = useState(false);

  // No corregir inputs numéricos, date, time, password, email, url ni selectores
  const tipo = props.type || 'text';
  const tipoSafe = ['text', 'search', undefined].includes(props.type) ? 'text' : null;
  const shouldCorrect = !correctorDisabled && tipoSafe;

  const handleBlur = async (e) => {
    const txt = typeof value === 'string' ? value : '';
    if (shouldCorrect && txt.trim().length >= minLength) {
      try {
        setCorrigiendo(true);
        const corregido = await corregirTextoIA(txt);
        if (corregido && corregido !== txt) {
          onChange?.({ target: { value: corregido } });
        }
      } catch { /* silencioso */ } finally {
        setCorrigiendo(false);
      }
    }
    onBlur?.(e);
  };

  return (
    <div className={cn('relative w-full', wrapperClassName)}>
      <Input value={value} onChange={onChange} onBlur={handleBlur} className={className} {...props} />
      {corrigiendo && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}