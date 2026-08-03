import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl, StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { formatEggCount, cratesAndLooseToTotal } from '../utils/crates';

export const DashboardScreen: React.FC<any> = ({ navigation }) => {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quick Daily Log Modal State (Crates + Loose Eggs)
  const [quickLogModal, setQuickLogModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [crates, setCrates] = useState('0');
  const [looseEggs, setLooseEggs] = useState('0');
  const [brokenEggCount, setBrokenEggCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedGivenKg, setFeedGivenKg] = useState('');
  const [waterGivenLiters, setWaterGivenLiters] = useState('');
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

  // Create Batch Modal State
  const [createBatchModal, setCreateBatchModal] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [breed, setBreed] = useState('');
  const [batchType, setBatchType] = useState<'layer' | 'broiler'>('layer');
  const [initialCount, setInitialCount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [shed, setShed] = useState('');
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Dedicated Batchwise Dashboard Modal State
  const [batchDashModalOpen, setBatchDashModalOpen] = useState(false);
  const [batchDashData, setBatchDashData] = useState<any>(null);
  const [loadingBatchDash, setLoadingBatchDash] = useState(false);

  const isOwner = user?.role === 'owner';
  const canManageBatches = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const [sum, batchData, logs] = await Promise.all([
        apiFetch('/reports/summary', {}, token),
        apiFetch('/batches', {}, token),
        apiFetch('/logs', {}, token),
      ]);
      setSummary(sum);
      setBatches(batchData);
      const activeBatches = batchData.filter((b: any) => b.status === 'active');
      if (activeBatches.length > 0 && !selectedBatchId) setSelectedBatchId(activeBatches[0]._id);
      else if (batchData.length > 0 && !selectedBatchId) setSelectedBatchId(batchData[0]._id);
      setRecentLogs(logs.slice(0, 5));
    } catch (e) { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, selectedBatchId]);

  useEffect(() => { load(); }, [load]);

  const openBatchDashboard = async (batchId: string) => {
    setLoadingBatchDash(true);
    setBatchDashModalOpen(true);
    try {
      const data = await apiFetch(`/reports/batch-dashboard/${batchId}`, {}, token);
      setBatchDashData(data);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to load batch dashboard');
    } finally {
      setLoadingBatchDash(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); load(); };

  const totalLogEggs = cratesAndLooseToTotal(crates, looseEggs);
  const totalSaleEggQty = saleItemType === 'egg' ? cratesAndLooseToTotal(saleCrates, saleLooseEggs) : Number(saleChickenQty || 0);

  const handleQuickLog = async () => {
    if (!selectedBatchId || totalLogEggs <= 0 || !feedGivenKg || !waterGivenLiters) {
      showAlert('Error', 'Please enter Egg count (Crates/Loose), Feed, and Water');
      return;
    }
    setSubmittingLog(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await apiFetch('/logs', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId,
          date: today,
          eggCount: totalLogEggs,
          brokenEggCount: Number(brokenEggCount || 0),
          deadCount: Number(deadCount || 0),
          feedGivenKg: Number(feedGivenKg),
          waterGivenLiters: Number(waterGivenLiters),
        })
      }, token);
      setQuickLogModal(false);
      setCrates('0'); setLooseEggs('0');
      setFeedGivenKg(''); setWaterGivenLiters('');
      load();
      showAlert('Success', `Logged ${formatEggCount(totalLogEggs)} successfully!`);
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmittingLog(false); }
  };

  const handleRecordSale = async () => {
    if (totalSaleEggQty <= 0 || !saleUnitPrice) {
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
          quantity: totalSaleEggQty,
          unitPrice: Number(saleUnitPrice),
          date: saleDate,
          customerName: saleCustomer || undefined
        })
      }, token);
      setSaleModalOpen(false);
      setSaleCrates('0'); setSaleLooseEggs('0');
      setSaleChickenQty(''); setSaleUnitPrice(''); setSaleCustomer('');
      load();
      showAlert('Success', 'Sale recorded successfully!');
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmittingSale(false); }
  };

  const handleCreateBatch = async () => {
    if (!batchName || !breed || !initialCount || Number(initialCount) <= 0) {
      showAlert('Error', 'Batch Name, Breed, and Initial Birds count are required');
      return;
    }
    setSubmittingBatch(true);
    try {
      await apiFetch('/batches', {
        method: 'POST',
        body: JSON.stringify({
          name: batchName,
          breed,
          type: batchType,
          initialCount: Number(initialCount),
          startDate,
          shed: shed || undefined
        })
      }, token);
      setCreateBatchModal(false);
      setBatchName(''); setBreed(''); setInitialCount(''); setShed('');
      load();
      showAlert('Success', `Batch "${batchName}" created successfully!`);
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmittingBatch(false); }
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
          {canManageBatches && (
            <TouchableOpacity style={s.batchHeaderBtn} onPress={() => setCreateBatchModal(true)}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>➕ Batch</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Egg Stock & Sales Highlights */}
        <Text style={[s.titleHeader, { marginTop: 8, marginBottom: 12 }]}>Egg Stock & Revenue</Text>
        <View style={s.statRow}>
          <View style={[common.statCard, { borderColor: colors.secondary, borderWidth: 1 }]}>
            <Text style={common.statLabel}>Current Egg Stock</Text>
            <Text style={[common.statValue, { color: colors.secondary, fontSize: 15 }]}>{formatEggCount(summary?.currentEggCount || 0)}</Text>
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
          <View style={[common.statCard, { borderColor: colors.blue, borderWidth: 1, backgroundColor: 'rgba(61, 107, 140, 0.12)' }]}>
            <Text style={common.statLabel}>Sales Income</Text>
            <Text style={[common.statValue, { color: colors.blue, fontSize: 15 }]}>৳{(summary?.totalIncome || 0).toLocaleString()}</Text>
            <Text style={common.statSub}>Total Revenue</Text>
          </View>
          <View style={{ width: 10 }} />
          <View style={common.statCard}>
            <Text style={common.statLabel}>Active Birds</Text>
            <Text style={[common.statValue, { color: colors.brand, fontSize: 15 }]}>
              {batches.filter(b => b.status === 'active').reduce((a: number, b: any) => a + b.currentCount, 0).toLocaleString()}
            </Text>
            <Text style={common.statSub}>{batches.filter(b => b.status === 'active').length} active flocks</Text>
          </View>
        </View>

        {/* 🐔 FLOCKS & BATCHES LIST SECTION */}
        <View style={{ marginTop: 24 }}>
          <View style={[common.row, { marginBottom: 12 }]}>
            <Text style={s.titleHeader}>All Farm Flocks ({batches.length})</Text>
            {canManageBatches && (
              <TouchableOpacity onPress={() => setCreateBatchModal(true)}>
                <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 13 }}>➕ New Batch</Text>
              </TouchableOpacity>
            )}
          </View>

          {batches.length > 0 ? (
            <View style={{ gap: 12 }}>
              {batches.map(batch => (
                <TouchableOpacity
                  key={batch._id}
                  onPress={() => navigation.navigate('BatchDashboard', { batchId: batch._id })}
                  activeOpacity={0.8}
                >
                  <View style={[common.card, { borderColor: batch.status === 'active' ? 'rgba(74, 124, 89, 0.4)' : 'rgba(107, 101, 92, 0.2)' }]}>
                    <View style={common.row}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textMain }}>{batch.name}</Text>
                          <View style={[s.badgeTag, { backgroundColor: batch.type === 'layer' ? 'rgba(61, 107, 140, 0.15)' : 'rgba(217, 164, 65, 0.15)' }]}>
                            <Text style={{ color: batch.type === 'layer' ? colors.blue : colors.amber, fontSize: 9, fontWeight: '800' }}>
                              {batch.type.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                          Breed: {batch.breed} {batch.shed ? `• Shed: ${batch.shed}` : ''}
                        </Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: batch.status === 'active' ? 'rgba(74, 124, 89, 0.15)' : 'rgba(107, 101, 92, 0.15)' }]}>
                        <Text style={{ color: batch.status === 'active' ? colors.secondary : colors.textMuted, fontSize: 10, fontWeight: '800' }}>
                          {batch.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={[s.batchInfoBox, { marginTop: 10 }]}>
                      <View>
                        <Text style={{ fontSize: 10, color: colors.textMuted }}>Current Birds</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.secondary }}>{batch.currentCount.toLocaleString()}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, color: colors.textMuted }}>Initial Birds</Text>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textMain }}>{batch.initialCount.toLocaleString()}</Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 10, padding: 8, backgroundColor: 'rgba(199, 81, 31, 0.12)', borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 12 }}>📊 Open Batch Dashboard →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={common.card}>
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 12 }}>
                No flocks created yet. Tap "➕ New Batch" to add a flock!
              </Text>
            </View>
          )}
        </View>

        {/* Recent Daily Logs */}
        <View style={{ marginTop: 24 }}>
          <Text style={[s.titleHeader, { marginBottom: 12 }]}>Recent Daily Yield Logs</Text>
          <View style={{ gap: 10 }}>
            {recentLogs.map((log: any) => (
              <View key={log._id} style={common.card}>
                <View style={common.row}>
                  <Text style={{ color: colors.textMain, fontWeight: '700', fontSize: 14 }}>Date: {log.date}</Text>
                  <Text style={{ color: colors.secondary, fontWeight: '800', fontSize: 13 }}>+{formatEggCount(log.eggCount)}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  Feed: {log.feedGivenKg}kg | Water: {log.waterGivenLiters}L
                  {log.deadCount > 0 ? ` | Dead: ${log.deadCount}` : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 📊 BATCHWISE DASHBOARD MODAL */}
      <Modal visible={batchDashModalOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContainer, { maxHeight: '90%' }]}>
            {loadingBatchDash || !batchDashData ? (
              <ActivityIndicator size="large" color={colors.brand} style={{ marginVertical: 30 }} />
            ) : (
              <ScrollView>
                <View style={[common.row, { marginBottom: 14 }]}>
                  <View>
                    <Text style={s.modalTitle}>{batchDashData.batch.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Breed: {batchDashData.batch.breed} • Shed: {batchDashData.batch.shed || 'Main Shed'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setBatchDashModalOpen(false)}>
                    <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* 1. EGG SECTION */}
                <View style={[s.dashCard, { borderColor: colors.secondary }]}>
                  <Text style={[s.sectionHeader, { color: colors.secondary }]}>🥚 1. Egg Yield</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Eggs Collected:</Text>
                    <Text style={[s.dashVal, { color: colors.secondary }]}>{formatEggCount(batchDashData.eggSection.totalEggs)}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Broken Eggs:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>{batchDashData.eggSection.totalBrokenEggs} eggs</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Laying Rate %:</Text>
                    <Text style={s.dashVal}>{batchDashData.eggSection.eggLayingRate}%</Text>
                  </View>
                </View>

                {/* 2. MORTALITY RATE SECTION */}
                <View style={[s.dashCard, { borderColor: colors.rose }]}>
                  <Text style={[s.sectionHeader, { color: colors.rose }]}>💀 2. Mortality Rate</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Dead Birds:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>{batchDashData.mortalitySection.totalDead} birds</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Mortality Rate %:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>{batchDashData.mortalitySection.mortalityRate}%</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Active / Initial Birds:</Text>
                    <Text style={s.dashVal}>{batchDashData.mortalitySection.currentCount} / {batchDashData.mortalitySection.initialCount}</Text>
                  </View>
                </View>

                {/* 3. EXPENSE SECTION */}
                <View style={[s.dashCard, { borderColor: colors.amber }]}>
                  <Text style={[s.sectionHeader, { color: colors.amber }]}>💸 3. Expenses</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Batch Expense:</Text>
                    <Text style={[s.dashVal, { color: colors.amber }]}>৳{batchDashData.expenseSection.totalExpenses.toLocaleString()}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Cost / Bird:</Text>
                    <Text style={s.dashVal}>৳{batchDashData.expenseSection.costPerBird}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Cost / Egg:</Text>
                    <Text style={s.dashVal}>৳{batchDashData.expenseSection.costPerEgg}</Text>
                  </View>
                </View>

                {/* 4. SELL SECTION */}
                <View style={[s.dashCard, { borderColor: colors.blue }]}>
                  <Text style={[s.sectionHeader, { color: colors.blue }]}>🏷️ 4. Sales Volume</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Eggs Sold:</Text>
                    <Text style={[s.dashVal, { color: colors.blue }]}>{formatEggCount(batchDashData.sellSection.totalEggsSold)}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Chickens Sold:</Text>
                    <Text style={s.dashVal}>{batchDashData.sellSection.totalChickensSold.toLocaleString()} birds</Text>
                  </View>
                </View>

                {/* 5. INCOME SECTION */}
                <View style={[s.dashCard, { borderColor: colors.brand }]}>
                  <Text style={[s.sectionHeader, { color: colors.brand }]}>📈 5. Income & Net Profit</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Sales Revenue:</Text>
                    <Text style={[s.dashVal, { color: colors.blue }]}>৳{batchDashData.incomeSection.totalIncome.toLocaleString()}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Net Batch Profit:</Text>
                    <Text style={[s.dashVal, { color: batchDashData.incomeSection.netProfit >= 0 ? colors.secondary : colors.rose }]}>
                      ৳{batchDashData.incomeSection.netProfit.toLocaleString()} ({batchDashData.incomeSection.profitMargin}%)
                    </Text>
                  </View>
                </View>

                {/* 6. FOOD INFO SECTION */}
                <View style={[s.dashCard, { borderColor: colors.secondary }]}>
                  <Text style={[s.sectionHeader, { color: colors.secondary }]}>🌾 6. Food Info</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Feed Consumed:</Text>
                    <Text style={[s.dashVal, { color: colors.secondary }]}>{batchDashData.foodSection.totalFeedKg} kg</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Daily Feed / Chicken:</Text>
                    <Text style={s.dashVal}>{batchDashData.foodSection.feedPerChickenGrams} g/bird ({batchDashData.foodSection.feedPerChickenPercentage}%)</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Water Provided:</Text>
                    <Text style={s.dashVal}>{batchDashData.foodSection.totalWaterLiters} L</Text>
                  </View>
                </View>

                <TouchableOpacity style={[s.cancelBtn, { marginTop: 14 }]} onPress={() => setBatchDashModalOpen(false)}>
                  <Text style={s.btnText}>Close Dashboard</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* QUICK LOG MODAL */}
      <Modal visible={quickLogModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>⚡ Quick Daily Log</Text>
            <ScrollView>
              <Text style={common.label}>Select Flock / Batch</Text>
              {batches.map((b: any) => (
                <TouchableOpacity
                  key={b._id}
                  style={[s.batchOption, selectedBatchId === b._id && s.batchOptionSelected]}
                  onPress={() => setSelectedBatchId(b._id)}
                >
                  <Text style={{ color: selectedBatchId === b._id ? colors.brand : colors.textMain, fontWeight: '700' }}>
                    {b.name} ({b.breed})
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={s.eggInputBox}>
                <Text style={{ color: colors.secondary, fontWeight: '800', fontSize: 13, marginBottom: 6 }}>
                  🥚 Eggs Collected (1 Crate = 30 Eggs)
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Full Crates</Text>
                    <TextInput style={common.input} keyboardType="numeric" value={crates} onChangeText={setCrates} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Loose Eggs</Text>
                    <TextInput style={common.input} keyboardType="numeric" value={looseEggs} onChangeText={setLooseEggs} />
                  </View>
                </View>
                <Text style={{ color: colors.secondary, fontWeight: '800', marginTop: 6, fontSize: 13 }}>
                  Total: {formatEggCount(totalLogEggs)} ({totalLogEggs} eggs)
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={common.label}>Broken Eggs</Text>
                  <TextInput style={common.input} keyboardType="numeric" value={brokenEggCount} onChangeText={setBrokenEggCount} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={common.label}>Dead Birds</Text>
                  <TextInput style={common.input} keyboardType="numeric" value={deadCount} onChangeText={setDeadCount} />
                </View>
              </View>

              <Text style={common.label}>Feed Given (kg)</Text>
              <TextInput style={common.input} keyboardType="numeric" placeholder="50" placeholderTextColor="#6B655C" value={feedGivenKg} onChangeText={setFeedGivenKg} />

              <Text style={common.label}>Water Given (L)</Text>
              <TextInput style={common.input} keyboardType="numeric" placeholder="200" placeholderTextColor="#6B655C" value={waterGivenLiters} onChangeText={setWaterGivenLiters} />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setQuickLogModal(false)}>
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={handleQuickLog} disabled={submittingLog}>
                <Text style={s.btnText}>{submittingLog ? 'Saving...' : '⚡ Save Log'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RECORD SALE MODAL */}
      <Modal visible={saleModalOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>💰 Record Sale Revenue</Text>
            <ScrollView>
              <Text style={common.label}>Item to Sell</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <TouchableOpacity
                  style={[s.typeBtn, saleItemType === 'egg' && s.typeBtnSelectedEgg]}
                  onPress={() => setSaleItemType('egg')}
                >
                  <Text style={{ color: saleItemType === 'egg' ? colors.secondary : colors.textMuted, fontWeight: '800' }}>🥚 Eggs</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeBtn, saleItemType === 'chicken' && s.typeBtnSelectedChicken]}
                  onPress={() => setSaleItemType('chicken')}
                >
                  <Text style={{ color: saleItemType === 'chicken' ? colors.blue : colors.textMuted, fontWeight: '800' }}>🐔 Chickens</Text>
                </TouchableOpacity>
              </View>

              {saleItemType === 'egg' ? (
                <View style={s.eggInputBox}>
                  <Text style={{ color: colors.secondary, fontWeight: '800', fontSize: 13, marginBottom: 6 }}>
                    Egg Selling Quantity (1 Crate = 30 Eggs)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Full Crates</Text>
                      <TextInput style={common.input} keyboardType="numeric" value={saleCrates} onChangeText={setSaleCrates} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Loose Eggs</Text>
                      <TextInput style={common.input} keyboardType="numeric" value={saleLooseEggs} onChangeText={setSaleLooseEggs} />
                    </View>
                  </View>
                  <Text style={{ color: colors.secondary, fontWeight: '800', marginTop: 6, fontSize: 13 }}>
                    Selling: {formatEggCount(totalSaleEggQty)} ({totalSaleEggQty} eggs)
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={common.label}>Number of Chickens</Text>
                  <TextInput style={common.input} keyboardType="numeric" placeholder="50" placeholderTextColor="#6B655C" value={saleChickenQty} onChangeText={setSaleChickenQty} />
                </View>
              )}

              <Text style={common.label}>
                {saleItemType === 'egg' ? 'Price per Egg (৳)' : 'Price per Chicken (৳)'}
              </Text>
              <TextInput style={common.input} keyboardType="numeric" placeholder="10.50" placeholderTextColor="#6B655C" value={saleUnitPrice} onChangeText={setSaleUnitPrice} />

              {totalSaleEggQty > 0 && Number(saleUnitPrice) > 0 && (
                <Text style={{ color: colors.blue, fontWeight: '800', marginVertical: 6, fontSize: 14 }}>
                  Total Income: ৳{(totalSaleEggQty * Number(saleUnitPrice)).toLocaleString()}
                </Text>
              )}

              <Text style={common.label}>Customer Name</Text>
              <TextInput style={common.input} placeholder="Wholesale Buyer" placeholderTextColor="#6B655C" value={saleCustomer} onChangeText={setSaleCustomer} />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setSaleModalOpen(false)}>
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.blue }]} onPress={handleRecordSale} disabled={submittingSale}>
                <Text style={s.btnText}>{submittingSale ? 'Recording...' : '💰 Record Revenue'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CREATE BATCH MODAL */}
      <Modal visible={createBatchModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>➕ Create New Flock</Text>
            <ScrollView>
              <Text style={common.label}>Batch Name</Text>
              <TextInput style={common.input} placeholder="e.g. Batch 2026-A" placeholderTextColor="#6B655C" value={batchName} onChangeText={setBatchName} />

              <Text style={common.label}>Breed</Text>
              <TextInput style={common.input} placeholder="e.g. Hy-Line Brown" placeholderTextColor="#6B655C" value={breed} onChangeText={setBreed} />

              <Text style={common.label}>Initial Bird Count</Text>
              <TextInput style={common.input} keyboardType="numeric" placeholder="1000" placeholderTextColor="#6B655C" value={initialCount} onChangeText={setInitialCount} />

              <Text style={common.label}>Shed / House Name</Text>
              <TextInput style={common.input} placeholder="Shed 1" placeholderTextColor="#6B655C" value={shed} onChangeText={setShed} />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setCreateBatchModal(false)}>
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.brand }]} onPress={handleCreateBatch} disabled={submittingBatch}>
                <Text style={s.btnText}>{submittingBatch ? 'Creating...' : '➕ Create Flock'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  brandLogo: { fontSize: 20, fontWeight: '900', color: colors.brand },
  quickLogHeaderBtn: { backgroundColor: colors.secondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  saleHeaderBtn: { backgroundColor: colors.blue, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  batchHeaderBtn: { backgroundColor: colors.brand, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  titleHeader: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  statRow: { flexDirection: 'row' },
  badgeTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  batchInfoBox: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: colors.surfaceElevated, borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(45, 42, 38, 0.65)', justifyContent: 'center', padding: 16 },
  modalContainer: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textMain, marginBottom: 12 },
  batchOption: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 6, backgroundColor: colors.surfaceElevated },
  batchOptionSelected: { borderColor: colors.brand, backgroundColor: 'rgba(199, 81, 31, 0.15)' },
  eggInputBox: { backgroundColor: 'rgba(74, 124, 89, 0.08)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(74, 124, 89, 0.2)', marginVertical: 8 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surfaceElevated },
  typeBtnSelectedEgg: { borderColor: colors.secondary, backgroundColor: 'rgba(74, 124, 89, 0.15)' },
  typeBtnSelectedChicken: { borderColor: colors.blue, backgroundColor: 'rgba(61, 107, 140, 0.15)' },
  cancelBtn: { flex: 1, backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 8, alignItems: 'center' },
  submitBtn: { flex: 1, backgroundColor: colors.secondary, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  dashCard: { backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  sectionHeader: { fontWeight: '800', fontSize: 14, marginBottom: 8 },
  dashRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dashLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  dashVal: { color: colors.textMain, fontSize: 13, fontWeight: '800' }
});
