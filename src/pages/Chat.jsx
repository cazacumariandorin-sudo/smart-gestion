import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Users, Lock, Search, ArrowLeft, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

import CifradoInfo from '@/components/chat/CifradoInfo';
import NuevaConversacionDialog from '@/components/chat/NuevaConversacionDialog';
import GestionarGrupoDialog from '@/components/chat/GestionarGrupoDialog';
import ChatMessageBubble from '@/components/chat/ChatMessageBubble';
import ChatDateSeparator from '@/components/chat/ChatDateSeparator';
import ChatInfoPanel from '@/components/chat/ChatInfoPanel';
import ChatInput from '@/components/chat/ChatInput';
import ChatErrorBoundary from '@/components/chat/ChatErrorBoundary';
import ChatRecuperarClaveDialog from '@/components/chat/ChatRecuperarClaveDialog';
import {
  safeToISO, safeTimeFormat, toValidDate,
} from '@/lib/chatDateUtils';
import {
  generarClavesRSA, cifrarAES, descifrarAES,
  cifrarClaveAESConRSA, descifrarClaveAESConRSA,
  guardarClavesEnStorage, obtenerDeStorage, generarClaveAES,
  guardarParClaves, cargarParClaves,
  cifrarClavePrivadaConPIN, descifrarClavePrivadaConPIN,
} from '@/lib/chatCrypto';

