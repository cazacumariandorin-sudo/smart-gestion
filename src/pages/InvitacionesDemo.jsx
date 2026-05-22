import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { toast } from 'sonner';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Copy, Trash2, UserX, RefreshCw, FlaskConical, Users, Database } from 'lucide-react';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default function InvitacionesDemo() {
  const qc = useQueryClient();
  const { isAdmin, user } = useUserRole();
  const [openDialog, setOpenDialog] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [duracion, setDuracion] = useState('30');

  const { data: invitaciones = [], isLoading } = useQuery({
    queryKey: ['invitaciones-demo'],
    queryFn: () => base44.entities.InvitacionDemo.list('-created_date', 100),
    enabled: isAdmin,
  });

  const { data: demoRegistros = [] } = useQuery({
    queryKey: ['demo-registros'],
    queryFn: () => base44.entities.DemoRegistro.list('-created_date', 500),
    enabled: isAdmin,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-demo'],
    queryFn: () => base44.entities.User.list('full_name', 200),
    enabled: isAdmin,
  });

  const demoUsers = allUsers.filter(u => u.role === 'usuario_demo');

  const createMutation = useMutation({
    mutationFn: async () => {
      // Validar email único si se especificó
      if (emailDestino) {
        const existing = allUsers.find(u => u.email === emailDestino);
        if (existing) throw new Error('Este email ya tiene una cuenta activa en la plataforma.');
      }
      const now = new Date();
      const dias = parseInt(duracion);
      const expira = new Date(now.getTime() + dias * 24 * 60 * 60 * 1000);
      const codigo = generateUUID();
      return base44.entities.InvitacionDemo.create({
        codigo,
        generada_por_email: user?.email,
        generada_por_nombre: user?.full_name || user?.email,
        email_destino: emailDestino || '',
        duracion_dias: dias,
        fecha_generacion: now.toISOString(),
        fecha_expiracion: expira.toISOString(),
        usada: false,
        activa: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitaciones-demo'] });
      setOpenDialog(false);
      setEmailDestino('');
      setDuracion('30');
      toast.success('Invitación demo generada correctamente');
    },
    onError: (err) => toast.error(err.message || 'Error al generar la invitación'),
  });

  const revokeMutation = useMutation({
    mutationFn: (inv) => base44.entities.InvitacionDemo.update(inv.id, { activa: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitaciones-demo'] });
      toast.success('Acceso revocado');
    },
  });

  const cleanDataMutation = useMutation({
    mutationFn: async (demoEmail) => {
      const regs = demoRegistros.filter(r => r.demo_user_email === demoEmail);
      await Promise.all(regs.map(r => base44.entities.DemoRegistro.delete(r.id)));
      return regs.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['demo-registros'] });
      toast.success(`${count} registros demo eliminados`);
    },
  });

  const copyLink = (codigo) => {
    const url = `${window.location.origin}/demo-join?codigo=${codigo}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado al portapapeles');
  };

  const activeInvs = invitaciones.filter(i => i.activa && !isPast(new Date(i.fecha_expiracion)));
  const expiredInvs = invitaciones.filter(i => !i.activa || isPast(new Date(i.fecha_expiracion)));

  const totalDemoRegistros = demoRegistros.length;

  if (!isAdmin) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      No tienes permisos para ver esta página.
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Invitaciones Demo"
        subtitle="Gestión de accesos demo a la plataforma"
        hideBack={true}
        actions={
          <Button onClick={() => setOpenDialog(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva invitación</span>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Demos activos</p>
              <p className="text-xl font-bold">{demoUsers.length}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Links activos</p>
              <p className="text-xl font-bold">{activeInvs.length}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Registros demo</p>
              <p className="text-xl font-bold">{totalDemoRegistros}</p>
            </div>
          </div>
        </div>

        {/* Usuarios demo activos */}
        {demoUsers.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Usuarios demo activos</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground">
                    <th className="text-left py-2.5 px-3 font-medium">Usuario</th>
                    <th className="text-left py-2.5 px-3 font-medium">Expira</th>
                    <th className="text-left py-2.5 px-3 font-medium">Invitado por</th>
                    <th className="text-left py-2.5 px-3 font-medium">Registros</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {demoUsers.map(u => {
                    const regsCount = demoRegistros.filter(r => r.demo_user_email === u.email).length;
                    const expira = u.demo_expires_at ? new Date(u.demo_expires_at) : null;
                    const expired = expira ? isPast(expira) : false;
                    return (
                      <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{u.full_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          {expira ? (
                            <Badge variant={expired ? 'destructive' : 'outline'} className="text-xs">
                              {expired ? 'Expirado' : format(expira, 'd MMM yyyy', { locale: es })}
                            </Badge>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">{u.invitado_por || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs font-medium">{regsCount}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex gap-1.5">
                            {(expired || regsCount > 0) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => cleanDataMutation.mutate(u.email)}
                                title="Limpiar datos demo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Links de invitación */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Links de invitación</h2>
          {isLoading ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : invitaciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
              No hay invitaciones generadas aún.
            </div>
          ) : (
            <div className="space-y-2">
              {invitaciones.map(inv => {
                const expired = isPast(new Date(inv.fecha_expiracion));
                const isActive = inv.activa && !expired;
                return (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
                          {inv.usada ? 'Usada' : isActive ? 'Activa' : 'Expirada/Revocada'}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono truncate">{inv.codigo?.slice(0, 18)}…</span>
                        {inv.email_destino && (
                          <span className="text-xs text-muted-foreground">→ {inv.email_destino}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {inv.duracion_dias}d · Generada {inv.fecha_generacion ? format(new Date(inv.fecha_generacion), 'd MMM yyyy', { locale: es }) : '—'} · Expira {inv.fecha_expiracion ? format(new Date(inv.fecha_expiracion), 'd MMM yyyy', { locale: es }) : '—'}
                        {inv.usada && inv.demo_user_email && <span className="ml-1">· Usado por {inv.demo_user_email}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {isActive && !inv.usada && (
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => copyLink(inv.codigo)} title="Copiar link">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {isActive && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => revokeMutation.mutate(inv)} title="Revocar">
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog nueva invitación */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generar invitación demo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email destino (opcional)</Label>
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={emailDestino}
                onChange={e => setEmailDestino(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Si lo dejas vacío, el link puede usarlo cualquier persona.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duración del acceso</Label>
              <MobileSelect value={duracion} onValueChange={setDuracion} placeholder="Duración">
                <MobileSelectItem value="7">7 días</MobileSelectItem>
                <MobileSelectItem value="15">15 días</MobileSelectItem>
                <MobileSelectItem value="30">30 días</MobileSelectItem>
                <MobileSelectItem value="60">60 días</MobileSelectItem>
              </MobileSelect>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}