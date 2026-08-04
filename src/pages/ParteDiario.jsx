import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus, ClipboardList, Eye, EyeOff, ArchiveX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ParteDiarioForm from '@/components/partediario/ParteDiarioForm';
import ParteDiarioCard from '@/components/partediario/ParteDiarioCard';
import ParteDiarioDetail from '@/components/partediario/ParteDiarioDetail';
import ClientObraTree from '@/components/documentos/ClientObraTree';
import { useObrasActivasMap, esItemVisible } from '@/hooks/useObrasActivasMap';

export default function ParteDiario() {
  const { user } = useAuth();
  const { isGerencia, isJefeObra, isAdmin } = useUserRole();
  const [showForm, setShowForm] = useState(false);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const [selected, setSelected] = useState(null);

  const verTodos = isGerencia || isJefeObra || isAdmin;
  const podeVerInactivas = isAdmin || isGerencia;

  const obrasMap = useObrasActivasMap();

  const { data: partes = [], isLoading } = useQuery({
    queryKey: ['partes-diarios', verTodos, user?.id, mostrarInactivas],
    queryFn: () => verTodos
      ? base44.entities.ParteDiarioObra.list('-fecha', 300)
      : base44.entities.ParteDiarioObra.filter({ tecnico_id: user.id }, '-fecha', 300),
    enabled: !!user,
  });

  const partesVisibles = useMemo(
    () => partes.filter(p => {
      // Filtro de partes archivados (activo=false)
      if (p.activo === false && !mostrarInactivas) return false;
      // Filtro de obras inactivas
      return esItemVisible(p, obrasMap, mostrarInactivas);
    }),
    [partes, obrasMap, mostrarInactivas]
  );

  const grouped = useMemo(() => {
    const map = {};
    partesVisibles.forEach(p => {
      const obr = p.obra_id ? obrasMap[p.obra_id] : null;
      const cKey = obr?.client_id || '__no_client__';
      const cName = obr?.client_name || 'Sin cliente';
      if (!map[cKey]) map[cKey] = { name: cName, projects: {} };
      const pKey = p.obra_id || p.obra_name || '__no_project__';
      const pName = p.obra_name || 'Sin obra';
      if (!map[cKey].projects[pKey]) map[cKey].projects[pKey] = { name: pName, items: [], activo: p.obra_id ? obrasMap[p.obra_id]?.activo : undefined };
      map[cKey].projects[pKey].items.push(p);
    });
    return map;
  }, [partesVisibles, obrasMap]);

  const archivadosCount = partes.filter(p => p.activo === false).length;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Parte Diario" subtitle="Trabajos, materiales, fotos, firma y cierre de la jornada" />
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex gap-2">
          <Button onClick={() => setShowForm(true)} className="flex-1 gap-2">
            <Plus className="w-4 h-4" /> Nuevo parte de hoy
          </Button>
          {podeVerInactivas && (
            <Button
              type="button"
              variant={mostrarInactivas ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMostrarInactivas(v => !v)}
              className="gap-1.5 shrink-0"
              title="Mostrar/ocultar partes archivados"
            >
              {mostrarInactivas ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{mostrarInactivas ? 'Ver activos' : 'Ver archivados'}</span>
              {archivadosCount > 0 && !mostrarInactivas && (
                <span className="ml-1 text-[10px] bg-amber-500 text-white rounded-full px-1.5">{archivadosCount}</span>
              )}
            </Button>
          )}
        </div>

        {mostrarInactivas && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <ArchiveX className="w-3.5 h-3.5 shrink-0" />
            Estás viendo partes archivados. Reactívalos desde el detalle si lo necesitas.
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando...</div>
        ) : partesVisibles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>
              {mostrarInactivas
                ? 'No hay partes archivados.'
                : 'Aún no hay partes registrados (o están en obras inactivas).'}
            </p>
          </div>
        ) : (
          <ClientObraTree
            grouped={grouped}
            defaultExpanded={false}
            renderItem={(p) => (
              <ParteDiarioCard key={p.id} parte={p} onClick={() => setSelected(p)} />
            )}
          />
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Parte Diario</DialogTitle>
          </DialogHeader>
          <ParteDiarioForm onSuccess={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {selected && <ParteDiarioDetail parte={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}