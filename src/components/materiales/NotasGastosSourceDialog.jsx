/**
 * NotasGastosSourceDialog — Carga documentos para alta de materiales desde
 * notas de gastos existentes (RegistroGasto con archivos adjuntos).
 *
 * Los contadores (Total / Pendientes / Procesados / Duplicados) son filtros
 * interactivos. "Procesar bloque" lanza OCR + guardado de todos los pendientes
 * visibles. La vista Duplicados permite examinar y borrar los repetidos.
 */
import { useMemo, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Search, FileImage, CheckCircle2, Copy, Loader2, ImageIcon, Play, Square } from 'lucide-react';
import { toast } from 'sonner';
import DuplicadosNotasGastos from './DuplicadosNotasGastos';
import { useCargaMasivaMateriales } from '@/hooks/useCargaMasivaMateriales';

const CATEGORIA_COLOR = {
  material: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  combustible: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
  peaje: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
  parking: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  comida: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  otros: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

export default function NotasGastosSourceDialog({ open, onClose, onSelect, onSaved }) {
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('pendientes'); // 'pendientes' | 'procesados' | 'duplicados' | 'todos'
  const [selectedId, setSelectedId] = useState(null);
  const qc = useQueryClient();
  const { progreso, ejecutar, detener } = useCargaMasivaMateriales();

  const { data: gastos = [], isLoading } = useQuery({
    queryKey: ['registro_gasto_con_archivos'],
    queryFn: async () => {
      const all = [];
      let skip = 0;
      for (let i = 0; i < 3; i++) {
        const batch = await base44.entities.RegistroGasto.list('-created_date', 200, skip);
        if (!batch || !batch.length) break;
        all.push(...batch);
        if (batch.length < 200) break;
        skip += 200;
      }
      return all.filter(g => Array.isArray(g.archivos) && g.archivos.length > 0 && (g.categoria || 'otros') === 'material');
    },
    enabled: open,
  });

  const { data: docsOrigen = [] } = useQuery({
    queryKey: ['materiales_documento_origen'],
    queryFn: () => base44.entities.MaterialDocumentoOrigen.list('-created_date', 500),
    enabled: open,
  });

  const { urlsProcesadas, numerosProcesados } = useMemo(() => {
    const urls = new Set();
    const nums = new Set();
    for (const d of docsOrigen) {
      if (d.archivo_url_mejorado) urls.add(d.archivo_url_mejorado);
      if (d.archivo_url_original) urls.add(d.archivo_url_original);
      if (d.numero_documento) nums.add(d.numero_documento);
    }
    return { urlsProcesadas: urls, numerosProcesados: nums };
  }, [docsOrigen]);

  const items = useMemo(() => {
    const out = [];
    const seenUrls = new Set();
    for (const g of gastos) {
      const archivos = g.archivos || [];
      archivos.forEach((a, idx) => {
        const url = a.url || '';
        const yaProcesado = url && (urlsProcesadas.has(url) || (g.numero_factura && numerosProcesados.has(g.numero_factura)));
        const dupInterno = url && seenUrls.has(url);
        if (url) seenUrls.add(url);
        out.push({
          key: g.id + '_' + idx,
          registro_id: g.id,
          file_url: url,
          nombre: a.nombre || '',
          tipo_archivo: a.tipo || '',
          operario_name: g.operario_name || '',
          nombre_comercio: g.nombre_comercio || '',
          nif_comercio: g.nif_comercio || '',
          fecha_documento: g.fecha_documento || '',
          numero_factura: g.numero_factura || '',
          categoria: g.categoria || 'otros',
          importe: g.importe || 0,
          obra_name: g.obra_name || '',
          yaProcesado,
          dupInterno,
          ...g,
        });
      });
    }
    return out;
  }, [gastos, urlsProcesadas, numerosProcesados]);

  const stats = useMemo(() => {
    const total = items.length;
    const procesados = items.filter(i => i.yaProcesado).length;
    const pendientes = total - procesados;
    const duplicados = items.filter(i => i.dupInterno && !i.yaProcesado).length;
    return { total, procesados, pendientes, duplicados };
  }, [items]);

  // Grupos de duplicados: mismo archivo (URL) en más de un registro.
  const gruposDup = useMemo(() => {
    const byUrl = new Map();
    for (const it of items) {
      if (!it.file_url) continue;
      if (!byUrl.has(it.file_url)) byUrl.set(it.file_url, []);
      byUrl.get(it.file_url).push(it);
    }
    return [...byUrl.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([url, list]) => ({ url, items: list }));
  }, [items]);

  const q = search.trim().toLowerCase();
  const coincide = (it) => {
    if (!q) return true;
    const blob = [it.nombre_comercio, it.operario_name, it.numero_factura, it.obra_name, it.nombre].join(' ').toLowerCase();
    return blob.includes(q);
  };

  const filtrados = useMemo(() => {
    const base = filtro === 'procesados'
      ? items.filter(i => i.yaProcesado)
      : filtro === 'pendientes'
        ? items.filter(i => !i.yaProcesado)
        : items;
    return base.filter(coincide);
  }, [items, filtro, q]);

  // Bloque a procesar: pendientes visibles, un solo archivo por URL.
  const lote = useMemo(() => {
    const seen = new Set();
    return items.filter(i => {
      if (i.yaProcesado || !i.file_url || seen.has(i.file_url) || !coincide(i)) return false;
      seen.add(i.file_url);
      return true;
    });
  }, [items, q]);

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['registro_gasto_con_archivos'] });
    qc.invalidateQueries({ queryKey: ['materiales_documento_origen'] });
    qc.invalidateQueries({ queryKey: ['material_catalog'] });
    onSaved?.();
  };

  const procesarLote = async () => {
    if (!lote.length) { toast.error('No hay documentos pendientes que procesar'); return; }
    const res = await ejecutar(lote, { onDone: refrescar });
    if (res) {
      toast.success(`${res.ok} documento(s) procesados · ${res.sinLineas} sin líneas · ${res.errores.length} errores`);
    }
  };

  const handleConfirm = () => {
    const sel = items.find(i => i.key === selectedId);
    if (!sel) { toast.error('Selecciona un documento'); return; }
    onSelect?.({ file_url: sel.file_url, registro: sel });
    onClose?.();
  };

  useEffect(() => {
    if (open) { setSearch(''); setSelectedId(null); setFiltro('pendientes'); }
  }, [open]);

  const chip = (activo, onClick, children, color) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors inline-flex items-center gap-1',
        activo ? 'ring-2 ring-primary ring-offset-1' : 'hover:opacity-80',
        color,
      )}
    >
      {children}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose?.(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="w-4 h-4 text-primary" />
            Cargar de notas de gastos existentes
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {chip(filtro === 'todos', () => setFiltro('todos'), <>Total: {stats.total}</>, 'bg-secondary text-secondary-foreground border-border')}
          {chip(filtro === 'pendientes', () => setFiltro('pendientes'), <>Pendientes: {stats.pendientes}</>, 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-200 dark:border-green-900')}
          {chip(filtro === 'procesados', () => setFiltro('procesados'), <>Procesados: {stats.procesados}</>, 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-blue-200 dark:border-blue-900')}
          {chip(filtro === 'duplicados', () => setFiltro('duplicados'), <><Copy className="w-3 h-3" /> Duplicados: {gruposDup.length}</>, 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-200 dark:border-amber-900')}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por comercio, operario, nº factura, obra..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {progreso && (
          <div className="rounded-xl border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Procesando {progreso.hechas} de {progreso.total}…</p>
              <Button size="sm" variant="outline" onClick={detener} className="gap-1.5 h-8">
                <Square className="w-3.5 h-3.5" /> Detener
              </Button>
            </div>
            <Progress value={progreso.total ? Math.round((progreso.hechas / progreso.total) * 100) : 0} />
            <p className="text-[11px] text-muted-foreground truncate">
              {progreso.actual || 'Preparando…'} · {progreso.ok} guardados · {progreso.sinLineas} sin líneas · {progreso.errores.length} errores
            </p>
          </div>
        )}

        {filtro === 'duplicados' ? (
          <DuplicadosNotasGastos grupos={gruposDup} onChanged={refrescar} />
        ) : (
          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No hay documentos de material que coincidan con el filtro.
              </div>
            ) : (
              filtrados.map(it => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setSelectedId(it.key)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-start gap-3 ${
                    selectedId === it.key ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${it.yaProcesado ? 'bg-green-100 dark:bg-green-950' : 'bg-primary/10'}`}>
                    {it.yaProcesado ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" /> : <FileImage className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{it.nombre_comercio || '(sin comercio)'}</span>
                      <Badge className={`${CATEGORIA_COLOR[it.categoria] || CATEGORIA_COLOR.otros} border-0 text-[10px]`}>{it.categoria}</Badge>
                      {it.numero_factura && <span className="text-[11px] font-mono text-muted-foreground">{it.numero_factura}</span>}
                      {it.yaProcesado && <Badge className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-0 text-[10px]">Procesado</Badge>}
                      {it.dupInterno && !it.yaProcesado && (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-0 text-[10px]">
                          <Copy className="w-2.5 h-2.5 mr-0.5" />Duplicado
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {it.fecha_documento || '—'} · {it.operario_name || '—'} · {it.nombre || 'archivo'}
                      {it.obra_name ? ` · ${it.obra_name}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">{it.importe ? `${Number(it.importe).toFixed(2)}€` : ''}</span>
                </button>
              ))
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={!!progreso}>Cancelar</Button>
          <Button variant="outline" onClick={handleConfirm} disabled={!selectedId || !!progreso} className="gap-2">
            <FileImage className="w-4 h-4" /> Cargar y procesar
          </Button>
          <Button onClick={procesarLote} disabled={!lote.length || !!progreso} className="gap-2">
            <Play className="w-4 h-4" /> Procesar bloque ({lote.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}