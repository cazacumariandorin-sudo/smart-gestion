import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Download, Search, User, Calendar, AlertTriangle, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function EditForm({ nom, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    operario_name: nom.operario_name || '',
    operario_dni: nom.operario_dni || '',
    liquido_percibir: nom.liquido_percibir || '',
    total_devengado: nom.total_devengado || '',
    coste_empresa: nom.coste_empresa || '',
    estado_asignacion: nom.estado_asignacion || 'asignada',
    file_url: nom.file_url || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-700 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Nombre trabajador</label>
          <Input value={form.operario_name} onChange={e => set('operario_name', e.target.value)} className="h-8 text-sm mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">DNI</label>
          <Input value={form.operario_dni} onChange={e => set('operario_dni', e.target.value)} className="h-8 text-sm mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Líquido a percibir (€)</label>
          <Input type="number" value={form.liquido_percibir} onChange={e => set('liquido_percibir', e.target.value)} className="h-8 text-sm mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Total devengado (€)</label>
          <Input type="number" value={form.total_devengado} onChange={e => set('total_devengado', e.target.value)} className="h-8 text-sm mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Coste empresa (€)</label>
          <Input type="number" value={form.coste_empresa} onChange={e => set('coste_empresa', e.target.value)} className="h-8 text-sm mt-0.5" />
        </div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Estado</label>
          <select
            value={form.estado_asignacion}
            onChange={e => set('estado_asignacion', e.target.value)}
            className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm mt-0.5"
          >
            <option value="asignada">Asignada</option>
            <option value="sin_asignar">Sin asignar</option>
            <option value="revision_manual">Revisión manual</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">URL del PDF</label>
          <Input value={form.file_url} onChange={e => set('file_url', e.target.value)} className="h-8 text-sm mt-0.5" placeholder="https://..." />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving} className="h-8 px-3 text-xs gap-1">
          <X className="w-3.5 h-3.5" /> Cancelar
        </Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={saving} className="h-8 px-3 text-xs gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

export default function ListaNominas({ esAdmin }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
  const [editandoId, setEditandoId] = useState(null);
  const [confirmarBorrarId, setConfirmarBorrarId] = useState(null);

  const queryClient = useQueryClient();

  const { data: nominas = [], isLoading } = useQuery({
    queryKey: ['nominas', filtroMes, filtroAnio],
    queryFn: () => base44.entities.Nomina.list('-created_date', 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Nomina.update(id, {
      ...data,
      liquido_percibir: data.liquido_percibir ? parseFloat(data.liquido_percibir) : null,
      total_devengado: data.total_devengado ? parseFloat(data.total_devengado) : null,
      coste_empresa: data.coste_empresa ? parseFloat(data.coste_empresa) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nominas'] });
      setEditandoId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Nomina.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nominas'] });
      setConfirmarBorrarId(null);
    },
  });

  const nominasFiltradas = nominas.filter(n => {
    const coincideBusqueda = !busqueda ||
      (n.operario_name || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (n.operario_dni || '').toLowerCase().includes(busqueda.toLowerCase());
    const coincideMes = !filtroMes || n.mes === parseInt(filtroMes);
    const coincideAnio = !filtroAnio || n.anio === parseInt(filtroAnio);
    return coincideBusqueda && coincideMes && coincideAnio;
  });

  const porLote = nominasFiltradas.reduce((acc, nom) => {
    const key = nom.lote_id || `${nom.mes}_${nom.anio}`;
    if (!acc[key]) acc[key] = { periodo: nom.periodo, mes: nom.mes, anio: nom.anio, nominas: [] };
    acc[key].nominas.push(nom);
    return acc;
  }, {});

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar trabajador o DNI..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos los meses</option>
          {MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={filtroAnio}
          onChange={e => setFiltroAnio(e.target.value)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Lista agrupada por lote */}
      {Object.keys(porLote).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay nóminas para los filtros seleccionados</p>
        </div>
      ) : (
        Object.entries(porLote).map(([loteKey, lote]) => (
          <div key={loteKey} className="border border-border rounded-xl overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">{lote.periodo}</span>
                <Badge variant="secondary" className="text-xs">{lote.nominas.length} nóminas</Badge>
              </div>
              {esAdmin && lote.nominas.filter(n => n.estado_asignacion === 'sin_asignar').length > 0 && (
                <span className="text-amber-600 flex items-center gap-1 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {lote.nominas.filter(n => n.estado_asignacion === 'sin_asignar').length} sin asignar
                </span>
              )}
            </div>

            <div className="divide-y divide-border">
              {lote.nominas.map(nom => (
                <div key={nom.id}>
                  {/* Fila principal */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{nom.operario_name || 'Sin asignar'}</p>
                      <p className="text-xs text-muted-foreground">DNI: {nom.operario_dni || '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {nom.liquido_percibir && (
                        <p className="font-semibold text-sm text-green-700">
                          {nom.liquido_percibir.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </p>
                      )}
                      {esAdmin && nom.coste_empresa && (
                        <p className="text-xs text-muted-foreground">
                          Coste: {nom.coste_empresa.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </p>
                      )}
                      <Badge
                        variant={nom.estado_asignacion === 'asignada' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {nom.estado_asignacion === 'asignada' ? 'Asignada' : nom.estado_asignacion === 'revision_manual' ? 'Revisión' : 'Sin asignar'}
                      </Badge>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-1 shrink-0">
                      {nom.file_url && (
                        <Button variant="ghost" size="icon" asChild className="w-8 h-8">
                          <a href={nom.file_url} target="_blank" rel="noopener noreferrer" title="Ver PDF">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      {esAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 text-muted-foreground hover:text-foreground"
                            title="Editar"
                            onClick={() => setEditandoId(editandoId === nom.id ? null : nom.id)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {confirmarBorrarId === nom.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="icon"
                                className="w-8 h-8"
                                title="Confirmar borrado"
                                onClick={() => deleteMutation.mutate(nom.id)}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8"
                                onClick={() => setConfirmarBorrarId(null)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 text-muted-foreground hover:text-destructive"
                              title="Eliminar"
                              onClick={() => setConfirmarBorrarId(nom.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Formulario de edición inline */}
                  {esAdmin && editandoId === nom.id && (
                    <EditForm
                      nom={nom}
                      onSave={(data) => updateMutation.mutate({ id: nom.id, data })}
                      onCancel={() => setEditandoId(null)}
                      saving={updateMutation.isPending}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}