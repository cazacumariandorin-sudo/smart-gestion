import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Eye, Square, Play, Clock, User, FileSearch, GitCompare, AlertCircle, CheckCircle2, XCircle, CalendarRange } from 'lucide-react';
import VigilanciaEventosView from '@/components/diagnostico/VigilanciaEventosView';
import VigilanciaComparativa from '@/components/diagnostico/VigilanciaComparativa';
import VigilanciaInformePeriodoDialog from '@/components/diagnostico/VigilanciaInformePeriodoDialog';

const LLAMAR = (action, payload = {}) =>
  base44.functions.invoke('gestionVigilanciaDiagnostico', { action, ...payload }).then(r => r?.data || r);

export default function VigilanciaPanel({ esGerencia }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [motivo, setMotivo] = useState('');
  const [duracionHoras, setDuracionHoras] = useState(48);
  const [esComparativa, setEsComparativa] = useState(false);
  const [compararConVigId, setCompararConVigId] = useState('');
  const [vistaEventosId, setVistaEventosId] = useState(null);
  const [modoComparativa, setModoComparativa] = useState(false);
  const [vigA, setVigA] = useState('');
  const [vigB, setVigB] = useState('');
  const [showInformePeriodo, setShowInformePeriodo] = useState(false);

  const { data: usuariosData } = useQuery({
    queryKey: ['vig-usuarios'],
    queryFn: () => LLAMAR('listar_usuarios'),
    enabled: esGerencia && showForm
  });

  const { data: listData, isLoading, refetch } = useQuery({
    queryKey: ['vig-lista'],
    queryFn: () => LLAMAR('listar'),
    enabled: esGerencia,
    refetchInterval: 30_000
  });

  const activas = listData?.activas || [];
  const recientes = listData?.recientes || [];
  const limite = listData?.limite || 3;

  const iniciarMutation = useMutation({
    mutationFn: (payload) => LLAMAR('iniciar', payload),
    onSuccess: () => {
      toast({ title: 'Vigilancia activada ✓', description: 'Se grabará la telemetría del usuario durante las próximas horas.' });
      setShowForm(false);
      setUserEmail(''); setMotivo(''); setEsComparativa(false); setCompararConVigId('');
      qc.invalidateQueries({ queryKey: ['vig-lista'] });
    },
    onError: (e) => toast({ variant: 'destructive', title: 'No se pudo activar', description: e.message || 'Error' })
  });

  const finalizarMutation = useMutation({
    mutationFn: ({ vigilancia_id, cancelar }) => LLAMAR('finalizar', { vigilancia_id, cancelar }),
    onSuccess: () => {
      toast({ title: 'Vigilancia finalizada ✓' });
      qc.invalidateQueries({ queryKey: ['vig-lista'] });
    },
    onError: (e) => toast({ variant: 'destructive', title: 'Error', description: e.message })
  });

  const submitIniciar = (e) => {
    e.preventDefault();
    if (!userEmail) return toast({ variant: 'destructive', title: 'Selecciona un usuario' });
    iniciarMutation.mutate({
      user_email: userEmail,
      motivo,
      duracion_horas: duracionHoras || 48,
      es_comparativa: esComparativa,
      comparativa_con_vigilancia_id: esComparativa ? compararConVigId || null : null
    });
  };

  if (!esGerencia) {
    return (
      <div className="text-xs text-muted-foreground p-4 text-center">
        Solo Gerencia/Admin puede gestionar vigilancias activas.
      </div>
    );
  }

  if (vistaEventosId) {
    return (
      <VigilanciaEventosView
        vigilanciaId={vistaEventosId}
        onBack={() => setVistaEventosId(null)}
      />
    );
  }

  if (modoComparativa) {
    return (
      <VigilanciaComparativa
        vigAId={vigA}
        vigBId={vigB}
        onBack={() => setModoComparativa(false)}
        onSelectA={setVigA}
        onSelectB={setVigB}
        activas={activas}
      />
    );
  }

  const usuarios = usuariosData?.usuarios || [];
  const usuariosFiltrados = usuarios.filter(u => u.email !== '');

  return (
    <div className="space-y-3">
      {/* Cabecera de control */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={activas.length >= limite ? 'destructive' : 'secondary'}>
            {activas.length}/{limite} activas
          </Badge>
          <span className="text-muted-foreground">Máx. 3 simultáneas · máx. 48h</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setShowInformePeriodo(true)}>
            <CalendarRange className="w-3.5 h-3.5 mr-1" /> Informe de periodo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setModoComparativa(true)} disabled={activas.length < 2}>
            <GitCompare className="w-3.5 h-3.5 mr-1" /> Comparar
          </Button>
          <Button size="sm" onClick={() => setShowForm(s => !s)} disabled={activas.length >= limite}>
            <Play className="w-3.5 h-3.5 mr-1" /> Activar
          </Button>
        </div>
      </div>

      <VigilanciaInformePeriodoDialog
        open={showInformePeriodo}
        onClose={() => setShowInformePeriodo(false)}
        generadoPor={undefined}
      />

      {activas.length >= limite && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Límite de {limite} vigilancias activas alcanzado. Finaliza una antes de activar otra.
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Activar vigilancia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={submitIniciar} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Usuario objetivo</Label>
                {usuariosFiltrados.length > 0 ? (
                  <select
                    className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={userEmail}
                    onChange={e => setUserEmail(e.target.value)}
                  >
                    <option value="">— Selecciona —</option>
                    {usuariosFiltrados.map(u => (
                      <option key={u.id} value={u.email}>
                        {u.full_name || u.email} ({u.role || 'sin rol'}) — {u.email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value={userEmail} onChange={e => setUserEmail(e.target.value)} placeholder="email@simantec.es" />
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Motivo (interno)</Label>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: depurar pantalla blanca del técnico Jorge" rows={2} />
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs">Duración (horas, máx. 48)</Label>
                <Input type="number" min={1} max={48} value={duracionHoras}
                  onChange={e => setDuracionHoras(Math.min(48, Math.max(1, Number(e.target.value) || 48)))}
                  className="w-24" />
              </div>

              <div className="flex items-center gap-2 pt-1 border-t">
                <Switch checked={esComparativa} onCheckedChange={setEsComparativa} id="vig-comp" />
                <Label htmlFor="vig-comp" className="text-xs">Es comparativa con otra vigilancia (mismo rol)</Label>
              </div>

              {esComparativa && (
                <div className="space-y-1">
                  <Label className="text-xs">Comparar con (vigilancia activa)</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={compararConVigId}
                    onChange={e => setCompararConVigId(e.target.value)}
                  >
                    <option value="">— Selecciona —</option>
                    {activas.filter(v => v.user_role_snapshot).map(v => (
                      <option key={v.id} value={v.id}>
                        {v.user_full_name || v.user_email} (rol: {v.user_role_snapshot})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={iniciarMutation.isPending}>
                  {iniciarMutation.isPending ? 'Activando…' : 'Activar vigilancia'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Vigilancias activas */}
      <div className="space-y-2">
        {isLoading && <div className="text-xs text-muted-foreground">Cargando…</div>}
        {!isLoading && activas.length === 0 && !showForm && (
          <div className="text-center py-6 text-xs text-muted-foreground">
            <Eye className="w-5 h-5 mx-auto mb-1 opacity-40" />
            No hay vigilancias activas.
          </div>
        )}
        {activas.map(v => (
          <Card key={v.id} className="border-l-2 border-l-blue-500">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium text-sm truncate">{v.user_full_name || v.user_email}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {v.user_email} · rol: {v.user_role_snapshot || '?'}
                  </div>
                </div>
                <Badge variant={v.es_comparativa ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                  {v.es_comparativa ? 'Comparativa' : 'Diagnóstico'}
                </Badge>
              </div>
              {v.motivo && <div className="text-[11px] text-muted-foreground italic line-clamp-2">“{v.motivo}”</div>}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <CuentaAtras fechaFin={v.fecha_fin_prevista} />
                </div>
                <span>{v.eventos_count || 0} eventos</span>
              </div>
              <div className="flex gap-1 pt-1">
                <Button size="sm" variant="outline" onClick={() => setVistaEventosId(v.id)}>
                  <FileSearch className="w-3 h-3 mr-1" /> Ver eventos
                </Button>
                <Button size="sm" variant="ghost" className="text-amber-700"
                  onClick={() => finalizarMutation.mutate({ vigilancia_id: v.id, cancelar: false })}>
                  <Square className="w-3 h-3 mr-1" /> Finalizar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recientes / históricas */}
      {recientes.length > 0 && (
        <div className="space-y-1 pt-3 border-t">
          <div className="text-xs font-medium text-muted-foreground">Vigilancias recientes</div>
          {recientes.slice(0, 8).map(v => (
            <div key={v.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded hover:bg-muted/50">
              <span className="truncate">{v.user_full_name || v.user_email}</span>
              <div className="flex items-center gap-1.5">
                <EstadoIcon estado={v.estado} />
                <span className="text-muted-foreground">{v.eventos_count || 0} ev.</span>
                <Button size="sm" variant="ghost" className="h-6" onClick={() => setVistaEventosId(v.id)}>
                  <FileSearch className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CuentaAtras({ fechaFin }) {
  const restante = (() => {
    const ms = new Date(fechaFin).getTime() - Date.now();
    if (ms <= 0) return 'Expirada';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  })();
  return <span>{restante}</span>;
}

function EstadoIcon({ estado }) {
  if (estado === 'finalizada') return <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
  if (estado === 'cancelada' || estado === 'expirada') return <XCircle className="w-3 h-3 text-amber-600" />;
  return <Clock className="w-3 h-3 text-muted-foreground" />;
}