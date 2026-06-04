import { useState } from 'react';
import { Lock, Reply, Check, CheckCheck, Paperclip, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function TickEstado({ msg, isOwn, currentUser }) {
  if (!isOwn) return null;
  const leidoPorTodos = msg.leido_por && msg.leido_por.length > 1;
  const entregado = msg.leido_por && msg.leido_por.length > 0;
  if (leidoPorTodos) return <CheckCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  if (entregado) return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  return <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
}

export default function ChatMessageBubble({ msg, isOwn, textoMostrar, onReply, mensajesDescifrados }) {
  const [hovered, setHovered] = useState(false);

  const tieneAdjuntos = msg.adjuntos && msg.adjuntos.length > 0;
  const esImagen = (adj) => adj.tipo && adj.tipo.startsWith('image/');

  return (
    <div
      className={cn('flex gap-2 group relative', isOwn ? 'justify-end' : 'justify-start')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 mt-1">
          {(msg.autor_nombre || msg.autor_email || '?')[0].toUpperCase()}
        </div>
      )}

      <div className={cn('max-w-[70%] flex flex-col gap-0.5', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && (
          <span className="text-xs text-muted-foreground px-1">{msg.autor_nombre || msg.autor_email}</span>
        )}

        {/* Reply preview */}
        {msg.reply_a_id && msg.reply_preview && (
          <div className={cn(
            'text-xs px-2 py-1 rounded border-l-2 border-primary bg-muted/60 max-w-full truncate mb-0.5',
            isOwn ? 'self-end' : 'self-start'
          )}>
            <Reply className="w-3 h-3 inline mr-1 opacity-60" />
            {msg.reply_preview}
          </div>
        )}

        {/* Bubble */}
        <div className={cn(
          'px-3 py-2 rounded-2xl text-sm relative',
          isOwn
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted rounded-tl-sm',
          msg.tipo_mensaje === 'cifrado' && 'border border-primary/30'
        )}>
          {msg.tipo_mensaje === 'cifrado' && (
            <Lock className="w-2.5 h-2.5 absolute -top-1 -right-1 text-primary bg-background rounded-full p-0.5" />
          )}

          {/* Texto */}
          {textoMostrar && (
            <p className="whitespace-pre-wrap break-words">{textoMostrar}</p>
          )}

          {/* Adjuntos */}
          {tieneAdjuntos && (
            <div className="mt-1 space-y-1">
              {msg.adjuntos.map((adj, i) => (
                esImagen(adj) ? (
                  <a key={i} href={adj.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={adj.url}
                      alt={adj.nombre || 'imagen'}
                      className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <a
                    key={i}
                    href={adj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs',
                      isOwn ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' : 'bg-background/60 hover:bg-background'
                    )}
                  >
                    <Paperclip className="w-3 h-3 shrink-0" />
                    <span className="truncate">{adj.nombre}</span>
                  </a>
                )
              ))}
            </div>
          )}
        </div>

        {/* Hora + ticks */}
        <div className="flex items-center gap-1 px-1">
          <span className="text-[10px] text-muted-foreground">
            {msg.fecha_envio ? format(new Date(msg.fecha_envio), 'HH:mm') : ''}
          </span>
          <TickEstado msg={msg} isOwn={isOwn} />
        </div>
      </div>

      {/* Botón reply (aparece al hover) */}
      {hovered && onReply && (
        <button
          onClick={() => onReply(msg, textoMostrar)}
          className={cn(
            'absolute top-0 p-1 rounded-full bg-background border border-border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity',
            isOwn ? 'right-full mr-1' : 'left-full ml-1'
          )}
          title="Responder"
        >
          <Reply className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}