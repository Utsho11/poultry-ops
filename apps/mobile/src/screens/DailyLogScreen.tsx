import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { formatEggCount, cratesAndLooseToTotal } from '../utils/crates';
import { DatePickerInput } from '../components/DatePickerInput';
import { Plus, Zap, Egg, Bird, AlertCircle, Wheat, Droplets, Calendar, Filter, FileText } from 'lucide-react-native';

export const DailyLogScreen: React.FC = () => {
  const { token } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form Section: 'log' vs 'stock'
  const [formSection, setFormSection] = useState<'log' | 'stock'>('log');
  const [summaryData, setSummaryData] = useState<any>(null);

  // Filter state (separate from form selectedBatchId)
  const [filterBatchId, setFilterBatchId] = useState<string>('all');

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [crates, setCrates] = useState('0');
  const [looseEggs, setLooseEggs] = useState('0');
  const [brokenEggCount, setBrokenEggCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedBags, setFeedBags] = useState('1');
  const [feedLooseKg, setFeedLooseKg] = useState('5');
  const [waterGivenLiters, setWaterGivenLiters] = useState('100');
  const [notes, setNotes] = useState('');

  // Store Feed Stock form states
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0]);
  const [feedCategory, setFeedCategory] = useState<string>('layer_layer_1');
  const [stockBags, setStockBags] = useState('10');
  const [bagPrice, setBagPrice] = useState('2500');
  const [stockVendor, setStockVendor] = useState('');
  const [submittingStock, setSubmittingStock] = useState(false);

  const load = useCallback(async () => {
    try {
      const logsQuery = filterBatchId !== 'all' ? `?batchId=${filterBatchId}` : '';
      const [batchData, logData, summaryRes] = await Promise.all([
        apiFetch('/batches?status=active', {}, token),
        apiFetch(`/logs${logsQuery}`, {}, token),
        apiFetch('/reports/summary', {}, token)
      ]);
      setBatches(batchData);
      if (batchData.length > 0 && !selectedBatchId) setSelectedBatchId(batchData[0]._id);
      setLogs(logData);
      setSummaryData(summaryRes);
    } catch (e) {}
    finally { setRefreshing(false); }
  }, [token, selectedBatchId, filterBatchId]);

  useEffect(() => { load(); }, [load]);

  const totalCalculatedEggs = cratesAndLooseToTotal(crates, looseEggs);
  const totalFeedGivenKg = (Number(feedBags || 0) * 50) + Number(feedLooseKg || 0);

  const availableStockKg = summaryData?.availableFeedStockKg ?? Infinity;
  const isFeedExceeded = (summaryData?.purchasedFeedKg || 0) > 0 && totalFeedGivenKg > availableStockKg;

  const handleSubmit = async () => {
    if (!selectedBatchId) {
      showAlert('Validation Error', 'Please select an active flock/batch');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId,
          date: logDate,
          eggCount: totalCalculatedEggs,
          brokenEggCount: Number(brokenEggCount || 0),
          deadCount: Number(deadCount || 0),
          feedGivenKg: Number(totalFeedGivenKg || 0),
          waterGivenLiters: Number(waterGivenLiters || 0),
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

  const handleAddFeedStock = async () => {
    const numBags = Number(stockBags || 0);
    const numPrice = Number(bagPrice || 0);
    if (numBags <= 0 || numPrice <= 0) {
      showAlert('Error', 'Please enter valid Bags and Price per Bag');
      return;
    }
    setSubmittingStock(true);
    const totalKg = numBags * 50;
    try {
      await apiFetch('/feed-stock', {
        method: 'POST',
        body: JSON.stringify({
          category: feedCategory,
          bagPrice: numPrice,
          bags: numBags,
          date: stockDate,
          note: stockVendor ? `Vendor: ${stockVendor}` : undefined
        })
      }, token);
      setModalVisible(false);
      load();
      showAlert('Success', `🌾 Added ${numBags} Bags (${totalKg} kg) to Store Feed Stock (${feedCategory.toUpperCase().replace('_', ' ')})!`);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to add feed stock');
    } finally { setSubmittingStock(false); }
  };

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
                Daily log saved! Recorded {activeFarm?.animalType === 'layer' ? formatEggCount(totalCalculatedEggs) : `${totalFeedGivenKg}kg feed`}.
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

      {/* Submit Log Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Zap size={18} color={colors.brand} />
              <Text style={{ color: colors.textMain, fontSize: 16, fontWeight: '800' }}>Log Daily Yield & Feeding</Text>
            </View>

            {/* Batch selector */}
            <Text style={common.label}>Select Batch *</Text>
            <View style={s.pickerWrapper}>
              <Picker
                selectedValue={selectedBatchId}
                onValueChange={(val) => setSelectedBatchId(val)}
                dropdownIconColor={colors.brand}
                style={s.pickerStyle}
              >
                {batches
                  .filter(b => b.type === (activeFarm?.animalType === 'broiler' ? 'broiler' : 'layer'))
                  .map(b => (
                    <Picker.Item key={b._id} label={`${b.name} (${b.breed || 'Flock'})`} value={b._id} />
                  ))}
              </Picker>
            </View>

            <DatePickerInput
              label="Log Date *"
              value={logDate}
              onChange={setLogDate}
              style={{ marginBottom: 14 }}
            />

            {activeFarm?.animalType === 'layer' && (
              <>
                <View style={s.crateBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Egg size={14} color={colors.brand} />
                    <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 14 }}>Eggs Collected (1 Crate = 30 Eggs)</Text>
                  </View>
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

                <Text style={common.label}>Broken Eggs</Text>
                <TextInput style={common.input} keyboardType="numeric" value={brokenEggCount} onChangeText={setBrokenEggCount} />
              </>
            )}

            <Text style={common.label}>Dead Birds</Text>
            <TextInput style={common.input} keyboardType="numeric" value={deadCount} onChangeText={setDeadCount} />

            {/* DUAL FEED INPUT (Full Bags + Loose kg) WITH STOCK LIMIT CHECK */}
            <View style={[s.feedBox, isFeedExceeded && { borderColor: colors.rose, backgroundColor: 'rgba(244,63,94,0.1)' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Wheat size={14} color={isFeedExceeded ? colors.rose : colors.amber} />
                  <Text style={{ color: isFeedExceeded ? colors.rose : colors.amber, fontWeight: '800', fontSize: 13 }}>
                    Feed Given (Full Bags + Loose kg) *
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
                Stock Available: {(summaryData?.availableFeedStockKg || 0).toLocaleString()} kg ({summaryData?.availableFeedStockBags || 0} Bags)
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={common.label}>Full Bags (50kg/bag)</Text>
                  <TextInput style={common.input} keyboardType="numeric" placeholder="1" value={feedBags} onChangeText={setFeedBags} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={common.label}>Loose kg</Text>
                  <TextInput style={common.input} keyboardType="numeric" placeholder="5" value={feedLooseKg} onChangeText={setFeedLooseKg} />
                </View>
              </View>

              <Text style={{ color: isFeedExceeded ? colors.rose : colors.textMain, fontWeight: '800', fontSize: 13, marginTop: 8 }}>
                Total: {totalFeedGivenKg.toLocaleString()} kg ({feedBags || 0} Bags + {feedLooseKg || 0} kg)
              </Text>
              {isFeedExceeded && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <AlertCircle size={12} color={colors.rose} />
                  <Text style={{ color: colors.rose, fontWeight: '800', fontSize: 11 }}>
                    Exceeds store feed stock ({availableStockKg.toLocaleString()} kg max)!
                  </Text>
                </View>
              )}
            </View>

            <Text style={common.label}>Water Given (Liters)</Text>
                <TextInput style={common.input} keyboardType="numeric" value={waterGivenLiters} onChangeText={setWaterGivenLiters} />

                <Text style={common.label}>Notes / Observations</Text>
                <TextInput
                  style={[common.input, { minHeight: 50 }]}
                  placeholder="Optional health notes..."
                  placeholderTextColor="#64748b"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 30 }}>
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
