import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import { toast } from 'sonner';
import { Loader2, Wallet, Utensils } from 'lucide-react';
import { calcularCicloMes } from '@/lib/adelantosConciliacion';

const METODOS_PAGO = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta_empresa', label: 'Tarjeta empresa' },
  { value: 'sepa', label: 'SEPA' },
];

export default function AdelantoFormDialog({ open, onClose, onCreated, operarioPreseleccionado, operarios }) {
  const { user } = useAuth();
  const { isAdmin, isGerencia, isDirComercial } = useUserRole();
  const puedeDieta = isAdmin || isGerencia;

  const [operarioId, setOperarioId] = useState('');
  const [tipo, setTipo] = useState('gastos');
  const [importe, setImporte] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState(new Date().toISOString().slice(0, 10));
  const [concepto, setConcepto] = useState('');
  const [obraId, setObraId] = useState('');
  const [estado, setEstado] = useState('pendiente_entrega');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: operariosRaw = [] } = useQuery({
    queryKey: ['adelanto_operarios'],
    queryFn: () => base44.entities.Operario.list('name', 300),
    enabled: !!open,
  });
  const listaOperarios = operarios || operariosRaw;

  const { data: obrasRaw = [] } = useQuery({
    queryKey: ['adelanto_obras'],
    queryFn: () => base44.entities.Obra.list('name', 300),
    enabled: !!open,
  });
  const { data: solarObrasRaw = [] } = useQuery({
    queryKey: ['adelanto_solar_obras'],
    queryFn: () => base44.entities.SolarObra.list('name', 300),
    enabled: !!open,
  });
  const todasObras = useMemo(
    () => [
      ...obrasRaw.map(o => ({ id: o.id, name: o.name, tipo: 'obra_civil' })),
      ...solarObrasRaw.map(o => ({ id: o.id, name: o.name, tipo: 'solar' })),
    ],
    [obrasRaw, solarObrasRaw]
  );

  useEffect(() => {
    if (open && operarioPreseleccionado?.id) setOperarioId(operarioPreseleccionado.id);
  }, [open, operarioPreseleccionado]);

  useEffect(() => {
    if (!open) return;
    // Reset al cerrar/reabrir
    if (operarioPreseleccionado?.id) {
      setOperarioId(operarioPreseleccionado.id);
    }
  }, [open]);

  const operarioSel = listaOperarios.find(o => o.id === operarioId);

  const puedeCrearGastos = isAdmin || isGerencia || isDirComercial;
  const puedeCrear = tipo === 'dieta' ? puedeDieta : puedeCrearGastos;
  const puedeEntregar = isAdmin || isGerencia;

  const handleSubmit = async () => {
    if (!operarioId) { toast.error('Selecciona un operario'); return; }
    const imp = parseFloat(importe);
    if (!imp || isNaN(imp) || imp <= 0) { toast.error('Introduce un importe válido'); return; }
    if (!concepto.trim()) { toast.error('Indica el concepto del adelanto'); return; }
    if (!fechaEntrega) { toast.error('Indica la fecha de entrega'); return; }
    if (!puedeCrear) { toast.error('No tienes permiso para crear este adelanto'); return; }

    setSaving(true);
    try {
      const obraSel = todasObras.find(o => o.id === obraId);
      const ciclo_mes = calcularCicloMes(fechaEntrega);
      const ahora = new Date().toISOString();

      // Buscar nota_mensual_id del ciclo si existe
      let nota_mensual_id = undefined;
      if (ciclo_mes && operarioId) {
        try {
          const existentes = await base44.entities.NotaMensualGasto.filter({ ciclo_mes, operario_id: operarioId });
          if (existentes?.length > 0) nota_mensual_id = existentes[0].id;
        } catch {}
      }

      const esEntregado = estado === 'entregado';
      const payload = {
        operario_id: operarioId,
        operario_name: operarioSel?.name || '',
        operario_email: operarioSel?.user_email || operarioSel?.email || '',
        tipo,
        importe: Number(imp.toFixed(2)),
        fecha_entrega: fechaEntrega,
        concepto: concepto.trim(),
        obra_id: obraId || undefined,
        obra_name: obraSel?.name,
        obra_tipo: obraSel?.tipo,
        autorizado_por: user?.email,
        fecha_autorizacion: ahora,
        estado: esEntregado ? 'entregado' : 'pendiente_entrega',
        ciclo_mes,
        nota_mensual_id,
        notas: notas.trim() || undefined,
      };
      if (esEntregado) {
        payload.entregado_por = user?.email;
        payload.fecha_entrega_real = ahora;
        payload.metodo_pago = metodoPago;
      }

      await base44.entities.Adelanto.create(payload);
      toast.success(esEntregado ? 'Adelanto entregado registrado' : 'Adelanto creado (pendiente de entrega)');
      onCreated?.();
      // Reset
      setImporte(''); setConcepto(''); setObraId(''); setNotas(''); setEstado('pendiente_entrega');
      if (!operarioPreseleccionado) setOperarioId('');
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'No se pudo crear el adelanto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Nuevo adelanto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Tipo */}
          <div className="space-y-1">
            <Label className="text-xs">Tipo de adelanto *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo('gastos')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  tipo === 'gastos' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
                }`}
              >
                <Wallet className="w-4 h-4" /> Gastos
              </button>
              <button
                type="button"
                disabled={!puedeDieta}
                onClick={() => setTipo('dieta')}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  tipo === 'dieta' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
                }`}
              >
                <Utensils className="w-4 h-4" /> Dieta {puedeDieta ? '' : '(gerencia)'}
              </button>
            </div>
          </div>

          {/* Operario */}
          <div className="space-y-1">
            <Label className="text-xs">Operario destinatario *</Label>
            <MobileSelect
              value={operarioId}
              onValueChange={setOperarioId}
              placeholder="Selecciona operario"
              disabled={!!operarioPreseleccionado}
              triggerClassName="w-full"
            >
              {listaOperarios
                .slice()
                .sort((a, b) => (a.active === false ? 1 : 0) - (b.active === false ? 1 : 0)
                  || (a.name || '').localeCompare(b.name || '', 'es'))
                .map(o => (
                  <MobileSelectItem key={o.id} value={o.id}>
                    {o.name}{o.active === false ? ' (inactivo)' : ''}
                  </MobileSelectItem>
                ))}
            </MobileSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Importe (€) *</Label>
              <Input type="number" step="0.01" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha entrega *</Label>
              <Input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Concepto / motivo *</Label>
            <Input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: anticipo de gasolina para la semana" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Obra asociada (opcional)</Label>
            <MobileSelect value={obraId} onValueChange={setObraId} placeholder="Sin obra" triggerClassName="w-full">
              {todasObras.map(o => (
                <MobileSelectItem key={o.id} value={o.id}>{o.name} {o.tipo === 'solar' ? '☀️' : ''}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          {/* Estado / entrega */}
          {puedeEntregar && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Estado inicial</Label>
                <MobileSelect value={estado} onValueChange={setEstado} triggerClassName="w-full">
                  <MobileSelectItem value="pendiente_entrega">Pendiente de entrega</MobileSelectItem>
                  <MobileSelectItem value="entregado">Entregado ahora</MobileSelectItem>
                </MobileSelect>
              </div>
              {estado === 'entregado' && (
                <div className="space-y-1">
                  <Label className="text-xs">Método de pago</Label>
                  <MobileSelect value={metodoPago} onValueChange={setMetodoPago} triggerClassName="w-full">
                    {METODOS_PAGO.map(m => <MobileSelectItem key={m.value} value={m.value}>{m.label}</MobileSelectItem>)}
                  </MobileSelect>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones internas…" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !puedeCrear} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {estado === 'entregado' ? 'Registrar adelanto entregado' : 'Crear adelanto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}