export default function Chat() {
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [clavesE2E, setClavesE2E] = useState(null);
  const [cargandoClaves, setCargandoClaves] = useState(false);
  const [mensajesDescifrados, setMensajesDescifrados] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [showNuevaConv, setShowNuevaConv] = useState(false);
  const [showGestionarGrupo, setShowGestionarGrupo] = useState(false);
  const [showCifradoInfo, setShowCifradoInfo] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [replyMsg, setReplyMsg] = useState(null);
  const [mostrandoChat, setMostrandoChat] = useState(false); // móvil: true = panel mensajes
  const [dialogoClaveModo, setDialogoClaveModo] = useState(null); // 'recuperar' | 'crear_respaldo' | 'confirmar_sobrescritura' | null
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  // Cargar usuario actual
  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  // Genera un par de claves nuevo, lo guarda local y opcionalmente sube un
  // respaldo cifrado con PIN. `forzar` sobrescribe la clave pública activa
  // en el servidor aunque ya hubiera otra distinta (usar solo tras avisar).
  const generarYRegistrarClaveNueva = async (pin, forzar) => {
    const { publicKeyBase64, privateKey } = await generarClavesRSA();
    setClavesE2E({ publicKeyBase64, privateKey });
    guardarClavesEnStorage(publicKeyBase64);
    guardarParClaves(currentUser.email, publicKeyBase64, privateKey).catch(() => {});
    let respaldoCifrado;
    if (pin) {
      try { respaldoCifrado = await cifrarClavePrivadaConPIN(privateKey, pin); } catch (e) { console.error('Error cifrando respaldo:', e); }
    }
    try {
      await base44.functions.invoke('gestionClavesChat', { action: 'registrar', publicKeyBase64, respaldoCifrado, forzar });
    } catch (e) {
      console.error('Error registrando clave:', e);
    }
    setCargandoClaves(false);
  };

  // Inicializar claves E2E — reutiliza el par persistido en IndexedDB para que
  // los mensajes cifrados con claves públicas anteriores sigan siendo
  // descifrables tras recargar la página. Si este dispositivo no tiene clave
  // local pero el servidor ya conoce una activa para el usuario, se intenta
  // recuperar con PIN antes de generar (y así romper) una clave nueva.
  useEffect(() => {
    if (!currentUser) return;
    const initClaves = async () => {
      setCargandoClaves(true);
      try {
        const existente = await cargarParClaves(currentUser.email);
        if (existente) {
          setClavesE2E(existente);
          guardarClavesEnStorage(existente.publicKeyBase64);
          // Re-registrar por si la entrada del backend quedó desfasada
          await base44.functions.invoke('gestionClavesChat', {
            action: 'registrar', publicKeyBase64: existente.publicKeyBase64,
          }).catch((e) => console.error('Error registrando clave:', e));
          setCargandoClaves(false);
          return;
        }
      } catch (e) {
        console.error('Error cargando claves persistentes:', e);
      }

      // Sin clave local: comprobar si el servidor ya tiene una clave activa
      // (dispositivo nuevo / datos de navegación borrados) antes de generar.
      try {
        const verif = await base44.functions.invoke('gestionClavesChat', { action: 'verificar_propia' });
        if (verif?.data?.existe) {
          setDialogoClaveModo(verif.data.tiene_respaldo ? 'recuperar' : 'confirmar_sobrescritura');
          setCargandoClaves(false);
          return;
        }
      } catch (e) {
        console.error('Error verificando clave existente:', e);
      }

      // Primera vez: generar clave y pedir PIN de respaldo
      setDialogoClaveModo('crear_respaldo');
      setCargandoClaves(false);
    };
    initClaves();
  }, [currentUser]);

  const handleRecuperarConPin = async (pin) => {
    try {
      const resp = await base44.functions.invoke('gestionClavesChat', { action: 'obtener_respaldo' });
      const respaldoCifrado = resp?.data?.respaldoCifrado;
      const publicKeyBase64 = resp?.data?.publicKeyBase64;
      if (!respaldoCifrado) return false;
      const privateKey = await descifrarClavePrivadaConPIN(respaldoCifrado, pin);
      if (!privateKey) return false;
      setClavesE2E({ publicKeyBase64, privateKey });
      guardarClavesEnStorage(publicKeyBase64);
      guardarParClaves(currentUser.email, publicKeyBase64, privateKey).catch(() => {});
      setDialogoClaveModo(null);
      toast.success('Acceso al chat cifrado recuperado');
      return true;
    } catch (e) {
      console.error('Error recuperando clave con PIN:', e);
      return false;
    }
  };

  const handleCrearRespaldoPin = async (pin) => {
    setCargandoClaves(true);
    await generarYRegistrarClaveNueva(pin, false);
    setDialogoClaveModo(null);
    toast.success('PIN de recuperación guardado');
  };

  const handleContinuarSinRecuperar = async () => {
    // Usuario decidió (tras el aviso) generar una clave nueva sin PIN de
    // respaldo, o saltarse el PIN en el primer uso.
    setCargandoClaves(true);
    await generarYRegistrarClaveNueva(null, true);
    setDialogoClaveModo(null);
  };

  // Suscripción en tiempo real
  useEffect(() => {
    if (!selectedConvId) return;
    const unsub = base44.entities.ChatMensaje.subscribe((event) => {
      if (event.type === 'create' && event.data?.conversacion_id === selectedConvId) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedConvId] });
      }
    });
    return () => unsub();
  }, [selectedConvId, queryClient]);

  useEffect(() => {
    const unsub = base44.entities.ChatConversacion.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    });
    return () => unsub();
  }, [queryClient]);

  const { data: conversations = [] } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => base44.entities.ChatConversacion.list('-updated_date', 50),
    refetchInterval: 8000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', selectedConvId],
    queryFn: () => selectedConvId
      ? base44.entities.ChatMensaje.filter({ conversacion_id: selectedConvId }, 'fecha_envio', 100)
      : [],
    enabled: !!selectedConvId,
    refetchInterval: 4000,
  });

  // Descifrar mensajes
  useEffect(() => {
    if (!clavesE2E?.privateKey || messages.length === 0) return;
    const descifrar = async () => {
      const result = {};
      for (const msg of messages) {
        if (msg.tipo_mensaje === 'cifrado' && msg.mensaje_cifrado) {
          // Intentar descifrar con clave AES del mensaje (claves_por_usuario)
          try {
            if (msg.claves_por_usuario && currentUser?.id && msg.claves_por_usuario[currentUser.id]) {
              const claveAES = await descifrarClaveAESConRSA(msg.claves_por_usuario[currentUser.id], clavesE2E.privateKey);
              if (claveAES) {
                const texto = await descifrarAES(msg.mensaje_cifrado, claveAES);
                result[msg.id] = texto || '[No se pudo descifrar]';
              } else {
                result[msg.id] = '[No se pudo descifrar]';
              }
            } else {
              // Mensaje previo sin clave AES por usuario asignada: no se puede
              // descifrar (la AES estaba cifrada solo para destinatarios que no
              // incluyen al usuario actual con la clave vigente).
              result[msg.id] = '[No se pudo descifrar]';
            }
          } catch {
            result[msg.id] = '[Error al descifrar]';
          }
        } else {
          result[msg.id] = msg.mensaje_cifrado;
        }
      }
      setMensajesDescifrados(result);
    };
    descifrar();
  }, [messages, clavesE2E, currentUser]);

  // Scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mensajesDescifrados]);

  // Marcar como leídos al abrir conversación
  useEffect(() => {
    if (!selectedConvId || !currentUser) return;
    const mensajesNoLeidos = messages.filter(
      m => !m.leido_por?.includes(currentUser.email) && m.autor_email !== currentUser.email
    );
    for (const m of mensajesNoLeidos) {
      base44.entities.ChatMensaje.update(m.id, {
        leido_por: [...(m.leido_por || []), currentUser.email],
      }).catch(() => {});
    }
  }, [selectedConvId, messages, currentUser]);

  const sendMutation = useMutation({
    mutationFn: async ({ text, adjuntos, replyData }) => {
      const selectedConv = conversations.find(c => c.id === selectedConvId);
      const participantes = selectedConv?.participantes || [];

      const destinatarios = participantes.map(p => p.user_email).filter(Boolean);

      let mensajePayload = {
        conversacion_id: selectedConvId,
        autor_email: currentUser?.email || '',
        autor_nombre: currentUser?.full_name || currentUser?.email || '',
        fecha_envio: new Date().toISOString(),
        leido_por: [currentUser?.email],
        adjuntos: adjuntos || [],
        destinatarios,
      };

      // Reply
      if (replyData) {
        mensajePayload.reply_a_id = replyData.id;
        mensajePayload.reply_preview = (replyData._previewText || '').substring(0, 80);
      }

      // Intentar cifrado E2E multi-destinatario
      if (clavesE2E && text && participantes.length > 0) {
        try {
          const claveAES = await generarClaveAES();
          const mensajeCifrado = await cifrarAES(text, claveAES);
          const clavesPorUsuario = {};

          for (const p of participantes) {
            const resp = await base44.functions.invoke('gestionClavesChat', {
              action: 'obtener',
              destinatario_email: p.user_email,
            });
            if (resp?.data?.clave_publica) {
              const claveCifrada = await cifrarClaveAESConRSA(claveAES, resp.data.clave_publica);
              if (claveCifrada && p.user_id) {
                clavesPorUsuario[p.user_id] = claveCifrada;
              }
            }
          }

          mensajePayload = {
            ...mensajePayload,
            mensaje_cifrado: mensajeCifrado,
            iv: 'aes-gcm-v2',
            tipo_mensaje: 'cifrado',
            claves_por_usuario: clavesPorUsuario,
            algoritmo: 'AES-256-GCM',
          };
        } catch {
          // Fallback texto plano
          mensajePayload = { ...mensajePayload, mensaje_cifrado: text, iv: 'plain', tipo_mensaje: 'texto' };
        }
      } else {
        mensajePayload = { ...mensajePayload, mensaje_cifrado: text || '', iv: 'plain', tipo_mensaje: adjuntos?.length ? 'archivo' : 'texto' };
      }

      const msg = await base44.entities.ChatMensaje.create(mensajePayload);

      // Actualizar conversación + notificaciones vía backend (service role)
      // — evita "Permission denied" para técnicos al hacer ChatConversacion.update
      // No se espera (fire & forget): el email puede tardar y no debe bloquear el envío
      base44.functions.invoke('notificarNuevoMensaje', {
        conversacion_id: selectedConvId,
        mensaje_id: msg?.id || null,
        preview_texto: text ? (text.substring(0, 50) || '[Archivo]') : '[Archivo]',
        incrementar_total: true,
      }).catch((e) => console.error('Error notificando mensaje:', e));

      return msg;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
    onError: (err) => toast.error('Error al enviar: ' + err.message),
  });

  const handleSend = (text, adjuntos, replyData) => {
    if ((!text && adjuntos.length === 0) || !selectedConvId) return;
    sendMutation.mutate({ text, adjuntos, replyData });
    setReplyMsg(null);
  };

  const handleSelectConv = (id) => {
    setSelectedConvId(id);
    setMostrandoChat(true);
    setMensajesDescifrados({});
  };

  const handleSalirConversacion = async () => {
    if (!selectedConvId || !currentUser) return;
    const conv = conversations.find(c => c.id === selectedConvId);
    if (!conv) return;
    const nuevosParticipantes = (conv.participantes || []).filter(p => p.user_email !== currentUser.email);
    await base44.entities.ChatConversacion.update(selectedConvId, { participantes: nuevosParticipantes });
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    setSelectedConvId(null);
    setMostrandoChat(false);
    setShowInfoPanel(false);
    toast.success('Has salido de la conversación');
  };

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  // Filtrar conversaciones por búsqueda
  const convsFiltradas = conversations.filter(conv => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      conv.nombre?.toLowerCase().includes(q) ||
      conv.participantes?.some(p => p.nombre_display?.toLowerCase().includes(q))
    );
  });

  // Calcular no leídos por conversación
  const noLeidos = (conv) => {
    // Simplificado: si el último mensaje no es del usuario actual y la fecha es nueva
    return 0; // Se puede extender con datos reales
  };

  // Agrupar mensajes por fecha para separadores
  const mensajesConSeparadores = [];
  let lastDate = null;
  for (const msg of messages) {
    const fechaMsg = toValidDate(msg.fecha_envio);
    if (
      fechaMsg &&
      (!lastDate || !isSameDay(fechaMsg, lastDate))
    ) {
      const iso = safeToISO(msg.fecha_envio);
      if (iso) mensajesConSeparadores.push({ type: 'separator', date: iso });
      lastDate = fechaMsg;
    }
    mensajesConSeparadores.push({ type: 'message', msg });
  }

  // Iniciales para avatar de conversación
  const getConvAvatar = (conv) => {
    if (conv.tipo === 'directo') {
      const otro = conv.participantes?.find(p => p.user_email !== currentUser?.email);
      return (otro?.nombre_display || conv.nombre || '?')[0].toUpperCase();
    }
    return (conv.nombre || 'G')[0].toUpperCase();
  };

  return (
    <ChatErrorBoundary>
    <div className="flex h-[calc(100vh-4rem)] bg-background overflow-hidden">

      {/* ── SIDEBAR LISTA DE CONVERSACIONES ── */}
      <div className={cn(
        'flex flex-col bg-card border-r border-border shrink-0',
        // Desktop: siempre visible
        'md:w-72 md:flex',
        // Móvil: visible solo cuando NO se muestra el chat
        mostrandoChat ? 'hidden md:flex' : 'flex w-full md:w-72'
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary shrink-0" />
            <h2 className="font-semibold text-sm">Mensajes</h2>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setShowNuevaConv(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Buscador */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar conversación..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {convsFiltradas.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              {busqueda ? 'Sin resultados' : 'No hay conversaciones'}
            </div>
          )}
          {convsFiltradas.map(conv => {
            const isSelected = selectedConvId === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => handleSelectConv(conv.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border/40 hover:bg-muted/50 transition-colors',
                  isSelected && 'bg-primary/10 border-l-2 border-l-primary'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold shrink-0 text-primary">
                    {getConvAvatar(conv)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-sm truncate">{conv.nombre || 'Sin nombre'}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {conv.cifrado_activo && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
                        {conv.ultimo_mensaje_fecha && (
                          <span className="text-[10px] text-muted-foreground">
                            {safeTimeFormat(conv.ultimo_mensaje_fecha)}
                          </span>
                        )}
                      </div>
                    </div>
                    {conv.ultimo_mensaje_texto && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.ultimo_mensaje_texto}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PANEL MENSAJES ── */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        // Móvil: visible solo cuando se muestra el chat
        mostrandoChat ? 'flex' : 'hidden md:flex'
      )}>
        {!selectedConvId ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
            <MessageSquare className="w-14 h-14 opacity-15" />
            <p className="text-sm">Selecciona una conversación para empezar</p>
          </div>
        ) : (
          <>
            {/* Header conversación */}
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Botón volver (móvil) */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 md:hidden"
                  onClick={() => { setMostrandoChat(false); setSelectedConvId(null); }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>

                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold shrink-0 text-primary">
                  {selectedConv ? getConvAvatar(selectedConv) : '?'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">{selectedConv?.nombre || 'Conversación'}</h3>
                  <p className="text-xs text-muted-foreground capitalize">
                    {selectedConv?.tipo} · {selectedConv?.participantes?.length || 0} participantes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedConv?.cifrado_activo && (
                  <Badge variant="outline" className="text-xs gap-1 text-green-600 border-green-200">
                    <Lock className="w-3 h-3" /> E2E
                  </Badge>
                )}
                {selectedConv?.tipo === 'grupo' && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowGestionarGrupo(true)}>
                    <Users className="w-4 h-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowInfoPanel(true)}>
                  <Info className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Área de mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1" role="log" aria-live="polite">
              {mensajesConSeparadores.map((item, i) => {
                if (item.type === 'separator') {
                  return <ChatDateSeparator key={`sep-${i}`} dateStr={item.date} />;
                }
                const msg = item.msg;
                const isOwn = msg.autor_email === currentUser?.email;
                const textoMostrar = mensajesDescifrados[msg.id] ?? msg.mensaje_cifrado ?? '';

                return (
                  <ChatMessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={isOwn}
                    textoMostrar={textoMostrar}
                    onReply={(m, previewText) => setReplyMsg({ ...m, _previewText: previewText })}
                    mensajesDescifrados={mensajesDescifrados}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              disabled={sendMutation.isPending || cargandoClaves}
              replyMsg={replyMsg}
              onCancelReply={() => setReplyMsg(null)}
            />
          </>
        )}
      </div>

      {/* Dialogs */}
      <CifradoInfo open={showCifradoInfo} onClose={() => setShowCifradoInfo(false)} />

      <NuevaConversacionDialog
        open={showNuevaConv}
        onClose={() => setShowNuevaConv(false)}
        user={currentUser}
        onSuccess={(convId) => {
          handleSelectConv(convId);
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        }}
      />

      <GestionarGrupoDialog
        open={showGestionarGrupo}
        onClose={() => setShowGestionarGrupo(false)}
        conversacion={selectedConv}
        user={currentUser}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
          queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedConvId] });
        }}
      />

      <ChatInfoPanel
        open={showInfoPanel}
        onClose={() => setShowInfoPanel(false)}
        conversacion={selectedConv}
        currentUser={currentUser}
        messages={messages}
        onSalir={handleSalirConversacion}
      />
    </div>
    </ChatErrorBoundary>
  );
}