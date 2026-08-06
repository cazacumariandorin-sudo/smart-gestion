import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, SpellCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

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
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          "Eres un corrector ortográfico y gramatical de español técnico. " +
          "Corrige ortografía, tildes, mayúsculas y gramática del siguiente texto DEVOLVIENDO ÚNICAMENTE el texto corregido, " +
          "sin explicaciones, sin comillas y conservando el formato de líneas y comillas si las hubiera. " +
          "Las siglas, unidades y referencias técnicas (A, mA, kW, V, IP, 2P, 4P, curva C, etc.) deben permanecer exactas. " +
          "Si appears un nombre comercial aproximado de material eléctrico o de construcción, normalízalo a la nomenclatura " +
          "técnica más probable (ej: 'Automatico 4x63A/300mA' → 'Automático 4P 63A curva C 300mA diferencial') sin inventar datos ni añadir marcas comerciales.\n\n" +
          "Texto:\n" + text,
      });
      const corregido = typeof res === "string" ? res : res?.response || res?.text || res?.output || "";
      const limpio = String(corregido || "").trim().replace(/^["'"]+|["'"]+$/g, "");
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