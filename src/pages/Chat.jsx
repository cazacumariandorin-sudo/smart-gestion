import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Plus, MessageSquare, Users, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';

export default function Chat() {
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvName, setNewConvName] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    if (selectedConvId) queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedConvId] });
  }, [queryClient, selectedConvId]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: conversations = [] } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => base44.entities.ChatConversacion.list('-updated_date', 50),
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', selectedConvId],
    queryFn: () => selectedConvId
      ? base44.entities.ChatMensaje.filter({ conversacion_id: selectedConvId }, 'created_date', 100)
      : [],
    enabled: !!selectedConvId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (text) => base44.entities.ChatMensaje.create({
      conversacion_id: selectedConvId,
      autor_email: currentUser?.email || '',
      autor_nombre: currentUser?.full_name || currentUser?.email || '',
      mensaje_cifrado: text,
      iv: 'plain',
      fecha_envio: new Date().toISOString(),
      tipo_mensaje: 'texto',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedConvId] });
      setNewMessage('');
    },
  });

  const createConvMutation = useMutation({
    mutationFn: (name) => base44.entities.ChatConversacion.create({
      nombre: name,
      tipo: 'grupo',
      participantes: [{ user_email: currentUser?.email, nombre_display: currentUser?.full_name || currentUser?.email }],
      cifrado_activo: false,
    }),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      setSelectedConvId(conv.id);
      setShowNewConv(false);
      setNewConvName('');
    },
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvId) return;
    sendMutation.mutate(newMessage.trim());
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background relative">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      {/* Sidebar conversaciones */}
      <div className="w-72 border-r border-border flex flex-col bg-card shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-sm">Mensajes</h2>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowNewConv(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {showNewConv && (
          <div className="p-3 border-b border-border bg-muted/40">
            <Input
              placeholder="Nombre de la conversación..."
              value={newConvName}
              onChange={e => setNewConvName(e.target.value)}
              className="mb-2 h-8 text-sm"
              onKeyDown={e => e.key === 'Enter' && newConvName.trim() && createConvMutation.mutate(newConvName.trim())}
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => newConvName.trim() && createConvMutation.mutate(newConvName.trim())}>Crear</Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setShowNewConv(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No hay conversaciones
            </div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConvId(conv.id)}
              className={cn(
                'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors',
                selectedConvId === conv.id && 'bg-primary/10 border-l-2 border-l-primary'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  {conv.tipo === 'directo' ? <MessageSquare className="w-3.5 h-3.5 text-primary" /> : <Users className="w-3.5 h-3.5 text-primary" />}
                </div>
                <span className="font-medium text-sm truncate">{conv.nombre || 'Sin nombre'}</span>
                {conv.cifrado_activo && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
              </div>
              {conv.ultimo_mensaje_texto && (
                <p className="text-xs text-muted-foreground truncate pl-9">{conv.ultimo_mensaje_texto}</p>
              )}
              {conv.ultimo_mensaje_fecha && (
                <p className="text-[10px] text-muted-foreground pl-9 mt-0.5">
                  {format(new Date(conv.ultimo_mensaje_fecha), 'dd MMM HH:mm', { locale: es })}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Panel mensajes */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedConvId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="text-sm">Selecciona una conversación</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{selectedConv?.nombre || 'Conversación'}</h3>
                <p className="text-xs text-muted-foreground capitalize">{selectedConv?.tipo}</p>
              </div>
              {selectedConv?.cifrado_activo && (
                <Badge variant="outline" className="ml-auto text-xs flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Cifrado
                </Badge>
              )}
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => {
                const isOwn = msg.autor_email === currentUser?.email || msg.created_by === currentUser?.email;
                return (
                  <div key={msg.id} className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
                    {!isOwn && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                        {(msg.autor_nombre || msg.autor_email || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className={cn('max-w-[70%]', isOwn ? 'items-end' : 'items-start', 'flex flex-col gap-0.5')}>
                      {!isOwn && <span className="text-xs text-muted-foreground px-1">{msg.autor_nombre || msg.autor_email}</span>}
                      <div className={cn(
                        'px-3 py-2 rounded-2xl text-sm',
                        isOwn ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'
                      )}>
                        {msg.mensaje_cifrado}
                      </div>
                      <span className="text-[10px] text-muted-foreground px-1">
                        {msg.fecha_envio ? format(new Date(msg.fecha_envio), 'HH:mm') : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 border-t border-border bg-card flex gap-2">
              <Input
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim() || sendMutation.isPending}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}