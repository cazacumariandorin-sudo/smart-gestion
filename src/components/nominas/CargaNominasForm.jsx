import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function CargaNominasForm({ onResultado }) {
  const [archivo, setArchivo] = useState(null);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState('');
  const inputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setArchivo(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') setArchivo(file);
  };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleProcesar = async () => {
    if (!archivo) return;
    setProcesando(true);
    setProgreso('Leyendo PDF...');
    try {
      const pdf_base64 = await toBase64(archivo);
      setProgreso('Extrayendo datos con IA...');
      const res = await base44.functions.invoke('procesarNominas', {
        pdf_base64,
        mes: parseInt(mes),
        anio: parseInt(anio),
        nombre_archivo: archivo.name
      });
      setProgreso('');
      onResultado(res.data);
      setArchivo(null);
    } catch (err) {
      setProgreso('');
      onResultado({ error: err.message || 'Error al procesar' });
    } finally {
      setProcesando(false);
    }
  };

  const anios = [anio - 1, anio, anio + 1];

  return (
    <div className="space-y-4">
      {/* Selector de período */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mes</label>
          <select
            value={mes}
            onChange={e => setMes(e.target.value)}
            disabled={procesando}
            className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {MESES.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Año</label>
          <select
            value={anio}
            onChange={e => setAnio(e.target.value)}
            disabled={procesando}
            className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !procesando && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${archivo ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
          ${procesando ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
        {archivo ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div className="text-left">
              <p className="font-medium text-sm">{archivo.name}</p>
              <p className="text-xs text-muted-foreground">{(archivo.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setArchivo(null); }}
              className="ml-2 p-1 rounded-full hover:bg-destructive/10"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-sm">Arrastra el PDF de nóminas aquí</p>
            <p className="text-xs text-muted-foreground mt-1">o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground mt-3 bg-muted/40 rounded px-2 py-1 inline-block">
              Formato: PDF con todas las nóminas del mes (una por página)
            </p>
          </>
        )}
      </div>

      {/* Progreso */}
      {procesando && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary">Procesando nóminas...</p>
            <p className="text-xs text-muted-foreground">{progreso}</p>
          </div>
        </div>
      )}

      <Button
        onClick={handleProcesar}
        disabled={!archivo || procesando}
        className="w-full"
      >
        {procesando ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Procesando...</>
        ) : (
          <><Upload className="w-4 h-4 mr-2" /> Procesar y Asignar Nóminas</>
        )}
      </Button>
    </div>
  );
}