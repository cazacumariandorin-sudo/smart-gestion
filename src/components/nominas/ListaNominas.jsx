import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Download, Search, User, Calendar, AlertTriangle, Pencil, Trash2, Check, X, Loader2, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Detecta duplicados: mismo DNI (o nombre) + mismo mes + mismo año ──────────
function detectarDuplicados(nominas) {
  const grupos = {};
  for (const nom of nominas) {
    const clave = `${(nom.operario_dni || nom.operario_name || '').toUpperCase()}_${nom.mes}_${nom.anio}`;
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(nom);
  }
  // Solo devuelve grupos con más de 1 entrada
  return Object.values(grupos).filter(g => g.length > 1);
}

// ── Banner de alerta de duplicados ────────────────────────────────────────────
function AlertaDuplicados({ grupos, onVerDuplicados }) {
  const total = grupos.reduce((s, g) => s + g.length - 1, 0); // excedentes
  return (
    <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
          ⚠️ Se detectaron {total} nómina{total !== 1 ? 's' : ''} duplicada{total !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
          {grupos.length} trabajador{grupos.length !== 1 ? 'es' : ''} tienen más de una nómina para el mismo período.
        </p>
      </div>
      <Button size="sm" variant="destructive" className="h-8 px-3 text-xs shrink-0" onClick={onVerDuplicados}>
        Gestionar
      </Button>
    </div>
  );
}

// ── Modal de gestión de duplicados ────────────────────────────────────────────
function ModalDuplicados({ grupos, onClose, onEliminar, eliminando }) {
  const [seleccionados, setSeleccionados] = useState(() => {
    // Pre-selecciona automáticamente los más nuevos de cada grupo (mantiene el más antiguo)
    const ids = new Set();
    for (const grupo of grupos) {
      const ordenados = [...grupo].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      ordenados.slice(1).forEach(n => ids.add(n.id)); // los duplicados (todo menos el primero)
    }
    return ids;
  });

  const toggle = (id) => setSeleccionados(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const totalSeleccionados = seleccionados.size;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Copy className="w-4 h-4 text-red-500" /> Nóminas duplicadas
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Selecciona las que quieres eliminar</p>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Lista de grupos */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
          {grupos.map((grupo, gi) => {
            const ordenados = [...grupo].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            return (
              <div key={gi} className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold truncate">{grupo[0].operario_name}</span>
                  <span className="text-xs text-muted-foreground">· {grupo[0].operario_dni || '—'}</span>
                  <Badge variant="destructive" className="text-[10px] ml-auto">{grupo.length} copias</Badge>
                </div>
                <div className="divide-y divide-border">
                  {ordenados.map((nom, ni) => {
                    const esPrimero = ni === 0;
                    const marcado = seleccionados.has(nom.id);
                    return (
                      <label
                        key={nom.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                          ${marcado ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/20'}`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => toggle(nom.id)}
                          className="accent-destructive w-4 h-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">
                            {nom.periodo || `${MESES[nom.mes]} ${nom.anio}`}
                            {' · '}Lote: <span className="font-mono">{(nom.lote_id || '—').slice(-8)}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Creado: {nom.created_date ? new Date(nom.created_date).toLocaleString('es-ES') : '—'}
                          </p>
                        </div>
                        {nom.liquido_percibir && (
                          <span className="text-xs font-semibold text-green-700 shrink-0">
                            {nom.liquido_percibir.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                          </span>
                        )}
                        {esPrimero && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Original</Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {totalSeleccionados} seleccionada{totalSeleccionados !== 1 ? 's' : ''} para eliminar
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9 px-4 text-xs" onClick={onClose} disabled={eliminando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-9 px-4 text-xs gap-1.5"
              disabled={totalSeleccionados === 0 || eliminando}
              onClick={() => onEliminar([...seleccionados])}
            >
              {eliminando
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Eliminando...</>
                : <><Trash2 className="w-3.5 h-3.5" /> Eliminar {totalSeleccionados}</>
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Formulario de edición inline ──────────────────────────────────────────────
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

// ── Componente principal ───────────────────────────────────────────────────────
export default function ListaNominas({ esAdmin }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
  const [editandoId, setEditandoId] = useState(null);
  const [confirmarBorrarId, setConfirmarBorrarId] = useState(null);
  const [modalDuplicados, setModalDuplicados] = useState(false);
  const [eliminandoDuplicados, setEliminandoDuplicados] = useState(false);

  const queryClient = useQueryClient();

  const { data: nominas = [], isLoading } = useQuery({
    queryKey: ['nominas'],
    queryFn: () => base44.entities.Nomina.list('-created_date', 500),
  });

  // Detectar duplicados sobre TODAS las nóminas (sin filtro)
  const gruposDuplicados = useMemo(() => detectarDuplicados(nominas), [nominas]);

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

  const handleEliminarDuplicados = async (ids) => {
    setEliminandoDuplicados(true);
    for (const id of ids) {
      await base44.entities.Nomina.delete(id);
    }
    queryClient.invalidateQueries({ queryKey: ['nominas'] });
    setEliminandoDuplicados(false);
    setModalDuplicados(false);
  };

  const nominasFiltradas = nominas.filter(n => {
    const coincideBusqueda = !busqueda ||
      (n.operario_name || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (n.operario_dni || '').toLowerCase().includes(busqueda.toLowerCase());
    const coincideMes = !filtroMes || n.mes === parseInt(filtroMes);
    const coincideAnio = !filtroAnio || n.anio === parseInt(filtroAnio);
    return coincideBusqueda && coincideMes && coincideAnio;
  });

  // IDs de nóminas duplicadas para resaltado visual
  const idsDuplicados = useMemo(() => {
    const ids = new Set();
    gruposDuplicados.forEach(g => g.forEach(n => ids.add(n.id)));
    return ids;
  }, [gruposDuplicados]);

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
      {/* Banner de duplicados — solo para admin */}
      {esAdmin && gruposDuplicados.length > 0 && (
        <AlertaDuplicados
          grupos={gruposDuplicados}
          onVerDuplicados={() => setModalDuplicados(true)}
        />
      )}

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
              {lote.nominas.map(nom => {
                const esDuplicado = idsDuplicados.has(nom.id);
                return (
                  <div key={nom.id}>
                    <div className={`flex items-center gap-3 px-4 py-3 transition-colors
                      ${esDuplicado ? 'bg-red-50/60 dark:bg-red-950/10' : 'hover:bg-muted/20'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                        ${esDuplicado ? 'bg-red-100 dark:bg-red-900/40' : 'bg-primary/10'}`}>
                        {esDuplicado
                          ? <Copy className="w-4 h-4 text-red-500" />
                          : <User className="w-4 h-4 text-primary" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{nom.operario_name || 'Sin asignar'}</p>
                          {esDuplicado && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">DUP</Badge>
                          )}
                        </div>
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
                              variant="ghost" size="icon"
                              className="w-8 h-8 text-muted-foreground hover:text-foreground"
                              title="Editar"
                              onClick={() => setEditandoId(editandoId === nom.id ? null : nom.id)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {confirmarBorrarId === nom.id ? (
                              <div className="flex items-center gap-1">
                                <Button variant="destructive" size="icon" className="w-8 h-8"
                                  onClick={() => deleteMutation.mutate(nom.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setConfirmarBorrarId(null)}>
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="icon"
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

                    {esAdmin && editandoId === nom.id && (
                      <EditForm
                        nom={nom}
                        onSave={(data) => updateMutation.mutate({ id: nom.id, data })}
                        onCancel={() => setEditandoId(null)}
                        saving={updateMutation.isPending}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal de duplicados */}
      {modalDuplicados && (
        <ModalDuplicados
          grupos={gruposDuplicados}
          onClose={() => setModalDuplicados(false)}
          onEliminar={handleEliminarDuplicados}
          eliminando={eliminandoDuplicados}
        />
      )}
    </div>
  );
}