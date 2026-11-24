import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Input de una línea cuyo ancho se ajusta al contenido: parte de `minCh` caracteres
 * y se ensancha cuando el valor lo necesita (hasta `maxCh`), sin cortar cifras largas.
 * Props estándar de <Input> + `minCh` y `maxCh`.
 */
export default function AutoSizeInput({ value, minCh = 4, maxCh = 20, className, style, ...props }) {
  const texto = String(value ?? '');
  const ancho = Math.min(maxCh, Math.max(minCh, texto.length + 1));

  return (
    <Input
      {...props}
      value={value}
      className={cn('px-1', className)}
      style={{ width: `${ancho}ch`, ...style }}
    />
  );
}