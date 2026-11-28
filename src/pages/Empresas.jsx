import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import PlanEmpresaPanel from '@/components/empresas/PlanEmpresaPanel';
import EspaciosEmpresaPanel from '@/components/empresas/EspaciosEmpresaPanel';
import SolicitudesPrivilegioPanel from '@/components/empresas/SolicitudesPrivilegioPanel';
import SolicitudesEmpresaPanel from '@/components/empresas/SolicitudesEmpresaPanel';
import LimpiezaEmpresasPanel from '@/components/empresas/LimpiezaEmpresasPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Building2, Plus, Pencil, Star, CheckCircle2, XCircle, ImagePlus, Loader2, Landmark, CreditCard, Briefcase, Calendar, History, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const GASTOS_KEYS = [
  'gastos_fijos_gestoria_mensual', 'gastos_fijos_luz_telefono_mensual', 'gastos_fijos_oficina_mensual',
  'gastos_fijos_prl_anual', 'gastos_fijos_seguro_convenio_metal_anual', 'gastos_fijos_itv_coches_anual',
  'gastos_periodicos_mantenimiento_coches', 'gastos_periodicos_mantenimiento_coches_frecuencia', 'gastos_empresa_observaciones',
];
const EMPTY = {
  nombre: '', cif: '', domicilio: '', localidad: '', provincia: '', codigo_postal: '', telefono: '', email: '', web: '',
  logo_url: '', logo_2_url: '', actividad_principal: '', iban: '', registro_mercantil: '', fecha_constitucion: '', activa: true,
  es_principal: false, notas: '', organizacion_gerencia_personas: 1, organizacion_gerencia_neto_mensual: 2400,
  organizacion_director_comercial_personas: 1, organizacion_director_comercial_neto_mensual: 2400,
  organizacion_administracion_personas: 1, organizacion_administracion_nomina_referencia: '', organizacion_observaciones: '',
  gastos_fijos_gestoria_mensual: 900, gastos_fijos_luz_telefono_mensual: 75, gastos_fijos_oficina_mensual: 600,
  gastos_fijos_prl_anual: 800, gastos_fijos_seguro_convenio_metal_anual: 2500, gastos_fijos_itv_coches_anual: 360,
  gastos_periodicos_mantenimiento_coches: '', gastos_periodicos_mantenimiento_coches_frecuencia: '', gastos_empresa_observaciones: '',
};
const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €` : '—';
};
const nombreGasto = {
  gastos_fijos_gestoria_mensual: 'Gestoría laboral/contable',
  gastos_fijos_luz_telefono_mensual: 'Luz y teléfono',
  gastos_fijos_oficina_mensual: 'Local oficina',
  gastos_fijos_prl_anual: 'PRL',
  gastos_fijos_seguro_convenio_metal_anual: 'Seguros obligatorios convenio metal',
  gastos_fijos_itv_coches_anual: 'ITV coches',
  gastos_periodicos_mantenimiento_coches: 'Mantenimiento coches',
  gastos_periodicos_mantenimiento_coches_frecuencia: 'Frecuencia mantenimiento',
  gastos_empresa_observaciones: 'Observaciones',
};

export default function Empresas() {
  const { user } = useAuth();
  const { isGerencia } = useUserRole();
  const puedeEditarGastos = isGerencia;
  // Borrar una empresa queda reservado al propietario global de la app.
  const esPropietario = user?.es_propietario_global === true || user?.role === 'propietario';
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logo2Uploading, setLogo2Uploading] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(null);
  const [borrando, setBorrando] = useState(null);

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ['empresas'], queryFn: () => base44.entities.Empresa.list('-created_date', 100),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const datos = { ...payload };
      if (!puedeEditarGastos) {
        GASTOS_KEYS.forEach((key) => delete datos[key]);
        delete datos.gastos_empresa_historial;
        delete datos.gastos_empresa_actualizado_por;
        delete datos.gastos_empresa_actualizado_en;
        delete datos.gastos_empresa_estado_aprobacion;
      } else {
        const anterior = editing || {};
        const cambios = GASTOS_KEYS
          .filter((key) => (anterior[key] ?? '') !== (payload[key] ?? ''))
          .map((key) => ({ campo: key, concepto: nombreGasto[key], anterior: anterior[key] ?? null, nuevo: payload[key] ?? null }));
        if (cambios.length || !editing) {
          const evento = {
            fecha: new Date().toISOString(),
            usuario_email: user?.email || '',
            usuario_nombre: user?.full_name || user?.email || 'Gerencia',
            cambios: cambios.length ? cambios : GASTOS_KEYS.map((key) => ({ campo: key, concepto: nombreGasto[key], anterior: null, nuevo: payload[key] ?? null })),
            estado: 'aprobado',
          };
          datos.gastos_empresa_historial = [...(anterior.gastos_empresa_historial || []), evento];
          datos.gastos_empresa_actualizado_por = evento.usuario_nombre;
          datos.gastos_empresa_actualizado_en = evento.fecha;
          datos.gastos_empresa_estado_aprobacion = 'aprobado';
        }
      }
      if (editing) return base44.entities.Empresa.update(editing.id, datos);
      const creada = await base44.entities.Empresa.create({ ...datos, empresa_id: user?.empresa_id || '' });
      await base44.entities.Empresa.update(creada.id, { empresa_id: creada.id });
      return creada;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      toast({ title: editing ? 'Empresa actualizada' : 'Empresa creada' });
      setOpen(false);
    },
    onError: (e) => toast({ title: 'Error', description: e?.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    // El borrado pasa por la herramienta de limpieza: elimina la empresa y
    // todos sus rastros (privilegios, espacio, plan, invitaciones y datos).
    mutationFn: async (empresa) => {
      const res = await base44.functions.invoke('limpiarEmpresa', { modo: 'purgar', empresa_id: empresa.id });
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['empresas'] });
      toast({ title: 'Empresa borrada', description: `${data?.usuarios_desvinculados || 0} usuario(s) desvinculado(s).` });
      setBorrando(null);
    },
    onError: (e) => toast({ title: 'Error al borrar', description: e?.message, variant: 'destructive' }),
  });

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY, ...(puedeEditarGastos ? {} : Object.fromEntries(GASTOS_KEYS.map((key) => [key, '']))) });
    setOpen(true);
  };
  const openEdit = (empresa) => { setEditing(empresa); setForm({ ...EMPTY, ...empresa }); setOpen(true); };
  const subirLogo = async (file, campo = 'logo_url', setCargando = setLogoUploading) => {
    if (!file) return;
    setCargando(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      set(campo, res.file_url);
    } catch (e) {
      toast({ title: 'Error al subir logo', description: e?.message, variant: 'destructive' });
    } finally { setCargando(false); }
  };
  const submit = () => {
    if (!form.nombre || !form.cif) return toast({ title: 'Nombre y CIF son obligatorios', variant: 'destructive' });
    saveMutation.mutate(form);
  };
  const numericField = (label, key, suffix) => (
    <div key={key}><Label>{label}</Label><div className="flex items-center gap-2">
      <Input type="number" min="0" step="0.01" value={form[key] ?? ''} disabled={!puedeEditarGastos && GASTOS_KEYS.includes(key)}
        onChange={(e) => set(key, e.target.value === '' ? '' : Number(e.target.value))} />
      {suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>}
    </div></div>
  );

  return (
    <div className="p-4 space-y-4">
      <PageHeader title="Empresas" subtitle="Gestión de empresas del workspace" />
      <PlanEmpresaPanel />
      <SolicitudesEmpresaPanel />
      <EspaciosEmpresaPanel />
      <SolicitudesPrivilegioPanel />
      {esPropietario && <LimpiezaEmpresasPanel />}
      <div className="flex justify-end"><Button onClick={openNew}><Plus className="h-4 w-4" /> Nueva empresa</Button></div>
      {isLoading ? <div className="text-center py-8 text-muted-foreground">Cargando...</div> : empresas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No hay empresas registradas.</div>
      ) : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {empresas.map((emp) => <div key={emp.id} className="border rounded-lg p-4 bg-card relative flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">{emp.logo_url ? <img src={emp.logo_url} alt={emp.nombre} className="h-10 w-10 rounded-lg object-contain bg-white border" /> : <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>}
              <div><div className="font-semibold leading-tight">{emp.nombre}</div><div className="text-xs text-muted-foreground">{emp.cif}</div></div></div>
            {emp.es_principal && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
          </div>
          {emp.actividad_principal && <p className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> {emp.actividad_principal}</p>}
          <div className="text-sm text-muted-foreground space-y-0.5">
            {emp.domicilio && <div>{emp.domicilio}</div>}
            {(emp.localidad || emp.provincia || emp.codigo_postal) && <div>{[emp.codigo_postal, emp.localidad, emp.provincia].filter(Boolean).join(' ')}</div>}
            {emp.telefono && <div>Tel: {emp.telefono}</div>}{emp.email && <div>{emp.email}</div>}
            {emp.iban && <div className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> {emp.iban}</div>}
            {emp.registro_mercantil && <div className="flex items-center gap-1"><Landmark className="h-3 w-3" /> {emp.registro_mercantil}</div>}
            {emp.fecha_constitucion && <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {emp.fecha_constitucion}</div>}
          </div>
          {puedeEditarGastos && <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 border border-border p-2 text-[11px] text-muted-foreground space-y-1">
            <div className="font-medium text-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Costes de empresa · {emp.gastos_empresa_estado_aprobacion || 'pendiente de revisión'}</div>
            <div>Gestoría: {money(emp.gastos_fijos_gestoria_mensual)}/mes · Luz/teléfono: {money(emp.gastos_fijos_luz_telefono_mensual)}/mes · Oficina: {money(emp.gastos_fijos_oficina_mensual)}/mes</div>
            <div>PRL: {money(emp.gastos_fijos_prl_anual)}/año · Seguro convenio: {money(emp.gastos_fijos_seguro_convenio_metal_anual)}/año · ITV: {money(emp.gastos_fijos_itv_coches_anual)}/año</div>
            {emp.gastos_empresa_actualizado_en && <div>Última actualización: {new Date(emp.gastos_empresa_actualizado_en).toLocaleString('es-ES')} · {emp.gastos_empresa_actualizado_por || '—'}</div>}
            <Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-[11px]" onClick={() => setHistorialAbierto(historialAbierto === emp.id ? null : emp.id)}><History className="w-3 h-3 mr-1" />Historial ({(emp.gastos_empresa_historial || []).length})</Button>
            {historialAbierto === emp.id && <div className="max-h-44 overflow-y-auto border-t pt-1 space-y-2">
              {[...(emp.gastos_empresa_historial || [])].reverse().map((evento, i) => <div key={`${evento.fecha}-${i}`} className="border-b pb-1">
                <div className="font-medium text-foreground">{new Date(evento.fecha).toLocaleString('es-ES')} · {evento.usuario_nombre} · Aprobado</div>
                {(evento.cambios || []).map((c, j) => <div key={`${c.campo}-${j}`}>{c.concepto}: {c.anterior == null ? '—' : c.anterior} → {c.nuevo == null ? '—' : c.nuevo}</div>)}
              </div>)}
              {!emp.gastos_empresa_historial?.length && <div>Sin cambios registrados aún.</div>}
            </div>}
          </div>}
          <div className="flex items-center justify-between mt-2">
            <span className="inline-flex items-center gap-1 text-xs">{emp.activa ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-slate-400" />}{emp.activa ? 'Activa' : 'Inactiva'}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => openEdit(emp)}><Pencil className="h-4 w-4" /> Editar</Button>
              {esPropietario && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setBorrando(emp)}>
                  <Trash2 className="h-4 w-4" /> Borrar
                </Button>
              )}
            </div>
          </div>
        </div>)}
      </div>}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{editing ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 max-h-[70vh] overflow-y-auto pr-1">
          <div><Label>Logotipo corporativo (Logo 1)</Label><div className="flex items-center gap-3">
            {form.logo_url ? <img src={form.logo_url} alt="Logo 1" className="h-16 w-16 rounded-lg object-contain bg-white border" /> : <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center"><ImagePlus className="h-6 w-6 text-muted-foreground" /></div>}
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-accent">{logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{logoUploading ? 'Subiendo...' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}<input type="file" accept="image/*" className="hidden" onChange={(e) => subirLogo(e.target.files?.[0])} disabled={logoUploading} /></label>
            {form.logo_url && <Button variant="ghost" size="sm" onClick={() => set('logo_url', '')}>Quitar</Button>}</div></div>
          <div><Label>Logo 2 (presupuestos)</Label><div className="flex items-center gap-3">
            {form.logo_2_url ? <img src={form.logo_2_url} alt="Logo 2" className="h-16 w-16 rounded-lg object-contain bg-white border" /> : <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center"><ImagePlus className="h-6 w-6 text-muted-foreground" /></div>}
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-accent">{logo2Uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{logo2Uploading ? 'Subiendo...' : form.logo_2_url ? 'Cambiar logo 2' : 'Subir logo 2'}<input type="file" accept="image/*" className="hidden" onChange={(e) => subirLogo(e.target.files?.[0], 'logo_2_url', setLogo2Uploading)} disabled={logo2Uploading} /></label>
            {form.logo_2_url && <Button variant="ghost" size="sm" onClick={() => set('logo_2_url', '')}>Quitar</Button>}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Se ofrece como logotipo alternativo en los presupuestos y sale en su PDF.</p></div>
          <div className="sm:col-span-2"><Label>Nombre / Razón social *</Label><Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} /></div>
          <div><Label>CIF / NIF *</Label><Input value={form.cif} onChange={(e) => set('cif', e.target.value)} /></div>
          <div><Label>Actividad principal</Label><Input value={form.actividad_principal} onChange={(e) => set('actividad_principal', e.target.value)} /></div>
          <div><Label>Teléfono</Label><Input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} /></div><div><Label>Email</Label><Input value={form.email} onChange={(e) => set('email', e.target.value)} /></div><div><Label>Web</Label><Input value={form.web} onChange={(e) => set('web', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => set('iban', e.target.value)} /></div><div className="sm:col-span-2"><Label>Registro Mercantil</Label><Input value={form.registro_mercantil} onChange={(e) => set('registro_mercantil', e.target.value)} /></div>
          <div><Label>Fecha de constitución</Label><Input type="date" value={form.fecha_constitucion} onChange={(e) => set('fecha_constitucion', e.target.value)} /></div><div className="sm:col-span-2"><Label>Domicilio</Label><Input value={form.domicilio} onChange={(e) => set('domicilio', e.target.value)} /></div>
          <div><Label>Código postal</Label><Input value={form.codigo_postal} onChange={(e) => set('codigo_postal', e.target.value)} /></div><div><Label>Localidad</Label><Input value={form.localidad} onChange={(e) => set('localidad', e.target.value)} /></div><div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => set('provincia', e.target.value)} /></div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={form.activa} onCheckedChange={(v) => set('activa', v)} /><Label>Activa</Label></div><div className="flex items-center gap-2 pt-6"><Switch checked={form.es_principal} onCheckedChange={(v) => set('es_principal', v)} /><Label>Empresa principal</Label></div>
          <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3"><div className="font-medium text-sm mb-3">Organización interna</div><div className="grid gap-3 sm:grid-cols-2">
            {numericField('Gerencia (personas)', 'organizacion_gerencia_personas', 'personas')}{numericField('Gerencia (neto referencia)', 'organizacion_gerencia_neto_mensual', '€/mes')}
            {numericField('Director comercial (personas)', 'organizacion_director_comercial_personas', 'personas')}{numericField('Director comercial (neto referencia)', 'organizacion_director_comercial_neto_mensual', '€/mes')}{numericField('Administración (personas)', 'organizacion_administracion_personas', 'personas')}
            <div><Label>Administración: nómina de referencia</Label><Input value={form.organizacion_administracion_nomina_referencia || ''} onChange={(e) => set('organizacion_administracion_nomina_referencia', e.target.value)} /></div></div>
            <div className="mt-3"><Label>Observaciones de organización</Label><Textarea value={form.organizacion_observaciones || ''} onChange={(e) => set('organizacion_observaciones', e.target.value)} rows={2} /></div></div>
          <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3"><div className="font-medium text-sm mb-1 flex items-center gap-2"><History className="w-4 h-4" /> Gastos fijos y periódicos</div><p className="text-xs text-muted-foreground mb-3">Solo Gerencia puede consultar y editar costes. Los cambios se guardan como aprobados y quedan en el historial.</p>
            {puedeEditarGastos ? <><div className="grid gap-3 sm:grid-cols-2">
              {numericField('Gestoría laboral/contable', 'gastos_fijos_gestoria_mensual', '€/mes')}{numericField('Luz y teléfono', 'gastos_fijos_luz_telefono_mensual', '€/mes')}{numericField('Local oficina', 'gastos_fijos_oficina_mensual', '€/mes')}{numericField('PRL', 'gastos_fijos_prl_anual', '€/año')}{numericField('Seguros convenio metal', 'gastos_fijos_seguro_convenio_metal_anual', '€/año')}{numericField('ITV coches', 'gastos_fijos_itv_coches_anual', '€/año')}
              <div><Label>Mantenimiento coches (importe/referencia)</Label><Input value={form.gastos_periodicos_mantenimiento_coches || ''} onChange={(e) => set('gastos_periodicos_mantenimiento_coches', e.target.value)} /></div><div><Label>Frecuencia mantenimiento</Label><Input value={form.gastos_periodicos_mantenimiento_coches_frecuencia || ''} onChange={(e) => set('gastos_periodicos_mantenimiento_coches_frecuencia', e.target.value)} /></div></div>
              <div className="mt-3"><Label>Observaciones económicas</Label><Textarea value={form.gastos_empresa_observaciones || ''} onChange={(e) => set('gastos_empresa_observaciones', e.target.value)} rows={2} /></div></> : <div className="text-sm text-muted-foreground">Los costes quedan ocultos para tu rol.</div>}
          </div>
          <div className="sm:col-span-2"><Label>Notas</Label><Textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit} disabled={saveMutation.isPending || logoUploading}>{saveMutation.isPending ? 'Guardando...' : 'Guardar'}</Button></DialogFooter>
      </DialogContent></Dialog>

      <AlertDialog open={!!borrando} onOpenChange={(v) => { if (!v) setBorrando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Borrar {borrando?.nombre || 'empresa'}</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina la empresa y todos sus rastros en la base de datos: invitaciones, solicitudes de privilegio, espacio, plan, solicitudes comerciales, plantilla, datos sensibles y registro horario legal. Los usuarios vinculados quedan desvinculados. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(borrando); }}
            >
              {deleteMutation.isPending ? 'Borrando...' : 'Borrar empresa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}