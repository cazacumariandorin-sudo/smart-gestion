import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, X, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { corregirTextoIA, MIN_LEN_AUTOCORRECCION } from '@/lib/correction';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ChatInput({ onSend, disabled, replyMsg, onCancelReply }) {
  const [text, setText] = useState('');
  const [adjuntos, setAdjuntos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px'; // max 4 lines ~96px
  }, [text]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && adjuntos.length === 0) || disabled || uploading) return;
    let textoFinal = text.trim();
    // Corrección ortográfica/gramatical automática en mensajes con suficiente longitud
    if (textoFinal.length >= MIN_LEN_AUTOCORRECCION) {
      try {
        const corregido = await corregirTextoIA(textoFinal);
        if (corregido && corregido !== textoFinal) textoFinal = corregido;
      } catch { /* silencioso: no interrumpir el envío */ }
    }
    onSend(textoFinal, adjuntos, replyMsg);
    setText('');
    setAdjuntos([]);
    if (onCancelReply) onCancelReply();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const uploadRes = await base44.functions.invoke('subirArchivoConFallback', {
          file_base64: file,
          ruta_drive: 'Chat/Adjuntos',
          entidad_tipo: 'ChatMensaje',
          entidad_id: null,
        });
        const file_url = uploadRes.data?.cdn_url_para_llm || uploadRes.data?.file_url;
        uploaded.push({ nombre: file.name, url: file_url, tipo: file.type, size_bytes: file.size });
      }
      setAdjuntos(prev => [...prev, ...uploaded]);
    } catch (err) {
      toast.error('Error al subir archivo: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const canSend = (text.trim() || adjuntos.length > 0) && !disabled && !uploading;

  return (
    <div className="border-t border-border bg-card px-3 py-2 space-y-2">
      {/* Reply preview */}
      {replyMsg && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 text-xs">
          <Reply className="w-3 h-3 text-primary shrink-0" />
          <span className="flex-1 truncate text-muted-foreground">{replyMsg._previewText || 'Respondiendo...'}</span>
          <button onClick={onCancelReply} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Adjuntos preview */}
      {adjuntos.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {adjuntos.map((adj, i) => (
            <div key={i} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1 text-xs">
              <Paperclip className="w-3 h-3" />
              <span className="max-w-[120px] truncate">{adj.nombre}</span>
              <button
                onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Paperclip className={cn('w-4 h-4', uploading && 'animate-pulse')} />
        </Button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          disabled={disabled}
          className={cn(
            'flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'min-h-[36px] max-h-24 overflow-y-auto'
          )}
        />

        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={!canSend}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}