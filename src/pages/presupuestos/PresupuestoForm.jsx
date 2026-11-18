import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash2, FileText, Upload, Type, Wrench, BedDouble, Save, Calculator } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import OcrUploader from "@/components/gastos/OcrUploader";
import ParteSelector from "@/components/presupuestos/ParteSelector";
import ImportarPartidasDocumento from "@/components/presupuestos/ImportarPartidasDocumento";
import AnalisisTecnicoPresupuesto from "@/components/presupuestos/AnalisisTecnicoPresupuesto";
import { extraerConceptosDesdeTexto } from "@/lib/conceptosExtractor";
import { calcularDocumento } from "@/lib/presupuestoCalculo";
import { lineasDeParte, lineasDeExtras, lineaManoDeObra, lineaAlojamiento, quitarLineasDeOrigen, resolverTarifa } from "@/lib/lineasDesdeObra";
import SimantecLogo from "@/components/SimantecLogo";
import CorrectorOrtograficoButton from "@/components/CorrectorOrtograficoButton";
import AutoCorrectTextarea from "@/components/ui/AutoCorrectTextarea";
import AutoCorrectInput from "@/components/ui/AutoCorrectInput";

const IVA_OPCIONES = [21, 10, 4, 0];
const selectCls = "h-7 w-full rounded-md border border-input bg-background px-1 text-xs";
const eur = (n) => (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

// fecha 'AAAA-MM-DD' + días (sin depender de la zona horaria)
function sumarDias(fecha, dias) {
    const m = String(fecha || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

// Normaliza una línea venga de donde venga (OCR, partes, presupuestos antiguos sin IVA ni tipo)
const normalizarLinea = (c) => ({
    tipo: c.tipo === "texto" ? "texto" : "linea",
    descripcion: c.descripcion || "",
    detalle: c.detalle || "",
    cantidad: Number(c.cantidad) || 0,
    unidad: c.unidad || "ud",
    precio_unitario: Number(c.precio_unitario) || 0,
    iva_pct: c.iva_pct === undefined || c.iva_pct === null ? 21 : Number(c.iva_pct),
    parte_id: c.parte_id,
    extra_id: c.extra_id,
    fecha: c.fecha,
});

const LINEA_NUEVA = { tipo: "linea", descripcion: "", cantidad: 1, unidad: "ud", precio_unitario: 0, iva_pct: 21 };

/**
 * Formulario de presupuesto (alta y edición de borradores).
 * Props:
 *  - onSubmit(datos), onCancel()
 *  - presupuestoInicial: si viene, el formulario edita ese presupuesto (solo borradores)
 *  - ocupados: Map(parteId -> código del presupuesto activo que ya lo usa); un parte solo puede estar en un presupuesto activo (DOC-04)
 */
export default function PresupuestoForm({ onSubmit, onCancel, presupuestoInicial = null, ocupados = new Map(), ocupadosExtras = new Map() }) {
    const edicion = !!presupuestoInicial;
    const [formData, setFormData] = useState(() => {
        const p = presupuestoInicial;
        const fecha = p?.fecha || format(new Date(), "yyyy-MM-dd");
        return {
            titulo: p?.titulo || "",
            cliente_id: p?.cliente_id || "",
            cliente_name: p?.cliente_name || "",
            fecha,
            valido_hasta: p?.valido_hasta || sumarDias(fecha, 30),
            referencia_cliente: p?.referencia_cliente || "",
            forma_pago: p?.forma_pago || "",
            conceptos: (p?.conceptos || []).map(normalizarLinea),
            partes_trabajo_ids: p?.partes_trabajo_ids || [],
            obra_id: p?.obra_id || "",
            obra_name: p?.obra_name || "",
            descripcion: p?.descripcion || "",
            notas: p?.notas || "",
            documentos_origen: p?.documentos_origen || [],
        };
    });
    const [validoManual, setValidoManual] = useState(!!presupuestoInicial?.valido_hasta);
    const [nuevoConcepto, setNuevoConcepto] = useState(LINEA_NUEVA);
    const [loadingPartes, setLoadingPartes] = useState(false);
    const [archivoFuente, setArchivoFuente] = useState(null);
    const [modoLineas, setModoLineas] = useState("una_linea");      // cómo se convierte un parte en líneas
    const [horasMO, setHorasMO] = useState("");
    const [alojTrab, setAlojTrab] = useState("");
    const [alojDias, setAlojDias] = useState("");
    const [tarifaEdit, setTarifaEdit] = useState(null);             // precios editados a mano en este documento
    const [guardandoTarifa, setGuardandoTarifa] = useState(false);
    const [showAnalisis, setShowAnalisis] = useState(false);        // análisis interno de precios e informe técnico

    // Totales en vivo: mismas reglas que el servidor (IVA por línea, redondeo por línea)
    const calculo = useMemo(() => calcularDocumento(formData.conceptos), [formData.conceptos]);
    const lineasCalculadas = calculo.lineas;

    // Cargar clientes disponibles
    const { data: clientes = [] } = useQuery({
        queryKey: ['clientes_presupuesto'],
        queryFn: () => base44.entities.Client.list('name', 500),
    });

    // Condiciones económicas acordadas (la de la obra prevalece sobre la del cliente; si no hay, 40 €/h y 100 €/día)
    const { data: condiciones = [], refetch: refetchCondiciones } = useQuery({
        queryKey: ['condiciones_economicas'],
        queryFn: () => base44.entities.CondicionesEconomicas.list('-created_date', 300),
        retry: false,
    });
    const tarifa = useMemo(() => resolverTarifa(condiciones, formData.cliente_id, formData.obra_id), [condiciones, formData.cliente_id, formData.obra_id]);
    const precioHora = tarifaEdit?.precio_hora ?? tarifa.precio_hora;
    const precioAloj = tarifaEdit?.alojamiento_dia_trabajador ?? tarifa.alojamiento_dia_trabajador;

    // Trabajos extra pendientes del cliente
    const { data: extrasCliente = [] } = useQuery({
        queryKey: ['extras_pendientes_presupuesto', formData.cliente_id],
        queryFn: () => base44.entities.TrabajoExtraObra.filter({ client_id: formData.cliente_id, estado: 'pendiente' }, '-fecha_solicitud', 100),
        enabled: !!formData.cliente_id,
        retry: false,
    });

    // Cargar partes de trabajo + partes diarios filtrados por cliente seleccionado
    const { data: partesTrabajoBase = [], isLoading: isLoadingPartes } = useQuery({
        queryKey: ['partes_trabajo_presupuesto', formData.cliente_id],
        queryFn: async () => {
            if (!formData.cliente_id) return [];
            setLoadingPartes(true);
            const [workOrders, partesDiarios] = await Promise.all([
                base44.entities.WorkOrder.list('-created_date', 200),
                base44.entities.ParteDiarioObra.list('-fecha', 300),
            ]);
            setLoadingPartes(false);

            // Partes de trabajo (WorkOrder) del cliente
            const wosNorm = workOrders
                .filter(p => p.client_id === formData.cliente_id)
                .map(w => ({
                    id: w.id,
                    tipo: 'parte_trabajo',
                    titulo: w.numero_parte || w.titulo || `Parte ${w.id.slice(-4)}`,
                    obra_name: w.obra_name || 'Sin obra',
                    fecha: w.created_date,
                    sub: `${w.trabajadores?.length || 0} trabajadores`,
                    descripcion_auto: [w.titulo, w.description].filter(Boolean).join('\n'),
                    desplazamiento_importe_eur: w.desplazamiento_importe_eur,
                    desplazamiento_concepto: w.desplazamiento_concepto,
                    obra_id: w.obra_id,
                }));

            // ParteDiarioObra no incluye client_id: resolver obras del cliente y filtrar por obra_id
            const partesCliente = partesDiarios.filter(p => p.client_id === formData.cliente_id);
            let pdsFiltrados = partesCliente;
            if (partesCliente.length === 0 && partesDiarios.length > 0) {
                const [obrasCiviles, obrasSolar] = await Promise.all([
                    base44.entities.Obra.list('name', 300),
                    base44.entities.SolarObra.list('name', 300),
                ]);
                const idsCliente = new Set([
                    ...obrasCiviles.filter(o => o.client_id === formData.cliente_id).map(o => o.id),
                    ...obrasSolar.filter(o => o.client_id === formData.cliente_id).map(o => o.id),
                ]);
                workOrders.filter(w => w.client_id === formData.cliente_id && w.obra_id).forEach(w => idsCliente.add(w.obra_id));
                pdsFiltrados = partesDiarios.filter(p => p.obra_id && idsCliente.has(p.obra_id));
            }

            const pdsNorm = pdsFiltrados.map(p => ({
                id: p.id,
                tipo: 'parte_diario',
                titulo: `Parte diario ${format(parseISO(String(p.fecha).slice(0, 10)), 'dd/MM/yyyy')}`,
                obra_name: p.obra_name || 'Sin obra',
                fecha: p.fecha,
                sub: p.tecnico_name || '',
                descripcion_auto: [
                    p.trabajos_realizados,
                    p.materiales_necesarios ? `Materiales: ${p.materiales_necesarios}` : null,
                    p.trabajos_pendientes ? `Pendiente: ${p.trabajos_pendientes}` : null,
                ].filter(Boolean).join('\n'),
                materiales_texto: p.materiales_necesarios || '',
            }));

            return [...wosNorm, ...pdsNorm].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        },
        enabled: !!formData.cliente_id,
    });

    // Los partes que ya están en otro presupuesto activo se marcan (el servidor también lo impide)
    const partesTrabajo = useMemo(() => partesTrabajoBase.map(p => (
        ocupados.has(p.id) ? { ...p, sub: [p.sub, `YA EN ${ocupados.get(p.id)}`].filter(Boolean).join(' · ') } : p
    )), [partesTrabajoBase, ocupados]);

    const set = (campo, valor) => setFormData(prev => ({ ...prev, [campo]: valor }));

    const handleFecha = (fecha) => setFormData(prev => ({
        ...prev,
        fecha,
        valido_hasta: validoManual ? prev.valido_hasta : sumarDias(fecha, 30),
    }));

    const handleDatosOcrExtraidos = (datos) => {
        if (datos?.conceptos && datos.conceptos.length > 0) {
            setFormData(prev => ({
                ...prev,
                conceptos: [...prev.conceptos, ...datos.conceptos.map(normalizarLinea)],
                descripcion: datos.notas || prev.descripcion,
            }));
        }
    };

    const handleAddConcepto = () => {
        // Se permiten líneas sin precio (la valoración puede hacerla otro usuario) y líneas de solo texto
        if (!nuevoConcepto.descripcion || !nuevoConcepto.descripcion.trim()) return;
        const linea = normalizarLinea({ ...nuevoConcepto, precio_unitario: parseFloat(nuevoConcepto.precio_unitario) || 0 });
        setFormData(prev => ({ ...prev, conceptos: [...prev.conceptos, linea] }));
        setNuevoConcepto(prev => ({ ...LINEA_NUEVA, tipo: prev.tipo, iva_pct: prev.iva_pct }));
    };

    // Editar una línea ya rellenada (incluidas las autocompletadas) para incorporar detalles
    const handleEditConcepto = (index, field, value) => {
        setFormData(prev => {
            const conceptos = [...prev.conceptos];
            conceptos[index] = { ...conceptos[index], [field]: value };
            return { ...prev, conceptos };
        });
    };

    const handleRemoveConcepto = (index) => {
        setFormData(prev => ({ ...prev, conceptos: prev.conceptos.filter((_, i) => i !== index) }));
    };

    // Aplica al presupuesto los precios propuestos en el análisis interno (siguen siendo editables)
    const aplicarPreciosPropuestos = (precios) => {
        setFormData(prev => ({
            ...prev,
            conceptos: prev.conceptos.map((c, i) => {
                const p = precios.find(x => x.indice === i);
                return p ? { ...c, precio_unitario: p.precio_unitario } : c;
            }),
        }));
    };

    const handleToggleParteTrabajo = (parte) => {
        const ya = formData.partes_trabajo_ids.includes(parte.id);
        if (!ya && ocupados.has(parte.id)) {
            toast.error(`Este parte ya está en el presupuesto ${ocupados.get(parte.id)}. Un parte solo puede estar en un presupuesto activo.`);
            return;
        }

        // Autocompletar descripcion: al anadir, anexamos el resumen del parte si no esta presente
        let nuevaDesc = formData.descripcion;
        if (!ya && parte.descripcion_auto) {
            const marca = parte.descripcion_auto.trim().slice(0, 40);
            if (!formData.descripcion.includes(marca)) {
                nuevaDesc = formData.descripcion
                    ? `${formData.descripcion}\n-- ${parte.titulo} (${parte.obra_name}):\n${parte.descripcion_auto}`
                    : `-- ${parte.titulo} (${parte.obra_name}):\n${parte.descripcion_auto}`;
            }
        }

        // Extraer conceptos desde los materiales del parte (sin precio)
        let conceptosExtraidos = [];
        if (!ya && parte.materiales_texto) {
            conceptosExtraidos = extraerConceptosDesdeTexto(parte.materiales_texto).map(normalizarLinea);
        }

        // Líneas del parte (texto, desplazamiento) según el estilo elegido; sin precio, salvo el desplazamiento
        const lineasParte = !ya ? lineasDeParte(parte, { modo: modoLineas, iva_pct: tarifa.iva_pct }).map(normalizarLinea) : [];

        setFormData(prev => {
            let nuevosConceptos = ya ? quitarLineasDeOrigen(prev.conceptos, { parte_id: parte.id }) : prev.conceptos;
            if (!ya && conceptosExtraidos.length) {
                const sinDuplicar = conceptosExtraidos.filter(nc =>
                    !nuevosConceptos.some(ec =>
                        ec.descripcion.trim().toLowerCase() === nc.descripcion.trim().toLowerCase() &&
                        Number(ec.cantidad) === Number(nc.cantidad)
                    )
                );
                nuevosConceptos = [...nuevosConceptos, ...sinDuplicar];
            }
            if (!ya && !nuevosConceptos.some(c => c.parte_id === parte.id)) nuevosConceptos = [...nuevosConceptos, ...lineasParte];
            return {
                ...prev,
                partes_trabajo_ids: ya
                    ? prev.partes_trabajo_ids.filter(id => id !== parte.id)
                    : [...prev.partes_trabajo_ids, parte.id],
                descripcion: nuevaDesc,
                conceptos: nuevosConceptos,
                obra_id: prev.obra_id || (!ya && parte.obra_id ? parte.obra_id : ''),
                obra_name: prev.obra_name || (!ya && parte.obra_id ? parte.obra_name : ''),
            };
        });
    };

    const anadirLineas = (lineas) => setFormData(prev => ({ ...prev, conceptos: [...prev.conceptos, ...lineas.map(normalizarLinea)] }));

    // Trabajos extra: marcar añade su línea, desmarcar la retira (un extra solo puede estar en un presupuesto activo)
    const handleToggleExtra = (extra) => {
        const ya = formData.conceptos.some(c => c.extra_id === extra.id);
        if (!ya && ocupadosExtras.has(extra.id)) {
            toast.error(`Este trabajo extra ya está en el presupuesto ${ocupadosExtras.get(extra.id)}. Un extra solo puede estar en un presupuesto activo.`);
            return;
        }
        setFormData(prev => ({
            ...prev,
            conceptos: ya
                ? quitarLineasDeOrigen(prev.conceptos, { extra_id: extra.id })
                : [...prev.conceptos, ...lineasDeExtras([extra], { iva_pct: tarifa.iva_pct }).map(normalizarLinea)],
        }));
    };

    const anadirManoDeObra = () => {
        const h = parseFloat(horasMO);
        if (!h) { toast.error("Indica las horas de mano de obra"); return; }
        anadirLineas([lineaManoDeObra({ horas: h, precio_hora: Number(precioHora), iva_pct: tarifa.iva_pct })]);
        setHorasMO("");
    };

    const anadirAlojamiento = () => {
        const tr = parseFloat(alojTrab), di = parseFloat(alojDias);
        if (!tr || !di) { toast.error("Indica trabajadores y días"); return; }
        anadirLineas([lineaAlojamiento({ trabajadores: tr, dias: di, precio: Number(precioAloj), iva_pct: tarifa.iva_pct })]);
        setAlojTrab(""); setAlojDias("");
    };

    // Guarda los precios como acuerdo del cliente (si ya había uno, lo actualiza: nunca se duplica)
    const guardarTarifa = async () => {
        setGuardandoTarifa(true);
        try {
            const datos = {
                client_id: formData.cliente_id, client_name: formData.cliente_name,
                precio_hora: Number(precioHora), alojamiento_dia_trabajador: Number(precioAloj), iva_pct: tarifa.iva_pct, activa: true,
            };
            const existente = condiciones.find(c => c.client_id === formData.cliente_id && !c.obra_id);
            if (existente) await base44.entities.CondicionesEconomicas.update(existente.id, datos);
            else await base44.entities.CondicionesEconomicas.create(datos);
            await refetchCondiciones();
            setTarifaEdit(null);
            toast.success("Tarifa guardada para este cliente");
        } catch (e) {
            toast.error("No se pudo guardar la tarifa: " + (e?.response?.data?.error || e?.message || "sin permiso"));
        } finally {
            setGuardandoTarifa(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.cliente_id) { toast.error("Selecciona un cliente"); return; }
        if (formData.conceptos.length === 0) { toast.error("Añade al menos una línea al presupuesto"); return; }
        // Los importes los calcula el servidor; aquí solo se envían las líneas
        onSubmit({
            ...(edicion ? { id: presupuestoInicial.id } : {}),
            titulo: formData.titulo,
            cliente_id: formData.cliente_id,
            cliente_name: formData.cliente_name,
            fecha: formData.fecha,
            valido_hasta: formData.valido_hasta,
            referencia_cliente: formData.referencia_cliente,
            obra_id: formData.obra_id,
            obra_name: formData.obra_name,
            forma_pago: formData.forma_pago,
            descripcion: formData.descripcion,
            notas: formData.notas,
            documentos_origen: formData.documentos_origen || [],
            partes_trabajo_ids: formData.partes_trabajo_ids,
            conceptos: formData.conceptos.map(c => ({
                tipo: c.tipo, descripcion: c.descripcion, detalle: c.detalle, cantidad: c.cantidad, unidad: c.unidad,
                precio_unitario: c.precio_unitario, iva_pct: c.iva_pct, parte_id: c.parte_id, extra_id: c.extra_id, fecha: c.fecha,
            })),
        });
    };

    const textoNuevo = nuevoConcepto.tipo === "texto";

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <CardHeader className="sticky top-0 bg-background border-b z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <SimantecLogo variant="icon" size={34} />
                            <CardTitle>{edicion ? `Editar presupuesto ${presupuestoInicial.codigo_registro || ""}` : "Nuevo Presupuesto"}</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onCancel}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Datos basicos */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="titulo">Título (opcional)</Label>
                                <Input
                                    id="titulo"
                                    value={formData.titulo}
                                    onChange={(e) => set("titulo", e.target.value)}
                                    placeholder="Se autogenera si está vacío"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cliente">Cliente *</Label>
                                <Select
                                    value={formData.cliente_id}
                                    onValueChange={(value) => {
                                        const cliente = clientes.find(c => c.id === value);
                                        setTarifaEdit(null);
                                        setFormData(prev => ({ ...prev, cliente_id: value, cliente_name: cliente?.name || '', obra_id: '', obra_name: '' }));
                                    }}
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
                                <Input id="fecha" type="date" value={formData.fecha} onChange={(e) => handleFecha(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="valido_hasta">Válido hasta</Label>
                                <Input
                                    id="valido_hasta"
                                    type="date"
                                    value={formData.valido_hasta}
                                    onChange={(e) => { setValidoManual(true); set("valido_hasta", e.target.value); }}
                                />
                                <p className="text-[11px] text-muted-foreground">Por defecto, 30 días desde la fecha.</p>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="referencia">Pedido / referencia del cliente (opcional)</Label>
                                <Input
                                    id="referencia"
                                    value={formData.referencia_cliente}
                                    onChange={(e) => set("referencia_cliente", e.target.value)}
                                    placeholder="Ej.: pedido, orden de trabajo o código de obra del cliente"
                                />
                            </div>
                        </div>

                        {/* Descripcion autocompletada */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <Label htmlFor="descripcion">Descripción (autocompletada)</Label>
                                <CorrectorOrtograficoButton
                                    text={formData.descripcion}
                                    onCorrected={(t) => set("descripcion", t)}
                                    label="Corregir ortografía"
                                />
                            </div>
                            <AutoCorrectTextarea
                                id="descripcion"
                                value={formData.descripcion}
                                onChange={(e) => set("descripcion", e.target.value)}
                                placeholder="Se rellena automáticamente al seleccionar partes de trabajo"
                                className="min-h-[60px]"
                                spellCheck
                                lang="es"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                El corrector normaliza ortografía y nomenclatura técnica (el parte es genérico, creado por técnicos).
                            </p>
                        </div>

                        {/* Fase 1: partidas propuestas desde la documentación de obra */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Partidas desde documentación de obra
                            </Label>
                            <ImportarPartidasDocumento
                                documentos={formData.documentos_origen}
                                onDocumentosChange={(docs) => set("documentos_origen", docs)}
                                onIncorporar={anadirLineas}
                                clienteName={formData.cliente_name}
                                obraId={formData.obra_id}
                                obraName={formData.obra_name}
                                presupuestoCodigo={presupuestoInicial?.codigo_registro}
                            />
                        </div>

                        {/* Subida de documento fuente con OCR */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Ticket o factura (opcional)
                            </Label>
                            <OcrUploader
                                onDatosExtraidos={handleDatosOcrExtraidos}
                                onArchivoSubido={setArchivoFuente}
                            />
                            {archivoFuente && (
                                <p className="text-xs text-muted-foreground">
                                    Archivo: {archivoFuente.nombre} · {new Date(archivoFuente.fecha_subida).toLocaleDateString()}
                                </p>
                            )}
                        </div>

                        {/* Líneas */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <Label>Líneas</Label>
                                <div className="flex items-center gap-2">
                                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setShowAnalisis(true)}>
                                        <Calculator className="w-3 h-3" /> Análisis interno
                                    </Button>
                                    <Badge variant="outline">{formData.conceptos.length} líneas</Badge>
                                </div>
                            </div>

                            {formData.conceptos.length > 0 && (
                                <div className="space-y-2">
                                    {formData.conceptos.map((concepto, index) => {
                                        const calc = lineasCalculadas[index] || {};
                                        const esTexto = concepto.tipo === "texto";
                                        return (
                                            <div key={index} className="p-2 border rounded-lg bg-card space-y-1.5">
                                                <div className="grid grid-cols-12 gap-2 text-xs items-center">
                                                    <div className={esTexto ? "col-span-10" : "col-span-4"}>
                                                        <AutoCorrectTextarea
                                                            className="text-xs min-h-[32px]"
                                                            rows={Math.min(6, Math.max(1, String(concepto.descripcion || "").split("\n").length))}
                                                            value={concepto.descripcion}
                                                            onChange={(e) => handleEditConcepto(index, "descripcion", e.target.value)}
                                                            placeholder={esTexto ? "Línea de texto (cabecera, obra, pedido…)" : "Descripción"}
                                                            spellCheck
                                                            lang="es"
                                                        />
                                                    </div>
                                                    {!esTexto && (
                                                        <>
                                                            <Input className="col-span-1 h-7 text-xs text-center px-1" type="number" step="any" value={concepto.cantidad}
                                                                onChange={(e) => handleEditConcepto(index, "cantidad", parseFloat(e.target.value) || 0)} />
                                                            <Input className="col-span-1 h-7 text-xs text-center px-1" value={concepto.unidad}
                                                                onChange={(e) => handleEditConcepto(index, "unidad", e.target.value)} />
                                                            <Input className="col-span-2 h-7 text-xs text-right" type="number" step="0.01" value={concepto.precio_unitario}
                                                                onChange={(e) => handleEditConcepto(index, "precio_unitario", parseFloat(e.target.value) || 0)} placeholder="0,00" />
                                                            <select className={`${selectCls} col-span-1`} value={concepto.iva_pct}
                                                                onChange={(e) => handleEditConcepto(index, "iva_pct", Number(e.target.value))} title="IVA de la línea">
                                                                {IVA_OPCIONES.map(v => <option key={v} value={v}>{v}%</option>)}
                                                            </select>
                                                            <span className="col-span-2 text-right font-bold">{eur(calc.total)}</span>
                                                        </>
                                                    )}
                                                    <button type="button" onClick={() => handleRemoveConcepto(index)}
                                                        className="col-span-1 text-destructive hover:text-destructive/80 flex justify-end" title="Quitar línea">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                {!esTexto && (
                                                    <AutoCorrectInput
                                                        className="h-7 text-[11px]"
                                                        value={concepto.detalle || ""}
                                                        onChange={(e) => handleEditConcepto(index, "detalle", e.target.value)}
                                                        placeholder="Detalle opcional bajo la línea (operarios, horas, materiales…)"
                                                        spellCheck
                                                        lang="es"
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Anadir nueva línea */}
                            <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                        <input type="checkbox" checked={textoNuevo}
                                            onChange={(e) => setNuevoConcepto(prev => ({ ...prev, tipo: e.target.checked ? "texto" : "linea" }))} />
                                        <Type className="w-3 h-3" /> Línea de solo texto (sin importe)
                                    </label>
                                </div>
                                <div className="grid gap-3 md:grid-cols-12">
                                    <AutoCorrectInput
                                        wrapperClassName={textoNuevo ? "md:col-span-11" : "md:col-span-4"}
                                        placeholder={textoNuevo ? "Texto de la línea" : "Descripción"}
                                        value={nuevoConcepto.descripcion}
                                        onChange={(e) => setNuevoConcepto(prev => ({ ...prev, descripcion: e.target.value }))}
                                        spellCheck
                                        lang="es"
                                    />
                                    {!textoNuevo && (
                                        <>
                                            <Input className="md:col-span-2" type="number" step="any" placeholder="Cant." value={nuevoConcepto.cantidad}
                                                onChange={(e) => setNuevoConcepto(prev => ({ ...prev, cantidad: parseFloat(e.target.value) || 0 }))} />
                                            <Input className="md:col-span-1" placeholder="Unid." value={nuevoConcepto.unidad}
                                                onChange={(e) => setNuevoConcepto(prev => ({ ...prev, unidad: e.target.value }))} />
                                            <Input className="md:col-span-2" type="number" step="0.01" placeholder="Precio" value={nuevoConcepto.precio_unitario}
                                                onChange={(e) => setNuevoConcepto(prev => ({ ...prev, precio_unitario: parseFloat(e.target.value) || 0 }))} />
                                            <select className="md:col-span-2 h-9 rounded-md border border-input bg-background px-2 text-sm" value={nuevoConcepto.iva_pct}
                                                onChange={(e) => setNuevoConcepto(prev => ({ ...prev, iva_pct: Number(e.target.value) }))} title="IVA">
                                                {IVA_OPCIONES.map(v => <option key={v} value={v}>IVA {v}%</option>)}
                                            </select>
                                        </>
                                    )}
                                    <Button type="button" className="md:col-span-1" size="icon" variant="outline" onClick={handleAddConcepto} title="Añadir línea">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Tarifa del cliente y líneas rápidas */}
                            {formData.cliente_id && (
                                <div className="p-3 border rounded-lg space-y-3">
                                    <Label className="flex flex-wrap items-center gap-2">
                                        Tarifa y líneas rápidas
                                        <span className="font-normal text-xs text-muted-foreground">
                                            ({tarifa.origen === "obra" ? "acuerdo de la obra" : tarifa.origen === "cliente" ? "acuerdo del cliente" : "valores sugeridos: aún no hay acuerdo guardado"})
                                        </span>
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 items-end">
                                        <div>
                                            <Label className="text-xs">€ por hora</Label>
                                            <Input type="number" step="0.01" value={precioHora}
                                                onChange={(e) => setTarifaEdit({ precio_hora: e.target.value, alojamiento_dia_trabajador: precioAloj })} />
                                        </div>
                                        <div>
                                            <Label className="text-xs">€ alojamiento / trabajador y día</Label>
                                            <Input type="number" step="0.01" value={precioAloj}
                                                onChange={(e) => setTarifaEdit({ precio_hora: precioHora, alojamiento_dia_trabajador: e.target.value })} />
                                        </div>
                                        <Button type="button" variant="outline" size="sm" className="col-span-2 gap-1.5" onClick={guardarTarifa} disabled={guardandoTarifa || !tarifaEdit}>
                                            <Save className="w-3.5 h-3.5" /> Guardar como tarifa del cliente
                                        </Button>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1"><Label className="text-xs">Horas de mano de obra</Label>
                                                <Input type="number" step="any" value={horasMO} onChange={(e) => setHorasMO(e.target.value)} placeholder="Ej.: 28" /></div>
                                            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={anadirManoDeObra}><Wrench className="w-3.5 h-3.5" /> Mano de obra</Button>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <div className="w-24"><Label className="text-xs">Trabajadores</Label>
                                                <Input type="number" step="any" value={alojTrab} onChange={(e) => setAlojTrab(e.target.value)} /></div>
                                            <div className="w-20"><Label className="text-xs">Días</Label>
                                                <Input type="number" step="any" value={alojDias} onChange={(e) => setAlojDias(e.target.value)} /></div>
                                            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={anadirAlojamiento}><BedDouble className="w-3.5 h-3.5" /> Alojamiento</Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Trabajos extra pendientes del cliente */}
                            {formData.cliente_id && extrasCliente.length > 0 && (
                                <div className="p-3 border rounded-lg space-y-2">
                                    <Label>Trabajos extra pendientes del cliente</Label>
                                    <div className="space-y-1">
                                        {extrasCliente.map((extra) => {
                                            const usado = formData.conceptos.some(c => c.extra_id === extra.id);
                                            const ocupadoPor = ocupadosExtras.get(extra.id);
                                            return (
                                                <label key={extra.id} className={`flex items-start gap-2 text-xs p-1.5 rounded ${ocupadoPor && !usado ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}>
                                                    <input type="checkbox" className="mt-0.5" checked={usado} disabled={!!ocupadoPor && !usado} onChange={() => handleToggleExtra(extra)} />
                                                    <span className="flex-1">
                                                        {extra.descripcion}
                                                        {extra.obra_name && <span className="text-muted-foreground"> · {extra.obra_name}</span>}
                                                        {ocupadoPor && !usado && <span className="text-amber-700 font-medium"> · YA EN {ocupadoPor}</span>}
                                                    </span>
                                                    <span className="font-medium">{Number(extra.importe_estimado) > 0 ? eur(extra.importe_estimado) : "sin importe"}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Totales (calculados con las mismas reglas que el servidor) */}
                            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                                {calculo.desglose_iva.map(d => (
                                    <div key={d.tipo} className="flex justify-between text-xs text-muted-foreground">
                                        <span>Base {eur(d.base)} · IVA {d.tipo}%</span><span>{eur(d.cuota)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between"><span>Base imponible</span><span className="font-medium">{eur(calculo.base_imponible)}</span></div>
                                <div className="flex justify-between"><span>IVA</span><span className="font-medium">{eur(calculo.iva_total)}</span></div>
                                <div className="flex justify-between text-base font-bold border-t pt-1"><span>TOTAL</span><span>{eur(calculo.total_con_iva)}</span></div>
                            </div>
                        </div>

                        {/* Partes de trabajo / diarios vinculados */}
                        {formData.cliente_id && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Partes de Trabajo y Partes Diarios del Cliente
                                </Label>
                                <div className="flex flex-wrap items-center gap-4 text-xs">
                                    <span className="text-muted-foreground">Al marcar un parte, crear:</span>
                                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="modoLineas" checked={modoLineas === "una_linea"} onChange={() => setModoLineas("una_linea")} /> una línea por parte</label>
                                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="modoLineas" checked={modoLineas === "por_parrafo"} onChange={() => setModoLineas("por_parrafo")} /> una posición por párrafo</label>
                                </div>
                                <ParteSelector
                                    partes={partesTrabajo}
                                    seleccionadosIds={formData.partes_trabajo_ids}
                                    onToggle={handleToggleParteTrabajo}
                                    clienteName={formData.cliente_name}
                                    loading={loadingPartes || isLoadingPartes}
                                />
                            </div>
                        )}

                        {/* Forma de pago y notas */}
                        <div className="space-y-2">
                            <Label htmlFor="forma_pago">Forma de pago (sale en el pie del PDF)</Label>
                            <Input id="forma_pago" value={formData.forma_pago} onChange={(e) => set("forma_pago", e.target.value)}
                                placeholder="Ej.: Transferencia bancaria a 30 días" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notas">Notas / Observaciones (opcional)</Label>
                            <AutoCorrectTextarea
                                id="notas"
                                value={formData.notas}
                                onChange={(e) => set("notas", e.target.value)}
                                placeholder="Añade aquí tus observaciones..."
                                className="min-h-[80px]"
                            />
                        </div>

                        {/* Botones de accion */}
                        <div className="flex gap-3 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                                Cancelar
                            </Button>
                            <Button type="submit" className="flex-1">
                                {edicion ? "Guardar cambios" : "Guardar Presupuesto"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <AnalisisTecnicoPresupuesto
                open={showAnalisis}
                onClose={() => setShowAnalisis(false)}
                clienteId={formData.cliente_id}
                clienteName={formData.cliente_name}
                obraId={formData.obra_id}
                obraName={formData.obra_name}
                presupuesto={presupuestoInicial}
                conceptos={formData.conceptos}
                onAplicarPrecios={aplicarPreciosPropuestos}
            />
        </div>
    );
}