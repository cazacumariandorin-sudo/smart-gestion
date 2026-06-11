import { Shield, Check, X, Eye, LayoutDashboard, ClipboardList, Users, Clock, Calendar, FileText, FileImage, BookOpen, Building2, HardHat, Car, MessageSquare, ImageIcon, Images, ShoppingCart, Package, DollarSign, BarChart2, Settings } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';

const MODULOS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, submodulos: [] },
  { id: 'work-orders', label: 'Partes de Trabajo', icon: ClipboardList, submodulos: ['new'] },
  { id: 'clients', label: 'Clientes', icon: Users, submodulos: [] },
  { id: 'control-horario', label: 'Control Horario', icon: Clock, submodulos: ['fichajes', 'informes', 'apuntes', 'alarmas'] },
  { id: 'calendario-vacaciones', label: 'Calendario Vacaciones', icon: Calendar, submodulos: [] },
  { id: 'apuntes-horario', label: 'Apuntes Horario', icon: FileText, submodulos: [] },
  { id: 'notas-gastos', label: 'Notas de Gastos', icon: DollarSign, submodulos: [] },
  { id: 'orders', label: 'Pedidos', icon: ShoppingCart, submodulos: [] },
  { id: 'materials', label: 'Materiales', icon: Package, submodulos: [] },
  { id: 'drawings', label: 'Planos', icon: FileImage, submodulos: [] },
  { id: 'manuales', label: 'Manuales', icon: BookOpen, submodulos: [] },
  { id: 'obras', label: 'Obras', icon: Building2, submodulos: [] },
  { id: 'obras-civiles', label: 'Obras Civiles', icon: HardHat, submodulos: [] },
  { id: 'flota', label: 'Flota / Vehículos', icon: Car, submodulos: [] },
  { id: 'galeria-fotos', label: 'Galería de Fotos', icon: ImageIcon, submodulos: [] },
  { id: 'photos', label: 'Fotos por Parte', icon: Images, submodulos: [] },
  { id: 'chat', label: 'Chat', icon: MessageSquare, submodulos: [] },
  { id: 'reports', label: 'Informes', icon: BarChart2, submodulos: [] },
];

export default function DiagnosticoTecnico() {
  const { role, isOperario, isSimulating, canAccess } = useUserRole();

  // Lista EXACTA de módulos para técnico según useUserRole.js
  const tecnicoModules = [
    'dashboard', 'work-orders', 'clients', 'control-horario', 'orders', 
    'obras', 'obras-civiles', 'materials', 'drawings', 'manuales', 
    'calendario-vacaciones', 'photos', 'notas-gastos', 'vehiculos', 'chat', 
    'galeria-fotos', 'apuntes-horario', 'reports', 'flota'
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Diagnóstico: Rol Técnico"
        subtitle="Verificación completa de módulos y permisos"
        hideBack={true}
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Banner de estado */}
        <Card className={`p-4 border-2 ${isSimulating && role === 'operario' ? 'border-green-400 bg-green-50' : 'border-amber-400 bg-amber-50'}`}>
          <div className="flex items-center gap-3">
            <Shield className={`w-6 h-6 ${isSimulating && role === 'operario' ? 'text-green-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <p className="text-sm font-bold">
                {isSimulating && role === 'operario' 
                  ? '✅ Simulación de Técnico ACTIVA' 
                  : '⚠️ Activa la simulación de Técnico'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isSimulating && role === 'operario'
                  ? 'Estás viendo la app como TÉCNICO. Verifica que todos los módulos estén accesibles.'
                  : 'Ve al Simulador de Roles y activa "Técnico" para ver esta página con sus permisos.'}
              </p>
            </div>
            {!isSimulating && (
              <Button size="sm" onClick={() => window.location.href = '/simulador-roles'} className="gap-2">
                <Eye className="w-4 h-4" /> Ir al Simulador
              </Button>
            )}
          </div>
        </Card>

        {/* Lista de módulos */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            Módulos Disponibles para Técnico
          </h2>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map(mod => {
              const Icon = mod.icon;
              const hasAccess = tecnicoModules.includes(mod.id);
              const canView = hasAccess;
              
              return (
                <Card key={mod.id} className={`p-3 border ${hasAccess ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${hasAccess ? 'text-green-600' : 'text-red-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${hasAccess ? 'text-green-800' : 'text-red-800'}`}>
                          {mod.label}
                        </p>
                        {mod.submodulos.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mod.submodulos.map(sub => (
                              <Badge key={sub} variant="outline" className="text-[9px] h-4 px-1">
                                {sub}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {hasAccess ? (
                      <Check className="w-4 h-4 text-green-600 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-red-600 shrink-0" />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Verificación de permisos */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Capacidades del Rol Técnico
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Partes de trabajo:</strong> Crear y visualizar partes propios</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Fichajes:</strong> Registrar entrada/salida y pausas</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Vacaciones / Bajas / DAP:</strong> Solicitar ausencias</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Apuntes Horario:</strong> Registrar producción (m², ud, horas) por obra</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Notas de Gastos:</strong> Crear registros de gastos con ticket</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Manuales:</strong> Crear y visualizar manuales de obra</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Planos:</strong> Crear y visualizar planos de obra</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Galería de Fotos:</strong> Subir y visualizar fotos del proyecto</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Flota:</strong> Registrar viajes de vehículos con km y ruta</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Clientes:</strong> Visualizar cartera de clientes</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Obras / Obras Civiles:</strong> Visualizar obras asignadas</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Materiales / Pedidos:</strong> Visualizar pedidos y materiales</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Chat:</strong> Comunicación interna</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span><strong>Informes:</strong> Ver informes de producción</span>
            </div>
          </div>
        </Card>

        {/* Instrucciones */}
        <Card className="p-4 bg-muted/50 border-border">
          <h3 className="text-sm font-semibold mb-2">📋 Pasos para Verificar:</h3>
          <ol className="text-xs space-y-1.5 list-decimal list-inside text-muted-foreground">
            <li>Si no estás en simulación, haz clic en "Ir al Simulador"</li>
            <li>Activa el rol <strong>Técnico</strong></li>
            <li>Navega por cada módulo listado arriba</li>
            <li>Verifica que los botones "Nuevo" / "Crear" estén visibles</li>
            <li>Comprueba que puedes guardar registros en cada módulo</li>
            <li>Al terminar, detén la simulación para volver a tu rol real</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}