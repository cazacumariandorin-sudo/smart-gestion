import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sharpenAndEnhance } from '@/lib/imageEnhance';
import { subirImagen } from '@/lib/uploadPhoto';

/**
 * Re-procesa una foto ya guardada (nitidez + contraste + ampliación suave),
 * la sube de nuevo y sustituye la URL en RegistroGasto.archivos.
 * La URL anterior se conserva en `url_original` por si hay que volver atrás.
 */
export default function MejorarFotoButton({ foto }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!foto?.gasto_id || !foto?.archivo?.url || foto.archivo.mejorada) return null;

  const mejorar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const resp = await fetch(foto.archivo.url);
      if (!resp.ok) throw new Error('No se pudo descargar la foto');
      const blob = await resp.blob();
      const tipo = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      const original = new File([blob], 'ticket.jpg', { type: tipo });

      const mejorada = await sharpenAndEnhance(original, { upscaleMax: 1800 });
      if (mejorada === original) throw new Error('No se pudo procesar la imagen');

      const { file_url } = await subirImagen(mejorada);
      const nuevos = (foto.archivos_gasto || []).map((a) =>
        a?.url === foto.archivo.url
          ? { ...a, url: file_url, url_original: a.url_original || a.url, mejorada: true }
          : a
      );
      await base44.entities.RegistroGasto.update(foto.gasto_id, { archivos: nuevos });
      await queryClient.invalidateQueries({ queryKey: ['fotos_contabilidad'] });
      toast.success('Foto mejorada. La original sigue guardada.');
    } catch (err) {
      console.error('[MejorarFoto]', err);
      const status = err?.response?.status ?? err?.status;
      toast.error(
        status === 403
          ? 'Tu rol no puede modificar este gasto.'
          : /fetch|descargar|network/i.test(err?.message || '')
            ? 'No se pudo descargar la foto para procesarla. Inténtalo de nuevo.'
            : 'No se pudo mejorar la foto. Inténtalo de nuevo.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={mejorar}
      disabled={busy}
      className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium py-1.5 border border-t-0 rounded-b-xl bg-muted/40 hover:bg-muted text-primary disabled:opacity-60"
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      {busy ? 'Mejorando…' : 'Mejorar nitidez'}
    </button>
  );
}
