import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  Calendar,
  User,
  Building2,
} from "lucide-react";

/**
 * Selector expandible de partes (trabajo + diarios) agrupados por obra.
 * Muestra la ruta Cliente → Obra para distinguir partes con nombres parecidos.
 *
 * Props:
 *  - partes: lista normalizada [{ id, tipo, titulo, obra_name, fecha, sub, descripcion_auto }]
 *  - seleccionadosIds: array de ids seleccionados
 *  - onToggle(parte)
 *  - clienteName: nombre del cliente (para la ruta)
 *  - loading: boolean
 */
export default function ParteSelector({
  partes = [],
  seleccionadosIds = [],
  onToggle,
  clienteName = "",
  loading = false,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [obraExpandida, setObraExpandida] = useState(null);
  const [parteExpandida, setParteExpandida] = useState(null);

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return partes;
    const q = busqueda.toLowerCase();
    return partes.filter((p) => {
      const titulo = (p.titulo || "").toLowerCase();
      const obra = (p.obra_name || "").toLowerCase();
      const desc = (p.descripcion_auto || "").toLowerCase();
      return titulo.includes(q) || obra.includes(q) || desc.includes(q);
    });
  }, [partes, busqueda]);

  // Agrupar por obra_name
  const grupos = useMemo(() => {
    const map = new Map();
    for (const p of filtrados) {
      const key = p.obra_name || "Sin obra";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return Array.from(map.entries()).map(([obra, items]) => ({ obra, items }));
  }, [filtrados]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando partes…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Buscador */}
      {partes.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por título, obra o contenido…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-h-[40px]"
          />
        </div>
      )}

      {/* Resumen de selecciones */}
      {seleccionadosIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {partes
            .filter((p) => seleccionadosIds.includes(p.id))
            .map((p) => (
              <Badge key={p.id} variant="default" className="gap-1 text-[10px]">
                {p.tipo === "parte_diario" ? (
                  <ClipboardCheck className="w-3 h-3" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                {p.titulo}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(p);
                  }}
                  className="ml-1 hover:text-destructive-foreground/80"
                  aria-label="Quitar"
                >
                  ×
                </button>
              </Badge>
            ))}
        </div>
      )}

      {filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          {busqueda
            ? "No se encontraron partes con esa búsqueda"
            : "No hay partes de trabajo ni partes diarios para este cliente"}
        </p>
      ) : (
        <div className="border rounded-md max-h-80 overflow-y-auto divide-y">
          {grupos.map(({ obra, items }) => {
            const grupoId = `obra:${obra}`;
            const expandido = obraExpandida === grupoId;
            const seleccionadosEnGrupo = items.filter((i) =>
              seleccionadosIds.includes(i.id)
            ).length;

            return (
              <div key={grupoId}>
                {/* Cabecera de obra (ruta Cliente → Obra) */}
                <button
                  type="button"
                  onClick={() => setObraExpandida(expandido ? null : grupoId)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors min-h-[40px]"
                >
                  {expandido ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {clienteName || "Cliente"} →
                    </span>
                    <span className="text-xs font-medium truncate block">
                      {obra}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    {items.length} · {seleccionadosEnGrupo} ✓
                  </Badge>
                </button>

                {/* Items del grupo */}
                {expandido && (
                  <div className="bg-background">
                    {items.map((parte) => {
                      const sel = seleccionadosIds.includes(parte.id);
                      const parteExp = parteExpandida === parte.id;

                      return (
                        <div key={parte.id} className="border-t">
                          {/* Fila del parte */}
                          <div className="flex items-stretch">
                            <button
                              type="button"
                              onClick={() => onToggle(parte)}
                              className={`flex-1 flex items-start gap-2 px-3 py-2 text-left transition-colors min-h-[44px] ${
                                sel ? "bg-primary/10" : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="pt-0.5">
                                {sel ? (
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                ) : parte.tipo === "parte_diario" ? (
                                  <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {parte.titulo}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                  {parte.fecha && (
                                    <span className="flex items-center gap-0.5">
                                      <Calendar className="w-3 h-3" />
                                      {parte.fecha}
                                    </span>
                                  )}
                                  {parte.sub && (
                                    <span className="flex items-center gap-0.5">
                                      <User className="w-3 h-3" />
                                      {parte.sub}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                            {/* Botón de expandir detalle */}
                            <button
                              type="button"
                              onClick={() =>
                                setParteExpandida(parteExp ? null : parte.id)
                              }
                              className="px-2 self-stretch hover:bg-muted/70 flex items-center border-l"
                              aria-label="Ver detalle"
                            >
                              {parteExp ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {/* Detalle expandido del parte */}
                          {parteExp && (
                            <div className="px-3 pb-2 pt-1 bg-muted/20 text-[11px] text-muted-foreground whitespace-pre-wrap border-t">
                              {parte.descripcion_auto || "Sin descripción detallada."}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}