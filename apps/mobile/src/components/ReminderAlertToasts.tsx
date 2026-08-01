import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ActiveAlert } from '../hooks/useReminderAlerts';

interface Props {
  alerts: ActiveAlert[];
  onDismiss: (id: string) => void;
}

export const ReminderAlertToasts: React.FC<Props> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null;

  return (
    <View style={s.container}>
      {alerts.map(alert => (
        <View key={alert.id} style={s.toastCard}>
          <View style={s.iconCircle}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.toastTitle}>Farm Alarm — {alert.dueTime}</Text>
            <Text style={s.toastMessage}>{alert.message}</Text>
          </View>
          <TouchableOpacity onPress={() => onDismiss(alert.id)} style={s.closeBtn}>
            <Text style={{ color: '#94a3b8', fontSize: 16, fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 10,
  },
  toastCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    justify: 'center',
    alignItems: 'center',
  },
  toastTitle: {
    color: '#3b82f6',
    fontWeight: '800',
    fontSize: 13,
  },
  toastMessage: {
    color: '#f8fafc',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
});
