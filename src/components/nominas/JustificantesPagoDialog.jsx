import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X, Upload, Loader2, FileText, Trash2, CheckCircle2, AlertCircle, ExternalLink, Wallet,
} from 'lucide-react';
import { resumenPago, estadoPago, eur } from '@/lib/pagosNomina';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Justificantes de pago de una nómina (solo gerencia / administración).
 * Permite subir pagos parciales y bajarlos; la nómina se marca pagada
 * automáticamente cuando la suma de justificantes alcanza el líquido a percibir.
 */
export default function JustificantesPagoDialog({ nomina, justificantes = [], onClose, onChanged }) {
  const { liquido, pagado, falta, estado } = resumenPago(nomina, justificantes);
  const cerrado = estado === 'pagado';

  const [form, setForm] = useState({ importe: '', fecha: hoy(), metodo: 'transferencia', notas: '' });
  const [archivo, setArchivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState(null);
  const inputFile = useRef(null);

  // Propone el importe que falta al abrir el diálogo
  useEffect(() => {
    if (falta > 0) setForm(f => ({ ...f, importe: falta.toFixed(2) }));
  }, [falta]);

  const periodo = nomina.periodo || `${MESES[nomina.mes] || ''} ${nomina.anio || ''}`.trim();

  const sincronizarNomina = async (nuevoTotal) => {
    await base44.entities.Nomina.update(nomina.id, {
      importe_pagado: Math.round(nuevoTotal * 100) / 100,
      estado_pago: estadoPago(liquido, nuevoTotal) === 'sin_importe'
        ? 'pendiente'
        : estadoPago(liquido, nuevoTotal),
    });
  };

  const guardar = async () => {
    setError('');
    const importe = parseFloat(String(form.importe).replace(',', '.'));
    if (!importe || importe <= 0) {
      setError('Indica un importe válido.');
      return;
    }
    setBusy(true);
    try {
      let file_uri = null;
      let nombre_archivo = null;
      if (archivo) {
        const subido = await base44.integrations.Core.UploadPrivateFile({ file: archivo });
        file_uri = subido.file_uri;
        nombre_archivo = archivo.name;
      }
      let user = null;
      try { user = await base44.auth.me(); } catch { user = null; }

      await base44.entities.JustificanteNomina.create({
        nomina_id: nomina.id,
        operario_name: nomina.operario_name,
        periodo,
        importe,
        fecha_pago: form.fecha || hoy(),
        metodo: form.metodo,
        notas: form.notas || undefined,
        file_uri: file_uri || undefined,
        nombre_archivo: nombre_archivo || undefined,
        subido_por: user?.email,
        subido_por_nombre: user?.full_name,
      });

      await sincronizarNomina(pagado + importe);
      onChanged();
      setForm({ importe: '', fecha: hoy(), metodo: 'transferencia', notas: '' });
      setArchivo(null);
      if (inputFile.current) inputFile.current.value = '';
    } catch (e) {
      setError(e?.message || 'No se pudo guardar el justificante.');
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (j) => {
    setBusy(true);
    setError('');
    try {
      await base44.entities.JustificanteNomina.delete(j.id);
      await sincronizarNomina(Math.max(0, pagado - (Number(j.importe) || 0)));
      onChanged();
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar el justificante.');
    } finally {
      setBusy(false);
    }
  };

  const abrirArchivo = async (j) => {
    if (!j.file_uri) return;
    setAbriendo(j.id);
    setError('');
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: j.file_uri, expires_in: 3600 });
      window.open(signed_url, '_blank', 'noopener');
    } catch {
      setError('No se pudo abrir el justificante.');
    } finally {
      setAbriendo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Justificantes de pago
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {nomina.operario_name || 'Trabajador'} · {periodo}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Resumen cobrado / pendiente */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Líquido</p>
              <p className="text-sm font-semibold">{eur(liquido)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Cobrado</p>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{eur(pagado)}</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${falta > 0
              ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800'
              : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800'}`}>
              <p className={`text-[10px] uppercase tracking-wide ${falta > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>Falta</p>
              <p className={`text-sm font-semibold ${falta > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{eur(falta)}</p>
            </div>
          </div>

          {cerrado && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Nómina pagada · ciclo de pago cerrado</p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/70">
                  Los justificantes cubren el líquido a percibir. Si eliminas un pago, el ciclo se reabre.
                </p>
              </div>
            </div>
          )}

          {/* Lista de justificantes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Pagos registrados ({justificantes.length})
            </p>
            {justificantes.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border rounded-xl">
                <FileText className="w-7 h-7 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Todavía no hay justificantes de pago</p>
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                {justificantes.map(j => (
                  <div key={j.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{eur(j.importe)}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {j.fecha_pago || '—'} · {j.metodo || 'transferencia'}
                        {j.nombre_archivo ? ` · ${j.nombre_archivo}` : ''}
                      </p>
                      {j.notas && <p className="text-[11px] text-muted-foreground/80 truncate">{j.notas}</p>}
                    </div>
                    {j.file_uri && (
                      <Button variant="ghost" size="icon" className="w-8 h-8" title="Ver justificante"
                        disabled={abriendo === j.id} onClick={() => abrirArchivo(j)}>
                        {abriendo === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive"
                      title="Quitar justificante" disabled={busy} onClick={() => borrar(j)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alta de justificante */}
          <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/20">
            <p className="text-xs font-semibold">Añadir pago</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Importe (€)</label>
                <Input type="number" step="0.01" inputMode="decimal" value={form.importe}
                  onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} className="h-9 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Fecha de pago</label>
                <Input type="date" value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className="h-9 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Forma de pago</label>
                <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm mt-0.5">
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="confirming">Confirming</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Justificante</label>
                <input ref={inputFile} type="file" accept="application/pdf,image/*"
                  onChange={e => setArchivo(e.target.files?.[0] || null)}
                  className="w-full h-9 mt-0.5 text-xs rounded-md border border-input bg-transparent px-2 file:mr-2 file:h-7 file:rounded file:border-0 file:bg-muted file:px-2 file:text-xs" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Notas (opcional)</label>
                <Input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  className="h-9 text-sm mt-0.5" placeholder="Ej. primer pago a cuenta" />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full gap-2" size="sm" onClick={guardar} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {busy ? 'Guardando...' : 'Adjuntar justificante'}
            </Button>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" /> El justificante se guarda en almacenamiento privado y solo es accesible para gerencia y administración.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}