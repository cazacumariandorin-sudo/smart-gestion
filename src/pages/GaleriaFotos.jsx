import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Image, Search, X, ZoomIn, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CATEGORIAS = ['parte_trabajo', 'obra', 'nota_gastos', 'presupuesto', 'averia'];
const CAT_LABELS = {
  parte_trabajo: 'Parte trabajo',
  obra: 'Obra',
  nota_gastos: 'Nota gastos',
  presupuesto: 'Presupuesto',
  averia: 'Avería',
};
const CAT_COLORS = {
  parte_trabajo: 'bg-blue-100 text-blue-700',
  obra: 'bg-green-100 text-green-700',
  nota_gastos: 'bg-orange-100 text-orange-700',
  presupuesto: 'bg-purple-100 text-purple-700',
  averia: 'bg-red-100 text-red-700',
};

export default function GaleriaFotos() {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterOperario, setFilterOperario] = useState('');
  const [selectedFoto, setSelectedFoto] = useState(null);

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ['fotos-proyecto'],
    queryFn: () => base44.entities.FotoProyecto.list('-fecha_foto', 200),
  });

  const operarios = [...new Set(fotos.map(f => f.operario_name).filter(Boolean))];
  const proyectos = [...new Set(fotos.map(f => f.proyecto_name).filter(Boolean))];

  const filtradas = fotos.filter(f => {
    const matchSearch = !search || 
      f.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      f.proyecto_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.operario_name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || f.categoria === filterCat;
    const matchOp = !filterOperario || f.operario_name === filterOperario;
    return matchSearch && matchCat && matchOp;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Image className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Galería de Fotos</h1>
        <Badge variant="outline" className="text-xs">{filtradas.length} fotos</Badge>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proyecto, operario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                filterCat === cat ? CAT_COLORS[cat] + ' border-transparent' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {CAT_LABELS[cat]}
            </button>
          ))}
        </div>
        {operarios.length > 0 && (
          <select
            value={filterOperario}
            onChange={e => setFilterOperario(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">Todos los operarios</option>
            {operarios.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        )}
        {(filterCat || filterOperario || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterCat(''); setFilterOperario(''); setSearch(''); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando fotos...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No hay fotos que coincidan con los filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtradas.map(foto => (
            <div
              key={foto.id}
              className="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer hover:shadow-lg transition-all"
              onClick={() => setSelectedFoto(foto)}
            >
              <img
                src={foto.foto_url}
                alt={foto.titulo || 'Foto'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                {foto.categoria && (
                  <Badge className={cn('text-[9px] px-1 py-0', CAT_COLORS[foto.categoria])}>{CAT_LABELS[foto.categoria]}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle */}
      {selectedFoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedFoto(null)}>
          <div className="bg-card rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="font-semibold">{selectedFoto.titulo || 'Sin título'}</h3>
                <p className="text-xs text-muted-foreground">{selectedFoto.proyecto_name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedFoto(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <img src={selectedFoto.foto_url} alt={selectedFoto.titulo} className="w-full h-full object-contain max-h-[60vh]" />
            </div>
            <div className="p-4 text-sm space-y-1">
              {selectedFoto.operario_name && <p className="text-muted-foreground">👤 {selectedFoto.operario_name}</p>}
              {selectedFoto.fecha_foto && <p className="text-muted-foreground">📅 {format(new Date(selectedFoto.fecha_foto), 'dd MMMM yyyy', { locale: es })}</p>}
              {selectedFoto.descripcion && <p>{selectedFoto.descripcion}</p>}
              {selectedFoto.categoria && <Badge className={cn('text-xs', CAT_COLORS[selectedFoto.categoria])}>{CAT_LABELS[selectedFoto.categoria]}</Badge>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}