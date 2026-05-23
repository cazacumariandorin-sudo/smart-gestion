import { useNavigate } from 'react-router-dom';
import { Eye, Shield, LogOut, CheckCircle } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { setSimulatedRole, clearSimulatedRole } from '@/lib/roleSimulator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/layout/PageHeader';

const ROLES = [
  {
    key: 'gerencia',
    label: 'Gerencia',
    desc: 'Acceso amplio a todos los módulos operativos y económicos.',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  {
    key: 'director_comercial',
    label: 'Director Comercial',
    desc: 'Gestión de clientes, obras, informes y económico. Sin datos sensibles.',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  {
    key: 'jefe_obra',
    label: 'Jefe de Obra',
    desc: 'Obras, partes, operarios, flota y documental de su ámbito.',
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    dot: 'bg-teal-500',
  },
  {
    key: 'operario',
    label: 'Operario',
    desc: 'Control horario, partes propios, materiales y gastos propios.',
    color: 'bg-green-100 text-green-700 border-green-200',
    dot: 'bg-green-500',
  },
  {
    key: 'control_horario',
    label: 'Control Horario',
    desc: 'Acceso exclusivo a control horario y partes de trabajo.',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    dot: 'bg-yellow-500',
  },
  {
    key: 'cliente_obra',
    label: 'Cliente Obra',
    desc: 'Solo acceso al dashboard, informe de sus obras y chat.',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
  },
];

export default function SimuladorRoles() {
  const { isAdmin, isGerencia, isSimulating, simulatedRole, role } = useUserRole();
  const navigate = useNavigate();

  // Solo admin y gerencia pueden acceder
  if (!isAdmin && !isGerencia) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Shield className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">Sin acceso</p>
      </div>
    );
  }

  const activar = (roleKey) => {
    setSimulatedRole(roleKey);
    navigate('/', { replace: true });
  };

  const detener = () => {
    clearSimulatedRole();
    navigate('/', { replace: true });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Simulador de Roles"
        subtitle="Previsualiza la app como cualquier rol sin modificar datos reales"
        hideBack={true}
      />

      <div className="p-4 sm:p-6 space-y-6">

        {/* Banner si hay simulación activa */}
        {isSimulating && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">Simulación activa</p>
                <p className="text-xs text-amber-600">
                  Estás viendo la app como: <strong>{ROLES.find(r => r.key === simulatedRole)?.label || simulatedRole}</strong>
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={detener} className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-100">
              <LogOut className="w-3.5 h-3.5" /> Detener
            </Button>
          </div>
        )}

        {/* Aviso */}
        <div className="p-3 bg-muted/60 rounded-lg border text-xs text-muted-foreground flex gap-2">
          <Shield className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
          <span>
            La simulación usa <strong>sessionStorage</strong> — se resetea al cerrar la pestaña. No modifica ningún dato real ni tu cuenta de administrador.
          </span>
        </div>

        {/* Grid de roles */}
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map(r => {
            const isActive = isSimulating && simulatedRole === r.key;
            return (
              <Card
                key={r.key}
                className={`p-4 border-2 transition-all ${isActive ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20' : 'border-border hover:border-primary/40'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${r.dot} shrink-0 mt-0.5`} />
                    <span className="font-semibold text-sm">{r.label}</span>
                  </div>
                  {isActive && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-1">
                      <CheckCircle className="w-3 h-3" /> Activo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{r.desc}</p>
                <Button
                  size="sm"
                  variant={isActive ? 'outline' : 'default'}
                  className="w-full gap-2 text-xs"
                  onClick={() => isActive ? detener() : activar(r.key)}
                >
                  {isActive ? (
                    <><LogOut className="w-3.5 h-3.5" /> Detener simulación</>
                  ) : (
                    <><Eye className="w-3.5 h-3.5" /> Simular este rol</>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}