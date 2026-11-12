import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Plus, Pencil, Star, CheckCircle2, XCircle, ImagePlus, Loader2, Landmark, CreditCard, Briefcase, Calendar } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const EMPTY = {
  nombre: '',
  cif: '',
  domicilio: '',
  localidad: '',
  provincia: '',
  codigo_postal: '',
  telefono: '',
  email: '',
  web: '',
  logo_url: '',
  actividad_principal: '',
  iban: '',
  registro_mercantil: '',
  fecha_constitucion: '',
  activa: true,
  es_principal: false,
  notas: '',

  // Organización interna
  organizacion_gerencia_personas: 1,
  organizacion_gerencia_neto_mensual: 2400,
  organizacion_director_comercial_personas: 1,
  organizacion_director_comercial_neto_mensual: 2400,
  organizacion_administracion_personas: 1,
  organizacion_administracion_nomina_referencia: '',
  organizacion_observaciones: '',

  // Gastos fijos y periódicos
  gastos_fijos_gestoria_mensual: 900,
  gastos_fijos_luz_telefono_mensual: 75,
  gastos_fijos_oficina_mensual: 600,
  gastos_fijos_prl_anual: 800,
  gastos_fijos_seguro_convenio_metal_anual: 2500,
  gastos_fijos_itv_coches_anual: 360,
  gastos_periodicos_mantenimiento_coches: '',
  gastos_periodicos_mantenimiento_coches_frecuencia: '',
  gastos_empresa_observaciones: '',
};

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
}

