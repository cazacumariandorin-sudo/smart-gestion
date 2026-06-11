import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash2, FileText, Loader2, Upload, Search } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OcrUploader from "@/components/gastos/OcrUploader";

export default function PresupuestoForm({ onSubmit, onCancel }) {
    const [formData, setFormData] = useState({
        titulo: "",
        cliente_id: "",
        cliente_name: "",
        fecha: format(new Date(), 'yyyy-MM-dd'),
        importe: 0,
        conceptos: [],
        partes_trabajo_ids: [],
        descripcion: "",
        notas: ""
    });

    const [nuevoConcepto, setNuevoConcepto] = useState({
        descripcion: "",
        cantidad: 1,
        unidad: "ud",
        precio_unitario: 0
    });

    const [loadingPartes, setLoadingPartes] = useState(false);
    const [busquedaPartes, setBusquedaPartes] = useState("");
    const [archivoFuente, setArchivoFuente] = useState(null);
    const [procesandoOcr, setProcesandoOcr] = useState(false);

    // Cargar clientes disponibles
    const { data: clientes = [] } = useQuery({
        queryKey: ['clientes_presupuesto'],
        queryFn: () => base44.entities.Client.list('name', 200),
    });

    // Cargar partes de trabajo filtrados por cliente seleccionado
    const { data: partesTrabajo = [], refetch: refetchPartes } = useQuery({
        queryKey: ['partes_trabajo_presupuesto', formData.cliente_id],
        queryFn: async () => {
            if (!formData.cliente_id) return [];
            setLoadingPartes(true);
            const allPartes = await base44.entities.WorkOrder.list('-created_date', 200);
            setLoadingPartes(false);
            // Filtrar por cliente seleccionado
            return allPartes.filter(p => p.client_id === formData.cliente_id);
        },
        enabled: !!formData.cliente_id,
    });

    // Filtrar partes por búsqueda
    const partesFiltrados = partesTrabajo.filter(parte => {
        if (!busquedaPartes) return true;
        const search = busquedaPartes.toLowerCase();
        const titulo = (parte.titulo || "").toLowerCase();
        const obra = (parte.obra_name || "").toLowerCase();
        return titulo.includes(search) || obra.includes(search);
    });

    const handleDatosOcrExtraidos = (datos) => {
        if (datos?.conceptos && datos.conceptos.length > 0) {
            setFormData(prev => ({
                ...prev,
                conceptos: [...prev.conceptos, ...datos.conceptos],
                importe: prev.importe + (datos.importe_total || 0),
                descripcion: datos.notas || prev.descripcion
            }));
        }
    };

    const handleArchivoFuente = (archivoInfo) => {
        setArchivoFuente(archivoInfo);
    };

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
                                <Label htmlFor="titulo">Título (opcional)</Label>
                                <Input
                                    id="titulo"
                                    value={formData.titulo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                                    placeholder="Se autogenera si está vacío"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cliente">Cliente *</Label>
                                <Select
                                    value={formData.cliente_id}
                                    onValueChange={(value) => {
                                        const cliente = clientes.find(c => c.id === value);
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            cliente_id: value,
                                            cliente_name: cliente?.name || ''
                                        }));
                                    }}
                                    required
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar cliente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clientes.map(cliente => (
                                            <SelectItem key={cliente.id} value={cliente.id}>
                                                {cliente.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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

                        {/* Descripción autocompletada */}
                        <div className="space-y-2">
                            <Label htmlFor="descripcion">Descripción (autocompletada)</Label>
                            <Textarea
                                id="descripcion"
                                value={formData.descripcion}
                                onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                placeholder="Se rellena automáticamente al seleccionar partes de trabajo"
                                className="min-h-[60px]"
                            />
                        </div>

                        {/* Subida de documento fuente con OCR */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Documento Fuente (opcional)
                            </Label>
                            <OcrUploader
                                onDatosExtraidos={handleDatosOcrExtraidos}
                                onArchivoSubido={handleArchivoFuente}
                            />
                            {archivoFuente && (
                                <p className="text-xs text-muted-foreground">
                                    Archivo: {archivoFuente.nombre} · {new Date(archivoFuente.fecha_subida).toLocaleDateString()}
                                </p>
                            )}
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
                        {formData.cliente_id && (
                            <div className="space-y-3">
                                <Label className="flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Partes de Trabajo de este Cliente
                                    </span>
                                    {loadingPartes && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                                </Label>
                                
                                {/* Buscador de partes */}
                                {partesTrabajo.length > 0 && (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Buscar por título o obra..."
                                            value={busquedaPartes}
                                            onChange={(e) => setBusquedaPartes(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                )}
                                
                                {partesFiltrados.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        {busquedaPartes ? 'No se encontraron partes con esa búsqueda' : 'No hay partes de trabajo para este cliente'}
                                    </p>
                                ) : (
                                    <div className="grid gap-2 md:grid-cols-2 max-h-64 overflow-y-auto">
                                        {partesFiltrados.map(parte => (
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
                                )}
                            </div>
                        )}

                        {/* Notas */}
                        <div className="space-y-2">
                            <Label htmlFor="notas">Notas / Observaciones (opcional)</Label>
                            <Textarea
                                id="notas"
                                value={formData.notas}
                                onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                                placeholder="Añade aquí tus observaciones personales..."
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