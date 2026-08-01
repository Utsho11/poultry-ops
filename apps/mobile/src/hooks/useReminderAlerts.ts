import { useEffect, useRef, useState, useCallback } from 'react';
import { Vibration } from 'react-native';
import { apiFetch, showAlert } from '../config';

const POLL_MS = 15_000;

export interface ActiveAlert {
  id: string;
  message: string;
  type: string;
  dueTime: string;
}

function parse12HourTime(timeStr: string): { hours: number; minutes: number } {
  const cleaned = (timeStr || '').trim().toUpperCase();
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

function dedupeKey(remId: string, now: Date): string {
  return `${remId}-${now.toISOString().slice(0, 16)}`;
}

export function useReminderAlerts(token: string | null) {
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const firedKeysRef = useRef<Set<string>>(new Set());

  const dismissAlert = useCallback((id: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  useEffect(() => {
    if (!token) return;

    const check = async () => {
      const now = new Date();
      try {
        const reminders = await apiFetch('/reminders', {}, token);
        if (!Array.isArray(reminders)) return;

        const dueNow = reminders.filter((rem: any) => shouldFireNow(rem, now));
        const newlyFired: ActiveAlert[] = [];

        for (const rem of dueNow) {
          const key = dedupeKey(rem._id, now);
          if (!firedKeysRef.current.has(key)) {
            firedKeysRef.current.add(key);

            // Vibrate mobile device for alarm alert
            try { Vibration.vibrate([0, 500, 200, 500]); } catch (e) {}

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
      } catch (err) {
        // ignore network error silently during background polling
      }
    };

    check();
    const intervalId = setInterval(check, POLL_MS);
    return () => clearInterval(intervalId);
  }, [token]);

  return { activeAlerts, dismissAlert };
}
