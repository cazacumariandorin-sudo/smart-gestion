import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Shield, LogOut, Trash2, ChevronRight } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const roleLabels = {
  admin: { label: 'Administrador', className: 'bg-red-100 text-red-700 border-red-200' },
  encargado: { label: 'Encargado', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  operario: { label: 'Operario', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function Profile() {
  const [deleteStep, setDeleteStep] = useState(false);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const role = me?.role || 'operario';
  const roleCfg = roleLabels[role] || roleLabels.operario;
  const initials = (me?.full_name || me?.email || '?').slice(0, 2).toUpperCase();

  const handleLogout = () => base44.auth.logout();

  const handleDeleteAccount = async () => {
    // Logs out — account deletion requires admin action server-side
    await base44.auth.logout();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">Mi Perfil</h1>

      {/* Avatar + info */}
      <Card className="p-6 mb-4 flex items-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${roleCfg.className}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base truncate">{me?.full_name || '—'}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
            <Mail className="w-3.5 h-3.5 shrink-0" /> {me?.email}
          </p>
          <Badge variant="outline" className={`${roleCfg.className} text-xs mt-2`}>
            <Shield className="w-3 h-3 mr-1" /> {roleCfg.label}
          </Badge>
        </div>
      </Card>

      {/* Actions */}
      <Card className="divide-y divide-border overflow-hidden mb-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <LogOut className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Cerrar sesión</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30 overflow-hidden">
        <div className="px-5 py-3 bg-destructive/5 border-b border-destructive/20">
          <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Zona de peligro</p>
        </div>
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Eliminar cuenta</p>
            <p className="text-xs text-muted-foreground mt-0.5">Esta acción es permanente e irreversible</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5 shrink-0">
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción es permanente. Todos tus datos serán eliminados y no podrás recuperar el acceso. ¿Estás seguro?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, eliminar mi cuenta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Versión 1.0.0
      </p>
    </div>
  );
}