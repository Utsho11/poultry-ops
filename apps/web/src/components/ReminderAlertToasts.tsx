import React from 'react';
import { Bell, X } from 'lucide-react';
import { ActiveAlert } from '../hooks/useReminderAlerts';

interface Props {
  alerts: ActiveAlert[];
  onDismiss: (id: string) => void;
}

export const ReminderAlertToasts: React.FC<Props> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 360,
        width: 'calc(100vw - 40px)',
      }}
    >
      {alerts.map(alert => (
        <div
          key={alert.id}
          role="alert"
          style={{
            background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.25)',
                borderRadius: 10,
                padding: 8,
                flexShrink: 0,
              }}
            >
              <Bell size={20} color="#3b82f6" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.95rem', marginBottom: 4 }}>
                Farm Alarm — {alert.dueTime}
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.4 }}>{alert.message}</div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              aria-label="Dismiss alarm"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 4,
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
