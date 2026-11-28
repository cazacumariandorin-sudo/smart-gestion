import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PLANES } from '@/lib/planes';
import { ESTADOS_ESPACIO, PASOS_ESPACIO, checklistInicial } from '@/lib/multiempresa';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

/**
 * Ficha del espacio Base44 de una empresa: administrador local, estado del
 * aprovisionamiento y pasos completados. No toca datos de otras empresas.
 */
export default function EspacioEmpresaDialog({ empresa, espacio, onClose }) {
  const { user } = useUserRole();
  const qc = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    estado: espacio?.estado || 'pendiente_configuracion',
    url_espacio: espacio?.url_espacio || '',
    admin_local_email: espacio?.admin_local_email || '',
    admin_local_nombre: espacio?.admin_local_nombre || '',
    plan: espacio?.plan || 'completo',
    version_app: espacio?.version_app || '',
    fecha_alta: espacio?.fecha_alta || '',
    notas: espacio?.notas || '',
  });
  const [checklist, setChecklist] = useState(() => {
    const guardado = espacio?.checklist || [];
    return checklistInicial().map((paso) => {
      const previo = guardado.find((p) => p.clave === paso.clave);
      return previo ? { ...paso, ...previo } : paso;
    });
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const alternarPaso = (clave) => {
    setChecklist((pasos) =>
      pasos.map((paso) =>
        paso.clave === clave
          ? { ...paso, hecho: !paso.hecho, fecha: !paso.hecho ? new Date().toISOString() : null }
          : paso,
      ),
    );
  };

  const guardar = async () => {
    if (!form.admin_local_email) {
      toast({ title: 'Indica el administrador local', description: 'Es quien gestionará usuarios en ese espacio.', variant: 'destructive' });
      return;
    }
    setGuardando(true);
    try {
      const datos = {
        empresa_id: empresa.id,
        empresa_nombre: empresa.nombre || '',
        estado: form.estado,
        url_espacio: form.url_espacio,
        admin_local_email: form.admin_local_email,
        admin_local_nombre: form.admin_local_nombre,
        plan: form.plan,
        version_app: form.version_app,
        fecha_alta: form.fecha_alta || null,
        notas: form.notas,
        es_simantec: !!empresa.es_principal,
        checklist,
        actualizado_por: user?.email || '',
        actualizado_en: new Date().toISOString(),
      };
      if (espacio) await base44.entities.EspacioEmpresa.update(espacio.id, datos);
      else await base44.entities.EspacioEmpresa.create(datos);
      qc.invalidateQueries({ queryKey: ['espacios-empresa'] });
      toast({ title: espacio ? 'Espacio actualizado' : 'Espacio registrado', description: empresa.nombre });
      onClose();
    } catch (e) {
      toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Espacio de {empresa.nombre}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <Label>Estado del espacio</Label>
            <select className="ing-input" value={form.estado} onChange={(e) => set('estado', e.target.value)}>
              {Object.entries(ESTADOS_ESPACIO).map(([clave, valor]) => (
                <option key={clave} value={clave}>{valor.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Plan contratado</Label>
            <select className="ing-input" value={form.plan} onChange={(e) => set('plan', e.target.value)}>
              {PLANES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Dirección del espacio</Label>
            <Input value={form.url_espacio} onChange={(e) => set('url_espacio', e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Administrador local (email) *</Label>
            <Input type="email" value={form.admin_local_email} onChange={(e) => set('admin_local_email', e.target.value)} />
          </div>
          <div>
            <Label>Administrador local (nombre)</Label>
            <Input value={form.admin_local_nombre} onChange={(e) => set('admin_local_nombre', e.target.value)} />
          </div>
          <div>
            <Label>Versión de la app</Label>
            <Input value={form.version_app} onChange={(e) => set('version_app', e.target.value)} placeholder="Fecha o versión replicada" />
          </div>
          <div>
            <Label>Fecha de alta</Label>
            <Input type="date" value={form.fecha_alta} onChange={(e) => set('fecha_alta', e.target.value)} />
          </div>

          <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3">
            <div className="font-medium text-sm mb-2">Aprovisionamiento</div>
            <div className="space-y-1">
              {PASOS_ESPACIO.map((paso) => {
                const item = checklist.find((p) => p.clave === paso.clave) || paso;
                return (
                  <button
                    key={paso.clave}
                    type="button"
                    onClick={() => alternarPaso(paso.clave)}
                    className="w-full flex items-center gap-2 text-left text-sm py-1.5 hover:bg-accent rounded px-1"
                  >
                    {item.hecho ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className={item.hecho ? 'line-through text-muted-foreground' : ''}>{paso.etiqueta}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sm:col-span-2">
            <Label>Notas internas</Label>
            <Textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}