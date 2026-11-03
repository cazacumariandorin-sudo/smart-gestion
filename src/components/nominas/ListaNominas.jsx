import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText, Download, Search, User, Calendar, AlertTriangle,
  Pencil, Trash2, Check, X, Loader2, Copy, ChevronDown, ChevronUp, Eye, Receipt
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EstadoPagoBadge from '@/components/nominas/EstadoPagoBadge';
import JustificantesPagoDialog from '@/components/nominas/JustificantesPagoDialog';
import { urlVisorNomina, urlDescargaNomina } from '@/lib/nominaArchivos';

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Extrae mes/año del campo periodo_texto si existe (ej: "De 01/05/26 a 31/05/26")
function parsearPeriodoLiquidacion(nom) {
  const texto = nom.texto_extraido ? (() => { try { return JSON.parse(nom.texto_extraido); } catch { return {}; } })() : {};
  const periodoTexto = texto.periodo_texto || '';
  // Busca fecha "a DD/MM/YY" o "a DD/MM/YYYY" (fin del período de liquidación)
  const match = periodoTexto.match(/a\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (match) {
    const mesLiq = parseInt(match[2]);
    const anioLiq = parseInt(match[3]) < 100 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
    return { mes: mesLiq, anio: anioLiq };
  }
  // Fallback: usar mes/anio del registro
  return { mes: nom.mes, anio: nom.anio };
}

function detectarDuplicados(nominas) {
  const grupos = {};

  // CRITERIO 1: mismo trabajador + mismo mes/año de registro
  for (const nom of nominas) {
    const clave = `C1_${(nom.operario_dni || nom.operario_name || '').toUpperCase()}_${nom.mes}_${nom.anio}`;
    if (!grupos[clave]) grupos[clave] = { nominas: [], motivo: 'Mismo trabajador y período de alta' };
    grupos[clave].nominas.push(nom);
  }

  // CRITERIO 2: mismo trabajador + mismo importe + mismo período de liquidación (aunque mes/año de alta sean distintos)
  const porTrabajador = {};
  for (const nom of nominas) {
    const trabKey = (nom.operario_dni || nom.operario_name || '').toUpperCase();
    if (!porTrabajador[trabKey]) porTrabajador[trabKey] = [];
    porTrabajador[trabKey].push(nom);
  }

  for (const [trabKey, noms] of Object.entries(porTrabajador)) {
    if (noms.length < 2) continue;
    for (let i = 0; i < noms.length; i++) {
      for (let j = i + 1; j < noms.length; j++) {
        const a = noms[i];
        const b = noms[j];
        // Solo si tienen importe y son iguales (tolerancia 0.01€)
        if (!a.liquido_percibir || !b.liquido_percibir) continue;
        if (Math.abs(a.liquido_percibir - b.liquido_percibir) > 0.01) continue;
        // Comparar período de liquidación extraído del documento
        const periA = parsearPeriodoLiquidacion(a);
        const periB = parsearPeriodoLiquidacion(b);
        if (periA.mes === periB.mes && periA.anio === periB.anio) {
          // Son duplicados por criterio 2 — agruparlos si no están ya en el mismo grupo C1
          const mismoGrupoC1 = `C1_${trabKey}_${a.mes}_${a.anio}` === `C1_${trabKey}_${b.mes}_${b.anio}`;
          if (!mismoGrupoC1) {
            const clave = `C2_${trabKey}_${periA.mes}_${periA.anio}_${Math.round(a.liquido_percibir * 100)}`;
            if (!grupos[clave]) grupos[clave] = { nominas: [], motivo: `Mismo importe (${a.liquido_percibir.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €) y período de liquidación` };
            if (!grupos[clave].nominas.find(n => n.id === a.id)) grupos[clave].nominas.push(a);
            if (!grupos[clave].nominas.find(n => n.id === b.id)) grupos[clave].nominas.push(b);
          }
        }
      }
    }
  }

  return Object.values(grupos)
    .filter(g => g.nominas.length > 1)
    .map(g => ({ nominas: g.nominas, motivo: g.motivo }));
}

function AlertaDuplicados({ grupos, onVerDuplicados }) {
  const total = grupos.reduce((s, g) => s + g.nominas.length - 1, 0);
  return (
    <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
          ⚠️ {total} nómina{total !== 1 ? 's' : ''} duplicada{total !== 1 ? 's' : ''} detectada{total !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">
          {grupos.length} grupo{grupos.length !== 1 ? 's' : ''} de posibles duplicados encontrados.
        </p>
      </div>
      <Button size="sm" variant="destructive" className="h-8 px-3 text-xs shrink-0" onClick={onVerDuplicados}>
        Gestionar
      </Button>
    </div>
  );
}

function ModalDuplicados({ grupos, onClose, onEliminar, eliminando }) {
  const [seleccionados, setSeleccionados] = useState(() => {
    const ids = new Set();
    for (const grupo of grupos) {
      const ordenados = [...grupo.nominas].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      ordenados.slice(1).forEach(n => ids.add(n.id));
    }
    return ids;
  });

  const toggle = (id) => setSeleccionados(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Copy className="w-4 h-4 text-red-500" /> Nóminas duplicadas
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Selecciona las que quieres eliminar</p>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
          {grupos.map((grupo, gi) => {
            const ordenados = [...grupo.nominas].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
            return (
              <div key={gi} className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold truncate">{grupo.nominas[0].operario_name}</span>
                    <span className="text-xs text-muted-foreground">· {grupo.nominas[0].operario_dni || '—'}</span>
                    <Badge variant="destructive" className="text-[10px] ml-auto">{grupo.nominas.length} copias</Badge>
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" /> {grupo.motivo}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {ordenados.map((nom, ni) => (
                    <label key={nom.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors
                      ${seleccionados.has(nom.id) ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/20'}`}>
                      <input type="checkbox" checked={seleccionados.has(nom.id)} onChange={() => toggle(nom.id)} className="accent-destructive w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{nom.periodo || `${MESES[nom.mes]} ${nom.anio}`} · Lote: <span className="font-mono">{(nom.lote_id || '—').slice(-8)}</span></p>
                        <p className="text-[11px] text-muted-foreground">Subida: {nom.created_date ? new Date(nom.created_date).toLocaleString('es-ES') : '—'}</p>
                      </div>
                      {nom.liquido_percibir && <span className="text-xs font-semibold text-green-700 shrink-0">{nom.liquido_percibir.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>}
                      {ni === 0 && <Badge variant="secondary" className="text-[10px] shrink-0">Original</Badge>}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{seleccionados.size} seleccionada{seleccionados.size !== 1 ? 's' : ''} para eliminar</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-9 px-4 text-xs" onClick={onClose} disabled={eliminando}>Cancelar</Button>
            <Button variant="destructive" size="sm" className="h-9 px-4 text-xs gap-1.5"
              disabled={seleccionados.size === 0 || eliminando}
              onClick={() => onEliminar([...seleccionados])}>
              {eliminando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Eliminando...</> : <><Trash2 className="w-3.5 h-3.5" /> Eliminar {seleccionados.size}</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Visor sin descarga: muestra el PDF embebido en un overlay ────────────────
function VisorNomina({ nom, onClose }) {
  if (!nom) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={onClose}>
      <div className="flex items-center justify-between px-4 h-12 bg-card border-b border-border shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{nom.operario_name || 'Nómina'}</p>
            <p className="text-[11px] text-muted-foreground truncate">{nom.periodo || `${MESES[nom.mes] || ''} ${nom.anio}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {nom.file_url && (
            <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5">
              <a href={urlDescargaNomina(nom)} target="_blank" rel="noopener noreferrer"><Download className="w-3.5 h-3.5" /> Descargar</a>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-2 sm:p-4" onClick={e => e.stopPropagation()}>
        {nom.file_url ? (
          <iframe
            src={urlVisorNomina(nom)}
            title={`Nomina-${nom.operario_name || ''}-${nom.id}`}
            className="w-full h-full rounded-lg border-0 bg-white"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Esta nómina no tiene PDF asociado.
          </div>
        )}
      </div>
    </div>
  );
}

function EditForm({ nom, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    operario_name: nom.operario_name || '',
    operario_dni: nom.operario_dni || '',
    liquido_percibir: nom.liquido_percibir || '',
    total_devengado: nom.total_devengado || '',
    coste_empresa: nom.coste_empresa || '',
    estado_asignacion: nom.estado_asignacion || 'asignada',
    file_url: nom.file_url || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-700 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><label className="text-[10px] font-medium text-muted-foreground uppercase">Nombre trabajador</label><Input value={form.operario_name} onChange={e => set('operario_name', e.target.value)} className="h-8 text-sm mt-0.5" /></div>
        <div><label className="text-[10px] font-medium text-muted-foreground uppercase">DNI</label><Input value={form.operario_dni} onChange={e => set('operario_dni', e.target.value)} className="h-8 text-sm mt-0.5" /></div>
        <div><label className="text-[10px] font-medium text-muted-foreground uppercase">Líquido a percibir (€)</label><Input type="number" value={form.liquido_percibir} onChange={e => set('liquido_percibir', e.target.value)} className="h-8 text-sm mt-0.5" /></div>
        <div><label className="text-[10px] font-medium text-muted-foreground uppercase">Total devengado (€)</label><Input type="number" value={form.total_devengado} onChange={e => set('total_devengado', e.target.value)} className="h-8 text-sm mt-0.5" /></div>
        <div><label className="text-[10px] font-medium text-muted-foreground uppercase">Coste empresa (€)</label><Input type="number" value={form.coste_empresa} onChange={e => set('coste_empresa', e.target.value)} className="h-8 text-sm mt-0.5" /></div>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Estado</label>
          <select value={form.estado_asignacion} onChange={e => set('estado_asignacion', e.target.value)} className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm mt-0.5">
            <option value="asignada">Asignada</option>
            <option value="sin_asignar">Sin asignar</option>
            <option value="revision_manual">Revisión manual</option>
          </select>
        </div>
        <div className="col-span-2"><label className="text-[10px] font-medium text-muted-foreground uppercase">URL del PDF</label><Input value={form.file_url} onChange={e => set('file_url', e.target.value)} className="h-8 text-sm mt-0.5" placeholder="https://..." /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving} className="h-8 px-3 text-xs gap-1"><X className="w-3.5 h-3.5" /> Cancelar</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={saving} className="h-8 px-3 text-xs gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
        </Button>
      </div>
    </div>
  );
}

// ── Vista tabla: filas por trabajador, columnas por mes ───────────────────────
function TablaResumen({ nominas, esAdmin, idsDuplicados, onEditar, onBorrar, onVer, onPagos, justificantesPorNomina = {}, confirmarBorrarId, setConfirmarBorrarId, deletePending }) {
  const [expandido, setExpandido] = useState(null); // trabajador expandido

  // Años disponibles en los datos
  const anios = [...new Set(nominas.map(n => n.anio))].sort((a, b) => b - a);

  // Agrupar por trabajador (dni o nombre)
  const porTrabajador = useMemo(() => {
    const map = {};
    for (const nom of nominas) {
      const key = nom.operario_dni || nom.operario_name || nom.id;
      if (!map[key]) map[key] = { name: nom.operario_name, dni: nom.operario_dni, nominas: [] };
      map[key].nominas.push(nom);
    }
    return Object.values(map).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [nominas]);

  if (porTrabajador.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">No hay nóminas para los filtros seleccionados</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {porTrabajador.map((trab) => {
        const key = trab.dni || trab.name;
        const isOpen = esAdmin ? expandido === key : true;
        const tieneDup = trab.nominas.some(n => idsDuplicados.has(n.id));

        // Agrupar las nóminas de este trabajador por año→mes
        const porAnioMes = {};
        for (const nom of trab.nominas) {
          const a = nom.anio;
          const m = nom.mes;
          if (!porAnioMes[a]) porAnioMes[a] = {};
          if (!porAnioMes[a][m]) porAnioMes[a][m] = [];
          porAnioMes[a][m].push(nom);
        }

        return (
          <div key={key} className={`border rounded-xl overflow-hidden transition-all
            ${tieneDup ? 'border-red-300 dark:border-red-800' : 'border-border'}`}>

            {/* Cabecera del trabajador */}
            <button
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${tieneDup ? 'bg-red-50/60 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20'
                           : 'bg-muted/30 hover:bg-muted/50'}`}
              onClick={() => setExpandido(isOpen ? null : key)}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                ${tieneDup ? 'bg-red-100 dark:bg-red-900/40' : 'bg-primary/10'}`}>
                <User className={`w-4 h-4 ${tieneDup ? 'text-red-500' : 'text-primary'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{trab.name || 'Sin nombre'}</span>
                  {tieneDup && <Badge variant="destructive" className="text-[10px] px-1.5">DUP</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">DNI: {trab.dni || '—'} · {trab.nominas.length} nómina{trab.nominas.length !== 1 ? 's' : ''}</p>
              </div>
              {/* Resumen importes */}
              <div className="text-right shrink-0 hidden sm:block">
                {trab.nominas.some(n => n.liquido_percibir) && (
                  <p className="text-xs text-green-700 font-medium">
                    Último: {([...trab.nominas].sort((a,b) => b.anio - a.anio || b.mes - a.mes)[0].liquido_percibir || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </p>
                )}
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>

            {/* Tabla de nóminas por año/mes */}
            {isOpen && (
              <div className="border-t border-border">
                {Object.entries(porAnioMes).sort(([a],[b]) => b - a).map(([anio, meses]) => (
                  <div key={anio}>
                    {/* Fila de año */}
                    <div className="bg-muted/20 px-4 py-1.5 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{anio}</span>
                    </div>

                    {/* Tabla meses */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/10">
                            <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-28">Mes</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Líquido</th>
                            {esAdmin && <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Devengado</th>}
                            {esAdmin && <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Coste emp.</th>}
                            <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Estado</th>
                            {esAdmin && <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Pago</th>}
                            <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground whitespace-nowrap">Documento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {Object.entries(meses).sort(([a],[b]) => b - a).map(([mes, noms]) =>
                            noms.map((nom, ni) => {
                              const esDup = idsDuplicados.has(nom.id);
                              return (
                                <tr key={nom.id} className={`transition-colors ${esDup ? 'bg-red-50/40 dark:bg-red-950/10' : 'hover:bg-muted/10'}`}>
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-medium">{MESES[parseInt(mes)]}</span>
                                      {esDup && <Badge variant="destructive" className="text-[9px] px-1 py-0">DUP</Badge>}
                                      {noms.length > 1 && <span className="text-[10px] text-muted-foreground">#{ni+1}</span>}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    <span className="font-semibold text-green-700 text-sm">
                                      {nom.liquido_percibir ? nom.liquido_percibir.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}
                                    </span>
                                  </td>
                                  {esAdmin && (
                                    <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                                      {nom.total_devengado ? nom.total_devengado.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}
                                    </td>
                                  )}
                                  {esAdmin && (
                                    <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                                      {nom.coste_empresa ? nom.coste_empresa.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—'}
                                    </td>
                                  )}
                                  <td className="px-3 py-2.5 text-center">
                                    <Badge variant={nom.estado_asignacion === 'asignada' ? 'default' : 'outline'} className="text-[10px]">
                                      {nom.estado_asignacion === 'asignada' ? 'Asignada' : nom.estado_asignacion === 'revision_manual' ? 'Revisión' : 'Sin asignar'}
                                    </Badge>
                                  </td>
                                  {esAdmin && (
                                    <td className="px-3 py-2.5">
                                      <div className="flex justify-center">
                                        <EstadoPagoBadge nomina={nom} justificantes={justificantesPorNomina[nom.id] || []} />
                                      </div>
                                    </td>
                                  )}
                                  <td className="px-2 py-2 whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1">
                                      {nom.file_url && (
                                        <Button variant="outline" size="sm" className="h-7 px-2 text-[11px] gap-1 text-primary" onClick={() => onVer(nom.id)} title="Visualizar nómina">
                                          <Eye className="w-3.5 h-3.5" /> Ver
                                        </Button>
                                      )}
                                      {nom.file_url && (
                                        <Button variant="outline" size="sm" asChild className="h-7 px-2 text-[11px] gap-1 text-primary">
                                          <a href={urlDescargaNomina(nom)} target="_blank" rel="noopener noreferrer" title="Descargar nómina"><Download className="w-3.5 h-3.5" /> PDF</a>
                                        </Button>
                                      )}
                                      {esAdmin && (
                                        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => onPagos(nom)} title="Justificantes de pago">
                                          <Receipt className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                      {esAdmin && (
                                        <>
                                          <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground" onClick={() => onEditar(nom.id)} title="Editar">
                                            <Pencil className="w-3 h-3" />
                                          </Button>
                                          {confirmarBorrarId === nom.id ? (
                                            <>
                                              <Button variant="destructive" size="icon" className="w-7 h-7" onClick={() => onBorrar(nom.id)} disabled={deletePending}>
                                                {deletePending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                              </Button>
                                              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setConfirmarBorrarId(null)}><X className="w-3 h-3" /></Button>
                                            </>
                                          ) : (
                                            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmarBorrarId(nom.id)} title="Eliminar">
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ListaNominas({ esAdmin }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());
  const [editandoId, setEditandoId] = useState(null);
  const [confirmarBorrarId, setConfirmarBorrarId] = useState(null);
  const [modalDuplicados, setModalDuplicados] = useState(false);
  const [eliminandoDuplicados, setEliminandoDuplicados] = useState(false);
  const [nominaVista, setNominaVista] = useState(null);
  const [nominaPagos, setNominaPagos] = useState(null);

  const queryClient = useQueryClient();

  const { data: nominas = [], isLoading, error } = useQuery({
    queryKey: ['nominas'],
    queryFn: () => base44.entities.Nomina.list('-created_date', 500),
  });

  // Justificantes de pago (solo gerencia / administración)
  const { data: justificantes = [] } = useQuery({
    queryKey: ['justificantes-nomina'],
    queryFn: () => base44.entities.JustificanteNomina.list('-fecha_pago', 500),
    enabled: !!esAdmin,
  });

  const justificantesPorNomina = useMemo(() => {
    const map = {};
    for (const j of justificantes) {
      if (!j.nomina_id) continue;
      if (!map[j.nomina_id]) map[j.nomina_id] = [];
      map[j.nomina_id].push(j);
    }
    return map;
  }, [justificantes]);

  const gruposDuplicados = useMemo(() => detectarDuplicados(nominas), [nominas]);
  const idsDuplicados = useMemo(() => {
    const ids = new Set();
    gruposDuplicados.forEach(g => g.nominas.forEach(n => ids.add(n.id)));
    return ids;
  }, [gruposDuplicados]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Nomina.update(id, {
      ...data,
      liquido_percibir: data.liquido_percibir ? parseFloat(data.liquido_percibir) : null,
      total_devengado: data.total_devengado ? parseFloat(data.total_devengado) : null,
      coste_empresa: data.coste_empresa ? parseFloat(data.coste_empresa) : null,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['nominas'] }); setEditandoId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Nomina.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['nominas'] }); setConfirmarBorrarId(null); },
  });

  const handleEliminarDuplicados = async (ids) => {
    setEliminandoDuplicados(true);
    for (const id of ids) await base44.entities.Nomina.delete(id);
    queryClient.invalidateQueries({ queryKey: ['nominas'] });
    setEliminandoDuplicados(false);
    setModalDuplicados(false);
  };

  const nominasFiltradas = nominas.filter(n => {
    const coincideBusqueda = !busqueda ||
      (n.operario_name || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (n.operario_dni || '').toLowerCase().includes(busqueda.toLowerCase());
    const coincideMes = !filtroMes || n.mes === parseInt(filtroMes);
    const coincideAnio = !filtroAnio || n.anio === parseInt(filtroAnio);
    return coincideBusqueda && coincideMes && coincideAnio;
  });

  // Nómina en edición (puede estar oculta por filtros, buscamos en todas)
  const nominaEditando = editandoId ? nominas.find(n => n.id === editandoId) : null;

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
      <AlertTriangle className="w-8 h-8 text-amber-500" />
      <p className="text-sm font-medium">No se pudieron cargar las nóminas</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Ha ocurrido un error de conexión o de permisos. Si el problema persiste, contacta con administración.
      </p>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => queryClient.invalidateQueries({ queryKey: ['nominas'] })}>
        Reintentar
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {esAdmin && gruposDuplicados.length > 0 && (
        <AlertaDuplicados grupos={gruposDuplicados} onVerDuplicados={() => setModalDuplicados(true)} />
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar trabajador o DNI..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="pl-9" />
        </div>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">Todos los meses</option>
          {MESES.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">Todos los años</option>
          {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Tabla agrupada por trabajador */}
      <TablaResumen
        nominas={nominasFiltradas}
        esAdmin={esAdmin}
        idsDuplicados={idsDuplicados}
        onEditar={(id) => setEditandoId(editandoId === id ? null : id)}
        onBorrar={(id) => deleteMutation.mutate(id)}
        onVer={(id) => setNominaVista(nominas.find(n => n.id === id))}
        onPagos={(nom) => setNominaPagos(nom)}
        justificantesPorNomina={justificantesPorNomina}
        confirmarBorrarId={confirmarBorrarId}
        setConfirmarBorrarId={setConfirmarBorrarId}
        deletePending={deleteMutation.isPending}
      />

      {/* Formulario edición (slide-in sobre el componente) */}
      {nominaEditando && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4 bg-background/95 backdrop-blur border-t border-border shadow-2xl sm:static sm:rounded-xl sm:border sm:shadow-none sm:bg-transparent sm:p-0">
          <p className="text-xs font-semibold text-muted-foreground mb-2 sm:hidden">Editando: {nominaEditando.operario_name}</p>
          <EditForm
            nom={nominaEditando}
            onSave={(data) => updateMutation.mutate({ id: nominaEditando.id, data })}
            onCancel={() => setEditandoId(null)}
            saving={updateMutation.isPending}
          />
        </div>
      )}

      {modalDuplicados && (
        <ModalDuplicados
          grupos={gruposDuplicados}
          onClose={() => setModalDuplicados(false)}
          onEliminar={handleEliminarDuplicados}
          eliminando={eliminandoDuplicados}
        />
      )}

      {nominaVista && (
        <VisorNomina nom={nominaVista} onClose={() => setNominaVista(null)} />
      )}

      {nominaPagos && (
        <JustificantesPagoDialog
          nomina={nominaPagos}
          justificantes={justificantesPorNomina[nominaPagos.id] || []}
          onClose={() => setNominaPagos(null)}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ['justificantes-nomina'] });
            queryClient.invalidateQueries({ queryKey: ['nominas'] });
          }}
        />
      )}
    </div>
  );
}