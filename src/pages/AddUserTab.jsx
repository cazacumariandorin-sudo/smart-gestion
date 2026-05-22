import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Copy, Link } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const ROLES_REALES = ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra'];

export default function AddUserTab({ users, usersLoaded, isOwner, onInvited }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operario');
  const [inviteCargo, setInviteCargo] = useState('');
  const [inviteAccessDate, setInviteAccessDate] = useState('');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const [demoEmail, setDemoEmail] = useState('');
  const [demoDuration, setDemoDuration] = useState(7);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [isDemoDialogOpen, setIsDemoDialogOpen] = useState(false);

  const qc = useQueryClient();

  // Invitar usuario real
  const inviteRealMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/functions/inviteUserFunction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          role: data.role,
          cargo: data.cargo,
          acceso_hasta: data.acceso_hasta,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al invitar');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Invitación enviada correctamente');
      setIsInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('operario');
      setInviteCargo('');
      setInviteAccessDate('');
      onInvited();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Generar link demo
  const generateDemoLinkMutation = useMutation({
    mutationFn: async (data) => {
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + data.duracion_dias);

      const codigo = crypto.randomUUID();
      const invitacion = {
        codigo,
        generada_por_email: base44.auth.me().email,
        generada_por_nombre: base44.auth.me().full_name,
        email_destino: data.email_destino || null,
        duracion_dias: data.duracion_dias,
        fecha_generacion: now.toISOString(),
        fecha_expiracion: expiryDate.toISOString(),
        usada: false,
        activa: true,
      };

      await base44.entities.InvitacionDemo.create(invitacion);
      return {
        codigo,
        link: `${window.location.origin}/demo-join?codigo=${codigo}`,
      };
    },
    onSuccess: (result) => {
      setGeneratedLink(result);
      toast.success('Link de invitación demo generado');
      setDemoEmail('');
      setDemoDuration(7);
    },
    onError: (err) => {
      toast.error('Error al generar link: ' + err.message);
    },
  });

  const handleInviteReal = () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast.error('Email inválido');
      return;
    }

    if (usersLoaded && users.find(u => u.email?.toLowerCase() === inviteEmail.toLowerCase())) {
      toast.error('Este email ya tiene una cuenta activa en la plataforma');
      return;
    }

    inviteRealMutation.mutate({
      email: inviteEmail,
      role: inviteRole,
      cargo: inviteCargo,
      acceso_hasta: inviteAccessDate || null,
    });
  };

  const handleGenerateDemoLink = () => {
    if (demoEmail && !demoEmail.includes('@')) {
      toast.error('Email inválido');
      return;
    }

    if (usersLoaded && demoEmail && users.find(u => u.email?.toLowerCase() === demoEmail.toLowerCase())) {
      toast.error('Este email ya tiene una cuenta activa');
      return;
    }

    generateDemoLinkMutation.mutate({
      email_destino: demoEmail || null,
      duracion_dias: demoDuration,
    });
  };

  return (
    <div className="space-y-6">
      {/* Tarjeta Usuario Real */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Invitar Usuario Real</h3>
              <p className="text-sm text-muted-foreground">Crea una cuenta permanente con rol y cargo</p>
            </div>
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Invitar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invitar Usuario Real</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Rol</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES_REALES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cargo</Label>
                    <Input
                      placeholder="Ej: Jefe de equipo"
                      value={inviteCargo}
                      onChange={(e) => setInviteCargo(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Acceso hasta (opcional)</Label>
                    <Input
                      type="date"
                      value={inviteAccessDate}
                      onChange={(e) => setInviteAccessDate(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleInviteReal}
                    disabled={inviteRealMutation.isPending}
                  >
                    {inviteRealMutation.isPending ? 'Enviando...' : 'Enviar invitación'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta Usuario Demo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Generar Link Demo</h3>
              <p className="text-sm text-muted-foreground">Crea un link de invitación temporal</p>
            </div>
            <Dialog open={isDemoDialogOpen} onOpenChange={setIsDemoDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Link className="w-4 h-4 mr-2" />
                  Generar link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generar Link de Invitación Demo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Email destino (opcional)</Label>
                    <Input
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={demoEmail}
                      onChange={(e) => setDemoEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Duración</Label>
                    <Select value={demoDuration.toString()} onValueChange={(v) => setDemoDuration(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar duración" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 días</SelectItem>
                        <SelectItem value="15">15 días</SelectItem>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="60">60 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {generatedLink && (
                    <div className="p-4 bg-muted rounded-lg">
                      <Label className="text-xs">Link generado:</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Input value={generatedLink.link} readOnly className="text-xs" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedLink.link);
                            toast.success('Link copiado');
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleGenerateDemoLink}
                    disabled={generateDemoLinkMutation.isPending}
                  >
                    {generateDemoLinkMutation.isPending ? 'Generando...' : 'Generar link'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}