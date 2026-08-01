import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '../services/api';

const POLL_MS = 15_000;
const FIRED_STORAGE_KEY = 'poultryops-fired-alarms';

export interface ActiveAlert {
  id: string;
  message: string;
  type: string;
  dueTime: string;
}

// Web Audio API Synthesizer to play pleasant alarm chime sound
function playWebAlarmSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    osc1.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.15); // C6 note

    osc2.frequency.setValueAtTime(440, ctx.currentTime);
    osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.6);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (e) {
    /* ignore audio context restrictions */
  }
}

function parse12HourTime(timeStr: string): { hours: number; minutes: number } {
  const cleaned = timeStr.trim().toUpperCase();
  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h = h + 12;
    return { hours: h, minutes: m };
  }
  const parts = cleaned.split(':');
  return { hours: parseInt(parts[0], 10) || 8, minutes: parseInt(parts[1], 10) || 0 };
}

function shouldFireNow(rem: any, now: Date): boolean {
  if (rem.active === false) return false;
  const { hours, minutes } = parse12HourTime(rem.dueTime || '08:00 AM');
  const today = now.toISOString().split('T')[0];

  if (rem.repeat === 'none' && rem.dueDate && rem.dueDate !== today) return false;
  if (rem.repeat === 'weekly' && rem.dueDate) {
    const dueDay = new Date(`${rem.dueDate}T12:00:00`).getDay();
    if (now.getDay() !== dueDay) return false;
  }

  return now.getHours() === hours && now.getMinutes() === minutes;
}

function loadFiredKeys(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistFiredKeys(keys: Set<string>) {
  try {
    sessionStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    /* ignore quota errors */
  }
}

function dedupeKey(remId: string, now: Date): string {
  return `${remId}-${now.toISOString().slice(0, 16)}`;
}

function dispatchAlert(rem: any, now: Date, firedKeys: Set<string>): boolean {
  const key = dedupeKey(rem._id, now);
  if (firedKeys.has(key)) return false;

  firedKeys.add(key);
  persistFiredKeys(firedKeys);

  // 1. Play audio alarm chime sound
  playWebAlarmSound();

  // 2. Browser native notification
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('🔔 Farm Alarm — ' + (rem.dueTime || '08:00 AM'), {
        body: rem.message,
        tag: key,
        icon: '/favicon.ico',
      });
    } catch {
      /* Notification constructor may fail in some contexts */
    }
  }

  return true;
}

export function useReminderAlerts() {
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const firedRef = useRef<Set<string>>(loadFiredKeys());

  const dismissAlert = useCallback((id: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const check = async () => {
      const now = new Date();
      try {
        const reminders = await fetchWithAuth('/reminders');
        const dueNow = reminders.filter((rem: any) => shouldFireNow(rem, now));
        const newlyFired: ActiveAlert[] = [];

        for (const rem of dueNow) {
          if (dispatchAlert(rem, now, firedRef.current)) {
            newlyFired.push({
              id: rem._id,
              message: rem.message,
              type: rem.type || 'general',
              dueTime: rem.dueTime || '08:00 AM',
            });
          }
        }

        if (newlyFired.length > 0) {
          setActiveAlerts(prev => {
            const ids = new Set(newlyFired.map(a => a.id));
            return [...prev.filter(a => !ids.has(a.id)), ...newlyFired];
          });
        }
      } catch (err: any) {
        /* ignore poll errors */
      }
    };

    check();
    const intervalId = setInterval(check, POLL_MS);
    return () => clearInterval(intervalId);
  }, []);

  return { activeAlerts, dismissAlert };
}
