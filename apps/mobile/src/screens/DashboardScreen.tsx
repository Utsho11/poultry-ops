import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl, StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { formatEggCount, cratesAndLooseToTotal } from '../utils/crates';

export const DashboardScreen: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Record<string, boolean>>({});
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quick Daily Log Form State (Crates + Loose Eggs)
  const [quickLogModal, setQuickLogModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [crates, setCrates] = useState('0');
  const [looseEggs, setLooseEggs] = useState('0');
  const [brokenCount, setBrokenCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedKg, setFeedKg] = useState('');
  const [waterL, setWaterL] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  // Record Sale Modal State (OWNER ONLY - Crates + Loose Eggs)
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleItemType, setSaleItemType] = useState<'egg' | 'chicken'>('egg');
  const [saleBatchId, setSaleBatchId] = useState('');
  const [saleCrates, setSaleCrates] = useState('0');
  const [saleLooseEggs, setSaleLooseEggs] = useState('0');
  const [saleChickenQty, setSaleChickenQty] = useState('');
  const [saleUnitPrice, setSaleUnitPrice] = useState('');
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingSale, setSubmittingSale] = useState(false);

  const isOwner = user?.role === 'owner';

  const load = useCallback(async () => {
    try {
      const [sum, batchData, logs, remData] = await Promise.all([
        apiFetch('/reports/summary', {}, token),
        apiFetch('/batches?status=active', {}, token),
        apiFetch('/logs', {}, token),
        apiFetch('/reminders', {}, token),
      ]);
      setSummary(sum);
      setBatches(batchData);
      if (batchData.length > 0 && !selectedBatchId) setSelectedBatchId(batchData[0]._id);
      setRecentLogs(logs.slice(0, 5));
      setReminders(remData);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const totalLogEggs = cratesAndLooseToTotal(crates, looseEggs);
  const totalSaleQty = saleItemType === 'egg' ? cratesAndLooseToTotal(saleCrates, saleLooseEggs) : Number(saleChickenQty || 0);

  const handleQuickLogSave = async () => {
    if (!selectedBatchId || totalLogEggs <= 0 || !feedKg || !waterL) {
      showAlert('Error', 'Please enter Eggs (Crates/Loose), Feed, and Water values');
      return;
    }
    setSubmittingLog(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId,
          date: todayStr,
          eggCount: totalLogEggs,
          brokenEggCount: Number(brokenCount || 0),
          deadCount: Number(deadCount || 0),
          feedGivenKg: Number(feedKg),
          waterGivenLiters: Number(waterL),
        })
      }, token);
      showAlert('Success', `Daily Log saved! (${formatEggCount(totalLogEggs)})`);
      setQuickLogModal(false);
      setCrates('0');
      setLooseEggs('0');
      setFeedKg('');
      setWaterL('');
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmittingLog(false); }
  };

  const handleSaveSale = async () => {
    if (totalSaleQty <= 0 || !saleUnitPrice) {
      showAlert('Error', 'Quantity and Unit Price are required');
      return;
    }
    setSubmittingSale(true);
    try {
      await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify({
          itemType: saleItemType,
          batchId: saleBatchId || undefined,
          quantity: totalSaleQty,
          unitPrice: Number(saleUnitPrice),
          date: saleDate,
          customerName: saleCustomer || undefined
        })
      }, token);
      showAlert('Success', `${saleItemType === 'egg' ? 'Egg' : 'Chicken'} sale recorded!`);
      setSaleModalOpen(false);
      setSaleCrates('0');
      setSaleLooseEggs('0');
      setSaleChickenQty('');
      setSaleUnitPrice('');
      setSaleCustomer('');
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmittingSale(false); }
  };

  const toggleTaskDone = (id: string) => {
    setCompletedTaskIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalBirds = batches.reduce((a: number, b: any) => a + b.currentCount, 0);
  const completedCount = Object.values(completedTaskIds).filter(Boolean).length;
  const todayDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // 12-hour AM/PM formatting helper
  const format12Hour = (timeStr?: string) => {
    if (!timeStr) return '06:00 AM';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h, 10);
    const minutes = m || '00';
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours < 10 ? '0' + hours : hours}:${minutes} ${period}`;
  };

  if (loading) return (
    <View style={[common.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );

  return (
    <View style={common.screen}>
      {/* Mobile Top Header */}
      <View style={s.topHeader}>
        <Text style={s.brandLogo}>PoultryOps</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={s.quickLogHeaderBtn} onPress={() => setQuickLogModal(true)}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>⚡ Log</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity style={s.saleHeaderBtn} onPress={() => setSaleModalOpen(true)}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>💰 Sale</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Today's Tasks Section */}
        <View style={common.row}>
          <View>
            <Text style={s.titleHeader}>Today's Tasks</Text>
            <Text style={s.dateSubheader}>{todayDateStr}</Text>
          </View>
          <Text style={s.taskProgress}>{completedCount}/<Text style={{ color: colors.textMuted }}>{reminders.length || 1}</Text></Text>
        </View>

        {/* Task Cards List */}
        <View style={{ marginTop: 14, gap: 14 }}>
          {reminders.length > 0 ? (
            reminders.map(rem => {
              const isDone = completedTaskIds[rem._id];
              return (
                <View key={rem._id} style={[common.card, isDone && { opacity: 0.55 }]}>
                  <View style={common.row}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                      <View style={s.taskIconCircle}>
                        <Text style={{ fontSize: 18 }}>{rem.type === 'feed' ? '🌾' : rem.type === 'medicine' ? '💊' : '💧'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.taskTitle, isDone && { textDecorationLine: 'line-through' }]}>{rem.message}</Text>
                        <Text style={s.taskDesc}>
                          {rem.repeat && rem.repeat !== 'none' ? `Repeats ${rem.repeat}` : `Target: ${rem.dueDate || 'Today'}`}
                        </Text>
                      </View>
                    </View>
                    <View style={s.timeBadge}>
                      <Text style={s.timeBadgeText}>{format12Hour(rem.dueTime)}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[s.markDoneBtn, isDone && { backgroundColor: colors.surfaceElevated }]}
                    onPress={() => toggleTaskDone(rem._id)}
                  >
                    <Text style={s.markDoneText}>{isDone ? '✓ Completed' : '✓ Mark Done'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={common.card}>
              <View style={common.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={s.taskIconCircle}><Text style={{ fontSize: 18 }}>🌾</Text></View>
                  <View>
                    <Text style={s.taskTitle}>Morning Feed - House A</Text>
                    <Text style={s.taskDesc}>Distribute 500kg grower pellet feed.</Text>
                  </View>
                </View>
                <View style={s.timeBadge}><Text style={s.timeBadgeText}>06:00 AM</Text></View>
              </View>
              <TouchableOpacity style={s.markDoneBtn}>
                <Text style={s.markDoneText}>✓ Mark Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Egg Stock & Sales Highlights (Formatted in Crates) */}
        <Text style={[s.titleHeader, { marginTop: 24, marginBottom: 12 }]}>Egg Stock & Revenue</Text>
        <View style={s.statRow}>
          <View style={[common.statCard, { borderColor: colors.brand, borderWidth: 1 }]}>
            <Text style={common.statLabel}>Current Egg Stock</Text>
            <Text style={[common.statValue, { color: colors.brand, fontSize: 15 }]}>{formatEggCount(summary?.currentEggCount || 0)}</Text>
            <Text style={common.statSub}>{(summary?.currentEggCount || 0).toLocaleString()} unsold eggs</Text>
          </View>
          <View style={{ width: 10 }} />
          <View style={common.statCard}>
            <Text style={common.statLabel}>All-Time Eggs</Text>
            <Text style={[common.statValue, { color: colors.amber, fontSize: 15 }]}>{formatEggCount(summary?.allTimeEggCount || 0)}</Text>
            <Text style={common.statSub}>{(summary?.allTimeEggCount || 0).toLocaleString()} total</Text>
          </View>
        </View>

        <View style={[s.statRow, { marginTop: 10 }]}>
          <View style={[common.statCard, { flex: 1, borderColor: colors.blue, borderWidth: 1 }]}>
            <Text style={common.statLabel}>Total Sales Income</Text>
            <Text style={[common.statValue, { color: colors.blue }]}>৳{(summary?.totalIncome || 0).toLocaleString()}</Text>
            <Text style={common.statSub}>Sold: {formatEggCount(summary?.totalEggsSold || 0)} | {summary?.totalChickensSold || 0} birds</Text>
          </View>
        </View>

        {/* Flock Overview Stats */}
        <Text style={[s.titleHeader, { marginTop: 24, marginBottom: 12 }]}>Flock Overview</Text>
        <View style={s.statRow}>
          <View style={common.statCard}>
            <Text style={common.statLabel}>Active Birds</Text>
            <Text style={[common.statValue, { color: colors.brand }]}>{totalBirds.toLocaleString()}</Text>
            <Text style={common.statSub}>{batches.length} active flocks</Text>
          </View>
          <View style={{ width: 10 }} />
          <View style={common.statCard}>
            <Text style={common.statLabel}>Total Expenses</Text>
            <Text style={[common.statValue, { color: colors.purple }]}>৳{(summary?.totalCost || 0).toLocaleString()}</Text>
            <Text style={common.statSub}>Cost/Egg: ৳{summary?.costPerEgg || 0}</Text>
          </View>
        </View>

        {/* Logout Link */}
        <TouchableOpacity onPress={logout} style={s.logoutRow}>
          <Text style={{ color: colors.rose, fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ⚡ Quick Save Daily Log Modal (Crates + Loose Eggs) */}
      <Modal visible={quickLogModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 20, fontWeight: '800', marginBottom: 16 }}>⚡ Quick Save Daily Log</Text>

            {/* Select Batch */}
            <Text style={common.label}>Select Flock / Batch *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {batches.map(b => (
                <TouchableOpacity
                  key={b._id}
                  onPress={() => setSelectedBatchId(b._id)}
                  style={[s.batchChip, selectedBatchId === b._id && s.batchChipActive]}
                >
                  <Text style={{ color: selectedBatchId === b._id ? '#fff' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Crates + Loose Eggs Inputs */}
            <View style={s.crateBox}>
              <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 13, marginBottom: 6 }}>🥚 Eggs Collected (1 Crate = 30 Eggs)</Text>
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
              <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 12, marginTop: 4 }}>
                Total: {formatEggCount(totalLogEggs)} ({totalLogEggs} eggs)
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={common.label}>Broken Eggs</Text>
                <TextInput style={common.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" value={brokenCount} onChangeText={setBrokenCount} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={common.label}>Dead Birds</Text>
                <TextInput style={common.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" value={deadCount} onChangeText={setDeadCount} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={common.label}>Feed (kg) *</Text>
                <TextInput style={common.input} keyboardType="numeric" placeholder="50" placeholderTextColor="#64748b" value={feedKg} onChangeText={setFeedKg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={common.label}>Water (L) *</Text>
                <TextInput style={common.input} keyboardType="numeric" placeholder="120" placeholderTextColor="#64748b" value={waterL} onChangeText={setWaterL} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 30 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setQuickLogModal(false)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1, backgroundColor: colors.brand }]} onPress={handleQuickLogSave} disabled={submittingLog}>
                {submittingLog ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>⚡ Save Log</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* 💰 Record Sale Modal (OWNER ONLY - Crates + Loose Eggs) */}
      <Modal visible={saleModalOpen && isOwner} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text style={{ color: colors.textMain, fontSize: 20, fontWeight: '800', marginBottom: 16 }}>💰 Record Sale (Owner Only)</Text>

            <Text style={common.label}>Select Item Type *</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => setSaleItemType('egg')}
                style={[s.typeChip, saleItemType === 'egg' && s.typeChipActiveEgg]}
              >
                <Text style={{ color: saleItemType === 'egg' ? '#fff' : colors.textMuted, fontWeight: '800' }}>🥚 Eggs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSaleItemType('chicken')}
                style={[s.typeChip, saleItemType === 'chicken' && s.typeChipActiveChicken]}
              >
                <Text style={{ color: saleItemType === 'chicken' ? '#fff' : colors.textMuted, fontWeight: '800' }}>🐔 Chicken / Birds</Text>
              </TouchableOpacity>
            </View>

            {saleItemType === 'egg' ? (
              <View style={s.crateBox}>
                <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 13, marginBottom: 6 }}>🥚 Egg Sale Qty (1 Crate = 30 Eggs)</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Full Crates</Text>
                    <TextInput style={common.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" value={saleCrates} onChangeText={setSaleCrates} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Loose Eggs</Text>
                    <TextInput style={common.input} keyboardType="numeric" placeholder="0" placeholderTextColor="#64748b" value={saleLooseEggs} onChangeText={setSaleLooseEggs} />
                  </View>
                </View>
                <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 12, marginTop: 4 }}>
                  Selling: {formatEggCount(totalSaleQty)} ({totalSaleQty} eggs)
                </Text>
              </View>
            ) : (
              <View>
                <Text style={common.label}>Number of Chickens / Birds *</Text>
                <TextInput style={common.input} keyboardType="numeric" placeholder="e.g. 50" placeholderTextColor="#64748b" value={saleChickenQty} onChangeText={setSaleChickenQty} />
              </View>
            )}

            <Text style={common.label}>Unit Price (৳) *</Text>
            <TextInput style={common.input} keyboardType="numeric" placeholder={saleItemType === 'egg' ? '10.50 per egg' : '220 per bird'} placeholderTextColor="#64748b" value={saleUnitPrice} onChangeText={setSaleUnitPrice} />

            {totalSaleQty > 0 && saleUnitPrice ? (
              <View style={s.totalBanner}>
                <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 15 }}>
                  Total Revenue: ৳{(totalSaleQty * Number(saleUnitPrice)).toLocaleString()}
                </Text>
              </View>
            ) : null}

            <Text style={common.label}>Customer Name</Text>
            <TextInput style={common.input} placeholder="e.g. Wholesale Buyer" placeholderTextColor="#64748b" value={saleCustomer} onChangeText={setSaleCustomer} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 30 }}>
              <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setSaleModalOpen(false)}>
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[common.btn, { flex: 1, backgroundColor: colors.blue }]} onPress={handleSaveSale} disabled={submittingSale}>
                {submittingSale ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>💰 Save Income</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 50, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandLogo: { fontSize: 22, fontWeight: '800', color: colors.brand },
  quickLogHeaderBtn: { backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  saleHeaderBtn: { backgroundColor: colors.blue, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  titleHeader: { fontSize: 22, fontWeight: '800', color: colors.textMain },
  dateSubheader: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  taskProgress: { fontSize: 20, fontWeight: '800', color: colors.brand },
  taskIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' },
  taskTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  taskDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  timeBadge: { backgroundColor: 'rgba(244,63,94,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  timeBadgeText: { color: colors.rose, fontSize: 11, fontWeight: '700' },
  markDoneText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  markDoneBtn: { backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
  statRow: { flexDirection: 'row' },
  logoutRow: { marginTop: 24, padding: 14, alignItems: 'center', backgroundColor: 'rgba(244,63,94,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244,63,94,0.2)' },
  typeChip: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  typeChipActiveEgg: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeChipActiveChicken: { backgroundColor: colors.blue, borderColor: colors.blue },
  crateBox: { backgroundColor: 'rgba(16,185,129,0.1)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 14 },
  totalBanner: { backgroundColor: 'rgba(59,130,246,0.15)', padding: 12, borderRadius: 10, marginBottom: 14, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  batchChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  batchChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
});
