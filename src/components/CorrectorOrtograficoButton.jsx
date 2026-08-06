import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, SpellCheck } from "lucide-react";
import { toast } from "sonner";
import { corregirTextoIA } from "@/lib/correction";

/**
 * Botón que corrige ortografía y gramática en español de un texto usando IA.
 * Pensado para textos genéricos escritos por técnicos sin conocimientos avanzados
 * de nombres comerciales / referencias técnicas: normaliza la nomenclatura
 * de material eléctrico y de construcción sin inventar datos.
 *
 * Props:
 *  - text: texto a corregir.
 *  - onCorrected: (textoCorregido) => void  — recibe el resultado ya limpio.
 *  - label, size, variant, disabled.
 */
export default function CorrectorOrtograficoButton({
  text,
  onCorrected,
  label = "Corregir",
  size = "sm",
  variant = "outline",
  disabled,
}) {
  const [corrigiendo, setCorrigiendo] = useState(false);

  const corregir = async () => {
    if (!text || !String(text).trim()) {
      toast.error("No hay texto para corregir");
      return;
    }
    setCorrigiendo(true);
    try {
      const limpio = await corregirTextoIA(text);
      if (limpio) {
        onCorrected?.(limpio);
        toast.success("Texto corregido");
      } else {
        toast.error("No se pudo corregir el texto");
      }
    } catch (e) {
      toast.error("No se pudo corregir el texto");
    } finally {
      setCorrigiendo(false);
    }
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={corregir} disabled={disabled || corrigiendo}>
      {corrigiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SpellCheck className="w-3.5 h-3.5" />}
      {corrigiendo ? "Corrigiendo..." : label}
    </Button>
  );
}