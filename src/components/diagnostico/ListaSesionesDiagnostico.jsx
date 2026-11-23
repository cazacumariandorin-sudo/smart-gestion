import React, { useState, useMemo } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';

const TIPO_LABEL = {
  error_auto: 'Auto',
  pantalla_blanca: 'Pantalla blanca',
  reporte_manual: 'Manual',
  timeout_red: 'Red lenta',
  crash_js: 'Crash JS',
  rechazo_promesa: 'Promesa'
};

const SEVERIDAD_COLOR = {
  critico: 'bg-red-500 text-white',
  error: 'bg-orange-500 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-slate-400 text-white'
};

const ESTADO_BADGE = {
  nuevo: 'bg-red-50 text-red-700 border-red-200',
  revisado: 'bg-blue-50 text-blue-700 border-blue-200',
  en_proceso: 'bg-amber-50 text-amber-700 border-amber-200',
  resuelto: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ignorado: 'bg-slate-50 text-slate-500 border-slate-200'
};

function formatearFecha(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}

export default function ListaSesionesDiagnostico({ sesiones, loading, onSelect, selectedId, onUpdate }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  const PENDIENTES = ['nuevo', 'en_proceso', 'revisado'];

  // Usuarios con sus conteos de errores pendientes (no resueltos/ignorados)
  const usuariosConErrores = useMemo(() => {
    const mapa = new Map();
    sesiones.forEach(s => {
      if (s.estado === 'resuelto' || s.estado === 'ignorado') return;
      const email = s.user_email || 'anónimo';
      if (!mapa.has(email)) mapa.set(email, { email, pendientes: 0, total: 0 });
      mapa.get(email).pendientes += PENDIENTES.includes(s.estado) ? 1 : 0;
      mapa.get(email).total += 1;
    });
    return Array.from(mapa.values()).sort((a, b) => b.pendientes - a.pendientes);
  }, [sesiones]);

  const totalPendientes = usuariosConErrores.reduce((acc, u) => acc + u.pendientes, 0);

  const filtradas = useMemo(() => {
    return sesiones.filter(s => {
      if (filtroTipo && s.tipo !== filtroTipo) return false;
      if (filtroEstado && s.estado !== filtroEstado) return false;
      if (filtroUsuario) {
        const email = s.user_email || 'anónimo';
        if (email !== filtroUsuario) return false;
      }
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const texto = `${s.user_email} ${s.mensaje_error} ${s.ruta} ${s.navegador} ${s.sistema_operativo}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [sesiones, busqueda, filtroTipo, filtroEstado, filtroUsuario]);

  const tipos = [...new Set(sesiones.map(s => s.tipo))];
  const estados = ['nuevo', 'revisado', 'en_proceso', 'resuelto', 'ignorado'];

  if (loading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Cargando incidentes...</div>;
  }

  if (sesiones.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-slate-200 rounded-md">
        <p className="text-sm text-muted-foreground">No hay incidentes registrados todavía.</p>
        <p className="text-xs text-muted-foreground mt-1">Los fallos capturados automáticamente aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Buscador */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por email, error, ruta..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <MobileSelect
          value={filtroUsuario || '__todos'}
          onValueChange={(v) => setFiltroUsuario(v === '__todos' ? '' : v)}
          placeholder="Todos los usuarios"
          triggerClassName="text-xs flex-1 min-w-[140px]"
        >
          <MobileSelectItem value="__todos">Todos los usuarios ({totalPendientes} pend.)</MobileSelectItem>
          {usuariosConErrores.map(u => (
            <MobileSelectItem key={u.email} value={u.email}>
              {u.email} ({u.pendientes} pend.)
            </MobileSelectItem>
          ))}
        </MobileSelect>
        <MobileSelect
          value={filtroTipo || '__todos'}
          onValueChange={(v) => setFiltroTipo(v === '__todos' ? '' : v)}
          placeholder="Todos los tipos"
          triggerClassName="text-xs"
        >
          <MobileSelectItem value="__todos">Todos los tipos</MobileSelectItem>
          {tipos.map(t => <MobileSelectItem key={t} value={t}>{TIPO_LABEL[t] || t}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect
          value={filtroEstado || '__todos'}
          onValueChange={(v) => setFiltroEstado(v === '__todos' ? '' : v)}
          placeholder="Todos los estados"
          triggerClassName="text-xs"
        >
          <MobileSelectItem value="__todos">Todos los estados</MobileSelectItem>
          {estados.map(e => <MobileSelectItem key={e} value={e}>{e}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      <p className="text-xs text-muted-foreground">{filtradas.length} de {sesiones.length} incidentes</p>

      {/* Lista */}
      <div className="space-y-2">
        {filtradas.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className={cn(
              'w-full text-left rounded-lg border p-3 hover:shadow-sm transition bg-card',
              selectedId === s.id ? 'border-primary ring-1 ring-primary' : 'border-border'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', SEVERIDAD_COLOR[s.severidad] || SEVERIDAD_COLOR.info)}>
                    {s.severidad}
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {TIPO_LABEL[s.tipo] || s.tipo}
                  </span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', ESTADO_BADGE[s.estado] || '')}>
                    {s.estado}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground truncate">{s.mensaje_error || 'Sin mensaje'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {s.user_email} · {s.ruta} · {formatearFecha(s.created_date)}
                </p>
                <p className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
                  {s.navegador} · {s.sistema_operativo} {s.dispositivo_modelo ? `· ${s.dispositivo_modelo}` : ''} {s.calidad_red ? `· ${s.calidad_red}` : ''}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}