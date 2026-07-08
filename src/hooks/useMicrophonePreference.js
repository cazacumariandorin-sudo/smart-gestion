import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'microphone_disabled_until';

function readIsDisabled() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  if (raw === 'forever') return true;
  const until = Number(raw);
  if (!until || Date.now() >= until) {
    localStorage.removeItem(STORAGE_KEY);
    return false;
  }
  return true;
}

export function useMicrophonePreference() {
  const [isMicDisabled, setIsMicDisabled] = useState(readIsDisabled);

  useEffect(() => {
    setIsMicDisabled(readIsDisabled());
  }, []);

  const disableMic = useCallback((days) => {
    if (!days || days === 'forever') {
      localStorage.setItem(STORAGE_KEY, 'forever');
    } else {
      const until = Date.now() + days * 24 * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEY, String(until));
    }
    setIsMicDisabled(true);
  }, []);

  const enableMic = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsMicDisabled(false);
  }, []);

  return { isMicDisabled, disableMic, enableMic };
}