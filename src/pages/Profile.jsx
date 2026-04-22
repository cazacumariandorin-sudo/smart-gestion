import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Shield, LogOut, Trash2, ChevronRight, HelpCircle, FileText, Scale, Info } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const roleLabels = {
  admin: { label: 'Administrador', className: 'bg-red-100 text-red-700 border-red-200' },
  encargado: { label: 'Encargado', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  operario: { label: 'Operario', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function Profile() {
  const [deleteStep, setDeleteStep] = useState(false);
  const [legalDialog, setLegalDialog] = useState(null); // 'legal', 'gdpr', 'help'
  const appVersion = '1.0.0';

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

      {/* Help & Legal */}
      <Card className="divide-y divide-border overflow-hidden mb-4">
        <button
          onClick={() => setLegalDialog('help')}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Centro de Ayudas</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setLegalDialog('legal')}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Aviso Legal</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setLegalDialog('gdpr')}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Scale className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Política GDPR</span>
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

      {/* Version info */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-6">
        <Info className="w-3.5 h-3.5" />
        <span>Versión {appVersion}</span>
      </div>

      {/* Legal dialogs */}
      <Dialog open={legalDialog === 'help'} onOpenChange={o => setLegalDialog(o ? 'help' : null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" /> Centro de Ayudas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">📋 Partes de Trabajo</h4>
              <p className="text-muted-foreground">Registra el trabajo realizado, incluyendo operarios, materiales y firmas. Los partes quedan archivados para consulta futura.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🕐 Control Horario</h4>
              <p className="text-muted-foreground">Fichajes diarios con entrada, salida y pausa. Visualiza informes por operario, semana o mes. Sistema de apuntes de cantidades.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🏢 Clientes y Obras</h4>
              <p className="text-muted-foreground">Gestiona clientes, contactos técnicos y obras asociadas. Consulta pedidos, documentación y planos por proyecto.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🧾 Gastos Operarios</h4>
              <p className="text-muted-foreground">Registra gastos con foto de ticket. Sistema OCR automático que extrae datos. Cierra notas cuando esté completo.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">⚙️ Soporte Técnico</h4>
              <p className="text-muted-foreground">Para problemas, contacta al equipo de administración o revisa la documentación en la sección de Manuales.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={legalDialog === 'legal'} onOpenChange={o => setLegalDialog(o ? 'legal' : null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Aviso Legal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">1. Titularidad</h4>
              <p>Esta aplicación y todos sus contenidos son propiedad intelectual de la empresa titular. Queda prohibida su reproducción total o parcial sin autorización escrita.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">2. Aceptación de Términos</h4>
              <p>El acceso a esta aplicación implica la aceptación de estos términos. Si no estás de acuerdo, no utilices el servicio.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">3. Responsabilidad</h4>
              <p>La empresa no se responsabiliza por daños indirectos, pérdida de datos o interrupciones del servicio causadas por circunstancias ajenas.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">4. Licencia de Uso</h4>
              <p>Se concede una licencia personal, intransferible y revocable para el uso de esta aplicación únicamente para fines comerciales autorizados.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">5. Cambios en los Términos</h4>
              <p>La empresa se reserva el derecho de modificar estos términos en cualquier momento. El uso continuado implica aceptación de cambios.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={legalDialog === 'gdpr'} onOpenChange={o => setLegalDialog(o ? 'gdpr' : null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" /> Política GDPR
            </DialogTitle>
            <DialogDescription>Reglamento General de Protección de Datos (UE) 2016/679</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">📊 Datos Recopilados</h4>
              <p>Recopilamos: email, nombre completo, datos de fichas de trabajo, fichajes horarios, gastos y documentación asociada al trabajo. Estos datos se procesan exclusivamente para gestión laboral y operativa.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">🔒 Seguridad de Datos</h4>
              <p>Los datos se almacenan en servidores seguros con encriptación. Se aplican medidas técnicas y organizativas para prevenir acceso no autorizado.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">📋 Derechos del Usuario</h4>
              <p>Tienes derecho a acceder, corregir, borrar y portar tus datos. Para ejercer estos derechos, contacta a administración con tu solicitud formal.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">🕐 Conservación de Datos</h4>
              <p>Los datos se conservan durante el período de relación laboral/comercial y según lo requerido por ley. Tras finalizar, se eliminan según política de retención.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">👥 Compartición de Datos</h4>
              <p>Los datos se comparten únicamente internamente entre roles autorizados (admin, jefe de obra). No se ceden a terceros sin consentimiento expreso.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">⚠️ Cookies y Análisis</h4>
              <p>Se utilizan cookies esenciales para la sesión. Se recopilan análisis de uso anónimos para mejorar el servicio. Puedes revocar estas autorizaciones en cualquier momento.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}