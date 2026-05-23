import { AlertTriangle } from 'lucide-react';

export default function DuplicadoInlineWarning({ duplicados = [] }) {
  if (!duplicados.length) return null;
  const top = duplicados[0];
  const isHigh = top.similitud >= 0.92;
  return (
    <div className={`flex items-start gap-1.5 text-xs rounded-md px-2 py-1.5 mt-1 ${isHigh ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>
        Posible duplicado: <strong>{top.name}</strong> ({Math.round(top.similitud * 100)}% similar)
        {duplicados.length > 1 && ` y ${duplicados.length - 1} más`}
      </span>
    </div>
  );
}