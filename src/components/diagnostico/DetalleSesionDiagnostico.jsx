import React, { useState, useEffect } from 'react';
import { X, Smartphone, Wifi, Battery, Monitor, Code, MessageSquareText, History, ClipboardList, Download, Copy, Check, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ESTADOS = ['nuevo', 'revisado', 'en_proceso', 'resuelto', 'ignorado'];

const SEVERIDAD_COLOR = {
  critico: 'bg-red-500 text-white',
  error: 'bg-orange-500 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-slate-400 text-white'
};

function FilaDato({ icon: Icon, label, value }) {
  if (!value && value !== 0 && value !== false) return null;
  return (
    <div className="flex items-start gap-2 py-1 border-b border-border/40 last:border-0">
      <Icon className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-xs font-mono">{value === null ? '—' : value === true ? 'sí' : value === false ? 'no' : String(value)}</div>
      </div>
    </div>
  );
}

export default function DetalleSesionDiagnostico({ sesion, onClose, onUpdate, puedeEditar }) {
  const [estadoLocal, setEstadoLocal] = useState(sesion?.estado || 'nuevo');
  const [comentario, setComentario] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (sesion) {
      setEstadoLocal(sesion.estado || 'nuevo');
      setComentario(sesion.comentario_soporte || '');
    }
  }, [sesion]);

  if (!sesion) return null;

  // Construye un resumen MarkDown con todos los datos del incidente, listo para pegar en un agente IA
  const buildResumenIA = () => {
    const s = sesion;
    const L = [];
    L.push('# 📋 Resumen de incidente — SIMANTEC Diagnóstico');
    L.push('');
    L.push(`- **ID:** ${s.id}`);
    L.push(`- **Fecha:** ${new Date(s.created_date).toLocaleString('es-ES')}`);
    L.push(`- **Severidad:** ${s.severidad || '—'}`);
    L.push(`- **Estado:** ${s.estado || '—'}`);
    L.push('');
    L.push('## 👤 Usuario');
    L.push(`- Email: ${s.user_email || '—'}`);
    L.push(`- Rol: ${s.user_role || '—'}`);
    L.push(`- User ID: ${s.user_id || '—'}`);
    L.push('');
    L.push('## 📍 Contexto');
    L.push(`- Ruta: ${s.ruta || '—'}`);
    L.push(`- Ruta completa: ${s.ruta_completa || '—'}`);
    L.push(`- Última acción: ${s.ultima_accion || '—'}`);
    L.push('');
    L.push('## 💥 Error');
    L.push('```');
    L.push(s.mensaje_error || '—');
    L.push('```');
    if (s.stack_trace) {
      L.push('### Stack trace');
      L.push('```');
      L.push(s.stack_trace);
      L.push('```');
    }
    L.push('');
    L.push('## 💻 Dispositivo');
    L.push(`- Navegador: ${s.navegador || '—'}`);
    L.push(`- SO: ${s.sistema_operativo || '—'}`);
    L.push(`- Modelo: ${s.dispositivo_modelo || '—'}`);
    L.push(`- Resolución: ${s.resolucion_pantalla || '—'}`);
    L.push(`- Viewport: ${s.viewport || '—'}`);
    L.push(`- User-Agent: ${s.user_agent || '—'}`);
    L.push(`- Batería: ${s.nivel_bateria !== null && s.nivel_bateria !== undefined ? Math.round(s.nivel_bateria * 100) + '%' : '—'}`);
    L.push(`- Cargando: ${s.cargando_bateria ? 'sí' : 'no'}`);
    L.push('');
    L.push('## 🌐 Red');
    L.push(`- Calidad: ${s.calidad_red || '—'}`);
    L.push(`- Downlink: ${s.downlink_mbps ?? '—'} Mbps`);
    L.push(`- RTT: ${s.rtt_ms ?? '—'} ms`);
    L.push(`- Online: ${s.online ? 'sí' : 'no'}`);
    L.push(`- Memoria JS: ${s.memoria_uso_mb ?? '—'} MB`);
    L.push(`- Cookies habilitadas: ${s.cookies_habilitadas ? 'sí' : 'no'}`);
    L.push('');
    if (s.notas_usuario) {
      L.push('## 📝 Reporte del usuario');
      L.push(s.notas_usuario);
      L.push('');
    }
    if (s.pasos_reproducir) {
      L.push('## 🔁 Pasos para reproducir');
      L.push(s.pasos_reproducir);
      L.push('');
    }
    if (s.historial_navegacion?.length) {
      L.push('## 🧭 Historial reciente');
      s.historial_navegacion.forEach((h, i) => L.push(`${i + 1}. ${h}`));
      L.push('');
    }
    if (s.comentario_soporte) {
      L.push('## 🛠️ Comentario de soporte');
      L.push(s.comentario_soporte);
      L.push('');
    }
    L.push('---');
    L.push('_Generado por SIMANTEC Diagnóstico_');
    return L.join('\n');
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(buildResumenIA());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // fallback: seleccionar en textarea oculto no disponible → usar descarga
      handleDescargar();
    }
  };

  const handleDescargar = () => {
    const blob = new Blob([buildResumenIA()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidente-${(sesion.id || 'sesion').slice(0, 12)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGuardar = () => {
    onUpdate?.({
      sesion_id: sesion.id,
      estado: estadoLocal,
      comentario_soporte: comentario
    });
  };

  return (
    <Dialog open={!!sesion} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', SEVERIDAD_COLOR[sesion.severidad] || SEVERIDAD_COLOR.info)}>
              {sesion.severidad}
            </span>
            Detalle del incidente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Mensaje principal */}
          <div className="rounded-md bg-muted/40 p-2 border">
            <div className="text-[10px] text-muted-foreground uppercase">Mensaje de error</div>
            <p className="text-xs font-mono break-words mt-1">{sesion.mensaje_error || 'Sin mensaje'}</p>
          </div>

          {/* Usuario + ruta */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-[10px] text-muted-foreground">Usuario</div>
              <div className="font-medium">{sesion.user_email}</div>
              <div className="text-[10px] text-muted-foreground">{sesion.user_role}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Ruta</div>
              <div className="font-mono">{sesion.ruta}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(sesion.created_date).toLocaleString('es-ES')}</div>
            </div>
          </div>

          {/* Datos del dispositivo */}
          <div className="rounded-md border p-2 space-y-0">
            <div className="text-xs font-semibold flex items-center gap-1 mb-1"><Smartphone className="w-3.5 h-3.5" /> Dispositivo</div>
            <FilaDato icon={Monitor} label="Navegador" value={sesion.navegador} />
            <FilaDato icon={Smartphone} label="Sistema operativo" value={sesion.sistema_operativo} />
            <FilaDato icon={Smartphone} label="Modelo" value={sesion.dispositivo_modelo} />
            <FilaDato icon={Monitor} label="Resolución / viewport" value={`${sesion.resolucion_pantalla} / ${sesion.viewport}`} />
            <FilaDato icon={Code} label="User-Agent completo" value={sesion.user_agent} />
            <FilaDato icon={Battery} label="Nivel de batería" value={sesion.nivel_bateria !== null ? `${Math.round(sesion.nivel_bateria * 100)}%` : null} />
          </div>

          {/* Datos de red */}
          <div className="rounded-md border p-2 space-y-0">
            <div className="text-xs font-semibold flex items-center gap-1 mb-1"><Wifi className="w-3.5 h-3.5" /> Red</div>
            <FilaDato icon={Wifi} label="Calidad de red" value={sesion.calidad_red || 'desconocida'} />
            <FilaDato icon={Wifi} label="Velocidad bajada" value={sesion.downlink_mbps ? `${sesion.downlink_mbps} Mbps` : null} />
            <FilaDato icon={Wifi} label="RTT" value={sesion.rtt_ms ? `${sesion.rtt_ms} ms` : null} />
            <FilaDato icon={Wifi} label="Online" value={sesion.online} />
            <FilaDato icon={Code} label="Memoria JS (MB)" value={sesion.memoria_uso_mb} />
            <FilaDato icon={Code} label="Cookies habilitadas" value={sesion.cookies_habilitadas} />
          </div>

          {/* Stack trace */}
          {sesion.stack_trace && (
            <div className="rounded-md border p-2">
              <div className="text-xs font-semibold flex items-center gap-1 mb-1"><Code className="w-3.5 h-3.5" /> Stack trace</div>
              <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto text-muted-foreground">
                {sesion.stack_trace}
              </pre>
            </div>
          )}

          {/* Reporte del usuario */}
          {sesion.notas_usuario && (
            <div className="rounded-md border p-2 bg-amber-50/50">
              <div className="text-xs font-semibold flex items-center gap-1 mb-1"><MessageSquareText className="w-3.5 h-3.5" /> Reporte del usuario</div>
              <p className="text-xs">{sesion.notas_usuario}</p>
            </div>
          )}

          {sesion.pasos_reproducir && (
            <div className="rounded-md border p-2">
              <div className="text-xs font-semibold flex items-center gap-1 mb-1"><ClipboardList className="w-3.5 h-3.5" /> Pasos para reproducir</div>
              <p className="text-xs whitespace-pre-wrap">{sesion.pasos_reproducir}</p>
            </div>
          )}

          {/* Historial de navegación */}
          {sesion.historial_navegacion?.length > 0 && (
            <div className="rounded-md border p-2">
              <div className="text-xs font-semibold flex items-center gap-1 mb-1"><History className="w-3.5 h-3.5" /> Historial reciente</div>
              <ol className="text-[10px] font-mono list-decimal ml-4 space-y-0.5">
                {sesion.historial_navegacion.map((h, i) => <li key={i}>{h}</li>)}
              </ol>
              {sesion.ultima_accion && (
                <p className="text-[10px] font-mono mt-1 text-muted-foreground">Última acción: {sesion.ultima_accion}</p>
              )}
            </div>
          )}

          {/* Gestión del incidente (soporte) */}
          {puedeEditar && (
            <div className="rounded-md border border-primary/30 p-2 space-y-2">
              <div className="text-xs font-semibold">Gestión del incidente</div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Select value={estadoLocal} onValueChange={setEstadoLocal}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Comentario del soporte</Label>
                <Textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  placeholder="Añade notas internas..."
                />
              </div>
              <Button size="sm" onClick={handleGuardar} className="w-full">
                Guardar estado y comentario
              </Button>
              {sesion.revisado_por && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Revisado por {sesion.revisado_por} · {sesion.fecha_revision && new Date(sesion.fecha_revision).toLocaleString('es-ES')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground -mt-1">
            <Sparkles className="w-3 h-3" /> Exporta el resumen completo para pegarlo en un agente IA
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="secondary" onClick={handleCopiar} className="flex-1 gap-1.5">
              {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiado ? 'Copiado ✓' : 'Copiar resumen IA'}
            </Button>
            <Button variant="secondary" onClick={handleDescargar} className="flex-1 gap-1.5">
              <Download className="w-4 h-4" /> Descargar .md
            </Button>
          </div>
          <Button variant="outline" onClick={onClose} className="w-full"><X className="w-4 h-4" /> Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}