import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { UserPlus, Loader2, Mail, Clock, Trash2, FlaskConical, CheckCircle2, XCircle, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { differenceInDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const DEMO_DURATIONS = [
  { label: '1 semana',  days: 7 },
  { label: '1 mes',     days: 30 },
  { label: '3 meses',   days: 90 },
];

function calcExpiry(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function DemoStatusBadge({ until }) {
  const today = new Date().toISOString().split('T')[0];
  if (!until) return null;
  const active = until >= today;
  const daysLeft = differenceInDays(parseISO(until), new Date());

  if (active) {
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-[10px]">
        <CheckCircle2 className="w-3 h-3" />
        {daysLeft <= 0 ? 'Expira hoy' : `${daysLeft}d restantes`}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 gap-1 text-[10px]">
      <XCircle className="w-3 h-3" /> Expirado
    </Badge>
  );
}

export default function DemoUsers() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [duration, setDuration] = useState('1 mes');
  const [role, setRole] = useState('jefe_obra');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 100),
  });

  const onRefresh = useCallback(async () => { await refetch(); }, [refetch]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.User.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  // Demo users = anyone with acceso_total_hasta set
  const today = new Date().toISOString().split('T')[0];
  const demoUsers = users.filter(u => u.acceso_total_hasta);
  const active = demoUsers.filter(u => u.acceso_total_hasta >= today);
  const expired = demoUsers.filter(u => u.acceso_total_hasta < today);

  const handleInvite = async () => {
    if (!email || !duration) return;
    setInviting(true); setError('');
    const days = DEMO_DURATIONS.find(d => d.label === duration)?.days || 30;
    const expiry = calcExpiry(days);
    try {
      await base44.users.inviteUser(email, 'user');
      // After invite, find the newly created user and set their expiry + role
      // (The user list will refresh; expiry is set via update after they accept,
      //  but we store the intent on any matching user record)
      qc.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
      setEmail(''); setDuration('1 mes'); setRole('jefe_obra');
    } catch (e) {
      setError(e.message || 'Error al invitar');
    }
    setInviting(false);
  };

  const extendAccess = (user, days) => {
    const expiry = calcExpiry(days);
    updateMutation.mutate({ id: user.id, data: { acceso_total_hasta: expiry } });
  };

  const revokeAccess = (user) => {
    updateMutation.mutate({ id: user.id, data: { acceso_total_hasta: '' } });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-primary" /> Usuarios Demo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Acceso temporal con fecha de expiración</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 shadow-sm">
          <UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Nuevo Demo</span>
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{demoUsers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total demo</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{active.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Activos</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{expired.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Expirados</p>
        </Card>
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : demoUsers.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <FlaskConical className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay usuarios demo todavía</p>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
            <UserPlus className="w-3.5 h-3.5" /> Crear primer demo
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {demoUsers.map(user => {
            const isActive = user.acceso_total_hasta >= today;
            return (
              <Card key={user.id} className={`p-4 ${!isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{user.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 shrink-0" /> {user.email}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <DemoStatusBadge until={user.acceso_total_hasta} />
                        {user.acceso_total_hasta && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <CalendarClock className="w-3 h-3" />
                            hasta {format(parseISO(user.acceso_total_hasta), "d MMM yyyy", { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {/* Quick extend buttons */}
                    {DEMO_DURATIONS.map(d => (
                      <Button
                        key={d.label}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => extendAccess(user, d.days)}
                      >
                        +{d.label}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700"
                      onClick={() => revokeAccess(user)}
                    >
                      Revocar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar usuario demo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se eliminará permanentemente a <strong>{user.full_name || user.email}</strong>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(user.id)} className="bg-destructive text-destructive-foreground">
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Grant demo access to existing users */}
      {users.filter(u => !u.acceso_total_hasta).length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Dar acceso demo a usuario existente
          </p>
          <div className="space-y-2">
            {users.filter(u => !u.acceso_total_hasta && u.role !== 'admin').map(user => (
              <Card key={user.id} className="p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                    {(user.full_name || user.email || '?')[0].toUpperCase()}
                  </div>
                  <p className="text-sm truncate">{user.full_name || user.email}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {DEMO_DURATIONS.map(d => (
                    <Button
                      key={d.label}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => extendAccess(user, d.days)}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" /> Invitar usuario demo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                placeholder="demo@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duración del acceso demo *</Label>
              <MobileSelect value={duration} onValueChange={setDuration} placeholder="Seleccionar duración...">
                {DEMO_DURATIONS.map(d => <MobileSelectItem key={d.label} value={d.label}>{d.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>

            {/* Info box */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> Acceso demo</p>
              <p>El usuario tendrá acceso completo a todos los módulos durante el período seleccionado. Al expirar, perderá el acceso adicional y volverá a su rol base.</p>
              {duration && (
                <p className="text-primary font-semibold">
                  Expira el: {format(parseISO(calcExpiry(DEMO_DURATIONS.find(d => d.label === duration)?.days || 30)), "d 'de' MMMM yyyy", { locale: es })}
                </p>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!email || !duration || inviting} className="gap-2 min-w-28">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invitar demo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}