export default function Empresas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [logoUploading, setLogoUploading] = useState(false);

  const subirLogo = async (file) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      set('logo_url', res.file_url);
    } catch (e) {
      toast({ title: 'Error al subir logo', description: e?.message, variant: 'destructive' });
    } finally {
      setLogoUploading(false);
    }
  };

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        return base44.entities.Empresa.update(editing.id, payload);
      }
      return base44.entities.Empresa.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries(['empresas']);
      toast({ title: editing ? 'Empresa actualizada' : 'Empresa creada' });
      setOpen(false);
    },
    onError: (e) => toast({ title: 'Error', description: e?.message, variant: 'destructive' }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({ ...EMPTY, ...emp });
    setOpen(true);
  };

  const submit = () => {
    if (!form.nombre || !form.cif) {
      toast({ title: 'Nombre y CIF son obligatorios', variant: 'destructive' });
      return;
    }
    saveMutation.mutate(form);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-4 space-y-4">
      <PageHeader title="Empresas" subtitle="Gestión de empresas del workspace" />
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nueva empresa
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : empresas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No hay empresas registradas.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {empresas.map((emp) => {
            const hasOrganization = [
              emp.organizacion_gerencia_personas,
              emp.organizacion_director_comercial_personas,
              emp.organizacion_administracion_personas,
            ].some((value) => value !== null && value !== undefined && value !== '');

            const hasFixedCosts = [
              emp.gastos_fijos_gestoria_mensual,
              emp.gastos_fijos_luz_telefono_mensual,
              emp.gastos_fijos_oficina_mensual,
              emp.gastos_fijos_prl_anual,
              emp.gastos_fijos_seguro_convenio_metal_anual,
              emp.gastos_fijos_itv_coches_anual,
            ].some((value) => value !== null && value !== undefined && value !== '');

            return (
              <div
                key={emp.id}
                className="border rounded-lg p-4 bg-card relative flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {emp.logo_url ? (
                      <img
                        src={emp.logo_url}
                        alt={emp.nombre}
                        className="h-10 w-10 rounded-lg object-contain bg-white border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold leading-tight">{emp.nombre}</div>
                      <div className="text-xs text-muted-foreground">{emp.cif}</div>
                    </div>
                  </div>
                  {emp.es_principal ? (
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  ) : null}
                </div>
                {emp.actividad_principal && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> {emp.actividad_principal}
                  </p>
                )}
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {emp.domicilio ? <div>{emp.domicilio}</div> : null}
                  {(emp.localidad || emp.provincia || emp.codigo_postal) ? (
                    <div>
                      {[emp.codigo_postal, emp.localidad, emp.provincia].filter(Boolean).join(' ')}
                    </div>
                  ) : null}
                  {emp.telefono ? <div>Tel: {emp.telefono}</div> : null}
                  {emp.email ? <div>{emp.email}</div> : null}
                  {emp.iban ? <div className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> {emp.iban}</div> : null}
                  {emp.registro_mercantil ? <div className="flex items-center gap-1"><Landmark className="h-3 w-3" /> {emp.registro_mercantil}</div> : null}
                  {emp.fecha_constitucion ? <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {emp.fecha_constitucion}</div> : null}
                </div>

                {(hasOrganization || hasFixedCosts) && (
                  <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 border border-border p-2 text-[11px] text-muted-foreground space-y-1">
                    {hasOrganization && (
                      <div>
                        <div className="font-medium text-foreground mb-0.5">Organización</div>
                        {emp.organizacion_gerencia_personas ? (
                          <div>Gerencia: {emp.organizacion_gerencia_personas} persona(s) · {money(emp.organizacion_gerencia_neto_mensual)}</div>
                        ) : null}
                        {emp.organizacion_director_comercial_personas ? (
                          <div>Dir. comercial: {emp.organizacion_director_comercial_personas} persona(s) · {money(emp.organizacion_director_comercial_neto_mensual)}</div>
                        ) : null}
                        {emp.organizacion_administracion_personas ? (
                          <div>Administración: {emp.organizacion_administracion_personas} persona(s) · {emp.organizacion_administracion_nomina_referencia || 'Nómina real'}</div>
                        ) : null}
                      </div>
                    )}

                    {hasFixedCosts && (
                      <div>
                        <div className="font-medium text-foreground mb-0.5">Gastos empresa</div>
                        {emp.gastos_fijos_gestoria_mensual ? <div>Gestoría: {money(emp.gastos_fijos_gestoria_mensual)}/mes</div> : null}
                        {emp.gastos_fijos_luz_telefono_mensual ? <div>Luz/telefono: {money(emp.gastos_fijos_luz_telefono_mensual)}/mes</div> : null}
                        {emp.gastos_fijos_oficina_mensual ? <div>Oficina: {money(emp.gastos_fijos_oficina_mensual)}/mes</div> : null}
                        {emp.gastos_fijos_prl_anual ? <div>PRL: {money(emp.gastos_fijos_prl_anual)}/año</div> : null}
                        {emp.gastos_fijos_seguro_convenio_metal_anual ? <div>Seguro convenio metal: {money(emp.gastos_fijos_seguro_convenio_metal_anual)}/año</div> : null}
                        {emp.gastos_fijos_itv_coches_anual ? <div>ITV coches: {money(emp.gastos_fijos_itv_coches_anual)}/año</div> : null}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-2">
                  <span className="inline-flex items-center gap-1 text-xs">
                    {emp.activa ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    {emp.activa ? 'Activa' : 'Inactiva'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}>
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 max-h-[70vh] overflow-y-auto pr-1">
            {/* Logo corporativo */}
            <div className="sm:col-span-2">
              <Label>Logotipo corporativo</Label>
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="h-16 w-16 rounded-lg object-contain bg-white border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-accent">
                  {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {logoUploading ? 'Subiendo...' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => subirLogo(e.target.files?.[0])}
                    disabled={logoUploading}
                  />
                </label>
                {form.logo_url && (
                  <Button variant="ghost" size="sm" onClick={() => set('logo_url', '')}>Quitar</Button>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label>Nombre / Razón social *</Label>
              <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
            </div>
            <div>
              <Label>CIF / NIF *</Label>
              <Input value={form.cif} onChange={(e) => set('cif', e.target.value)} />
            </div>
            <div>
              <Label>Actividad principal</Label>
              <Input value={form.actividad_principal} onChange={(e) => set('actividad_principal', e.target.value)} placeholder="Ej: Instalaciones eléctricas y fotovoltaicas" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div>
              <Label>Web</Label>
              <Input value={form.web} onChange={(e) => set('web', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>IBAN</Label>
              <Input value={form.iban} onChange={(e) => set('iban', e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" />
            </div>
            <div className="sm:col-span-2">
              <Label>Registro Mercantil</Label>
              <Input value={form.registro_mercantil} onChange={(e) => set('registro_mercantil', e.target.value)} placeholder="Tomo, Folio, Sección, Hoja, Inscripción" />
            </div>
            <div>
              <Label>Fecha de constitución</Label>
              <Input type="date" value={form.fecha_constitucion} onChange={(e) => set('fecha_constitucion', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Domicilio</Label>
              <Input value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)} />
            </div>
            <div>
              <Label>Código postal</Label>
              <Input value={form.codigo_postal} onChange={(e) => set('codigo_postal', e.target.value)} />
            </div>
            <div>
              <Label>Localidad</Label>
              <Input value={form.localidad} onChange={(e) => set('localidad', e.target.value)} />
            </div>
            <div>
              <Label>Provincia</Label>
              <Input value={form.provincia} onChange={(e) => set('provincia', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.activa} onCheckedChange={(v) => set('activa', v)} />
              <Label>Activa</Label>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.es_principal} onCheckedChange={(v) => set('es_principal', v)} />
              <Label>Empresa principal</Label>
            </div>

            <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3">
              <div className="font-medium text-sm mb-3">Organización interna</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Gerencia (personas)</Label>
                  <Input type="number" min="0" value={form.organizacion_gerencia_personas ?? ''} onChange={(e) => set('organizacion_gerencia_personas', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>Gerencia (€ netos/mes)</Label>
                  <Input type="number" min="0" step="0.01" value={form.organizacion_gerencia_neto_mensual ?? ''} onChange={(e) => set('organizacion_gerencia_neto_mensual', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>Dir. comercial (personas)</Label>
                  <Input type="number" min="0" value={form.organizacion_director_comercial_personas ?? ''} onChange={(e) => set('organizacion_director_comercial_personas', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>Dir. comercial (€ netos/mes)</Label>
                  <Input type="number" min="0" step="0.01" value={form.organizacion_director_comercial_neto_mensual ?? ''} onChange={(e) => set('organizacion_director_comercial_neto_mensual', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>Administración (personas)</Label>
                  <Input type="number" min="0" value={form.organizacion_administracion_personas ?? ''} onChange={(e) => set('organizacion_administracion_personas', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>Administración: nómina de referencia</Label>
                  <Input value={form.organizacion_administracion_nomina_referencia || ''} onChange={(e) => set('organizacion_administracion_nomina_referencia', e.target.value)} placeholder="Ej: mensual / actual / última nómina" />
                </div>
              </div>
              <div className="mt-3">
                <Label>Observaciones de organización</Label>
                <Textarea value={form.organizacion_observaciones || ''} onChange={(e) => set('organizacion_observaciones', e.target.value)} rows={2} placeholder="Detalle, roles, estructura o comentarios internos." />
              </div>
            </div>

            <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3">
              <div className="font-medium text-sm mb-3">Gastos fijos y periódicos</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Gestoría laboral/contable (€ mes)</Label>
                  <Input type="number" min="0" step="0.01" value={form.gastos_fijos_gestoria_mensual ?? ''} onChange={(e) => set('gastos_fijos_gestoria_mensual', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>Luz + teléfono (€ mes)</Label>
                  <Input type="number" min="0" step="0.01" value={form.gastos_fijos_luz_telefono_mensual ?? ''} onChange={(e) => set('gastos_fijos_luz_telefono_mensual', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>Oficina (€ mes)</Label>
                  <Input type="number" min="0" step="0.01" value={form.gastos_fijos_oficina_mensual ?? ''} onChange={(e) => set('gastos_fijos_oficina_mensual', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>PRL (€ año)</Label>
                  <Input type="number" min="0" step="0.01" value={form.gastos_fijos_prl_anual ?? ''} onChange={(e) => set('gastos_fijos_prl_anual', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>Seguros convenio metal (€ año)</Label>
                  <Input type="number" min="0" step="0.01" value={form.gastos_fijos_seguro_convenio_metal_anual ?? ''} onChange={(e) => set('gastos_fijos_seguro_convenio_metal_anual', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div>
                  <Label>ITV coches (€ año)</Label>
                  <Input type="number" min="0" step="0.01" value={form.gastos_fijos_itv_coches_anual ?? ''} onChange={(e) => set('gastos_fijos_itv_coches_anual', e.target.value === '' ? '' : Number(e.target.value))} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Mantenimiento coches</Label>
                  <Input value={form.gastos_periodicos_mantenimiento_coches || ''} onChange={(e) => set('gastos_periodicos_mantenimiento_coches', e.target.value)} placeholder="Ej: 120 €/mes, revisión + desgaste cada 3 meses" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Frecuencia mantenimiento coches</Label>
                  <Input value={form.gastos_periodicos_mantenimiento_coches_frecuencia || ''} onChange={(e) => set('gastos_periodicos_mantenimiento_coches_frecuencia', e.target.value)} placeholder="Ej: trimestral / mensual / según uso" />
                </div>
              </div>
              <div className="mt-3">
                <Label>Observaciones económicas</Label>
                <Textarea value={form.gastos_empresa_observaciones || ''} onChange={(e) => set('gastos_empresa_observaciones', e.target.value)} rows={2} placeholder="Notas internas sobre gastos fijos, periodicidad o excepciones." />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
