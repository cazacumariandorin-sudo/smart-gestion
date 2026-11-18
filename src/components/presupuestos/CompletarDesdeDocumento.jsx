import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { partidasFaltantesDocumento } from '@/lib/partidasDesdeDocumento';
import { partidasNoIncluidas } from '@/lib/compararPartidas';

/**
 * Compara el presupuesto con su documento de origen y añade automáticamente
 * las partidas que el documento describe y aún no están en el presupuesto.
 * No inventa precios: las líneas nuevas entran sin valorar.
 */
export default function CompletarDesdeDocumento({ documentos = [], conceptos = [], clienteName, obraName, onAgregar }) {
  const [cargando, setCargando] = useState(false);
  const docs = documentos.filter(d => d?.url);

  const completar = async () => {
    if (!docs.length) {
      toast.error('Sube primero el documento de origen del presupuesto');
      return;
    }
    setCargando(true);
    try {
      let propuestas = [];
      for (const d of docs) {
        const { datos, error } = await partidasFaltantesDocumento({
          file_url: d.url,
          file_name: d.nombre,
          cliente_name: clienteName,
          obra_name: obraName,
          existentes: conceptos,
        });
        if (error) throw new Error(error);
        propuestas = [...propuestas, ...(datos?.partidas || [])];
      }

      const nuevas = partidasNoIncluidas(propuestas, conceptos);
      if (!nuevas.length) {
        toast.success('El presupuesto ya incluye todas las partidas del documento');
        return;
      }

      onAgregar(nuevas.map(p => ({
        tipo: 'linea',
        descripcion: p.capitulo ? `${p.capitulo} · ${p.descripcion}` : p.descripcion,
        cantidad: Number(p.cantidad) || 1,
        unidad: p.unidad || 'ud',
        precio_unitario: Number(p.precio_unitario) || 0,
        iva_pct: Number(p.iva_pct) || 21,
        detalle: [p.medicion, p.detalle].filter(Boolean).join(' · '),
      })));
      toast.success(`${nuevas.length} ${nuevas.length === 1 ? 'partida añadida' : 'partidas añadidas'} desde el documento`);
    } catch (e) {
      toast.error(e?.message || 'No se pudieron completar las partidas');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={completar} disabled={cargando || !docs.length}
      title={docs.length ? 'Añade las partidas del documento que falten' : 'Sube un documento de origen para usar esta opción'}>
      {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListPlus className="w-3.5 h-3.5" />}
      {cargando ? 'Comparando…' : 'Completar desde documento'}
    </Button>
  );
}