import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { CreditCard, ShieldCheck, Archive, RotateCcw, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

/**
 * Panel de gestión de patrones de tarjeta aprendidos por el OCR (solo los 4
 * últimos dígitos). Permite ver qué medios de pago ha reconocido el sistema,
 * confirmarlos como regla fiable (solo entonces se sugiere el origen de pago
 * en el formulario de gasto) o archivarlos sin borrar el histórico.
 */
export default function PatronesTarjetaPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [ocupado, setOcupado] = useState(null);

  const { data: patrones = [], isLoading } = useQuery({
    queryKey: ['patrones_tarjeta'],
    queryFn: () => base44.entities.PatronTarjeta.filter({}, { sort: '-ultima_vez_vista', limit: 200 }),
    select: (data) => (Array.isArray(data) ? data : data?.items || []),
  });

  // La misma tarjeta clasificada de dos formas distintas: no debe usarse como regla.
  const conflictos = useMemo(() => {
    const porDigitos = new Map();
    patrones.forEach(p => {
      if (!p.digitos_finales) return;
      const tipos = porDigitos.get(p.digitos_finales) || new Set();
      tipos.add(p.titular_tipo);
      porDigitos.set(p.digitos_finales, tipos);
    });
    return new Set([...porDigitos.entries()].filter(([, tipos]) => tipos.size > 1).map(([d]) => d));
  }, [patrones]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return patrones.filter(p => {
      if (estado === 'confirmados' && !(p.confirmado && p.activo !== false)) return false;
      if (estado === 'pendientes' && (p.confirmado || p.activo === false)) return false;
      if (estado === 'archivados' && p.activo !== false) return false;
      if (!texto) return true;
      return [p.digitos_finales, p.operario_name, p.notas].filter(Boolean).some(v => String(v).toLowerCase().includes(texto));
    });
  }, [patrones, busqueda, estado]);

  const aplicar = async (patron, cambios, mensaje) => {
    setOcupado(patron.id);
    try {
      await base44.entities.PatronTarjeta.update(patron.id, cambios);
      await queryClient.invalidateQueries({ queryKey: ['patrones_tarjeta'] });
      toast.success(mensaje);
    } catch (err) {
      toast.error('No se pudo actualizar el patrón: ' + err.message);
    } finally {
      setOcupado(null);
    }
  };

  const confirmar = (p) => aplicar(p, { confirmado: true, confirmado_por: user?.email || '', fecha_confirmacion: new Date().toISOString() }, 'Patrón confirmado');
  const archivar = (p) => aplicar(p, { activo: false }, 'Patrón archivado');
  const reactivar = (p) => aplicar(p, { activo: true }, 'Patrón reactivado');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por dígitos, técnico o nota" className="pl-8" />
        </div>
        <MobileSelect value={estado} onValueChange={setEstado} placeholder="Estado" triggerClassName="w-44">
          <MobileSelectItem value="todos">Todos</MobileSelectItem>
          <MobileSelectItem value="confirmados">Confirmados</MobileSelectItem>
          <MobileSelectItem value="pendientes">Pendientes</MobileSelectItem>
          <MobileSelectItem value="archivados">Archivados</MobileSelectItem>
        </MobileSelect>
      </div>

      <p className="text-xs text-muted-foreground">
        Solo se guardan los 4 últimos dígitos de cada tarjeta. Un patrón confirmado clasifica el origen de pago
        automáticamente en los nuevos gastos; uno pendiente no se aplica hasta que gerencia o administración lo confirme.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Cargando patrones…</p>
      ) : visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin patrones de tarjeta para este filtro.</p>
      ) : (
        <div className="space-y-2">
          {visibles.map(p => {
            const esArchivado = p.activo === false;
            const enConflicto = conflictos.has(p.digitos_finales);
            return (
              <div key={p.id} className="rounded-lg border bg-card p-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 min-w-[120px]">
                  <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-mono font-semibold text-sm">•••• {p.digitos_finales}</span>
                </div>

                <Badge variant={p.titular_tipo === 'empresa' ? 'secondary' : 'outline'}>
                  {p.titular_tipo === 'empresa' ? 'Empresa' : (p.operario_name || 'Técnico')}
                </Badge>

                <Badge variant={p.confirmado ? 'default' : 'outline'} className={p.confirmado ? 'bg-green-600 hover:bg-green-600' : ''}>
                  {esArchivado ? 'Archivado' : p.confirmado ? 'Confirmado' : 'Pendiente'}
                </Badge>

                {enConflicto && !esArchivado && (
                  <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-3 h-3" /> Conflicto
                  </Badge>
                )}

                <span className="text-xs text-muted-foreground">
                  Vista {p.veces_visto || 1} {p.veces_visto === 1 ? 'vez' : 'veces'}
                  {p.ultima_vez_vista ? ` · última ${moment(p.ultima_vez_vista).format('DD/MM/YYYY')}` : ''}
                </span>

                {p.confirmado_por && <span className="text-xs text-muted-foreground">Confirmado por {p.confirmado_por}</span>}

                <div className="flex gap-2 ml-auto">
                  {!p.confirmado && !esArchivado && (
                    <Button size="sm" variant="outline" className="gap-1" disabled={ocupado === p.id} onClick={() => confirmar(p)}>
                      <ShieldCheck className="w-3.5 h-3.5" /> Confirmar
                    </Button>
                  )}
                  {esArchivado ? (
                    <Button size="sm" variant="outline" className="gap-1" disabled={ocupado === p.id} onClick={() => reactivar(p)}>
                      <RotateCcw className="w-3.5 h-3.5" /> Reactivar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" disabled={ocupado === p.id} onClick={() => archivar(p)}>
                      <Archive className="w-3.5 h-3.5" /> Archivar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}