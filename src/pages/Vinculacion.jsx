import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import PanelVinculacion from '@/components/vinculacion/PanelVinculacion';

export default function VinculacionPage() {
  const { isAdmin, isGerencia, isAdministracion } = useUserRole();

  if (!isAdmin && !isGerencia && !isAdministracion) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No tienes permisos para gestionar vinculaciones.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Vinculación Usuario → Operario"
        subtitle="Gestiona la asociación de usuarios con operarios y clientes"
        hideBack={true}
      />
      
      <div className="p-4 sm:p-6">
        <PanelVinculacion />
      </div>
    </div>
  );
}