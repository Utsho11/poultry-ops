import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { formatEggCount, cratesAndLooseToTotal } from '../utils/crates';

export const DailyLogScreen: React.FC = () => {
  const { token } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [crates, setCrates] = useState('0');
  const [looseEggs, setLooseEggs] = useState('0');
  const [brokenEggCount, setBrokenEggCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedGivenKg, setFeedGivenKg] = useState('50');
  const [waterGivenLiters, setWaterGivenLiters] = useState('100');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const [batchData, logData] = await Promise.all([
        apiFetch('/batches?status=active', {}, token),
        apiFetch('/logs', {}, token),
      ]);
      setBatches(batchData);
      if (batchData.length > 0 && !selectedBatchId) setSelectedBatchId(batchData[0]._id);
      setLogs(logData);
    } catch (e) {}
    finally { setRefreshing(false); }
  }, [token, selectedBatchId]);

  useEffect(() => { load(); }, [load]);

  const totalCalculatedEggs = cratesAndLooseToTotal(crates, looseEggs);

  const handleSubmit = async () => {
    if (!selectedBatchId) { showAlert('Error', 'Select a batch first'); return; }
    if (!logDate) { showAlert('Error', 'Please enter a valid date (YYYY-MM-DD)'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId,
          date: logDate,
          eggCount: totalCalculatedEggs,
          brokenEggCount: Number(brokenEggCount),
          deadCount: Number(deadCount),
          feedGivenKg: Number(feedGivenKg),
          waterGivenLiters: Number(waterGivenLiters),
          notes
        })
      }, token);
      setModalVisible(false);
      setSuccess(true);
      setCrates('0');
      setLooseEggs('0');
      setTimeout(() => setSuccess(false), 3000);
      load();
    } catch (err: any) {
      showAlert('Submission Error', err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <View style={common.screen}>
      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        <View style={[common.row, { marginBottom: 20 }]}>
          <View>
            <Text style={common.sectionTitle}>Daily Log</Text>
            <Text style={common.sectionSubtitle}>{logs.length} entries recorded</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>+ Submit Log</Text>
          </TouchableOpacity>
        </View>

        {success && (
          <View style={s.successBanner}>
            <Text style={{ color: colors.brand, fontWeight: '700' }}>✅ Daily log saved! Recorded {formatEggCount(totalCalculatedEggs)}.</Text>
          </View>
        )}

        {/* Log table */}
        {logs.length === 0
          ? <Text style={common.emptyText}>No logs yet. Tap "+ Submit Log" to record today's data.</Text>
          : logs.map(log => (
            <View key={log._id} style={common.card}>
              <View style={common.row}>
                <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 15 }}>{log.date}</Text>
                <View style={s.eggBadge}>
                  <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700' }}>
                    🥚 {formatEggCount(log.eggCount)}
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <View style={s.chip}><Text style={s.chipText}>Total: {log.eggCount} eggs</Text></View>
                <View style={s.chip}><Text style={s.chipText}>Broken: {log.brokenEggCount}</Text></View>
                <View style={[s.chip, log.deadCount > 0 && { backgroundColor: 'rgba(244,63,94,0.15)' }]}>
                  <Text style={[s.chipText, log.deadCount > 0 && { color: colors.rose }]}>☠️ Dead: {log.deadCount}</Text>
                </View>
                <View style={s.chip}><Text style={s.chipText}>Feed: {log.feedGivenKg}kg</Text></View>
                <View style={s.chip}><Text style={s.chipText}>Water: {log.waterGivenLiters}L</Text></View>
              </View>
              {log.notes ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>📝 {log.notes}</Text> : null}
            </View>
          ))
        }
      </ScrollView>

      {/* Submit Log Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Submit Daily Log</Text>

            {/* Batch selector */}
            <Text style={common.label}>Select Batch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {batches.map(b => (
                <TouchableOpacity
                  key={b._id}
                  onPress={() => setSelectedBatchId(b._id)}
                  style={[s.batchChip, selectedBatchId === b._id && s.batchChipActive]}
                >
                  <Text style={{ color: selectedBatchId === b._id ? '#fff' : colors.textMuted, fontSize: 13, fontWeight: '600' }}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={common.label}>📅 Log Date (YYYY-MM-DD) *</Text>
            <TextInput
              style={common.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748b"
              value={logDate}
              onChangeText={setLogDate}
            />

            {/* Crates & Loose Eggs Collection Input */}
            <View style={s.crateBox}>
              <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 14, marginBottom: 8 }}>🥚 Eggs Collected (1 Crate = 30 Eggs)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={common.label}>Full Crates</Text>
                  <TextInput style={common.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" value={crates} onChangeText={setCrates} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={common.label}>Loose Eggs</Text>
                  <TextInput style={common.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" value={looseEggs} onChangeText={setLooseEggs} />
                </View>
              </View>
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 13, marginTop: 6 }}>
                Total: {formatEggCount(totalCalculatedEggs)} ({totalCalculatedEggs} eggs)
              </Text>
            </View>

            {/* Numeric inputs */}
            {[
              { label: '🔴 Broken Eggs', value: brokenEggCount, set: setBrokenEggCount },
              { label: '☠️ Dead Birds', value: deadCount, set: setDeadCount },
              { label: '🌾 Feed Given (kg)', value: feedGivenKg, set: setFeedGivenKg },
              { label: '💧 Water Given (Liters)', value: waterGivenLiters, set: setWaterGivenLiters },
            ].map(field => (
              <View key={field.label}>
                <Text style={common.label}>{field.label}</Text>
                <TextInput
                  style={common.input}
                  keyboardType="numeric"
                  value={field.value}
                  onChangeText={field.set}
                />
              </View>
            ))}

            <Text style={common.label}>Notes / Observations</Text>
            <TextInput
              style={[common.input, { minHeight: 60 }]}
              placeholder="Optional health notes or observations..."
              placeholderTextColor="#64748b"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setModalVisible(false)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>Save Log</Text>}
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
  successBanner: { backgroundColor: 'rgba(16,185,129,0.15)', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', marginBottom: 16 },
  eggBadge: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chip: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  chipText: { color: colors.textMuted, fontSize: 12 },
  crateBox: { backgroundColor: 'rgba(16,185,129,0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 14 },
  batchChip: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  batchChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
});
