import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, SpellCheck } from 'lucide-react';
import { toast } from 'sonner';
import { corregirCamposIA } from '@/lib/correction';

/**
 * Corrige la ortografía de TODO el formulario en una sola pasada.
 * Props: campos [{id, texto}] · onCorregido({ [id]: texto }) · label
 */
export default function CorregirFormularioButton({ campos = [], onCorregido, label = 'Corregir ortografía' }) {
  const [corrigiendo, setCorrigiendo] = useState(false);
  const rellenables = campos.filter(c => String(c.texto || '').trim());

  const corregir = async () => {
    if (!rellenables.length) {
      toast.error('No hay texto que corregir en el formulario');
      return;
    }
    setCorrigiendo(true);
    try {
      const cambios = await corregirCamposIA(rellenables);
      const n = Object.keys(cambios).length;
      if (!n) {
        toast.error('No se pudo corregir el formulario');
        return;
      }
      onCorregido(cambios);
      toast.success(`Ortografía corregida en ${n} ${n === 1 ? 'campo' : 'campos'} del formulario`);
    } catch (e) {
      toast.error('No se pudo corregir el formulario');
    } finally {
      setCorrigiendo(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={corregir} disabled={corrigiendo || !rellenables.length}
      title="Revisa la ortografía de todos los campos del presupuesto">
      {corrigiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SpellCheck className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{corrigiendo ? 'Corrigiendo…' : label}</span>
    </Button>
  );
}