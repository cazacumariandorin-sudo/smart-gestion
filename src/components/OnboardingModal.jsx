import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { HardHat } from 'lucide-react';

function buildInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '').join('');
}

export default function OnboardingModal({ user }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initials = nombre.length >= 2
    ? buildInitials(nombre)
    : (user?.email?.[0] || '?').toUpperCase();

  const handleGuardar = async () => {
    if (nombre.trim().length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      return;
    }
    setSaving(true);
    await base44.auth.updateMe({
      full_name: nombre.trim(),
      avatar_initials: buildInitials(nombre),
      onboarding_completado: true,
    });
    await qc.invalidateQueries({ queryKey: ['auth'] });
    // Recargar para que AuthContext lea el usuario actualizado
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-2xl font-bold text-primary mb-3">
            {initials}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <HardHat className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-foreground">Bienvenido a SMART-GESTION</h2>
          </div>
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Para continuar, necesitamos tu nombre completo.<br />
            Tu administrador completará tu ficha laboral con el resto de datos.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nombre completo *</Label>
            <Input
              placeholder="Ej: Juan García López"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setError(''); }}
              className={error ? 'border-destructive' : ''}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <span>Iniciales del avatar:</span>
            <span className="font-bold text-primary">{initials || '—'}</span>
          </div>

          <Button
            className="w-full mt-1"
            onClick={handleGuardar}
            disabled={saving || nombre.trim().length < 3}
          >
            {saving ? 'Guardando...' : 'Guardar y continuar →'}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Accediendo como: {user?.email}
          </p>
        </div>
      </div>
    </div>
  );
}