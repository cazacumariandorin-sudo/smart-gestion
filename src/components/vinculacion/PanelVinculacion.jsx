import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sellarEmpresa } from '@/lib/empresaActiva';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  User, Link as LinkIcon, AlertTriangle, CheckCircle, Clock, 
  Search, RefreshCw, Calendar, Shield, UserCheck 
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import VinculacionModal from './VinculacionModal';

export default function PanelVinculacion() {
  const qc = useQueryClient();
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [mostrarExpandidos, setMostrarExpandidos] = useState(false);

  // Cargar usuarios pendientes
  const { data: usuariosPendientes = [], isLoading: loadingPendientes } = useQuery({
    queryKey: ['usuarios-pendientes-vinculacion'],
    queryFn: async () => {
      const all = await base44.entities.User.list('-fecha_registro', 500);
      return all.filter(u => 
        u.vinculo_estado === 'pendiente' && 
        u.tipo_cuenta !== 'demo' &&
        u.role !== 'usuario_demo'
      ).sort((a, b) => {
        // Ordenar por fecha límite (más urgente primero)
        const aDate = a.fecha_limite_vinculacion ? new Date(a.fecha_limite_vinculacion) : new Date();
        const bDate = b.fecha_limite_vinculacion ? new Date(b.fecha_limite_vinculacion) : new Date();
        return aDate - bDate;
      });
    },
  });

  // Cargar usuarios ya vinculados
  const { data: usuariosVinculados = [] } = useQuery({
    queryKey: ['usuarios-vinculados'],
    queryFn: async () => {
      const all = await base44.entities.User.list('-vinculo_fecha', 500);
      return all.filter(u => 
        ['vinculado', 'auto_vinculado'].includes(u.vinculo_estado)
      );
    },
  });

  // Cargar operarios para sugerencias
  const { data: operarios = [] } = useQuery({
    queryKey: ['todos-operarios'],
    queryFn: () => base44.entities.Operario.list('-name', 500),
  });

  // Función para comprobar vinculaciones automáticas
  const comprobarAutomaticas = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      const now = new Date();
      const resultados = { automaticos: 0, recordatorios: 0, temporales: 0 };

      for (const usuario of usuariosPendientes) {
        if (!usuario.fecha_limite_vinculacion) continue;

        const limite = new Date(usuario.fecha_limite_vinculacion);
        const diasRestantes = Math.ceil((limite.getTime() - now.getTime()) / 86400000);

        // PASO A: Ha pasado el límite → auto-vincular
        if (limite < now && usuario.tipo_cuenta === 'real') {
          // Buscar operario con email coincidente
          const operarioCoincidente = operarios.find(op => 
            !op.user_id && (op.email?.toLowerCase() === usuario.email?.toLowerCase())
          );

          let operarioId, operarioNombre, tipoVinculo, esTemporal = false;

          // SEGURIDAD: nunca auto-vincular usuarios con roles privilegiados
          const rolesProtegidos = ['admin', 'gerencia', 'director_comercial'];
          if (rolesProtegidos.includes(usuario.role)) {
            console.warn(`[Vinculación] IGNORADO: usuario ${usuario.email} tiene rol privilegiado (${usuario.role}), no se crea operario temporal.`);
            toast.warning(`⚠ ${usuario.email} tiene rol ${usuario.role} — no se auto-vincula como operario`);
            continue;
          }

          if (operarioCoincidente) {
            // Vincular con operario existente
            await base44.entities.Operario.update(operarioCoincidente.id, {
              user_id: usuario.id,
              user_email: usuario.email,
              user_vinculado_nombre: usuario.full_name || usuario.email,
              vinculacion_tipo: 'automatico_7dias',
              vinculacion_fecha: now.toISOString(),
            });
            operarioId = operarioCoincidente.id;
            operarioNombre = operarioCoincidente.name;
            tipoVinculo = 'operario';
          } else {
            // Crear operario temporal — role: 'operario' es solo del Operario, NUNCA del User
            const nuevoOperario = await base44.entities.Operario.create(sellarEmpresa({
              name: `Operario Temporal - ${usuario.email}`,
              email: usuario.email,
              user_id: usuario.id,
              user_email: usuario.email,
              active: true,
              es_temporal: true,
              vinculacion_tipo: 'automatico_7dias',
              vinculacion_fecha: now.toISOString(),
              role: 'operario', // campo del Operario, NO modifica el User.role
            }));
            operarioId = nuevoOperario.id;
            operarioNombre = nuevoOperario.name;
            tipoVinculo = 'operario_temporal';
            esTemporal = true;
            resultados.temporales++;
          }

          // Actualizar usuario — NO incluir role aquí, solo campos de vínculo
          await base44.entities.User.update(usuario.id, {
            vinculo_id: operarioId,
            vinculo_nombre: operarioNombre,
            vinculo_email: usuario.email,
            vinculo_tipo: tipoVinculo,
            vinculo_estado: 'auto_vinculado',
            vinculo_fecha: now.toISOString(),
            vinculo_asignado_por: 'sistema_automatico',
          });

          // Crear log
          await base44.entities.VinculacionLog.create({
            usuario_id: usuario.id,
            usuario_email: usuario.email,
            usuario_nombre: usuario.full_name || usuario.email,
            accion: 'vinculo_automatico',
            operario_id_nuevo: operarioId,
            operario_nombre: operarioNombre,
            tipo_vinculo: tipoVinculo,
            dias_transcurridos: differenceInDays(now, new Date(usuario.fecha_registro || now)),
            realizado_por_email: user.email,
            realizado_por_rol: user.role,
            timestamp: now.toISOString(),
            motivo: esTemporal ? 'No se encontró operario coincidente - creado temporal' : 'Coincidencia automática por email',
          });

          resultados.automaticos++;
          toast.success(esTemporal 
            ? `⚠ ${usuario.email} auto-vinculado como OPERARIO TEMPORAL`
            : `${usuario.email} vinculado automáticamente con ${operarioNombre}`
          );
        }

        // PASO B: Recordatorio urgente (≤2 días)
        else if (diasRestantes <= 2 && diasRestantes > 0 && !usuario.vinculo_recordatorio_enviado) {
          await base44.entities.User.update(usuario.id, {
            vinculo_recordatorio_enviado: true,
            vinculo_recordatorio_fecha: now.toISOString(),
          });

          await base44.entities.VinculacionLog.create({
            usuario_id: usuario.id,
            usuario_email: usuario.email,
            usuario_nombre: usuario.full_name || usuario.email,
            accion: 'recordatorio_enviado',
            tipo_vinculo: usuario.vinculo_tipo || 'sin_vincular',
            dias_transcurridos: differenceInDays(now, new Date(usuario.fecha_registro || now)),
            timestamp: now.toISOString(),
          });

          resultados.recordatorios++;
          toast.warning(`🔴 URGENTE: ${usuario.email} lleva ${diasRestantes} días sin vincular`);
        }
      }

      return resultados;
    },
    onSuccess: (resultados) => {
      qc.invalidateQueries({ queryKey: ['usuarios-pendientes-vinculacion'] });
      qc.invalidateQueries({ queryKey: ['usuarios-vinculados'] });
      qc.invalidateQueries({ queryKey: ['operarios'] });
    },
  });

  // Filtrar usuarios
  const usuariosFiltrados = usuariosPendientes.filter(u =>
    u.email.toLowerCase().includes(filtro.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(filtro.toLowerCase()))
  );

  const handleAbrirModal = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setModalAbierto(true);
  };

  const getDiasRestantesBadge = (usuario) => {
    if (!usuario.fecha_limite_vinculacion) return null;
    const dias = Math.ceil((new Date(usuario.fecha_limite_vinculacion).getTime() - Date.now()) / 86400000);
    
    if (dias <= 2) {
      return <Badge variant="destructive" className="text-xs">Urgente: {dias}d</Badge>;
    } else if (dias <= 4) {
      return <Badge variant="secondary" className="text-xs bg-orange-500 text-white">{dias}d</Badge>;
    } else {
      return <Badge variant="outline" className="text-xs text-green-600 border-green-600">{dias}d</Badge>;
    }
  };

  const getSugerenciaOperario = (usuario) => {
    const coincidencia = operarios.find(op => op.email?.toLowerCase() === usuario.email?.toLowerCase());
    if (coincidencia) {
      return (
        <div className="flex items-center gap-1 text-xs">
          <CheckCircle className="w-3 h-3 text-green-600" />
          <span className="text-green-700 dark:text-green-300 font-medium">{coincidencia.name}</span>
          {coincidencia.num_empleado && (
            <span className="font-mono bg-primary/10 text-primary rounded px-1 py-0.5 text-[10px]">{coincidencia.num_empleado}</span>
          )}
          <Badge variant="outline" className="text-[10px]">Email exacto ✓</Badge>
        </div>
      );
    }
    return <span className="text-xs text-muted-foreground">Sin coincidencia — selección manual</span>;
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" />
                Vinculación de Usuarios
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Gestiona la vinculación de usuarios con operarios y clientes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={usuariosPendientes.length > 0 ? "destructive" : "outline"}>
                {usuariosPendientes.length} pendientes
              </Badge>
              <Button
                size="sm"
                onClick={() => comprobarAutomaticas.mutate()}
                disabled={comprobarAutomaticas.isPending}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${comprobarAutomaticas.isPending ? 'animate-spin' : ''}`} />
                Comprobar auto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Estadísticas rápidas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="text-xs text-green-700 dark:text-green-300 font-medium">Vinculados manual</div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                {usuariosVinculados.filter(u => u.vinculo_estado === 'vinculado').length}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <div className="text-xs text-orange-700 dark:text-orange-300 font-medium">Auto-vinculados</div>
              <div className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                {usuariosVinculados.filter(u => u.vinculo_estado === 'auto_vinculado').length}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="text-xs text-red-700 dark:text-red-300 font-medium">Pendientes</div>
              <div className="text-2xl font-bold text-red-800 dark:text-red-200">
                {usuariosPendientes.length}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">Temporales</div>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {usuariosVinculados.filter(u => u.vinculo_tipo === 'operario_temporal').length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de pendientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios Pendientes de Vinculación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtro */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email o nombre..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="pl-10"
            />
          </div>

          {loadingPendientes ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No hay usuarios pendientes de vinculación</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Usuario</th>
                    <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Cargo</th>
                    <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Acceso hasta</th>
                    <th className="text-left py-3 px-4 font-medium">Días restantes</th>
                    <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">Operario sugerido</th>
                    <th className="text-left py-3 px-4 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map(u => {
                    const fechaRegistro = u.fecha_registro ? new Date(u.fecha_registro) : null;
                    return (
                      <tr 
                        key={u.id} 
                        className={`border-t border-border hover:bg-muted/30 transition-colors ${
                          u.fecha_limite_vinculacion && 
                          Math.ceil((new Date(u.fecha_limite_vinculacion).getTime() - Date.now()) / 86400000) <= 2
                            ? 'bg-red-50/50 dark:bg-red-950/10'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium">{u.email}</div>
                          {fechaRegistro && (
                            <div className="text-xs text-muted-foreground">
                              Registrado: {format(fechaRegistro, 'd MMM yyyy', { locale: es })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          {u.cargo ? (
                            <Badge variant="outline" className="text-xs">{u.cargo}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <Badge variant={u.tipo_cuenta === 'demo' ? 'secondary' : 'outline'} className="text-xs capitalize">
                            {u.tipo_cuenta || 'real'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          {u.acceso_hasta ? (
                            <div className="text-xs">
                              {format(new Date(u.acceso_hasta), 'd MMM yyyy', { locale: es })}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {getDiasRestantesBadge(u)}
                        </td>
                        <td className="py-3 px-4 hidden lg:table-cell">
                          {getSugerenciaOperario(u)}
                        </td>
                        <td className="py-3 px-4">
                          <Button 
                            size="sm" 
                            onClick={() => handleAbrirModal(u)}
                            className="gap-1"
                          >
                            <LinkIcon className="w-3 h-3" />
                            Vincular
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de vinculados (colapsable) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Usuarios Ya Vinculados</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMostrarExpandidos(!mostrarExpandidos)}
              className="gap-2"
            >
              {mostrarExpandidos ? 'Ocultar' : 'Mostrar'} ({usuariosVinculados.length})
            </Button>
          </div>
        </CardHeader>
        {mostrarExpandidos && (
          <CardContent>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Usuario</th>
                    <th className="text-left py-3 px-4 font-medium">Vinculado con</th>
                    <th className="text-left py-3 px-4 font-medium">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium">Cómo</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosVinculados.map(u => (
                    <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{u.email}</td>
                      <td className="py-3 px-4">{u.vinculo_nombre || '—'}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {u.vinculo_tipo === 'operario_temporal' ? 'Operario' : u.vinculo_tipo}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {u.vinculo_fecha ? format(new Date(u.vinculo_fecha), 'd MMM', { locale: es }) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {u.vinculo_estado === 'auto_vinculado' ? (
                          <Badge variant="secondary" className="text-xs">Auto 7d</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Manual</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Modal de vinculación */}
      <VinculacionModal
        open={modalAbierto}
        onClose={() => {
          setModalAbierto(false);
          setUsuarioSeleccionado(null);
        }}
        usuario={usuarioSeleccionado}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['usuarios-pendientes-vinculacion'] });
          qc.invalidateQueries({ queryKey: ['usuarios-vinculados'] });
          qc.invalidateQueries({ queryKey: ['operarios'] });
        }}
      />
    </div>
  );
}