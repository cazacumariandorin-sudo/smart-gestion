import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import PresupuestoForm from "@/pages/presupuestos/PresupuestoForm";

export default function Presupuestos() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [duplicadoConfirm, setDuplicadoConfirm] = useState(null);

    const { data: presupuestos = [], isLoading } = useQuery({
        queryKey: ['presupuestos'],
        queryFn: () => base44.entities.Presupuesto.list('-fecha', 100),
    });

    const crearPresupuestoMutation = useMutation({
        mutationFn: async (data) => {
            const response = await base44.functions.invoke('guardarPresupuesto', data);
            return response.data;
        },
        onSuccess: async (result) => {
            if (result.code === 'DUPLICATE_BUDGET') {
                setDuplicadoConfirm(result);
            } else {
                // Asignar ID único al presupuesto recién creado
                if (result.id) {
                    try { await base44.functions.invoke('generarIdUnico', { entidad: 'Presupuesto', record_id: result.id, campo_id: 'codigo_registro' }); } catch {}
                }
                queryClient.invalidateQueries({ queryKey: ['presupuestos'] });
                setShowForm(false);
            }
        },
    });

    const confirmarDuplicado = () => {
        if (duplicadoConfirm) {
            crearPresupuestoMutation.mutate({
                ...duplicadoConfirm.formData,
                es_duplicado_confirmado: true
            });
            setDuplicadoConfirm(null);
        }
    };

    const estadoColors = {
        borrador: 'bg-gray-100 text-gray-700',
        enviado: 'bg-blue-100 text-blue-700',
        aceptado: 'bg-green-100 text-green-700',
        rechazado: 'bg-red-100 text-red-700'
    };

    return (
        <div className="p-4 lg:p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Presupuestos</h1>
                    <p className="text-sm text-muted-foreground">Gestión y consolidación desde partes de trabajo</p>
                </div>
                <Button onClick={() => setShowForm(true)} className="gap-2">
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
                    presupuestos.map((presupuesto) => (
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
                                    <Badge className={estadoColors[presupuesto.estado]}>
                                        {presupuesto.estado}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {presupuesto.cliente_name}
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">Importe</span>
                                    <span className="font-bold">{presupuesto.importe?.toFixed(2)}€</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Fecha</span>
                                    <span>{format(new Date(presupuesto.fecha), 'dd MMM yyyy', { locale: es })}</span>
                                </div>
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
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Formulario de Creación */}
            {showForm && (
                <PresupuestoForm
                    onCancel={() => setShowForm(false)}
                    onSubmit={(data) => crearPresupuestoMutation.mutate(data)}
                />
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
                                <div><strong>Cliente:</strong> {duplicadoConfirm.duplicado.titulo}</div>
                                <div><strong>Fecha:</strong> {duplicadoConfirm.duplicado.fecha}</div>
                                <div><strong>Importe:</strong> {duplicadoConfirm.duplicado.importe}€</div>
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