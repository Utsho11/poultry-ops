import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface DatePickerInputProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  style?: any;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  style,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  // Parse YYYY-MM-DD string into Date object safely
  const getDateObject = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date();
  };

  const currentDate = getDateObject(value);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const formatted = `${yyyy}-${mm}-${dd}`;
      onChange(formatted);
    }
  };

  return (
    <View style={style}>
      {label && <Text style={s.label}>{label}</Text>}
      <TouchableOpacity
        style={s.button}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.8}
      >
        <Text style={s.dateText}>📅 {value || 'Select Date'}</Text>
        <Text style={s.changeBtnText}>Change 🗓️</Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justify: 'space-between',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  changeBtnText: {
    color: '#4A7C59',
    fontSize: 12,
    fontWeight: '800',
  },
});
