import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash2, FileText } from "lucide-react";
import { format } from "date-fns";

export default function PresupuestoForm({ onSubmit, onCancel }) {
    const [formData, setFormData] = useState({
        titulo: "",
        cliente_id: "",
        cliente_name: "",
        fecha: format(new Date(), 'yyyy-MM-dd'),
        importe: 0,
        conceptos: [],
        partes_trabajo_ids: [],
        notas: ""
    });

    const [nuevoConcepto, setNuevoConcepto] = useState({
        descripcion: "",
        cantidad: 1,
        unidad: "ud",
        precio_unitario: 0
    });

    const { data: partesTrabajo = [] } = useQuery({
        queryKey: ['partes_trabajo_presupuesto'],
        queryFn: () => base44.entities.WorkOrder.list('-created_date', 100),
    });

    const handleAddConcepto = () => {
        if (!nuevoConcepto.descripcion || !nuevoConcepto.precio_unitario) return;
        
        const total = nuevoConcepto.cantidad * nuevoConcepto.precio_unitario;
        setFormData(prev => ({
            ...prev,
            conceptos: [...prev.conceptos, { ...nuevoConcepto, total }]
        }));
        
        setFormData(prev => ({ ...prev, importe: prev.importe + total }));
        setNuevoConcepto({ descripcion: "", cantidad: 1, unidad: "ud", precio_unitario: 0 });
    };

    const handleRemoveConcepto = (index) => {
        const conceptoEliminado = formData.conceptos[index];
        setFormData(prev => ({
            ...prev,
            conceptos: prev.conceptos.filter((_, i) => i !== index),
            importe: prev.importe - conceptoEliminado.total
        }));
    };

    const handleToggleParteTrabajo = (parteId) => {
        setFormData(prev => ({
            ...prev,
            partes_trabajo_ids: prev.partes_trabajo_ids.includes(parteId)
                ? prev.partes_trabajo_ids.filter(id => id !== parteId)
                : [...prev.partes_trabajo_ids, parteId]
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <CardHeader className="sticky top-0 bg-background border-b z-10">
                    <div className="flex items-center justify-between">
                        <CardTitle>Nuevo Presupuesto</CardTitle>
                        <Button variant="ghost" size="icon" onClick={onCancel}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Datos básicos */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="titulo">Título *</Label>
                                <Input
                                    id="titulo"
                                    value={formData.titulo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                                    placeholder="Ej: Reforma Oficina Centro"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cliente">Cliente *</Label>
                                <Input
                                    id="cliente"
                                    value={formData.cliente_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, cliente_name: e.target.value }))}
                                    placeholder="Nombre del cliente"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fecha">Fecha *</Label>
                                <Input
                                    id="fecha"
                                    type="date"
                                    value={formData.fecha}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="importe">Importe Total (€)</Label>
                                <Input
                                    id="importe"
                                    type="number"
                                    step="0.01"
                                    value={formData.importe.toFixed(2)}
                                    readOnly
                                    className="bg-muted font-bold"
                                />
                            </div>
                        </div>

                        {/* Conceptos */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Conceptos</Label>
                                <Badge variant="outline">{formData.conceptos.length} líneas</Badge>
                            </div>
                            
                            {formData.conceptos.length > 0 && (
                                <div className="space-y-2">
                                    {formData.conceptos.map((concepto, index) => (
                                        <div key={index} className="flex items-center gap-2 p-2 border rounded-lg bg-card">
                                            <div className="flex-1 grid grid-cols-12 gap-2 text-xs">
                                                <span className="col-span-5 font-medium">{concepto.descripcion}</span>
                                                <span className="col-span-2 text-center">{concepto.cantidad} {concepto.unidad}</span>
                                                <span className="col-span-2 text-right">{concepto.precio_unitario.toFixed(2)}€</span>
                                                <span className="col-span-2 text-right font-bold">{concepto.total.toFixed(2)}€</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveConcepto(index)}
                                                    className="col-span-1 text-destructive hover:text-destructive/80"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Añadir nuevo concepto */}
                            <div className="grid gap-3 md:grid-cols-12 p-3 border rounded-lg bg-muted/30">
                                <Input
                                    className="md:col-span-5"
                                    placeholder="Descripción"
                                    value={nuevoConcepto.descripcion}
                                    onChange={(e) => setNuevoConcepto(prev => ({ ...prev, descripcion: e.target.value }))}
                                />
                                <Input
                                    className="md:col-span-2"
                                    type="number"
                                    placeholder="Cant."
                                    value={nuevoConcepto.cantidad}
                                    onChange={(e) => setNuevoConcepto(prev => ({ ...prev, cantidad: parseFloat(e.target.value) || 1 }))}
                                />
                                <Input
                                    className="md:col-span-2"
                                    placeholder="Unidad"
                                    value={nuevoConcepto.unidad}
                                    onChange={(e) => setNuevoConcepto(prev => ({ ...prev, unidad: e.target.value }))}
                                />
                                <Input
                                    className="md:col-span-2"
                                    type="number"
                                    step="0.01"
                                    placeholder="Precio"
                                    value={nuevoConcepto.precio_unitario}
                                    onChange={(e) => setNuevoConcepto(prev => ({ ...prev, precio_unitario: parseFloat(e.target.value) || 0 }))}
                                />
                                <Button
                                    type="button"
                                    className="md:col-span-1"
                                    size="icon"
                                    variant="outline"
                                    onClick={handleAddConcepto}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Partes de trabajo vinculados */}
                        {partesTrabajo.length > 0 && (
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Partes de Trabajo Vinculados
                                </Label>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {partesTrabajo.map(parte => (
                                        <Button
                                            key={parte.id}
                                            type="button"
                                            variant={formData.partes_trabajo_ids.includes(parte.id) ? "default" : "outline"}
                                            className="justify-start h-auto py-2 px-3"
                                            onClick={() => handleToggleParteTrabajo(parte.id)}
                                        >
                                            <FileText className="w-4 h-4 mr-2 shrink-0" />
                                            <div className="text-left">
                                                <p className="text-xs font-medium">{parte.titulo || `Parte ${parte.id.slice(-4)}`}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {parte.obra_name || 'Sin obra'} · {parte.trabajadores?.length || 0} trabajadores
                                                </p>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notas */}
                        <div className="space-y-2">
                            <Label htmlFor="notas">Notas / Observaciones</Label>
                            <Textarea
                                id="notas"
                                value={formData.notas}
                                onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                                placeholder="Observaciones adicionales..."
                                className="min-h-[80px]"
                            />
                        </div>

                        {/* Botones de acción */}
                        <div className="flex gap-3 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                                Cancelar
                            </Button>
                            <Button type="submit" className="flex-1">
                                Guardar Presupuesto
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}