import { useEffect, useRef } from 'react';

// Maps JS getDay() (0=Sun) to our index (0=Mon)
const jsToIdx = (jsDay) => (jsDay === 0 ? 6 : jsDay - 1);

// ─── Audio ───────────────────────────────────────────────────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Unlock AudioContext on first user gesture (required by iOS/Android)
let unlocked = false;
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    ctx.resume().catch(() => {});
  }
}

// Register unlock listeners once
if (typeof window !== 'undefined') {
  ['touchstart', 'touchend', 'click', 'keydown'].forEach(evt =>
    window.addEventListener(evt, unlockAudio, { once: false, passive: true })
  );
}

export function playAlarmSound() {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const freqs = [880, 1100, 880, 1100, 880];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    const t0 = ctx.currentTime + i * 0.28;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.5, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
    osc.start(t0);
    osc.stop(t0 + 0.28);
  });
}

// ─── Notification ─────────────────────────────────────────────────────────────
/**
 * Request notification permission with iOS 16.4+ PWA support.
 * Returns: 'granted' | 'denied' | 'default' | 'unavailable'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unavailable';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unavailable';
  return Notification.permission;
}

function fireNotification(alarm) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const tipoLabel = {
    entrada: 'Entrada',
    salida: 'Salida',
    pausa_inicio: 'Inicio Pausa',
    pausa_fin: 'Fin Pausa',
  }[alarm.tipo] || alarm.tipo;

  const opts = {
    body: `${tipoLabel} · ${alarm.hora}`,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: `alarma-${alarm.id}`,
    renotify: true,
    requireInteraction: false,
    silent: false, // let the OS play its own notification sound too
    vibrate: [200, 100, 200, 100, 300], // Android haptic pattern
  };

  // Use Service Worker notification if available (background, iOS PWA)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(`⏰ ${alarm.nombre}`, opts))
      .catch(() => {
        // Fallback to foreground notification
        new Notification(`⏰ ${alarm.nombre}`, opts);
      });
  } else {
    new Notification(`⏰ ${alarm.nombre}`, opts);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAlarmas(alarmas = []) {
  const triggered = useRef(new Set());

  useEffect(() => {
    if (!alarmas.length) return;

    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dayIdx = jsToIdx(now.getDay());

      alarmas.forEach(a => {
        if (!a.activa) return;
        if (a.hora !== hhmm) return;
        const dias = a.dias?.length ? a.dias : [0, 1, 2, 3, 4];
        if (!dias.includes(dayIdx)) return;

        const key = `${a.id}-${hhmm}`;
        if (triggered.current.has(key)) return;
        triggered.current.add(key);

        // Play audio + send notification
        playAlarmSound();
        fireNotification(a);

        // Clear key after 90s so it can retrigger next occurrence
        setTimeout(() => triggered.current.delete(key), 90000);
      });
    };

    // Check immediately, then every 10s
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [alarmas]);
}