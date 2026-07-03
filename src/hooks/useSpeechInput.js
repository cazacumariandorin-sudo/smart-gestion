import { useState, useRef, useCallback } from 'react';

const PREF_KEY = 'smartgestion_voz_desactivada';

/**
 * Hook para Web Speech API con gestión de preferencia de usuario.
 * Si el usuario rechaza el permiso del micrófono → guarda preferencia y
 * devuelve desactivado=true para que VoiceInputButton se oculte.
 */
export function useSpeechInput(lang = 'es-ES') {
  const [listening, setListening] = useState(false);
  const [desactivado, setDesactivado] = useState(() => {
    try { return localStorage.getItem(PREF_KEY) === 'true'; } catch { return false; }
  });
  const recRef = useRef(null);

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const desactivarVoz = useCallback(() => {
    try { localStorage.setItem(PREF_KEY, 'true'); } catch {}
    setDesactivado(true);
    if (recRef.current) { recRef.current.stop(); recRef.current = null; }
    setListening(false);
  }, []);

  const reactivarVoz = useCallback(() => {
    try { localStorage.removeItem(PREF_KEY); } catch {}
    setDesactivado(false);
  }, []);

  const startListening = useCallback((onResult, onPermisoDenegado) => {
    if (!supported || desactivado) return;

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
    rec.onerror = (e) => {
      setListening(false);
      recRef.current = null;
      // Permiso denegado por el usuario → notificar para mostrar diálogo
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        if (onPermisoDenegado) onPermisoDenegado();
      }
    };
    rec.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || '';
      if (text) onResult(text);
    };

    recRef.current = rec;
    try { rec.start(); } catch {}
  }, [supported, desactivado, lang]);

  return { listening, supported, desactivado, startListening, desactivarVoz, reactivarVoz };
}

// Helper para comprobar preferencia sin hook (para renderizado condicional)
export function isMicDesactivado() {
  try { return localStorage.getItem(PREF_KEY) === 'true'; } catch { return false; }
}