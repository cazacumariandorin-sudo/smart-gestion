/**
 * ImportarClientesCSV — FASE 1: vista previa de la importación de clientes desde el export
 * del programa de contabilidad. NO guarda nada: solo lee el archivo, lo compara con la tabla
 * Client (por NIF normalizado) y muestra qué se crearía, actualizaría o requiere revisión.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, AlertTriangle, Info } from 'lucide-react';
import { decodificar, analizarClientes } from '@/lib/clientesImport';

const ETIQUETA = {
  name: 'Nombre', nif: 'NIF', address: 'Dirección', postal_code: 'C.P.', localidad: 'Población',
  provincia: 'Provincia', pais: 'País', telefono: 'Teléfono', email: 'Email', web: 'Web',
};
const COLOR_CAMBIO = {
  rellenar: 'text-emerald-700',
  diferencia: 'text-amber-700 font-medium',
  limpieza: 'text-muted-foreground',
};

async function cargarTodosLosClientes() {
  const todos = [];
  for (let p = 0; p < 20; p++) {
    const lote = await base44.entities.Client.list('name', 500, p * 500);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todos.push(...lote);
    if (lote.length < 500) break;
  }
  return todos;
}

function Cambios({ cambios }) {
  return (
    <ul className="mt-0.5 space-y-0.5">
      {cambios.map((c, i) => (
        <li key={i} className={`text-[11px] ${COLOR_CAMBIO[c.tipo]}`}>
          {ETIQUETA[c.campo] || c.campo}: {c.de ? <><span className="line-through opacity-70">{c.de}</span> → </> : '+ '}{c.a}
          {c.tipo === 'diferencia' && <span className="ml-1">(distinto: hay que decidir)</span>}
          {c.tipo === 'limpieza' && <span className="ml-1">(limpieza del NIF)</span>}
        </li>
      ))}
    </ul>
  );
}

function Fila({ f }) {
  return (
    <div className="py-1.5 border-b last:border-0 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{f.csv.name || '(sin nombre)'}</span>
        <span className="font-mono text-muted-foreground">{f.csv.nifOriginal || 'sin NIF'}</span>
        {f.particular && <Badge variant="outline" className="text-[9px] h-4 px-1">particular</Badge>}
        {f.existente && <span className="text-muted-foreground">→ en la app: {f.existente.name}</span>}
      </div>
      {f.motivo && <p className="text-amber-700 flex items-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" />{f.motivo}</p>}
      {f.avisos.map((a, i) => <p key={i} className="text-amber-700 text-[11px]">⚠ {a}</p>)}
      {f.candidatos.length > 0 && (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Candidatos en la app: {f.candidatos.map((c) => `${c.name}${c.nif ? ` (${c.nif.trim()})` : ''}${c.similitud ? ` ${c.similitud}%` : ''}`).join(' · ')}
        </p>
      )}
      {f.accion === 'actualizar' && <Cambios cambios={f.cambios} />}
      {f.accion === 'crear' && (
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {[f.csv.address, f.csv.postal_code, f.csv.localidad, f.csv.provincia].filter(Boolean).join(', ') || 'Sin dirección'}
        </p>
      )}
    </div>
  );
}

function Grupo({ titulo, color, filas, abierto = false }) {
  if (!filas.length) return null;
  return (
    <details open={abierto} className="rounded-md border">
      <summary className={`cursor-pointer px-3 py-2 text-sm font-medium ${color}`}>{titulo} ({filas.length})</summary>
      <div className="px-3 pb-2 max-h-72 overflow-y-auto">{filas.map((f) => <Fila key={f.linea} f={f} />)}</div>
    </details>
  );
}

export default function ImportarClientesCSV({ open, onClose }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);
  const [nombre, setNombre] = useState('');

  const cerrar = () => { setRes(null); setError(''); setNombre(''); onClose(); };

  const onArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCargando(true); setError(''); setRes(null); setNombre(file.name);
    try {
      const texto = decodificar(await file.arrayBuffer());
      const [clientes, empresas] = await Promise.all([
        cargarTodosLosClientes(),
        base44.entities.Empresa.list('-created_date', 50).catch(() => []),
      ]);
      const r = analizarClientes(texto, clientes, { nifsPropios: (empresas || []).map((x) => x.cif).filter(Boolean) });
      if (!r.filas.length) setError('No se han encontrado clientes en el archivo. Debe ser el export de contabilidad con la sección CLIENTES (NIF, NOMBRE O RAZÓN SOCIAL, …).');
      else setRes(r);
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo');
    } finally {
      setCargando(false);
    }
  };

  const por = (a) => (res ? res.filas.filter((f) => f.accion === a) : []);
  const R = res?.resumen;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar clientes desde contabilidad (CSV)</DialogTitle></DialogHeader>

        <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-2.5 text-xs flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p><b>Vista previa.</b> Aquí no se guarda nada en la app. Se compara por NIF (sin espacios ni tabuladores) y nunca se vincula ni se crea un cliente por parecido de nombre sin revisión. Los proveedores, las cuentas bancarias y las notas privadas del archivo se ignoran.</p>
        </div>

        <div className="flex items-center gap-3">
          <input type="file" accept=".csv,.tsv,.txt" onChange={onArchivo} className="text-xs" disabled={cargando} />
          {cargando && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {nombre && !cargando && <span className="text-xs text-muted-foreground">{nombre}</span>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {res && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {[
                ['Actualizar', R.actualizar, 'text-blue-700'], ['Crear', R.crear, 'text-emerald-700'], ['Sin cambios', R.sin_cambios, 'text-muted-foreground'],
                ['Revisar', R.revisar, 'text-amber-700'], ['Conflictos', R.conflicto, 'text-red-700'], ['Proveedores ignorados', R.proveedores_ignorados, 'text-muted-foreground'],
              ].map(([l, n, c]) => (
                <div key={l} className="rounded-md border p-2"><p className={`text-lg font-bold ${c}`}>{n}</p><p className="text-[10px] text-muted-foreground leading-tight">{l}</p></div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {R.clientes} clientes en el archivo · {R.particulares} son particulares (datos personales) · {R.con_diferencias} con datos distintos a los de la app · {R.nif_con_limpieza} NIF de la app con espacios o tabuladores que se limpiarían · {R.nif_invalidos} NIF que no superan la validación.
            </p>

            <Grupo titulo="Conflictos: no se tocan hasta resolverlos" color="text-red-700" filas={por('conflicto')} abierto />
            <Grupo titulo="Revisar: no se crean ni se vinculan solos" color="text-amber-700" filas={por('revisar')} abierto />
            <Grupo titulo="Actualizar (mismo NIF)" color="text-blue-700" filas={por('actualizar')} />
            <Grupo titulo="Crear (clientes nuevos)" color="text-emerald-700" filas={por('crear')} />
            <Grupo titulo="Sin cambios" color="text-muted-foreground" filas={por('sin_cambios')} />

            {res.duplicadosApp.length > 0 && (
              <details className="rounded-md border border-amber-300">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-amber-700">Problemas que ya hay en la app ({res.duplicadosApp.length})</summary>
                <ul className="px-3 pb-2 text-xs space-y-1">
                  {res.duplicadosApp.map((d, i) => <li key={i}><b>{d.tipo}</b>: {d.clientes.map((c) => c.name).join(' · ')}</li>)}
                </ul>
              </details>
            )}
            <p className="text-[11px] text-muted-foreground">Sin leer ni importar: {res.ignorado.join(', ')}. Hay {R.ausentes_en_csv} clientes de la app que no aparecen en el archivo (no se tocarían).</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Icono exportado para el botón de la pantalla de Clientes
export { Upload as ImportIcon };
