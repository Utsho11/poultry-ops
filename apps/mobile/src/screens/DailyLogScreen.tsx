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

  // Form Section: 'log' vs 'stock'
  const [formSection, setFormSection] = useState<'log' | 'stock'>('log');

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [crates, setCrates] = useState('0');
  const [looseEggs, setLooseEggs] = useState('0');
  const [brokenEggCount, setBrokenEggCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedBags, setFeedBags] = useState('1');
  const [feedGivenKg, setFeedGivenKg] = useState('50');
  const [waterGivenLiters, setWaterGivenLiters] = useState('100');
  const [notes, setNotes] = useState('');

  // Store Feed Stock form states
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0]);
  const [stockBags, setStockBags] = useState('10');
  const [bagPrice, setBagPrice] = useState('2500');
  const [stockVendor, setStockVendor] = useState('');
  const [submittingStock, setSubmittingStock] = useState(false);

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

  const handleBagsChange = (txt: string) => {
    setFeedBags(txt);
    const numBags = Number(txt || 0);
    setFeedGivenKg(String(numBags * 50));
  };

  const handleKgChange = (txt: string) => {
    setFeedGivenKg(txt);
    const numKg = Number(txt || 0);
    setFeedBags(String((numKg / 50).toFixed(1)));
  };

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

  const handleAddFeedStock = async () => {
    const numBags = Number(stockBags || 0);
    const numPrice = Number(bagPrice || 0);
    if (numBags <= 0 || numPrice <= 0) {
      showAlert('Error', 'Please enter valid Bags and Price per Bag');
      return;
    }
    setSubmittingStock(true);
    const totalKg = numBags * 50;
    const totalCost = numBags * numPrice;
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId || undefined,
          category: 'feed',
          amount: totalCost,
          date: stockDate,
          note: `Purchased ${numBags} Bags (${totalKg} kg) of Feed @ ৳${numPrice}/bag${stockVendor ? ` from ${stockVendor}` : ''}`
        })
      }, token);
      setModalVisible(false);
      load();
      showAlert('Success', `🌾 Added ${numBags} Bags (${totalKg} kg) to Feed Stock & logged ৳${totalCost.toLocaleString()} expense!`);
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
                <View style={s.chip}><Text style={s.chipText}>Feed: {log.feedGivenKg}kg ({(log.feedGivenKg / 50).toFixed(1)} Bags)</Text></View>
                <View style={s.chip}><Text style={s.chipText}>Water: {log.waterGivenLiters}L</Text></View>
              </View>
              {log.notes ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>📝 {log.notes}</Text> : null}
            </View>
          ))
        }
      </ScrollView>

      {/* Submit Log / Stock Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            {/* Section Switcher Tabs */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TouchableOpacity
                style={[s.tabBtn, formSection === 'log' && s.tabBtnActiveLog]}
                onPress={() => setFormSection('log')}
              >
                <Text style={{ color: formSection === 'log' ? colors.secondary : colors.textMuted, fontWeight: '800', fontSize: 12 }}>
                  ⚡ Daily Log
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.tabBtn, formSection === 'stock' && s.tabBtnActiveStock]}
                onPress={() => setFormSection('stock')}
              >
                <Text style={{ color: formSection === 'stock' ? colors.amber : colors.textMuted, fontWeight: '800', fontSize: 12 }}>
                  🌾 Add Feed Stock
                </Text>
              </TouchableOpacity>
            </View>

            {formSection === 'log' ? (
              /* SECTION 1: DAILY FEEDING & PRODUCTION LOG */
              <View>
                <Text style={{ color: colors.textMain, fontSize: 16, fontWeight: '800', marginBottom: 12 }}>⚡ Log Daily Yield & Feeding</Text>

                {/* Batch selector */}
                <Text style={common.label}>Select Batch *</Text>
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

                <Text style={common.label}>🔴 Broken Eggs</Text>
                <TextInput style={common.input} keyboardType="numeric" value={brokenEggCount} onChangeText={setBrokenEggCount} />

                <Text style={common.label}>☠️ Dead Birds</Text>
                <TextInput style={common.input} keyboardType="numeric" value={deadCount} onChangeText={setDeadCount} />

                {/* DUAL FEED INPUT (BAGS & KG) */}
                <View style={s.feedBox}>
                  <Text style={{ color: colors.amber, fontWeight: '800', fontSize: 13, marginBottom: 6 }}>🌾 Feed Given (Bags & kg)</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Feed Bags</Text>
                      <TextInput style={common.input} keyboardType="numeric" placeholder="1" value={feedBags} onChangeText={handleBagsChange} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Feed kg (1 Bag = 50kg)</Text>
                      <TextInput style={common.input} keyboardType="numeric" placeholder="50" value={feedGivenKg} onChangeText={handleKgChange} />
                    </View>
                  </View>
                </View>

                <Text style={common.label}>💧 Water Given (Liters)</Text>
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
              </View>
            ) : (
              /* SECTION 2: STORE FEED STOCK FORM (BUY FEED BAGS) */
              <View>
                <Text style={{ color: colors.amber, fontSize: 16, fontWeight: '800', marginBottom: 6 }}>🌾 Buy & Add Feed Bags to Stock</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 14 }}>Add bags to farm store stock and set bag price (1 Bag = 50 kg).</Text>

                <Text style={common.label}>📅 Date *</Text>
                <TextInput style={common.input} value={stockDate} onChangeText={setStockDate} placeholder="YYYY-MM-DD" />

                <Text style={common.label}>Number of Feed Bags Purchased *</Text>
                <TextInput style={common.input} keyboardType="numeric" value={stockBags} onChangeText={setStockBags} placeholder="10" />
                <Text style={{ color: colors.secondary, fontWeight: '700', fontSize: 12, marginBottom: 10 }}>
                  = {(Number(stockBags || 0) * 50).toLocaleString()} kg feed added
                </Text>

                <Text style={common.label}>Price per Bag (৳) *</Text>
                <TextInput style={common.input} keyboardType="numeric" value={bagPrice} onChangeText={setBagPrice} placeholder="2500" />
                <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 13, marginBottom: 10 }}>
                  Total Expense: ৳{(Number(stockBags || 0) * Number(bagPrice || 0)).toLocaleString()}
                </Text>

                <Text style={common.label}>Supplier / Vendor Name (Optional)</Text>
                <TextInput style={common.input} value={stockVendor} onChangeText={setStockVendor} placeholder="e.g. Sona Feed Mills" />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 30 }}>
                  <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setModalVisible(false)}>
                    <Text style={common.btnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[common.btn, { flex: 1, backgroundColor: colors.amber }]} onPress={handleAddFeedStock} disabled={submittingStock}>
                    {submittingStock ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>🌾 Save Feed Stock</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  tabBtnActiveStock: { borderColor: colors.amber, backgroundColor: 'rgba(217, 164, 65, 0.15)' }
});
