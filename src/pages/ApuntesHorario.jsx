import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList, Plus, Search, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const EMPTY_FORM = {
  operario_id: '',
  operario_name: '',
  date: new Date().toISOString().split('T')[0],
  obra_id: '',
  obra_name: '',
  concepto: '',
  unidad: '',
  cantidad: '',
  precio_unitario: '',
  notas: '',
};

export default function ApuntesHorario() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterOperario, setFilterOperario] = useState('');
  const [filterObra, setFilterObra] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [currentUser, setCurrentUser] = useState(null);

  useState(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
    }).catch(() => {});
  });

  const { data: apuntes = [], isLoading } = useQuery({
    queryKey: ['apuntes-horario'],
    queryFn: () => base44.entities.ApunteHorario.list('-date', 200),
  });

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios-list'],
    queryFn: () => base44.entities.Operario.list('name', 100),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-list'],
    queryFn: () => base44.entities.Obra.list('name', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ApunteHorario.create({
      ...data,
      cantidad: parseFloat(data.cantidad) || 0,
      precio_unitario: data.precio_unitario ? parseFloat(data.precio_unitario) : undefined,
      total: data.cantidad && data.precio_unitario ? parseFloat(data.cantidad) * parseFloat(data.precio_unitario) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apuntes-horario'] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ApunteHorario.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['apuntes-horario'] }),
  });

  const allOperarios = [...new Set(apuntes.map(a => a.operario_name).filter(Boolean))];
  const allObras = [...new Set(apuntes.map(a => a.obra_name).filter(Boolean))];

  const filtrados = apuntes.filter(a => {
    const matchSearch = !search || a.concepto?.toLowerCase().includes(search.toLowerCase());
    const matchOp = !filterOperario || a.operario_name === filterOperario;
    const matchObra = !filterObra || a.obra_name === filterObra;
    return matchSearch && matchOp && matchObra;
  });

  const totalImporte = filtrados.reduce((sum, a) => sum + (a.total || 0), 0);

  const handleOperarioChange = (e) => {
    const op = operarios.find(o => o.id === e.target.value);
    setForm(f => ({ ...f, operario_id: e.target.value, operario_name: op?.name || '' }));
  };

  const handleObraChange = (e) => {
    const obra = obras.find(o => o.id === e.target.value);
    setForm(f => ({ ...f, obra_id: e.target.value, obra_name: obra?.name || '' }));
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Apuntes de Trabajo</h1>
          <Badge variant="outline" className="text-xs">{filtrados.length} apuntes</Badge>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nuevo apunte
        </Button>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-sm mb-3">Nuevo apunte</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Operario *</label>
                <select value={form.operario_id} onChange={handleOperarioChange}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="">Seleccionar...</option>
                  {operarios.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fecha *</label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Obra</label>
                <select value={form.obra_id} onChange={handleObraChange}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                  <option value="">Sin obra</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Concepto *</label>
                <Input placeholder="Descripción del trabajo..." value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Unidad</label>
                <Input placeholder="m², ud, kg..." value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cantidad *</label>
                <Input type="number" placeholder="0" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Precio unitario (€)</label>
                <Input type="number" placeholder="0.00" value={form.precio_unitario} onChange={e => setForm(f => ({ ...f, precio_unitario: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Total estimado</label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm font-medium">
                  {form.cantidad && form.precio_unitario ? (parseFloat(form.cantidad) * parseFloat(form.precio_unitario)).toFixed(2) + ' €' : '—'}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Notas</label>
                <Input placeholder="Observaciones..." value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancelar</Button>
              <Button size="sm" onClick={() => createMutation.mutate(form)}
                disabled={!form.operario_id || !form.concepto || !form.cantidad || createMutation.isPending}>
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar concepto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {allOperarios.length > 0 && (
          <select value={filterOperario} onChange={e => setFilterOperario(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm">
            <option value="">Todos los operarios</option>
            {allOperarios.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        )}
        {allObras.length > 0 && (
          <select value={filterObra} onChange={e => setFilterObra(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm">
            <option value="">Todas las obras</option>
            {allObras.map(ob => <option key={ob} value={ob}>{ob}</option>)}
          </select>
        )}
        {(search || filterOperario || filterObra) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterOperario(''); setFilterObra(''); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpiar
          </Button>
        )}
        {totalImporte > 0 && (
          <Badge className="ml-auto bg-primary/10 text-primary font-semibold">Total: {totalImporte.toFixed(2)} €</Badge>
        )}
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No hay apuntes registrados</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Operario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Obra</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Concepto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Cantidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Ud.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">€/ud</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(a => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {a.date ? format(new Date(a.date), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{a.operario_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.obra_name || '—'}</td>
                  <td className="px-4 py-3">{a.concepto}</td>
                  <td className="px-4 py-3 text-right">{a.cantidad}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.unidad || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {a.precio_unitario != null ? a.precio_unitario.toFixed(2) + ' €' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {a.total != null ? a.total.toFixed(2) + ' €' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(a.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}