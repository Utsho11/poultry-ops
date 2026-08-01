import cron from 'node-cron';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { ReminderModel, DeviceTokenModel, IReminderDoc } from '../models/schemas';

const expo = new Expo();

function parse12HourTime(timeStr: string): { hours: number; minutes: number } {
  const cleaned = timeStr.trim().toUpperCase();
  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'AM' && h === 12) h = 0;       // 12:xx AM -> 0:xx
    if (period === 'PM' && h !== 12) h = h + 12;   // 1-11 PM -> 13-23
    return { hours: h, minutes: m };
  }
  const parts = cleaned.split(':');
  return { hours: parseInt(parts[0], 10) || 8, minutes: parseInt(parts[1], 10) || 0 };
}

function shouldFireNow(rem: IReminderDoc, now: Date): boolean {
  if (!rem.active) return false;

  const { hours, minutes } = parse12HourTime(rem.dueTime || '08:00 AM');
  
  // Calculate current date/time string in Bangladesh Time / farm timezone (default Asia/Dhaka, UTC+6)
  // Or standard ISO date
  const nowDhaka = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  const todayStr = nowDhaka.toISOString().split('T')[0];

  // Prevent double-firing on same date
  if (rem.lastFiredForDate === todayStr) {
    return false;
  }

  // Date check for non-repeating reminders
  if (rem.repeat === 'none' || !rem.repeat) {
    if (rem.dueDate && rem.dueDate !== todayStr) return false;
  } else if (rem.repeat === 'weekly' && rem.dueDate) {
    const dueDay = new Date(`${rem.dueDate}T12:00:00`).getDay();
    if (nowDhaka.getDay() !== dueDay) return false;
  }

  // Time matching check (current hour & minute in local time)
  const currentHours = nowDhaka.getUTCHours();
  const currentMinutes = nowDhaka.getUTCMinutes();

  return currentHours === hours && currentMinutes === minutes;
}

export function startReminderDispatcher() {
  console.log('⏰ Starting Server-Side Remote Push Notification Engine (cron: * * * * *)...');

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const nowDhaka = new Date(now.getTime() + (6 * 60 * 60 * 1000));
      const todayStr = nowDhaka.toISOString().split('T')[0];

      const activeReminders = await ReminderModel.find({ active: true });
      const toFire = activeReminders.filter(rem => shouldFireNow(rem, now));

      if (toFire.length === 0) return;

      console.log(`⏰ [Reminder Engine] ${toFire.length} reminder(s) due to fire now!`);

      const messages: ExpoPushMessage[] = [];
      const firedReminderIds: string[] = [];

      for (const reminder of toFire) {
        firedReminderIds.push(reminder._id.toString());

        // Target assigned users, or default to the creator
        const userIds = reminder.assignedTo && reminder.assignedTo.length > 0
          ? reminder.assignedTo.map(id => id.toString())
          : [reminder.createdBy.toString()];

        const deviceTokens = await DeviceTokenModel.find({ userId: { $in: userIds } });

        for (const t of deviceTokens) {
          if (!Expo.isExpoPushToken(t.expoPushToken)) {
            console.warn(`[Push] Invalid Expo push token: ${t.expoPushToken}`);
            continue;
          }

          messages.push({
            to: t.expoPushToken,
            sound: 'default',
            title: `🐔 ${reminder.type.toUpperCase()} Reminder`,
            body: reminder.message,
            priority: 'high',
            channelId: 'farm-alarms',
            data: { reminderId: reminder._id.toString(), farmId: reminder.farmId.toString() },
          });
        }
      }

      // Send push notifications in chunks via Expo API
      if (messages.length > 0) {
        const chunks = expo.chunkPushNotifications(messages);
        for (const chunk of chunks) {
          try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            console.log(`[Push] Sent ${chunk.length} push notification(s) successfully! Tickets:`, tickets);
          } catch (pushErr) {
            console.error('[Push] Error sending push chunk:', pushErr);
          }
        }
      }

      // Mark fired reminders in database to guarantee single execution
      if (firedReminderIds.length > 0) {
        await ReminderModel.updateMany(
          { _id: { $in: firedReminderIds } },
          {
            lastFiredAt: now.toISOString(),
            lastFiredForDate: todayStr
          }
        );
      }
    } catch (err) {
      console.error('⏰ [Reminder Engine] Cron tick error:', err);
    }
  });
}
