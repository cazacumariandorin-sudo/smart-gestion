/**
 * UserRoleDiagnostic — Debug component to verify user role and access permissions
 * Shows why a user might not be seeing modules on the dashboard
 */
import { useState } from 'react';
import { useUserRole } from '@/lib/useUserRole';
import { Eye, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function UserRoleDiagnostic() {
  const [closed, setClosed] = useState(false);
  const { user, role, isAdmin, isJefeObra, isOperario, isControlHorario, isClienteObra, canAccess, isLoading, isSimulating, simulatedRole } = useUserRole();

  const today = new Date().toISOString().split('T')[0];
  const tempFullAccess = user?.acceso_total_hasta && user.acceso_total_hasta >= today;

  const allModules = ['dashboard', 'work-orders', 'clients', 'reports', 'photos', 'users', 'materials', 'drawings', 'orders', 'operarios', 'gastos-operarios', 'control-horario', 'obras', 'calendario-vacaciones', 'manuales', 'informe-obras', 'fabricantes', 'admin-backup', 'datos-sensibles', 'demo-users', 'solar-pedidos', 'inventario'];

  const accessibleModules = allModules.filter(m => canAccess(m));

  if (isLoading || closed) {
    return null;
  }

  const issues = [];

  if (!user) issues.push({ type: 'error', msg: '❌ Usuario no encontrado en la sesión' });
  if (!role) issues.push({ type: 'error', msg: '❌ Rol no definido' });
  if (role && !['admin', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra'].includes(role)) {
    issues.push({ type: 'error', msg: `❌ Rol "${role}" no es válido. Valores esperados: admin, jefe_obra, operario, control_horario, cliente_obra` });
  }
  if (user?.acceso_total_hasta && user.acceso_total_hasta < today) {
    issues.push({ type: 'warning', msg: `⚠️ Acceso temporal expirado: ${user.acceso_total_hasta}` });
  }
  if (accessibleModules.length === 0 && role !== 'admin') {
    issues.push({ type: 'error', msg: '❌ El rol no tiene módulos asignados' });
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50">
      <Card className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 shadow-2xl">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm">Debug: Estado del Usuario</h3>
            <button 
              onClick={() => setClosed(true)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {/* User Info */}
            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
              <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
              <p><strong>Nombre:</strong> {user?.full_name || 'N/A'}</p>
            </div>

            {/* Role Info */}
            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
              <p><strong>Rol Real:</strong> <Badge className="ml-1">{user?.role || 'INDEFINIDO'}</Badge></p>
              <p><strong>Rol Activo:</strong> <Badge className="ml-1" variant="outline">{role || 'INDEFINIDO'}</Badge></p>
              {isSimulating && <p className="text-amber-600 mt-1">🎭 Simulando: {simulatedRole}</p>}
            </div>

            {/* Access Flags */}
            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
              <p className={isAdmin ? 'text-green-600' : 'text-red-600'}>{isAdmin ? '✓' : '✗'} <strong>isAdmin:</strong> {isAdmin.toString()}</p>
              <p className={isJefeObra ? 'text-green-600' : 'text-red-600'}>{isJefeObra ? '✓' : '✗'} <strong>isJefeObra:</strong> {isJefeObra.toString()}</p>
              <p className={isOperario ? 'text-green-600' : 'text-red-600'}>{isOperario ? '✓' : '✗'} <strong>isOperario:</strong> {isOperario.toString()}</p>
              <p className={isControlHorario ? 'text-green-600' : 'text-red-600'}>{isControlHorario ? '✓' : '✗'} <strong>isControlHorario:</strong> {isControlHorario.toString()}</p>
              <p className={isClienteObra ? 'text-green-600' : 'text-red-600'}>{isClienteObra ? '✓' : '✗'} <strong>isClienteObra:</strong> {isClienteObra.toString()}</p>
            </div>

            {/* Temp Access */}
            {user?.acceso_total_hasta && (
              <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                <p><strong>Acceso temporal hasta:</strong> {user.acceso_total_hasta}</p>
                <p className={tempFullAccess ? 'text-green-600' : 'text-red-600'}>
                  {tempFullAccess ? '✓' : '✗'} Acceso: {tempFullAccess ? 'ACTIVO' : 'EXPIRADO'}
                </p>
              </div>
            )}

            {/* Module Access */}
            <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
              <p className="font-bold mb-1">Módulos accesibles: {accessibleModules.length}</p>
              {accessibleModules.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {accessibleModules.slice(0, 5).map(m => (
                    <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                  ))}
                  {accessibleModules.length > 5 && <Badge variant="outline" className="text-[10px]">+{accessibleModules.length - 5} más</Badge>}
                </div>
              ) : (
                <p className="text-red-600 font-bold">⚠️ SIN MÓDULOS ACCESIBLES</p>
              )}
            </div>

            {/* Issues */}
            {issues.length > 0 && (
              <div className="border-l-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-2 rounded">
                <p className="font-bold mb-1 text-red-700">Problemas detectados:</p>
                {issues.map((issue, i) => (
                  <p key={i} className={issue.type === 'error' ? 'text-red-700' : 'text-amber-700'}>{issue.msg}</p>
                ))}
              </div>
            )}

            {issues.length === 0 && (
              <div className="border-l-2 border-green-500 bg-green-50 dark:bg-green-950/30 p-2 rounded">
                <p className="text-green-700 font-bold">✓ Sin problemas detectados</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}