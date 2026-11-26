import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Trash2, Type } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { calcularDocumento } from "@/lib/presupuestoCalculo";

const IVA_OPCIONES = [21, 10, 4, 0];
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const eur = (n) => (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

// fecha 'AAAA-MM-DD' + días (sin depender de la zona horaria)
function sumarDias(fecha, dias) {
    const m = String(fecha || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}

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

/**
 * Editor de una FACTURA BORRADOR (no oficial). Los importes los recalcula el servidor al guardar.
 * Los partes y extras de origen se conservan en las líneas que vienen de un presupuesto.
 * Props: onSubmit(datos), onCancel(), facturaInicial (si se edita).
 */
export default function FacturaBorradorForm({ onSubmit, onCancel, facturaInicial = null }) {
    const edicion = !!facturaInicial;
    const [f, setF] = useState(() => {
        const p = facturaInicial;
        const fecha = p?.fecha || format(new Date(), "yyyy-MM-dd");
        return {
            titulo: p?.titulo || "",
            cliente_id: p?.cliente_id || "",
            cliente_name: p?.cliente_name || "",
            fecha,
            valido_hasta: p?.valido_hasta || sumarDias(fecha, 30),
            referencia_cliente: p?.referencia_cliente || "",
            forma_pago: p?.forma_pago || "",
            notas: p?.notas || "",
            tipo_ingreso: p?.tipo_ingreso || "705",
            conceptos: (p?.conceptos || []).map(normalizarLinea),
        };
    });
    const [validoManual, setValidoManual] = useState(!!facturaInicial?.valido_hasta);

    const { data: clientes = [] } = useQuery({
        queryKey: ["clientes_factura_borrador"],
        queryFn: () => base44.entities.Client.list("name", 500),
    });

    const calculo = useMemo(() => calcularDocumento(f.conceptos), [f.conceptos]);
    const set = (campo, valor) => setF((prev) => ({ ...prev, [campo]: valor }));
    const editarLinea = (i, campo, valor) => setF((prev) => {
        const conceptos = [...prev.conceptos];
        conceptos[i] = { ...conceptos[i], [campo]: valor };
        return { ...prev, conceptos };
    });
    const quitarLinea = (i) => setF((prev) => ({ ...prev, conceptos: prev.conceptos.filter((_, k) => k !== i) }));
    const anadir = (tipo) => setF((prev) => ({
        ...prev,
        conceptos: [...prev.conceptos, normalizarLinea({ tipo, descripcion: "", cantidad: 1, unidad: "ud", precio_unitario: 0, iva_pct: 21 })],
    }));
    const cambiarFecha = (fecha) => setF((prev) => ({ ...prev, fecha, valido_hasta: validoManual ? prev.valido_hasta : sumarDias(fecha, 30) }));

    const enviar = (e) => {
        e.preventDefault();
        if (!f.cliente_id) { toast.error("Selecciona un cliente"); return; }
        const utiles = f.conceptos.filter((c) => String(c.descripcion).trim() || Number(c.precio_unitario));
        if (utiles.length === 0) { toast.error("Añade al menos una línea"); return; }
        onSubmit({
            ...(edicion ? { id: facturaInicial.id } : {}),
            titulo: f.titulo, cliente_id: f.cliente_id, cliente_name: f.cliente_name, fecha: f.fecha, valido_hasta: f.valido_hasta,
            referencia_cliente: f.referencia_cliente, forma_pago: f.forma_pago, notas: f.notas, tipo_ingreso: f.tipo_ingreso,
            ...(edicion ? { partes_trabajo_ids: facturaInicial.partes_trabajo_ids || [], obra_id: facturaInicial.obra_id, obra_name: facturaInicial.obra_name } : {}),
            conceptos: utiles.map((c) => ({
                tipo: c.tipo, descripcion: c.descripcion, detalle: c.detalle, cantidad: c.cantidad, unidad: c.unidad,
                precio_unitario: c.precio_unitario, iva_pct: c.iva_pct, parte_id: c.parte_id, extra_id: c.extra_id, fecha: c.fecha,
            })),
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <CardHeader className="sticky top-0 bg-background border-b z-10">
                    <div className="flex items-center justify-between">
                        <CardTitle>{edicion ? `Editar factura borrador ${facturaInicial.codigo_registro || ""}` : "Nueva factura borrador"}</CardTitle>
                        <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Documento NO oficial. La factura oficial se emite en Contasimple y es allí donde se le asigna su número.</p>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={enviar} className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="fb-titulo">Título (opcional)</Label>
                                <Input id="fb-titulo" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fb-cliente">Cliente *</Label>
                                <select id="fb-cliente" className={selectCls} value={f.cliente_id}
                                    onChange={(e) => { const c = clientes.find((x) => x.id === e.target.value); setF((prev) => ({ ...prev, cliente_id: e.target.value, cliente_name: c?.name || "" })); }}>
                                    <option value="">Seleccionar cliente</option>
                                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fb-fecha">Fecha *</Label>
                                <Input id="fb-fecha" type="date" value={f.fecha} onChange={(e) => cambiarFecha(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fb-vto">Vencimiento</Label>
                                <Input id="fb-vto" type="date" value={f.valido_hasta} onChange={(e) => { setValidoManual(true); set("valido_hasta", e.target.value); }} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fb-ref">Pedido / referencia del cliente</Label>
                                <Input id="fb-ref" value={f.referencia_cliente} onChange={(e) => set("referencia_cliente", e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="fb-tipo">Tipo de ingreso en Contasimple</Label>
                                <select id="fb-tipo" className={selectCls} value={f.tipo_ingreso} onChange={(e) => set("tipo_ingreso", e.target.value)}>
                                    <option value="705">705 · Prestación de servicios</option>
                                    <option value="700">700 · Venta de mercaderías</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Líneas</Label>
                            {f.conceptos.map((c, i) => {
                                const calc = calculo.lineas[i] || {};
                                const esTexto = c.tipo === "texto";
                                return (
                                    <div key={i} className="p-2 border rounded-lg space-y-1.5">
                                        <div className="grid grid-cols-12 gap-2 items-start text-xs">
                                            <textarea className={`${esTexto ? "col-span-11" : "col-span-4"} min-h-[34px] rounded-md border border-input bg-background px-2 py-1 text-xs`}
                                                rows={Math.min(6, Math.max(1, String(c.descripcion || "").split("\n").length))}
                                                placeholder={esTexto ? "Línea de texto (obra, pedido…)" : "Descripción"} value={c.descripcion}
                                                onChange={(e) => editarLinea(i, "descripcion", e.target.value)} />
                                            {!esTexto && (
                                                <>
                                                    <Input className="col-span-1 h-8 text-xs text-center px-1" type="number" step="any" value={c.cantidad} onChange={(e) => editarLinea(i, "cantidad", parseFloat(e.target.value) || 0)} title="Cantidad" />
                                                    <Input className="col-span-1 h-8 text-xs text-center px-1" value={c.unidad} onChange={(e) => editarLinea(i, "unidad", e.target.value)} title="Unidad" />
                                                    <Input className="col-span-2 h-8 text-xs text-right" type="number" step="0.01" value={c.precio_unitario} onChange={(e) => editarLinea(i, "precio_unitario", parseFloat(e.target.value) || 0)} title="Precio unitario" />
                                                    <select className="col-span-1 h-8 rounded-md border border-input bg-background px-1 text-xs" value={c.iva_pct} onChange={(e) => editarLinea(i, "iva_pct", Number(e.target.value))} title="IVA de la línea">
                                                        {IVA_OPCIONES.map((v) => <option key={v} value={v}>{v}%</option>)}
                                                    </select>
                                                    <span className="col-span-2 text-right font-bold pt-2">{eur(calc.total)}</span>
                                                </>
                                            )}
                                            <button type="button" onClick={() => quitarLinea(i)} className="col-span-1 text-destructive flex justify-end pt-2" title="Quitar línea"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => anadir("linea")}><Plus className="w-3.5 h-3.5" /> Añadir línea</Button>
                                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => anadir("texto")}><Type className="w-3.5 h-3.5" /> Línea de texto</Button>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                                {calculo.desglose_iva.map((d) => (
                                    <div key={d.tipo} className="flex justify-between text-xs text-muted-foreground"><span>Base {eur(d.base)} · IVA {d.tipo}%</span><span>{eur(d.cuota)}</span></div>
                                ))}
                                <div className="flex justify-between"><span>Base imponible</span><span className="font-medium">{eur(calculo.base_imponible)}</span></div>
                                <div className="flex justify-between"><span>IVA</span><span className="font-medium">{eur(calculo.iva_total)}</span></div>
                                <div className="flex justify-between text-base font-bold border-t pt-1"><span>TOTAL</span><span>{eur(calculo.total_con_iva)}</span></div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="fb-pago">Forma de pago</Label>
                            <Input id="fb-pago" value={f.forma_pago} onChange={(e) => set("forma_pago", e.target.value)} placeholder="Ej.: Transferencia bancaria" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="fb-notas">Notas</Label>
                            <textarea id="fb-notas" className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={f.notas} onChange={(e) => set("notas", e.target.value)} />
                        </div>
                        <div className="flex gap-3 pt-3 border-t">
                            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
                            <Button type="submit" className="flex-1">{edicion ? "Guardar cambios" : "Guardar factura borrador"}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
