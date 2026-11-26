import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileText, Download, Pencil, FileSpreadsheet, RotateCcw, Ban, Loader2, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import FacturaBorradorForm from "@/pages/facturasBorrador/FacturaBorradorForm";

const eur = (n) => (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
const MARCA_AGUA = "NO válido como documento oficial";

const estadoColors = {
    borrador: "bg-gray-100 text-gray-700",
    preparada: "bg-blue-100 text-blue-700",
    emitida: "bg-purple-100 text-purple-700",
    anulada: "bg-red-100 text-red-700",
};
const etiquetaEstado = { borrador: "borrador", preparada: "preparada para Contasimple", emitida: "emitida", anulada: "anulada" };

const mensajeError = (err) => err?.response?.data?.error || err?.message || "Inténtalo de nuevo";
const codigoError = (err) => err?.response?.data?.code;

function descargarArchivo(bytes, nombre) {
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Genera y descarga el Excel de importación de Contasimple a partir de una factura ya preparada (con número oficial). */
async function descargarExcel(factura, opciones = {}) {
    const { filasContasimple, construirLibroContasimple, libroABytes } = await import("@/lib/contasimpleExcel");
    const cliente = await base44.entities.Client.get(factura.cliente_id).catch(() => null);
    const { filas, avisos } = filasContasimple({ factura, cliente: cliente || { name: factura.cliente_name }, opciones });
    descargarArchivo(libroABytes(construirLibroContasimple(filas)), `Importacion_facturas_emitidas_${String(factura.numero_oficial).replace(/[^A-Za-z0-9_-]/g, "_")}.xlsx`);
    return avisos;
}

/** Diálogo para preparar una factura: confirma el número OFICIAL (lo da Contasimple, la app solo lo sugiere) y descarga el Excel. */
function PrepararDialog({ factura, onCerrar, onPreparar }) {
    const anio = Number(String(factura.fecha || "").slice(0, 4)) || new Date().getFullYear();
    const { data: libro, isLoading } = useQuery({
        queryKey: ["libro_emitidas_numeros"],
        queryFn: () => base44.entities.FacturaIVA.filter({ tipo: "emitida" }, "-fecha_factura", 2000),
        retry: false,
    });
    const [numero, setNumero] = useState("");
    const [tipoIngreso, setTipoIngreso] = useState(factura.tipo_ingreso || "705");
    const [enviando, setEnviando] = useState(false);
    const [sugerido, setSugerido] = useState("");

    useEffect(() => {
        if (!libro) return;
        let cancelado = false;
        import("@/lib/contasimpleExcel").then(({ sugerirNumeroOficial }) => {
            if (cancelado) return;
            const s = sugerirNumeroOficial(libro, anio);
            setSugerido(s);
            setNumero((actual) => actual || s);
        });
        return () => { cancelado = true; };
    }, [libro, anio]);

    const confirmar = async () => {
        setEnviando(true);
        try { await onPreparar({ numero_oficial: numero, tipo_ingreso: tipoIngreso }); }
        finally { setEnviando(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-lg w-full">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Preparar para Contasimple · {factura.codigo_registro}</CardTitle>
                        <Button variant="ghost" size="icon" onClick={onCerrar}><X className="w-4 h-4" /></Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>Al importar el Excel, <strong>Contasimple crea una factura definitiva</strong> con el número que indiques. Comprueba que es el siguiente de vuestra serie oficial. Un número que ya exista en el libro de IVA, o con prefijo de borrador o de prueba, se rechaza.</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="num-oficial">Número oficial de la factura *</Label>
                        <Input id="num-oficial" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej.: 2026-0104" disabled={enviando} />
                        <p className="text-[11px] text-muted-foreground">
                            {isLoading ? "Buscando el último número registrado…" : sugerido ? `Sugerido: ${sugerido} (el siguiente al último de ${anio} registrado en el libro de IVA). Confírmalo o cámbialo.` : "No hay facturas de este año en el libro de IVA: escribe el número que te corresponde en Contasimple."}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="tipo-ing">Tipo de ingreso</Label>
                        <select id="tipo-ing" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={tipoIngreso} onChange={(e) => setTipoIngreso(e.target.value)} disabled={enviando}>
                            <option value="705">705 · Prestación de servicios</option>
                            <option value="700">700 · Venta de mercaderías</option>
                        </select>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button variant="outline" className="flex-1" onClick={onCerrar} disabled={enviando}>Cancelar</Button>
                        <Button className="flex-1 gap-1.5" onClick={confirmar} disabled={enviando || !numero.trim()}>
                            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Preparar y descargar Excel
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function FacturasBorrador() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editando, setEditando] = useState(null);
    const [preparando, setPreparando] = useState(null);
    const [cargando, setCargando] = useState(null);

    const { data: facturas = [], isLoading } = useQuery({
        queryKey: ["facturas_borrador"],
        queryFn: () => base44.entities.FacturaBorrador.list("-fecha", 300),
    });

    const guardarMutation = useMutation({
        mutationFn: async (data) => (await base44.functions.invoke("guardarFacturaBorrador", data)).data,
        onSuccess: (r) => {
            queryClient.invalidateQueries({ queryKey: ["facturas_borrador"] });
            setShowForm(false); setEditando(null);
            toast.success(`${r?.mensaje || "Factura borrador guardada"}${r?.codigo_registro ? ` · ${r.codigo_registro}` : ""}`);
        },
        onError: (err, variables) => {
            if (codigoError(err) === "DUPLICATE_INVOICE_DRAFT") {
                const d = err.response.data.duplicado;
                if (window.confirm(`Ya existe una factura borrador igual (${d?.codigo_registro || ""}, ${eur(d?.importe)}). ¿Crear otra de todos modos?`)) {
                    guardarMutation.mutate({ ...variables, es_duplicado_confirmado: true });
                }
                return;
            }
            toast.error("No se pudo guardar la factura borrador: " + mensajeError(err));
        },
    });

    const estadoMutation = useMutation({
        mutationFn: async (datos) => (await base44.functions.invoke("cambiarEstadoFacturaBorrador", datos)).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["facturas_borrador"] }),
    });

    const cambiarEstado = async (f, estado, confirmacion) => {
        if (confirmacion && !window.confirm(confirmacion)) return;
        try {
            const r = await estadoMutation.mutateAsync({ id: f.id, estado });
            toast.success(r?.mensaje || "Estado actualizado");
        } catch (err) {
            toast.error(mensajeError(err));
        }
    };

    const descargarPdf = async (f) => {
        setCargando(f.id + "pdf");
        try {
            const { generarPdfPresupuesto } = await import("@/lib/presupuestoPdfDescarga");
            const doc = await generarPdfPresupuesto(f, { tipo: "factura_borrador", marcaAgua: MARCA_AGUA });
            doc.save(`Factura_borrador_${f.codigo_registro || "borrador"}.pdf`);
        } catch (e) {
            toast.error("No se pudo generar el PDF: " + (e?.message || "error desconocido"));
        } finally { setCargando(null); }
    };

    const redescargarExcel = async (f) => {
        setCargando(f.id + "xlsx");
        try {
            const avisos = await descargarExcel(f);
            if (avisos.length) toast.info(avisos.join(" "));
        } catch (e) {
            toast.error("No se pudo generar el Excel: " + (e?.message || "error desconocido"));
        } finally { setCargando(null); }
    };

    // Prepara (el servidor valida número oficial y NIF) y, solo si lo acepta, descarga el Excel
    const prepararYDescargar = async (f, { numero_oficial, tipo_ingreso }) => {
        try {
            const r = await estadoMutation.mutateAsync({ id: f.id, estado: "preparada", numero_oficial, tipo_ingreso });
            (r.avisos || []).forEach((a) => toast.warning(a));
            const avisosExcel = await descargarExcel({ ...f, ...r.data });
            toast.success(`Factura preparada con el número ${r.data.numero_oficial}. Importa el Excel en Contasimple.`);
            if (avisosExcel.length) toast.info(avisosExcel.join(" "));
            setPreparando(null);
        } catch (err) {
            toast.error(mensajeError(err));
        }
    };

    return (
        <div className="p-4 lg:p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-2xl font-bold">Facturas borrador</h1>
                    <p className="text-sm text-muted-foreground">Documentos NO oficiales con el formato de Contasimple. La factura oficial se emite allí.</p>
                </div>
                <Button onClick={() => { setEditando(null); setShowForm(true); }} className="gap-2"><Plus className="w-4 h-4" /> Nueva factura borrador</Button>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Para crear una desde un presupuesto aceptado, usa el botón "Crear factura borrador" en Presupuestos.</p>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>
                ) : facturas.length === 0 ? (
                    <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No hay facturas borrador</p></CardContent></Card>
                ) : facturas.map((f) => {
                    const estado = f.estado || "borrador";
                    return (
                        <Card key={f.id}>
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        {f.codigo_registro && <Badge variant="outline" className="text-[10px] font-mono mb-1">{f.codigo_registro}</Badge>}
                                        <CardTitle className="text-base font-semibold">{f.titulo || f.cliente_name}</CardTitle>
                                    </div>
                                    <Badge className={estadoColors[estado]}>{etiquetaEstado[estado] || estado}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{f.cliente_name}</p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Base imponible</span><span className="font-bold">{eur(f.importe)}</span></div>
                                {f.total_con_iva !== undefined && f.total_con_iva !== null && (
                                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Total con IVA</span><span className="font-medium text-foreground">{eur(f.total_con_iva)}</span></div>
                                )}
                                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Fecha</span><span>{format(new Date(f.fecha), "dd MMM yyyy", { locale: es })}</span></div>
                                {f.numero_oficial && estado !== "anulada" && (
                                    <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Nº oficial (Contasimple)</span><span className="font-mono font-medium">{f.numero_oficial}</span></div>
                                )}
                                {f.presupuesto_codigo && <div className="text-xs text-muted-foreground">Desde el presupuesto {f.presupuesto_codigo}</div>}

                                <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => descargarPdf(f)} disabled={cargando === f.id + "pdf"}>
                                        {cargando === f.id + "pdf" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
                                    </Button>
                                    {estado === "borrador" && (
                                        <>
                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setEditando(f); setShowForm(true); }}><Pencil className="w-3 h-3" /> Editar</Button>
                                            <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setPreparando(f)}><FileSpreadsheet className="w-3 h-3" /> Preparar para Contasimple</Button>
                                        </>
                                    )}
                                    {estado === "preparada" && (
                                        <>
                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => redescargarExcel(f)} disabled={cargando === f.id + "xlsx"}>
                                                {cargando === f.id + "xlsx" ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />} Excel
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => cambiarEstado(f, "borrador", `¿Volver ${f.codigo_registro} a borrador? Se libera el número oficial ${f.numero_oficial}.`)}><RotateCcw className="w-3 h-3" /> Volver a borrador</Button>
                                        </>
                                    )}
                                    {(estado === "borrador" || estado === "preparada") && (
                                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => cambiarEstado(f, "anulada", `¿Anular la factura borrador ${f.codigo_registro}? Sus partes y extras quedan libres.`)}><Ban className="w-3 h-3" /> Anular</Button>
                                    )}
                                    {estado === "anulada" && (
                                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => cambiarEstado(f, "borrador")}><RotateCcw className="w-3 h-3" /> Reactivar</Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {showForm && (
                <FacturaBorradorForm
                    key={editando?.id || "nueva"}
                    facturaInicial={editando}
                    onCancel={() => { setShowForm(false); setEditando(null); }}
                    onSubmit={(data) => guardarMutation.mutate(data)}
                />
            )}
            {preparando && (
                <PrepararDialog factura={preparando} onCerrar={() => setPreparando(null)} onPreparar={(datos) => prepararYDescargar(preparando, datos)} />
            )}
        </div>
    );
}
