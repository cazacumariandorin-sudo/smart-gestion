import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Camera, Search, X } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Badge } from '@/components/ui/badge';

export default function PhotoGallery() {
  const [clientFilter, setClientFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['all_photos'],
    queryFn: () => base44.entities.WorkPhoto.list('-date', 500),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
  });

  // Unique projects from photos
  const projects = useMemo(() => {
    return [...new Set(photos.map(p => p.project).filter(Boolean))].sort();
  }, [photos]);

  // Unique months
  const months = useMemo(() => {
    const set = new Set();
    photos.forEach(p => {
      if (p.date) set.add(p.date.slice(0, 7));
    });
    return [...set].sort().reverse();
  }, [photos]);

  const filtered = useMemo(() => photos.filter(photo => {
    const matchClient = clientFilter === 'all' || photo.client_id === clientFilter;
    const matchProject = projectFilter === 'all' || photo.project === projectFilter;
    const matchMonth = monthFilter === 'all' || (photo.date && photo.date.startsWith(monthFilter));
    const matchSearch = !search || photo.project?.toLowerCase().includes(search.toLowerCase()) ||
      photo.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      photo.caption?.toLowerCase().includes(search.toLowerCase());
    return matchClient && matchProject && matchMonth && matchSearch;
  }), [photos, clientFilter, projectFilter, monthFilter, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      const key = p.date || 'sin_fecha';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const activeFilters = [clientFilter, projectFilter, monthFilter].filter(f => f !== 'all').length;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Galería de Fotos" subtitle={`${filtered.length} fotos`} hideBack={true} />
      <div className="p-4 sm:p-6 lg:p-8">

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={clientFilter} onValueChange={setClientFilter} placeholder="Cliente" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">Todos los clientes</MobileSelectItem>
          {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={projectFilter} onValueChange={setProjectFilter} placeholder="Obra" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">Todas las obras</MobileSelectItem>
          {projects.map(p => <MobileSelectItem key={p} value={p}>{p}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={monthFilter} onValueChange={setMonthFilter} placeholder="Mes" triggerClassName="w-full sm:w-40">
          <MobileSelectItem value="all">Todos los meses</MobileSelectItem>
          {months.map(m => (
            <MobileSelectItem key={m} value={m}>
              {format(parseISO(m + '-01'), 'MMMM yyyy', { locale: es })}
            </MobileSelectItem>
          ))}
        </MobileSelect>
        {activeFilters > 0 && (
          <Button variant="outline" size="sm" className="h-10 gap-1.5"
            onClick={() => { setClientFilter('all'); setProjectFilter('all'); setMonthFilter('all'); setSearch(''); }}>
            <X className="w-3.5 h-3.5" /> Limpiar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-xl">
          <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay fotos. Sube fotos desde los partes de trabajo.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([dateKey, dayPhotos]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-semibold text-sm">
                  {dateKey !== 'sin_fecha'
                    ? format(parseISO(dateKey), "EEEE, d 'de' MMMM yyyy", { locale: es })
                    : 'Sin fecha'}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{dayPhotos.length} fotos</span>
              </div>

              {/* Group by project within day */}
              {Object.entries(
                dayPhotos.reduce((acc, p) => {
                  const key = p.project || 'Sin obra';
                  if (!acc[key]) acc[key] = { photos: [], clientName: p.client_name };
                  acc[key].photos.push(p);
                  return acc;
                }, {})
              ).map(([proj, { photos: projPhotos, clientName }]) => (
                <div key={proj} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">{proj}</Badge>
                    {clientName && <span className="text-xs text-muted-foreground">{clientName}</span>}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {projPhotos.map(photo => (
                      <div
                        key={photo.id}
                        className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setLightbox(photo)}
                      >
                        <img src={photo.photo_url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      </div>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white z-10" onClick={() => setLightbox(null)}>
            <X className="w-7 h-7" />
          </button>
          <img
            src={lightbox.photo_url}
            alt={lightbox.caption}
            className="max-w-full max-h-[80vh] rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
          <div className="mt-4 text-center text-white" onClick={e => e.stopPropagation()}>
            <p className="font-semibold">{lightbox.project || 'Sin obra'}</p>
            <p className="text-sm text-white/70">{lightbox.client_name}</p>
            {lightbox.date && (
              <p className="text-sm text-white/60 mt-1">
                {format(parseISO(lightbox.date), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            )}
            {lightbox.caption && <p className="text-sm mt-1 italic text-white/80">{lightbox.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}