import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { formatEggCount } from '../utils/crates';
import { DailyLogModal } from '../components/DailyLogModal';
import { Zap, Egg, Bird, FileText } from 'lucide-react-native';

export const DailyLogScreen: React.FC = () => {
  const { token, activeFarm } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [success, setSuccess] = useState(false);

  // Filter state
  const [filterBatchId, setFilterBatchId] = useState<string>('all');

  const load = useCallback(async () => {
    try {
      const logsQuery = filterBatchId !== 'all' ? `?batchId=${filterBatchId}` : '';
      const [batchData, logData] = await Promise.all([
        apiFetch('/batches?status=active', {}, token),
        apiFetch(`/logs${logsQuery}`, {}, token)
      ]);
      setBatches(batchData);
      setLogs(logData);
    } catch (e: any) {
      console.warn('Failed to load daily logs:', e?.message || e);
      showAlert('Connection Error', e?.message || 'Failed to load daily logs');
    }
    finally { setRefreshing(false); }
  }, [token, filterBatchId]);

  useEffect(() => {
    let mounted = true;
    load();
    return () => { mounted = false; };
  }, [load]);

  return (
    <View style={common.screen}>
      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        <View style={[common.row, { marginBottom: 12 }]}>
          <View>
            <Text style={common.sectionTitle}>Daily Log</Text>
            <Text style={common.sectionSubtitle}>{logs.length} entries recorded</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>+ Submit Log</Text>
          </TouchableOpacity>
        </View>

        {/* Batch Filter */}
        <View style={s.filterContainer}>
          <Text style={s.filterLabel}>Filter by Flock</Text>
          <View style={s.pickerWrapper}>
            <Picker
              selectedValue={filterBatchId}
              onValueChange={(val) => setFilterBatchId(val)}
              dropdownIconColor={colors.brand}
              style={s.pickerStyle}
            >
              <Picker.Item label="All Flocks" value="all" />
              {batches
                .filter(b => b.type === (activeFarm?.animalType === 'broiler' ? 'broiler' : 'layer'))
                .map(b => (
                  <Picker.Item key={b._id} label={`${b.name} (${b.breed || 'Flock'})`} value={b._id} />
                ))}
            </Picker>
          </View>
        </View>

        {success && (
          <View style={s.successBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Zap size={14} color={colors.brand} />
              <Text style={{ color: colors.brand, fontWeight: '700' }}>
                Daily log saved successfully!
              </Text>
            </View>
          </View>
        )}

        {/* Log table */}
        {logs.length === 0
          ? <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 20 }}>No logs yet. Tap "+ Submit Log" to record today's data.</Text>
          : logs.map(log => (
            <View key={log._id} style={common.card}>
              <View style={common.row}>
                <View>
                  <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 15 }}>{log.date}</Text>
                  {log.batchId?.name && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Bird size={12} color={colors.brand} />
                      <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '700' }}>{log.batchId.name}</Text>
                    </View>
                  )}
                </View>
                {activeFarm?.animalType === 'layer' && (
                  <View style={s.eggBadge}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Egg size={12} color={colors.brand} />
                      <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700' }}>
                        {formatEggCount(log.eggCount)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {activeFarm?.animalType === 'layer' && (
                  <>
                    <View style={s.chip}><Text style={s.chipText}>Total: {log.eggCount} eggs</Text></View>
                    <View style={s.chip}><Text style={s.chipText}>Broken: {log.brokenEggCount}</Text></View>
                  </>
                )}
                <View style={[s.chip, log.deadCount > 0 && { backgroundColor: 'rgba(244,63,94,0.15)' }]}>
                  <Text style={[s.chipText, log.deadCount > 0 && { color: colors.rose }]}>Dead: {log.deadCount}</Text>
                </View>
                <View style={s.chip}><Text style={s.chipText}>Feed: {log.feedGivenKg}kg ({(log.feedGivenKg / 50).toFixed(1)} Bags)</Text></View>
                <View style={s.chip}><Text style={s.chipText}>Water: {log.waterGivenLiters}L</Text></View>
              </View>
              {log.notes ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <FileText size={12} color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{log.notes}</Text>
                </View>
              ) : null}
            </View>
          ))
        }
      </ScrollView>

      {/* Shared Daily Log Modal */}
      <DailyLogModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
          load();
        }}
        batches={batches}
      />
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
  feedBox: { backgroundColor: 'rgba(217, 164, 65, 0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217, 164, 65, 0.3)', marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surfaceElevated },
  tabBtnActiveLog: { borderColor: colors.secondary, backgroundColor: 'rgba(74, 124, 89, 0.15)' },
  tabBtnActiveStock: { borderColor: colors.amber, backgroundColor: 'rgba(217, 164, 65, 0.15)' },
  filterContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    marginBottom: 14,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickerStyle: {
    color: colors.textMain,
    height: 50,
  },
});
