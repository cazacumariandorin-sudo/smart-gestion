import { useEffect, useRef } from 'react';

// Maps JS getDay() (0=Sun) to our index (0=Mon)
const jsToIdx = (jsDay) => (jsDay === 0 ? 6 : jsDay - 1);

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export function playAlarmSound() {
  const ctx = getAudioCtx();
  const freqs = [880, 1100, 880, 1100];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.22);
    osc.start(ctx.currentTime + i * 0.25);
    osc.stop(ctx.currentTime + i * 0.25 + 0.25);
  });
}

export function useAlarmas(alarmas = []) {
  const triggered = useRef(new Set());

  useEffect(() => {
    if (!alarmas.length) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dayIdx = jsToIdx(now.getDay());

      alarmas.forEach(a => {
        if (!a.activa) return;
        if (a.hora !== hhmm) return;
        const dias = a.dias || [0, 1, 2, 3, 4]; // default L-V
        if (!dias.includes(dayIdx)) return;

        const key = `${a.id}-${hhmm}`;
        if (triggered.current.has(key)) return;
        triggered.current.add(key);

        playAlarmSound();

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`⏰ ${a.nombre}`, { body: `Alarma de ${a.tipo} a las ${a.hora}`, icon: '/favicon.ico' });
        }

        // Remove key after 1.5 min so it can re-trigger next day
        setTimeout(() => triggered.current.delete(key), 90000);
      });
    }, 10000); // check every 10s

    return () => clearInterval(interval);
  }, [alarmas]);
}