import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, UserPlus, CheckCircle2, BadgeCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIAS = [
  { value: 'oficial_primera', label: 'Oficial Primera' },
  { value: 'oficial_segunda', label: 'Oficial Segunda' },
  { value: 'peon', label: 'Peón' },
  { value: 'encargado', label: 'Encargado' },
  { value: 'tecnico_solar', label: 'Técnico Solar' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'subcontrata', label: 'Subcontrata' },
  { value: 'temporal', label: 'Temporal' },
];

const empty = {
  name: '', dni: '', email: '', phone: '', role: '', categoria: '', especialidad: '',
  coste_hora: '', salario_bruto_mensual: '', num_afiliacion_ss: '', cuenta_bancaria_iban: '',
  fecha_alta_empresa: '', invitar_usuario: false,
};

export default function AltaUnificadaDialog({ open, onOpenChange }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [showSensibles, setShowSensibles] = useState(false);
  const [resultado, setResultado] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => base44.functions.invoke('altaUnificadaTecnico', form),
    onSuccess: (res) => {
      setResultado(res.data);
      qc.invalidateQueries({ queryKey: ['tecnicos'] });
    },
  });

  const handleClose = () => {
    setForm(empty);
    setResultado(null);
    setShowSensibles(false);
    onOpenChange(false);
  };

  // Pantalla de éxito
  if (resultado?.success) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-6 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold">Técnico registrado</h3>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Número de empleado asignado</p>
              <p className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-400 tracking-widest">
                {resultado.num_empleado}
              </p>
            </div>
            {resultado.datos_sensibles_id && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                <BadgeCheck className="w-3.5 h-3.5 mr-1" /> Datos sensibles vinculados
              </Badge>
            )}
            {resultado.invitacion_enviada && (
              <p className="text-xs text-muted-foreground">✉️ Email de bienvenida enviado</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleClose} className="w-full">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" /> Alta Unificada de Técnico
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Se generará automáticamente el número de empleado (SMT-AAAA-NNNNN)</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* — DATOS BÁSICOS — */}
          <div className="space-y-1 pb-1 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datos del técnico</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nombre completo *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nombre y apellidos" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">DNI / NIE</Label>
              <Input value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="12345678A" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="600 000 000" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="tecnico@empresa.com" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría profesional</Label>
              <MobileSelect value={form.categoria} onValueChange={v => set('categoria', v)} placeholder="Seleccionar...">
                {CATEGORIAS.map(c => <MobileSelectItem key={c.value} value={c.value}>{c.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Especialidad</Label>
              <Input value={form.especialidad} onChange={e => set('especialidad', e.target.value)} placeholder="Fotovoltaica..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cargo / Puesto</Label>
            <Input value={form.role} onChange={e => set('role', e.target.value)} placeholder="Oficial electricista..." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fecha de alta</Label>
            <Input type="date" value={form.fecha_alta_empresa} onChange={e => set('fecha_alta_empresa', e.target.value)} />
          </div>

          {/* — DATOS SENSIBLES (colapsable) — */}
          <button
            type="button"
            onClick={() => setShowSensibles(s => !s)}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold"
          >
            <span>🔒 Datos sensibles (coste, nómina, SS, banco)</span>
            {showSensibles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSensibles && (
            <div className="space-y-3 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Coste/hora (€)</Label>
                  <Input type="number" value={form.coste_hora} onChange={e => set('coste_hora', parseFloat(e.target.value) || '')} placeholder="0.00" min="0" step="0.5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Salario bruto mensual (€)</Label>
                  <Input type="number" value={form.salario_bruto_mensual} onChange={e => set('salario_bruto_mensual', parseFloat(e.target.value) || '')} placeholder="0.00" min="0" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Núm. afiliación SS</Label>
                <Input value={form.num_afiliacion_ss} onChange={e => set('num_afiliacion_ss', e.target.value)} placeholder="28/123456789/00" className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">IBAN bancario</Label>
                <Input value={form.cuenta_bancaria_iban} onChange={e => set('cuenta_bancaria_iban', e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" className="font-mono" />
              </div>
            </div>
          )}

          {/* — INVITAR USUARIO — */}
          {form.email && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Enviar email de bienvenida</p>
                <p className="text-xs text-muted-foreground">Notifica al técnico con su número de empleado</p>
              </div>
              <Switch
                checked={form.invitar_usuario}
                onCheckedChange={v => set('invitar_usuario', v)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.name || mutation.isPending}
            className="gap-2 min-w-36"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Crear técnico
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}