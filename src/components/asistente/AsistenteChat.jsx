import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Zap, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

const SUGERENCIAS = {
  operario: ['¿Qué obra tengo hoy?', '¿Cuántas horas llevo este mes?', '¿Tengo gastos pendientes?'],
  jefe_obra: ['Partes pendientes de firma', 'Resumen de hoy', 'Operarios sin fichar'],
  admin: ['KPIs del mes', 'Obras sin presupuesto', 'Generar backup', 'Operarios sin fichar hoy'],
  gerencia: ['Rentabilidad por obra', 'Resumen ejecutivo semanal', 'Gastos sin obra asignada'],
  default: ['¿Cómo puedes ayudarme?', 'Resumen del día', 'Mis tareas pendientes'],
};

const HERRAMIENTAS_KEYWORDS = {
  'obras activas': 'get_obras_activas',
  'obras activa': 'get_obras_activas',
  'obras sin presupuesto': 'get_obras_sin_presupuesto',
  'sin fichar': 'get_operarios_sin_fichar_hoy',
  'operarios sin fichar': 'get_operarios_sin_fichar_hoy',
  'gastos pendientes': 'get_gastos_pendientes',
  'partes sin firmar': 'get_partes_sin_firmar',
  'partes pendientes': 'get_partes_sin_firmar',
  'kpis': 'get_kpis_mes',
  'kpi': 'get_kpis_mes',
  'fichajes hoy': 'get_fichajes_hoy',
  'fichar hoy': 'get_fichajes_hoy',
  'resumen ejecutivo': 'generar_resumen_ejecutivo',
  'resumen semanal': 'generar_resumen_ejecutivo',
};

function detectarHerramienta(texto) {
  const lower = texto.toLowerCase();
  for (const [keyword, tool] of Object.entries(HERRAMIENTAS_KEYWORDS)) {
    if (lower.includes(keyword)) return tool;
  }
  return null;
}

function extractarPeriodo(texto) {
  const lower = texto.toLowerCase();
  if (lower.includes('hoy')) return 'hoy';
  if (lower.includes('semana')) return 'semana';
  return 'mes';
}

export default function AsistenteChat({ currentUser }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `¡Hola${currentUser?.full_name ? ', ' + currentUser.full_name.split(' ')[0] : ''}! 👋 Soy tu Asistente SMART. Puedo consultar datos de obras, operarios, fichajes, gastos y más. ¿En qué te ayudo?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toolUsing, setToolUsing] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sugerencias = SUGERENCIAS[currentUser?.role] || SUGERENCIAS.default;

  const ejecutarHerramienta = async (toolName, toolInput = {}) => {
    setToolUsing(toolName);
    const resp = await base44.functions.invoke('asistenteHerramientas', {
      tool_name: toolName,
      tool_input: toolInput,
    });
    setToolUsing(null);
    return resp?.data?.result || resp?.data || {};
  };

  const enviarMensaje = async (texto) => {
    if (!texto.trim() || loading) return;
    const userMsg = { role: 'user', content: texto };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const herramienta = detectarHerramienta(texto);
      let contextoExtra = '';

      if (herramienta) {
        let toolInput = {};
        if (herramienta === 'generar_resumen_ejecutivo') {
          toolInput = { periodo: extractarPeriodo(texto) };
        }
        const toolResult = await ejecutarHerramienta(herramienta, toolInput);
        contextoExtra = `\n\nDATO OBTENIDO (${herramienta}):\n${JSON.stringify(toolResult, null, 2)}`;
      }

      const historial = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await base44.functions.invoke('asistenteIA', {
        messages: historial,
        contexto_extra: contextoExtra,
      });

      const reply = resp?.data?.reply || 'Lo siento, no pude procesar tu consulta.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Hubo un error al procesar tu consulta: ${err.message}. Por favor, inténtalo de nuevo.`,
      }]);
    } finally {
      setLoading(false);
      setToolUsing(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
              </div>
            )}
            <div className={cn(
              'max-w-[85%] px-3 py-2 rounded-2xl text-sm',
              msg.role === 'user'
                ? 'bg-slate-800 text-white rounded-tr-sm'
                : 'bg-blue-50 dark:bg-blue-950/40 text-foreground rounded-tl-sm border border-blue-100 dark:border-blue-900'
            )}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  components={{
                    p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                    li: ({ children }) => <li className="my-0.5">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : msg.content}
            </div>
          </div>
        ))}

        {/* Indicador "pensando" */}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300" />
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 px-3 py-2 rounded-2xl rounded-tl-sm text-sm text-muted-foreground">
              {toolUsing ? (
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-blue-500 animate-pulse" />
                  Consultando datos...
                </span>
              ) : (
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias rápidas */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {sugerencias.map((s, i) => (
            <button
              key={i}
              onClick={() => enviarMensaje(s)}
              className="px-2.5 py-1 rounded-full border border-border text-xs text-muted-foreground hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2 bg-card">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviarMensaje(input))}
          placeholder="Pregunta al asistente..."
          disabled={loading}
          className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-50"
        />
        <Button size="icon" className="h-9 w-9 shrink-0 bg-blue-600 hover:bg-blue-700" onClick={() => enviarMensaje(input)} disabled={!input.trim() || loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}