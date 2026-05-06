import { useState, useRef, useCallback } from 'react';

/**
 * Hook para usar la Web Speech API (SpeechRecognition).
 * Devuelve { listening, supported, startListening }
 * startListening(onResult) — llama onResult(texto) al finalizar.
 */
export function useSpeechInput(lang = 'es-ES') {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback((onResult) => {
    if (!supported) return;

    // Detener si ya está escuchando
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => setListening(true);
    rec.onend = () => { setListening(false); recRef.current = null; };
    rec.onerror = () => { setListening(false); recRef.current = null; };
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || '';
      if (text) onResult(text);
    };

    recRef.current = rec;
    rec.start();
  }, [supported, lang]);

  return { listening, supported, startListening };
}