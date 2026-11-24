import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, AlertTriangle, Download, Pencil, Send, Check, X, RotateCcw, Loader2, History } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import PresupuestoForm from "@/pages/presupuestos/PresupuestoForm";
import HistorialVersionesPresupuesto from "@/components/presupuestos/HistorialVersionesPresupuesto";
import InformesTecnicosPresupuesto, { ROLES_INFORMES_INTERNOS } from "@/components/presupuestos/InformesTecnicosPresupuesto";
import { useUserRole } from "@/lib/useUserRole";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import { toast } from "sonner";

const eur = (n) => (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

// Estados en los que un presupuesto "ocupa" sus partes: un parte solo puede estar en uno (DOC-04)
const ESTADOS_ACTIVOS = ["borrador", "enviado", "aceptado", "facturado"];

// Acciones de estado permitidas (el servidor valida las mismas transiciones)
const ACCIONES = {
    borrador: [{ a: "enviado", label: "Marcar como enviado", icon: Send }],
    enviado: [
        { a: "aceptado", label: "Aceptado", icon: Check, confirmar: true },
        { a: "rechazado", label: "Rechazado", icon: X, confirmar: true },
        { a: "borrador", label: "Volver a borrador", icon: RotateCcw },
    ],
    rechazado: [{ a: "borrador", label: "Volver a borrador", icon: RotateCcw }],
    aceptado: [],
    facturado: [],
};

const estadoColors = {
    borrador: "bg-gray-100 text-gray-700",
    enviado: "bg-blue-100 text-blue-700",
    aceptado: "bg-green-100 text-green-700",
    rechazado: "bg-red-100 text-red-700",
    facturado: "bg-purple-100 text-purple-700",
};

// El servidor devuelve el motivo en el cuerpo de la respuesta
const mensajeError = (err) => err?.response?.data?.error || err?.message || "Inténtalo de nuevo";
const codigoError = (err) => err?.response?.data?.code;

export default function Presupuestos() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editando, setEditando] = useState(null);
    const [duplicadoConfirm, setDuplicadoConfirm] = useState(null);
    const [pdfCargando, setPdfCargando] = useState(null);
    const [historial, setHistorial] = useState(null);
    const [informesDe, setInformesDe] = useState(null);      // presupuesto cuyos informes internos se están viendo
    const { role } = useUserRole();
    const verInformes = ROLES_INFORMES_INTERNOS.includes(role);

    const { data: presupuestos = [], isLoading } = useQuery({
        queryKey: ['presupuestos'],
        queryFn: () => base44.entities.Presupuesto.list('-fecha', 300),
    });
    const { pullDistance, refreshing } = usePullToRefresh(() => queryClient.invalidateQueries({ queryKey: ['presupuestos'] }));

    // Partes ya usados por otro presupuesto activo (se excluye el que se está editando)
    const ocupados = useMemo(() => {
        const mapa = new Map();
        presupuestos
            .filter((p) => ESTADOS_ACTIVOS.includes(p.estado || "borrador") && p.id !== editando?.id)
            .forEach((p) => (p.partes_trabajo_ids || []).forEach((id) => mapa.set(id, p.codigo_registro || p.titulo || "otro presupuesto")));
        return mapa;
    }, [presupuestos, editando]);

    // Trabajos extra ya usados por otro presupuesto activo (DOC-04)
    const ocupadosExtras = useMemo(() => {
        const mapa = new Map();
        presupuestos
            .filter((p) => ESTADOS_ACTIVOS.includes(p.estado || "borrador") && p.id !== editando?.id)
            .forEach((p) => (p.conceptos || []).forEach((c) => c.extra_id && mapa.set(c.extra_id, p.codigo_registro || p.titulo || "otro presupuesto")));
        return mapa;
    }, [presupuestos, editando]);

    const guardarMutation = useMutation({
        mutationFn: async (data) => {
            const response = await base44.functions.invoke('guardarPresupuesto', data);
            return response.data;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
            setShowForm(false);
            setEditando(null);
            toast.success(result?.mensaje
                ? `${result.mensaje}${result.codigo_registro ? ` · ${result.codigo_registro}` : ''}`
                : 'Presupuesto guardado correctamente');
        },
        onError: (err, variables) => {
            // 409 de duplicado: se pide confirmación y se reenvía lo mismo marcado como confirmado
            if (codigoError(err) === 'DUPLICATE_BUDGET') {
                setDuplicadoConfirm({ duplicado: err.response.data.duplicado, payload: variables });
                return;
            }
            toast.error('No se pudo guardar el presupuesto: ' + mensajeError(err));
        },
    });

    const estadoMutation = useMutation({
        mutationFn: async ({ id, estado }) => {
            const response = await base44.functions.invoke('cambiarEstadoPresupuesto', { id, estado });
            return response.data;
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
            toast.success(result?.mensaje || 'Estado actualizado');
        },
        onError: (err) => toast.error(mensajeError(err)),
    });

    const confirmarDuplicado = () => {
        if (duplicadoConfirm) {
            guardarMutation.mutate({ ...duplicadoConfirm.payload, es_duplicado_confirmado: true });
            setDuplicadoConfirm(null);
        }
    };

    const cambiarEstado = (presupuesto, accion) => {
        if (accion.confirmar && !window.confirm(`¿Marcar el presupuesto ${presupuesto.codigo_registro || presupuesto.titulo} como "${accion.a}"?`)) return;
        estadoMutation.mutate({ id: presupuesto.id, estado: accion.a });
    };

    const descargarPdf = async (presupuesto) => {
        setPdfCargando(presupuesto.id);
        try {
            const { descargarPresupuestoPdf } = await import('@/lib/presupuestoPdfDescarga');
            await descargarPresupuestoPdf(presupuesto);
        } catch (e) {
            toast.error('No se pudo generar el PDF: ' + (e?.message || 'error desconocido'));
        } finally {
            setPdfCargando(null);
        }
    };

    const hoy = format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="p-4 lg:p-6 max-w-6xl mx-auto">
            <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Presupuestos</h1>
                    <p className="text-sm text-muted-foreground">Gestión y consolidación desde partes de trabajo</p>
                </div>
                <Button onClick={() => { setEditando(null); setShowForm(true); }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Nuevo Presupuesto
                </Button>
            </div>

            {/* Lista de Presupuestos */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                    </div>
                ) : presupuestos.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No hay presupuestos creados</p>
                        </CardContent>
                    </Card>
                ) : (
                    presupuestos.map((presupuesto) => {
                        const estado = presupuesto.estado || 'borrador';
                        const caducado = estado === 'enviado' && presupuesto.valido_hasta && String(presupuesto.valido_hasta).slice(0, 10) < hoy;
                        const ultimo = (presupuesto.historial_estados || []).slice(-1)[0];
                        return (
                            <Card key={presupuesto.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            {presupuesto.codigo_registro && (
                                                <Badge variant="outline" className="text-[10px] font-mono mb-1">
                                                    {presupuesto.codigo_registro}
                                                </Badge>
                                            )}
                                            <CardTitle className="text-base font-semibold">{presupuesto.titulo}</CardTitle>
                                        </div>
                                        <Badge className={estadoColors[estado]}>
                                            {estado}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {presupuesto.cliente_name}
                                    </p>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Base imponible</span>
                                        <span className="font-bold">{eur(presupuesto.importe)}</span>
                                    </div>
                                    {presupuesto.total_con_iva !== undefined && presupuesto.total_con_iva !== null && (
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>Total con IVA</span>
                                            <span className="font-medium text-foreground">{eur(presupuesto.total_con_iva)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Fecha</span>
                                        <span>{format(new Date(presupuesto.fecha), 'dd MMM yyyy', { locale: es })}</span>
                                    </div>
                                    {presupuesto.valido_hasta && (
                                        <div className={`flex items-center justify-between text-xs ${caducado ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                            <span>{caducado ? 'Caducado el' : 'Válido hasta'}</span>
                                            <span>{format(new Date(presupuesto.valido_hasta), 'dd MMM yyyy', { locale: es })}</span>
                                        </div>
                                    )}
                                    {presupuesto.es_duplicado_confirmado && (
                                        <div className="flex items-center gap-1 text-xs text-orange-600">
                                            <AlertTriangle className="w-3 h-3" />
                                            Duplicado confirmado
                                        </div>
                                    )}
                                    {presupuesto.partes_trabajo_ids?.length > 0 && (
                                        <div className="text-xs text-muted-foreground">
                                            Consolidado de {presupuesto.partes_trabajo_ids.length} parte(s)
                                        </div>
                                    )}
                                    {ultimo?.por && (
                                        <div className="text-[10px] text-muted-foreground">
                                            Último cambio: {ultimo.estado} · {ultimo.por}
                                        </div>
                                    )}

                                    {/* Acciones */}
                                    <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => descargarPdf(presupuesto)} disabled={pdfCargando === presupuesto.id}>
                                            {pdfCargando === presupuesto.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setHistorial(presupuesto)}>
                                            <History className="w-3 h-3" /> Historial
                                            {Number(presupuesto.version_actual || 1) > 1 && (
                                                <span className="ml-0.5 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                                                    v{presupuesto.version_actual}
                                                </span>
                                            )}
                                        </Button>
                                        {verInformes && (
                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setInformesDe(presupuesto)}>
                                                <FileText className="w-3 h-3" /> Informes
                                            </Button>
                                        )}
                                        {estado === 'borrador' && (
                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setEditando(presupuesto); setShowForm(true); }}>
                                                <Pencil className="w-3 h-3" /> Editar
                                            </Button>
                                        )}
                                        {(ACCIONES[estado] || []).map((accion) => (
                                            <Button key={accion.a} size="sm" variant="outline" className="h-7 gap-1 text-xs"
                                                onClick={() => cambiarEstado(presupuesto, accion)} disabled={estadoMutation.isPending}>
                                                <accion.icon className="w-3 h-3" /> {accion.label}
                                            </Button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Formulario de creación / edición */}
            {showForm && (
                <PresupuestoForm
                    key={editando?.id || 'nuevo'}
                    presupuestoInicial={editando}
                    ocupados={ocupados}
                    ocupadosExtras={ocupadosExtras}
                    onCancel={() => { setShowForm(false); setEditando(null); }}
                    onSubmit={(data) => guardarMutation.mutate(data)}
                />
            )}

            {/* Historial interno de versiones */}
            <HistorialVersionesPresupuesto
                open={!!historial}
                presupuesto={historial}
                onClose={() => setHistorial(null)}
            />

            {/* Informes técnicos internos del presupuesto */}
            {informesDe && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
                    <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-base">Informes internos · {informesDe.codigo_registro || informesDe.titulo}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setInformesDe(null)}><X className="w-4 h-4" /></Button>
                        </CardHeader>
                        <CardContent><InformesTecnicosPresupuesto presupuestoId={informesDe.id} /></CardContent>
                    </Card>
                </div>
            )}

            {/* Modal de Confirmación de Duplicado */}
            {duplicadoConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-md w-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-orange-600">
                                <AlertTriangle className="w-5 h-5" />
                                Presupuesto Duplicado Detectado
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Ya existe un presupuesto con las mismas características:
                            </p>
                            <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                                <div><strong>Presupuesto:</strong> {duplicadoConfirm.duplicado?.codigo_registro} {duplicadoConfirm.duplicado?.titulo}</div>
                                <div><strong>Fecha:</strong> {duplicadoConfirm.duplicado?.fecha}</div>
                                <div><strong>Base imponible:</strong> {eur(duplicadoConfirm.duplicado?.importe)}</div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Si confirmas que es un presupuesto válido diferente, se creará con el sufijo <code>_01</code>
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setDuplicadoConfirm(null)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={confirmarDuplicado}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                                >
                                    Confirmar y Crear (_01)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}