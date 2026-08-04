import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus, ClipboardList, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ParteDiarioForm from '@/components/partediario/ParteDiarioForm';
import ParteDiarioCard from '@/components/partediario/ParteDiarioCard';
import ClientObraTree from '@/components/documentos/ClientObraTree';
import { useObrasActivasMap, esItemVisible } from '@/hooks/useObrasActivasMap';

export default function ParteDiario() {
  const { user } = useAuth();
  const { isGerencia, isJefeObra, isAdmin } = useUserRole();
  const [showForm, setShowForm] = useState(false);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);

  const verTodos = isGerencia || isJefeObra;
  const podeVerInactivas = isAdmin || isGerencia;

  const obrasMap = useObrasActivasMap();

  const { data: partes = [], isLoading } = useQuery({
    queryKey: ['partes-diarios', verTodos, user?.id],
    queryFn: () => verTodos
      ? base44.entities.ParteDiarioObra.list('-fecha', 200)
      : base44.entities.ParteDiarioObra.filter({ tecnico_id: user.id }, '-fecha', 200),
    enabled: !!user,
  });

  const partesVisibles = useMemo(
    () => partes.filter(p => esItemVisible(p, obrasMap, mostrarInactivas)),
    [partes, obrasMap, mostrarInactivas]
  );

  // Cross-reference para agrupar por cliente → obra (ParteDiarioObra no tiene client_id/client_name).
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

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Parte Diario" subtitle="Trabajos, materiales y fotos de la jornada" />
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
              title="Mostrar/ocultar partes de obras inactivas"
            >
              {mostrarInactivas ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{mostrarInactivas ? 'Inactivas visibles' : 'Inactivas ocultas'}</span>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando...</div>
        ) : partesVisibles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Aún no hay partes registrados{mostrarInactivas ? '' : ' (o están en obras inactivas)'}</p>
          </div>
        ) : (
          <ClientObraTree
            grouped={grouped}
            defaultExpanded={false}
            renderItem={(p) => <ParteDiarioCard key={p.id} parte={p} />}
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
    </div>
  );
}