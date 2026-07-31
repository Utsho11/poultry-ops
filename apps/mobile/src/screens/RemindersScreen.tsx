import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';

const TYPES = [
  { id: 'feed', label: '🌾 Feed', color: colors.brand },
  { id: 'vaccination', label: '💉 Vaccine', color: colors.rose },
  { id: 'checkup', label: '🩺 Health Check', color: colors.blue },
  { id: 'general', label: '📋 General Task', color: colors.amber },
];

// Select Component Options for Hr and Min
const HOURS_OPTIONS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES_OPTIONS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const PERIOD_OPTIONS = ['AM', 'PM'];

const REPEAT_OPTIONS = [
  { id: 'none', label: 'One-time Alarm' },
  { id: 'daily', label: 'Repeat Daily' },
  { id: 'weekly', label: 'Repeat Weekly' },
];

export const RemindersScreen: React.FC = () => {
  const { token, user } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const todayStr = new Date().toISOString().split('T')[0];
  const [message, setMessage] = useState('');
  const [type, setType] = useState('feed');
  const [dueDate, setDueDate] = useState(todayStr);

  // Select Dropdown States for Hr, Min, Period (AM/PM)
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMin, setSelectedMin] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');

  // Select Dropdown Toggles for Mobile UI
  const [showHourSelect, setShowHourSelect] = useState(false);
  const [showMinSelect, setShowMinSelect] = useState(false);

  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly'>('daily');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const load = useCallback(async () => {
    try {
      const [remData, batchData] = await Promise.all([
        apiFetch('/reminders', {}, token),
        apiFetch('/batches?status=active', {}, token),
      ]);
      setReminders(remData);
      setBatches(batchData);
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const getFormatted12HourTime = () => {
    return `${selectedHour}:${selectedMin} ${selectedPeriod}`;
  };

  const handleCreate = async () => {
    if (!message) { showAlert('Error', 'Reminder description is required'); return; }
    setSubmitting(true);
    const final12HrTime = getFormatted12HourTime();
    try {
      await apiFetch('/reminders', {
        method: 'POST',
        body: JSON.stringify({
          message,
          type,
          dueDate,
          dueTime: final12HrTime,
          repeat,
          batchId: selectedBatchId || undefined,
        })
      }, token);
      setModalVisible(false);
      setMessage('');
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    showAlert('Delete Reminder', 'Delete this alarm reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiFetch(`/reminders/${id}`, { method: 'DELETE' }, token);
            load();
          } catch (err: any) { showAlert('Error', err.message); }
        }
      }
    ]);
  };

  if (loading) return (
    <View style={[common.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );

  return (
    <View style={common.screen}>
      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        <View style={[common.row, { marginBottom: 20 }]}>
          <View>
            <Text style={common.sectionTitle}>Reminders & Alarms</Text>
            <Text style={common.sectionSubtitle}>{reminders.length} active scheduled alarms</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Alarm</Text>
          </TouchableOpacity>
        </View>

        {reminders.length === 0
          ? <Text style={common.emptyText}>No alarms scheduled. Tap "+ Add Alarm" to set one!</Text>
          : reminders.map(rem => {
            const typeInfo = TYPES.find(t => t.id === rem.type) || TYPES[0];
            return (
              <View key={rem._id} style={common.card}>
                <View style={common.row}>
                  <View style={[s.badge, { backgroundColor: `${typeInfo.color}25` }]}>
                    <Text style={{ color: typeInfo.color, fontSize: 12, fontWeight: '700' }}>
                      {typeInfo.label}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(rem._id)}>
                    <Text style={{ color: colors.rose, fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 17, marginTop: 10 }}>{rem.message}</Text>

                <View style={{ marginTop: 10, backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 10, gap: 4 }}>
                  <Text style={{ color: colors.brand, fontSize: 14, fontWeight: '800' }}>
                    ⏰ Alarm Time: {rem.dueTime || '08:00 AM'}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {rem.repeat && rem.repeat !== 'none' ? `Repeats: ${rem.repeat}` : `Date: ${rem.dueDate || 'Today'}`}
                  </Text>
                </View>
              </View>
            );
          })
        }
      </ScrollView>

      {/* Create Reminder Modal with SELECT Component UI for Hr & Min */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 20, fontWeight: '800', marginBottom: 16 }}>Set Reminder Alarm (Select Hr & Min)</Text>

            {/* Description */}
            <Text style={common.label}>Alarm Description *</Text>
            <TextInput
              style={common.input}
              placeholder="e.g. Give Newcastle Vaccine to Shed A"
              placeholderTextColor="#64748b"
              value={message}
              onChangeText={setMessage}
            />

            {/* Category Selector */}
            <Text style={common.label}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.chip, type === t.id && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => setType(t.id)}
                >
                  <Text style={{ color: type === t.id ? '#fff' : colors.textMuted, fontSize: 13, fontWeight: '600' }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Date Input */}
            <Text style={common.label}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={common.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="2026-08-01"
              placeholderTextColor="#64748b"
            />

            {/* SELECT Components for Hr, Min, AM/PM */}
            <Text style={common.label}>Select Time (Hour : Minute : AM/PM)</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {/* Hour Select Dropdown */}
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={s.selectBtn} onPress={() => setShowHourSelect(!showHourSelect)}>
                  <Text style={s.selectBtnText}>Hour: {selectedHour} ▾</Text>
                </TouchableOpacity>
              </View>

              {/* Minute Select Dropdown */}
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={s.selectBtn} onPress={() => setShowMinSelect(!showMinSelect)}>
                  <Text style={s.selectBtnText}>Min: {selectedMin} ▾</Text>
                </TouchableOpacity>
              </View>

              {/* AM/PM Toggle */}
              <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                {PERIOD_OPTIONS.map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setSelectedPeriod(p)}
                    style={[s.periodBtn, selectedPeriod === p && s.periodBtnActive]}
                  >
                    <Text style={{ color: selectedPeriod === p ? '#fff' : colors.textMuted, fontWeight: '800', fontSize: 13 }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Hour Select List Menu */}
            {showHourSelect && (
              <View style={s.selectMenu}>
                <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 12, marginBottom: 6 }}>Select Hour (01 - 12):</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {HOURS_OPTIONS.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[s.optionItem, selectedHour === h && s.optionItemActive]}
                      onPress={() => { setSelectedHour(h); setShowHourSelect(false); }}
                    >
                      <Text style={{ color: selectedHour === h ? '#fff' : colors.textMain, fontWeight: '700' }}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Minute Select List Menu */}
            {showMinSelect && (
              <View style={s.selectMenu}>
                <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 12, marginBottom: 6 }}>Select Minute (00 - 55):</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {MINUTES_OPTIONS.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[s.optionItem, selectedMin === m && s.optionItemActive]}
                      onPress={() => { setSelectedMin(m); setShowMinSelect(false); }}
                    >
                      <Text style={{ color: selectedMin === m ? '#fff' : colors.textMain, fontWeight: '700' }}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Selected Alarm Time Banner Preview */}
            <View style={s.timePreviewBanner}>
              <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 16 }}>🔔 Alarm Set For: {getFormatted12HourTime()}</Text>
            </View>

            {/* Repeat Selector */}
            <Text style={common.label}>Repeat Alarm</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {REPEAT_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[s.repeatChip, repeat === r.id && s.repeatChipActive]}
                  onPress={() => setRepeat(r.id as any)}
                >
                  <Text style={{ color: repeat === r.id ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '600' }}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Batch Selector */}
            {batches.length > 0 && (
              <>
                <Text style={common.label}>Assign Batch (Optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <TouchableOpacity onPress={() => setSelectedBatchId('')} style={[s.batchChip, !selectedBatchId && s.batchChipActive]}>
                    <Text style={{ color: !selectedBatchId ? '#fff' : colors.textMuted, fontSize: 12 }}>Entire Farm</Text>
                  </TouchableOpacity>
                  {batches.map(b => (
                    <TouchableOpacity key={b._id} onPress={() => setSelectedBatchId(b._id)} style={[s.batchChip, selectedBatchId === b._id && s.batchChipActive]}>
                      <Text style={{ color: selectedBatchId === b._id ? '#fff' : colors.textMuted, fontSize: 12 }}>{b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setModalVisible(false)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleCreate} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>Set Alarm</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  addBtn: { backgroundColor: colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  selectBtn: { backgroundColor: colors.surfaceElevated, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  selectBtnText: { color: colors.textMain, fontWeight: '700', fontSize: 13 },
  periodBtn: { flex: 1, backgroundColor: colors.surfaceElevated, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  periodBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  selectMenu: { backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  optionItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  optionItemActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  timePreviewBanner: { backgroundColor: 'rgba(16,185,129,0.15)', padding: 12, borderRadius: 10, marginBottom: 14, alignItems: 'center' },
  repeatChip: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  repeatChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  batchChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  batchChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
});
