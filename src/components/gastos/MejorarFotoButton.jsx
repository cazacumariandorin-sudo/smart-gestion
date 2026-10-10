import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Loader2, Upload, Undo2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { sharpenAndEnhance } from '@/lib/imageEnhance';
import { subirImagen } from '@/lib/uploadPhoto';
import { comprimirImagen } from '@/lib/workOrderUtils';
import { calcularDHash } from '@/lib/duplicadoGasto';

const ANCHO_MINIMO = 700; // por debajo no hay texto legible que recuperar

const medirAncho = (blob) =>
  createImageBitmap(blob).then((b) => b.width).catch(() => 0);

/**
 * Acciones sobre una foto justificante ya guardada:
 *  - Mejorar nitidez: solo si la foto tiene resolución suficiente (el filtro NO inventa texto).
 *  - Sustituir por original: sube de nuevo la foto buena (conserva la anterior en url_original).
 *  - Deshacer: vuelve a la versión anterior.
 */
export default function MejorarFotoButton({ foto }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState('');
  const inputRef = useRef(null);

  if (!foto?.gasto_id || !foto?.archivo?.url) return null;
  const actual = foto.archivo;

  const guardar = async (cambio) => {
    const nuevos = (foto.archivos_gasto || []).map((a) => (a?.url === actual.url ? { ...a, ...cambio } : a));
    await base44.entities.RegistroGasto.update(foto.gasto_id, { archivos: nuevos });
    await queryClient.invalidateQueries({ queryKey: ['fotos_contabilidad'] });
    await queryClient.invalidateQueries({ queryKey: ['notas_gasto'] });
  };

  const fallo = (err, msg) => {
    console.error('[Foto justificante]', err);
    const status = err?.response?.status ?? err?.status;
    toast.error(status === 403 ? 'Tu rol no puede modificar este gasto.' : msg);
  };

  const mejorar = async () => {
    setBusy('mejorar');
    try {
      const resp = await fetch(actual.url);
      if (!resp.ok) throw new Error('descarga');
      const blob = await resp.blob();
      const ancho = await medirAncho(blob);
      if (ancho && ancho < ANCHO_MINIMO) {
        toast.warning(
          `La foto solo tiene ${ancho} px de ancho: es demasiado pequeña y el filtro no puede recuperar el texto. Usa «Sustituir por original».`,
          { duration: 9000 }
        );
        return;
      }
      const tipo = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      const original = new File([blob], 'ticket.jpg', { type: tipo });
      const mejorada = await sharpenAndEnhance(original);
      if (mejorada === original) throw new Error('proceso');
      const { file_url } = await subirImagen(mejorada);
      await guardar({ url: file_url, url_original: actual.url_original || actual.url, mejorada: true });
      toast.success('Nitidez aplicada. Puedes deshacerlo.');
    } catch (err) {
      fallo(err, 'No se pudo mejorar la foto. Inténtalo de nuevo.');
    } finally {
      setBusy('');
    }
  };

  const sustituir = async (e) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setBusy('sustituir');
    try {
      const preparada = await comprimirImagen(file, 3200, 0.85);
      const dhash = await calcularDHash(preparada);
      const { file_url } = await subirImagen(preparada);
      await guardar({ url: file_url, url_original: actual.url_original || actual.url, reemplazada: true, mejorada: false, dhash });
      toast.success('Foto sustituida por el original.');
    } catch (err) {
      fallo(err, 'No se pudo subir la foto. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setBusy('');
    }
  };

  const deshacer = async () => {
    setBusy('deshacer');
    try {
      await guardar({ url: actual.url_original, url_original: actual.url, mejorada: false, reemplazada: false });
      toast.success('Se ha restaurado la versión anterior.');
    } catch (err) {
      fallo(err, 'No se pudo deshacer.');
    } finally {
      setBusy('');
    }
  };

  const cls = 'flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 hover:bg-muted text-primary disabled:opacity-60';
  return (
    <div className="flex border border-t-0 rounded-b-xl bg-muted/40 divide-x overflow-hidden">
      {(actual.mejorada || actual.reemplazada) && actual.url_original ? (
        <button type="button" onClick={deshacer} disabled={!!busy} className={cls}>
          {busy === 'deshacer' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Deshacer
        </button>
      ) : (
        <button type="button" onClick={mejorar} disabled={!!busy} className={cls}>
          {busy === 'mejorar' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Nitidez
        </button>
      )}
      <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy} className={cls}>
        {busy === 'sustituir' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Subir original
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={sustituir} />
    </div>
  );
}
