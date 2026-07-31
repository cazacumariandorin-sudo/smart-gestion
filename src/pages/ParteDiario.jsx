import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Plus, ClipboardList } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ParteDiarioForm from '@/components/partediario/ParteDiarioForm';
import ParteDiarioCard from '@/components/partediario/ParteDiarioCard';

export default function ParteDiario() {
  const { user } = useAuth();
  const { isGerencia, isJefeObra } = useUserRole();
  const [showForm, setShowForm] = useState(false);

  const verTodos = isGerencia || isJefeObra;

  const { data: partes = [], isLoading } = useQuery({
    queryKey: ['partes-diarios', verTodos, user?.id],
    queryFn: () => verTodos
      ? base44.entities.ParteDiarioObra.list('-fecha', 100)
      : base44.entities.ParteDiarioObra.filter({ tecnico_id: user.id }, '-fecha', 100),
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Parte Diario" subtitle="Trabajos, materiales y fotos de la jornada" />
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <Button onClick={() => setShowForm(true)} className="w-full gap-2">
          <Plus className="w-4 h-4" /> Nuevo parte de hoy
        </Button>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Cargando...</div>
        ) : partes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Aún no hay partes registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {partes.map(p => <ParteDiarioCard key={p.id} parte={p} />)}
          </div>
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