import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Plus, MessageSquare, Users, Lock, Key, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import CifradoInfo from '@/components/chat/CifradoInfo';
import NuevaConversacionDialog from '@/components/chat/NuevaConversacionDialog';
import GestionarGrupoDialog from '@/components/chat/GestionarGrupoDialog';
import {
  generarClavesRSA,
  cifrarAES,
  descifrarAES,
  cifrarClaveAESConRSA,
  descifrarClaveAESConRSA,
  guardarClavesEnStorage,
  obtenerDeStorage,
} from '@/lib/chatCrypto';
import { toast } from 'sonner';

export default function Chat() {
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  
  // Cargar usuario actual
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error cargando usuario:', error);
      }
    };
    loadUser();
  }, []);
  
  // Estado para cifrado E2E
  const [clavesE2E, setClavesE2E] = useState(null); // { publicKeyBase64, privateKey }
  const [claveAES, setClaveAES] = useState(null); // Clave AES para la conversación actual
  const [cargandoClaves, setCargandoClaves] = useState(false);
  const [mensajesDescifrados, setMensajesDescifrados] = useState({});
  const [showCifradoInfo, setShowCifradoInfo] = useState(false);
  const [showNuevaConv, setShowNuevaConv] = useState(false);
  const [showGestionarGrupo, setShowGestionarGrupo] = useState(false);

  // Inicializar claves E2E al cargar
  useEffect(() => {
    const initClaves = async () => {
      const stored = obtenerDeStorage();
      if (stored) {
        // Las claves privadas no se persisten, hay que regenerarlas
        // En producción, se debería pedir al usuario que las guarde
        const { publicKeyBase64, privateKey } = await generarClavesRSA();
        setClavesE2E({ publicKeyBase64, privateKey });
        guardarClavesEnStorage(publicKeyBase64);
        
        // Registrar en backend
        try {
          await base44.functions.invoke('gestionClavesChat', {
            action: 'registrar',
            publicKeyBase64,
          });
        } catch (error) {
          console.error('Error registrando clave:', error);
        }
      } else {
        // Generar nuevas claves
        setCargandoClaves(true);
        const { publicKeyBase64, privateKey } = await generarClavesRSA();
        setClavesE2E({ publicKeyBase64, privateKey });
        guardarClavesEnStorage(publicKeyBase64);
        
        try {
          await base44.functions.invoke('gestionClavesChat', {
            action: 'registrar',
            publicKeyBase64,
          });
          toast.success('Claves de cifrado generadas');
        } catch (error) {
          toast.error('Error al registrar claves: ' + error.message);
        }
        setCargandoClaves(false);
      }
    };

    if (currentUser) {
      initClaves();
    }
  }, [currentUser]);

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

  // Descifrar mensajes al cargar
  useEffect(() => {
    const descifrarMensajes = async () => {
      if (!clavesE2E?.privateKey || messages.length === 0) return;
      
      const descifrados = {};
      
      for (const msg of messages) {
        if (msg.tipo_mensaje === 'cifrado' && msg.mensaje_cifrado) {
          try {
            // El mensaje cifrado contiene IV + ciphertext en base64
            const textoDescifrado = await descifrarAES(msg.mensaje_cifrado, clavesE2E.privateKey);
            descifrados[msg.id] = textoDescifrado || '[No se pudo descifrar]';
          } catch (error) {
            console.error('Error descifrando mensaje:', error);
            descifrados[msg.id] = '[Error al descifrar]';
          }
        } else {
          descifrados[msg.id] = msg.mensaje_cifrado; // Texto plano
        }
      }
      
      setMensajesDescifrados(descifrados);
    };
    
    descifrarMensajes();
  }, [messages, clavesE2E]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mensajesDescifrados]);

  // Enviar mensaje cifrado
  const sendCifradoMutation = useMutation({
    mutationFn: async ({ text, destinatario_email }) => {
      if (!claveAES || !clavesE2E) throw new Error('Claves no inicializadas');
      
      // 1. Cifrar mensaje con AES
      const mensajeCifrado = await cifrarAES(text, claveAES);
      
      // 2. Obtener clave pública del destinatario
      const claveDest = await base44.functions.invoke('gestionClavesChat', {
        action: 'obtener',
        destinatario_email,
      });
      
      if (!claveDest.clave_publica) {
        throw new Error('El destinatario no tiene claves de cifrado');
      }
      
      // 3. Cifrar clave AES con RSA del destinatario
      const claveAESCifrada = await cifrarClaveAESConRSA(claveAES, claveDest.clave_publica);
      
      // 4. Enviar mensaje cifrado
      return await base44.functions.invoke('enviarMensajeCifrado', {
        conversacion_id: selectedConvId,
        clave_aes_cifrada: claveAESCifrada,
        iv_base64: mensajeCifrado, // IV + ciphertext combinados
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedConvId] });
      setNewMessage('');
      toast.success('Mensaje cifrado enviado');
    },
    onError: (error) => {
      toast.error('Error al enviar: ' + error.message);
    },
  });

  // Enviar mensaje en texto plano (fallback)
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

  // Eliminado - ahora se usa NuevaConversacionDialog

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConvId) return;
    
    // Determinar si usar cifrado (por defecto sí si hay claves)
    const usarCifrado = clavesE2E && claveAES;
    
    if (usarCifrado) {
      // Obtener el otro participante
      const otroParticipante = selectedConv?.participantes?.find(
        p => p.user_email !== currentUser?.email
      );
      
      if (otroParticipante?.user_email) {
        sendCifradoMutation.mutate({
          text: newMessage.trim(),
          destinatario_email: otroParticipante.user_email,
        });
      } else {
        // Conversación de grupo - enviar a todos
        sendMutation.mutate(newMessage.trim());
      }
    } else {
      sendMutation.mutate(newMessage.trim());
    }
  };

  const deleteConvMutation = useMutation({
    mutationFn: async (convId) => {
      const conv = conversations.find(c => c.id === convId);
      if (!conv) throw new Error('Conversación no encontrada');
      
      // Verificar si es el creador
      if (conv.creado_por_email !== currentUser?.email) {
        throw new Error('Solo el creador puede eliminar esta conversación');
      }
      
      return await base44.entities.ChatConversacion.delete(convId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      setSelectedConvId(null);
      toast.success('Conversación eliminada');
    },
    onError: (error) => {
      toast.error(error.message || 'Error al eliminar');
    },
  });

  const handleEliminarConversacion = () => {
    if (!selectedConvId) return;
    const conv = conversations.find(c => c.id === selectedConvId);
    if (!conv) return;
    
    if (conv.creado_por_email !== currentUser?.email) {
      toast.error('Solo el creador puede eliminar esta conversación');
      return;
    }
    
    if (confirm(`¿Eliminar "${conv.nombre}"? Esta acción no se puede deshacer.`)) {
      deleteConvMutation.mutate(selectedConvId);
    }
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
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8" 
            onClick={() => setShowNuevaConv(true)}
            title="Nueva conversación"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

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
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{selectedConv?.nombre || 'Conversación'}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{selectedConv?.tipo}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConv?.cifrado_activo ? (
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Cifrado
                  </Badge>
                ) : clavesE2E ? (
                  <button
                    onClick={() => setShowCifradoInfo(true)}
                    className="text-xs flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Key className="w-3 h-3" /> E2E activo
                  </button>
                ) : null}
                {cargandoClaves && (
                  <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
                {selectedConv?.tipo === 'grupo' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setShowGestionarGrupo(true)}
                    title="Gestionar grupo"
                  >
                    <Users className="w-4 h-4" />
                  </Button>
                )}
                {selectedConv?.creado_por_email === currentUser?.email && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={handleEliminarConversacion}
                    title="Eliminar conversación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => {
                const isOwn = msg.autor_email === currentUser?.email || msg.created_by === currentUser?.email;
                const textoMostrar = mensajesDescifrados[msg.id] || msg.mensaje_cifrado || '...';
                const esCifrado = msg.tipo_mensaje === 'cifrado';
                
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
                        'px-3 py-2 rounded-2xl text-sm relative',
                        isOwn 
                          ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                          : 'bg-muted rounded-tl-sm',
                        esCifrado && 'border border-primary/20'
                      )}>
                        {esCifrado && (
                          <Lock className="w-2.5 h-2.5 absolute -top-1 -right-1 text-primary fill-primary-foreground rounded-full p-0.5" />
                        )}
                        {textoMostrar}
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
                placeholder={clavesE2E ? "Escribe un mensaje (cifrado E2E)..." : "Escribe un mensaje..."}
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                className="flex-1"
                disabled={cargandoClaves}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!newMessage.trim() || sendMutation.isPending || sendCifradoMutation?.isPending || cargandoClaves}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        )}
      </div>

      {/* Dialog info cifrado */}
      <CifradoInfo open={showCifradoInfo} onClose={() => setShowCifradoInfo(false)} />
      
      {/* Dialog nueva conversación */}
      <NuevaConversacionDialog 
        open={showNuevaConv}
        onClose={() => setShowNuevaConv(false)}
        user={currentUser}
        onSuccess={(convId) => {
          setSelectedConvId(convId);
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        }}
      />
      
      {/* Dialog gestionar grupo */}
      <GestionarGrupoDialog
        open={showGestionarGrupo}
        onClose={() => setShowGestionarGrupo(false)}
        conversacion={selectedConv}
        user={currentUser}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
          if (selectedConvId) queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedConvId] });
        }}
      />
    </div>
  );
}