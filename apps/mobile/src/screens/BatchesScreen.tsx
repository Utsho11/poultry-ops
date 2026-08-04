import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
function getBatchAgeText(startDateStr: string) {
  if (!startDateStr) return 'N/A';
  const start = new Date(startDateStr);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const w = Math.floor(diffDays / 7);
  const d = diffDays % 7;
  const dayNumber = diffDays + 1;
  const formatted = w === 0 ? `${d}d` : d === 0 ? `${w}w` : `${w}w ${d}d`;
  return `${formatted} (Day ${dayNumber})`;
}

export const BatchesScreen: React.FC<any> = ({ navigation }) => {
  const { token, user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [teamWorkers, setTeamWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [assignModalBatch, setAssignModalBatch] = useState<any | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Dedicated Batchwise Dashboard Modal state
  const [activeBatchDashboard, setActiveBatchDashboard] = useState<any | null>(null);
  const [dashboardModalVisible, setDashboardModalVisible] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  // Form
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('Cobb 500');
  const [type, setType] = useState<'broiler' | 'layer'>('layer');
  const [initialCount, setInitialCount] = useState('1000');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [shed, setShed] = useState('Shed A');

  const load = useCallback(async () => {
    try {
      const [batchData, usersData] = await Promise.all([
        apiFetch('/batches', {}, token),
        canManage ? apiFetch('/team', {}, token) : Promise.resolve([])
      ]);
      setBatches(batchData);
      if (Array.isArray(usersData)) {
        setTeamWorkers(usersData.filter((u: any) => u.role === 'worker'));
      }
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [canManage, token]);

  useEffect(() => { load(); }, [load]);

  const loadBatchDashboard = async (batchId: string) => {
    setLoadingDashboard(true);
    setDashboardModalVisible(true);
    try {
      const data = await apiFetch(`/reports/batch-dashboard/${batchId}`, {}, token);
      setActiveBatchDashboard(data);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to load batch dashboard');
    } finally {
      setLoadingDashboard(false);
    }
  };

  const handleCreate = async () => {
    if (!name) { showAlert('Error', 'Batch name is required'); return; }
    if (!startDate) { showAlert('Error', 'Start date is required (YYYY-MM-DD)'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/batches', {
        method: 'POST',
        body: JSON.stringify({
          name, breed, type, startDate,
          initialCount: Number(initialCount), shed,
          assignedWorkerIds: selectedWorkerIds
        })
      }, token);
      setModalVisible(false);
      setName('');
      setSelectedWorkerIds([]);
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    } finally { setSubmitting(false); }
  };

  const handleOpenAssignModal = (batch: any) => {
    setAssignModalBatch(batch);
    setSelectedWorkerIds(batch.assignedWorkerIds || []);
  };

  const handleSaveAssignments = async () => {
    if (!assignModalBatch) return;
    try {
      await apiFetch(`/batches/${assignModalBatch._id}/assign-workers`, {
        method: 'PATCH',
        body: JSON.stringify({ workerIds: selectedWorkerIds })
      }, token);
      setAssignModalBatch(null);
      setSelectedWorkerIds([]);
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    }
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const handleClose = async (id: string, batchName: string) => {
    showAlert('Close Batch', `Close "${batchName}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close', style: 'destructive', onPress: async () => {
          try {
            await apiFetch(`/batches/${id}/close`, { method: 'POST' }, token);
            load();
          } catch (e: any) { showAlert('Error', e.message); }
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brand} />}
      >
        <View style={common.row}>
          <View>
            <Text style={common.sectionTitle}>Bird Flocks</Text>
            <Text style={common.sectionSubtitle}>
              {user?.role === 'worker' ? 'Your assigned flocks' : `${batches.length} total farm flocks`}
            </Text>
          </View>

          {canManage && (
            <TouchableOpacity style={common.btn} onPress={() => { setSelectedWorkerIds([]); setModalVisible(true); }}>
              <Text style={common.btnText}>+ New Batch</Text>
            </TouchableOpacity>
          )}
        </View>

        {batches.map(batch => {
          const isClosed = batch.status === 'closed';
          const mortalityCount = batch.initialCount - batch.currentCount;
          const mortalityPct = ((mortalityCount / batch.initialCount) * 100).toFixed(1);
          const assignedWorkers = teamWorkers.filter(w => (batch.assignedWorkerIds || []).includes(w._id));

          return (
            <View key={batch._id} style={[common.card, isClosed && { opacity: 0.6 }]}>
              <View style={common.row}>
                <Text style={s.batchName}>{batch.name}</Text>
                <View style={[s.badge, { backgroundColor: isClosed ? 'rgba(178, 58, 47, 0.15)' : 'rgba(74, 124, 89, 0.15)' }]}>
                  <Text style={{ color: isClosed ? colors.rose : colors.secondary, fontWeight: '800', fontSize: 10 }}>
                    {batch.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={s.breedText}>
                🐔 {batch.breed} ({batch.type}) • 🏠 {batch.shed || 'Main Shed'} • 📅 Age: {getBatchAgeText(batch.startDate)}
              </Text>

              {/* Progress bar */}
              <View style={s.progressContainer}>
                <View style={common.row}>
                  <Text style={s.progressText}>Current: {batch.currentCount} birds</Text>
                  <Text style={[s.progressText, { color: colors.rose }]}>Mortality: {mortalityPct}% ({mortalityCount})</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${(batch.currentCount / batch.initialCount) * 100}%` }]} />
                </View>
              </View>

              {/* View Batchwise Dashboard Button */}
              <TouchableOpacity style={s.dashBtn} onPress={() => navigation.navigate('BatchDashboard', { batchId: batch._id })}>
                <Text style={s.dashBtnText}>📊 View Batch Dashboard</Text>
              </TouchableOpacity>

              {/* Assigned Workers */}
              <View style={s.workerBox}>
                <View style={common.row}>
                  <Text style={s.workerTitle}>👥 Workers ({assignedWorkers.length})</Text>
                  {canManage && (
                    <TouchableOpacity onPress={() => handleOpenAssignModal(batch)}>
                      <Text style={s.assignBtnText}>Assign Workers</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {assignedWorkers.length > 0 ? (
                  <View style={s.workerChipRow}>
                    {assignedWorkers.map(w => (
                      <View key={w._id} style={s.workerChip}>
                        <Text style={s.workerChipText}>👤 {w.name}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={s.allWorkersText}>
                    {canManage ? 'All workers can access (Click Assign Workers to restrict)' : 'Assigned to All Workers'}
                  </Text>
                )}
              </View>

              {canManage && !isClosed && (
                <TouchableOpacity style={{ marginTop: 10 }} onPress={() => handleClose(batch._id, batch.name)}>
                  <Text style={s.closeText}>Close Batch</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* 📊 BATCHWISE DASHBOARD MODAL (6 SECTIONS) */}
      <Modal visible={dashboardModalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContainer, { maxHeight: '90%' }]}>
            {loadingDashboard || !activeBatchDashboard ? (
              <ActivityIndicator size="large" color={colors.brand} style={{ marginVertical: 30 }} />
            ) : (
              <ScrollView>
                <View style={[common.row, { marginBottom: 14 }]}>
                  <View>
                    <Text style={s.modalTitle}>{activeBatchDashboard.batch.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Breed: {activeBatchDashboard.batch.breed} • Shed: {activeBatchDashboard.batch.shed || 'Main Shed'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDashboardModalVisible(false)}>
                    <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* 1. EGG SECTION */}
                <View style={[s.dashCard, { borderColor: colors.secondary }]}>
                  <Text style={[s.sectionHeader, { color: colors.secondary }]}>🥚 1. Egg Yield</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Eggs Collected:</Text>
                    <Text style={[s.dashVal, { color: colors.secondary }]}>{formatEggCount(activeBatchDashboard.eggSection.totalEggs)}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Broken Eggs:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>{activeBatchDashboard.eggSection.totalBrokenEggs} eggs</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Laying Rate %:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.eggSection.eggLayingRate}%</Text>
                  </View>
                </View>

                {/* 2. MORTALITY RATE SECTION */}
                <View style={[s.dashCard, { borderColor: colors.rose }]}>
                  <Text style={[s.sectionHeader, { color: colors.rose }]}>💀 2. Mortality Rate</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Dead Birds:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>{activeBatchDashboard.mortalitySection.totalDead} birds</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Mortality Rate %:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>{activeBatchDashboard.mortalitySection.mortalityRate}%</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Active / Initial Birds:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.mortalitySection.currentCount} / {activeBatchDashboard.mortalitySection.initialCount}</Text>
                  </View>
                </View>

                {/* 3. EXPENSE SECTION */}
                <View style={[s.dashCard, { borderColor: colors.amber }]}>
                  <Text style={[s.sectionHeader, { color: colors.amber }]}>💸 3. Expenses</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Batch Expense:</Text>
                    <Text style={[s.dashVal, { color: colors.amber }]}>৳{activeBatchDashboard.expenseSection.totalExpenses.toLocaleString()}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Cost / Bird:</Text>
                    <Text style={s.dashVal}>৳{activeBatchDashboard.expenseSection.costPerBird}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Cost / Egg:</Text>
                    <Text style={s.dashVal}>৳{activeBatchDashboard.expenseSection.costPerEgg}</Text>
                  </View>
                </View>

                {/* 4. SELL SECTION */}
                <View style={[s.dashCard, { borderColor: colors.blue }]}>
                  <Text style={[s.sectionHeader, { color: colors.blue }]}>🏷️ 4. Sales Volume</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Eggs Sold:</Text>
                    <Text style={[s.dashVal, { color: colors.blue }]}>{formatEggCount(activeBatchDashboard.sellSection.totalEggsSold)}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Chickens Sold:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.sellSection.totalChickensSold.toLocaleString()} birds</Text>
                  </View>
                </View>

                {/* 5. INCOME SECTION */}
                <View style={[s.dashCard, { borderColor: colors.brand }]}>
                  <Text style={[s.sectionHeader, { color: colors.brand }]}>📈 5. Income & Net Profit</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Sales Revenue:</Text>
                    <Text style={[s.dashVal, { color: colors.blue }]}>৳{activeBatchDashboard.incomeSection.totalIncome.toLocaleString()}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Net Batch Profit:</Text>
                    <Text style={[s.dashVal, { color: activeBatchDashboard.incomeSection.netProfit >= 0 ? colors.secondary : colors.rose }]}>
                      ৳{activeBatchDashboard.incomeSection.netProfit.toLocaleString()} ({activeBatchDashboard.incomeSection.profitMargin}%)
                    </Text>
                  </View>
                </View>

                {/* 6. FOOD INFO SECTION */}
                <View style={[s.dashCard, { borderColor: colors.secondary }]}>
                  <Text style={[s.sectionHeader, { color: colors.secondary }]}>🌾 6. Food Info</Text>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Feed Consumed:</Text>
                    <Text style={[s.dashVal, { color: colors.secondary }]}>{activeBatchDashboard.foodSection.totalFeedKg} kg</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Daily Feed / Chicken:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.foodSection.feedPerChickenGrams} g/bird ({activeBatchDashboard.foodSection.feedPerChickenPercentage}%)</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Water Provided:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.foodSection.totalWaterLiters} L</Text>
                  </View>
                </View>

                <TouchableOpacity style={[s.cancelBtn, { marginTop: 14 }]} onPress={() => setDashboardModalVisible(false)}>
                  <Text style={s.btnText}>Close Dashboard</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* CREATE BATCH MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>New Bird Flock</Text>
            <ScrollView>
              <Text style={common.label}>Batch Name</Text>
              <TextInput style={common.input} placeholder="e.g. Batch 2026-A" placeholderTextColor="#6B655C" value={name} onChangeText={setName} />

              <Text style={common.label}>Breed</Text>
              <TextInput style={common.input} placeholder="Cobb 500" placeholderTextColor="#6B655C" value={breed} onChangeText={setBreed} />

              <Text style={common.label}>Flock Type</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[s.typeBtn, type === 'layer' && s.typeBtnSelected]}
                  onPress={() => setType('layer')}
                >
                  <Text style={{ color: type === 'layer' ? colors.brand : colors.textMuted, fontWeight: '800' }}>🥚 Layer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeBtn, type === 'broiler' && s.typeBtnSelected]}
                  onPress={() => setType('broiler')}
                >
                  <Text style={{ color: type === 'broiler' ? colors.amber : colors.textMuted, fontWeight: '800' }}>🍗 Broiler</Text>
                </TouchableOpacity>
              </View>

              <Text style={common.label}>Initial Birds Count</Text>
              <TextInput style={common.input} keyboardType="numeric" value={initialCount} onChangeText={setInitialCount} />

              <Text style={common.label}>📅 Start Date (YYYY-MM-DD) *</Text>
              <TextInput style={common.input} placeholder="YYYY-MM-DD" placeholderTextColor="#6B655C" value={startDate} onChangeText={setStartDate} />

              <Text style={common.label}>Shed / House Name</Text>
              <TextInput style={common.input} value={shed} onChangeText={setShed} />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={handleCreate} disabled={submitting}>
                <Text style={s.btnText}>{submitting ? 'Creating...' : 'Create Batch'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  batchName: { color: colors.textMain, fontSize: 18, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  breedText: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 12 },
  progressContainer: { backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 10, marginBottom: 12 },
  progressText: { fontSize: 12, color: colors.textMain, fontWeight: '600', marginBottom: 4 },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.brand, borderRadius: 3 },
  dashBtn: { backgroundColor: colors.brand, padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  dashBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  dashCard: { backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  sectionHeader: { fontWeight: '800', fontSize: 14, marginBottom: 8 },
  dashRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dashLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  dashVal: { color: colors.textMain, fontSize: 13, fontWeight: '800' },
  workerBox: { backgroundColor: 'rgba(74, 124, 89, 0.08)', borderRadius: 10, padding: 10 },
  workerTitle: { color: colors.secondary, fontSize: 12, fontWeight: '800' },
  assignBtnText: { color: colors.secondary, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  workerChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  workerChip: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  workerChipText: { color: colors.textMain, fontSize: 11, fontWeight: '600' },
  allWorkersText: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  closeText: { color: colors.rose, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  typeBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surfaceElevated },
  typeBtnSelected: { borderColor: colors.brand, backgroundColor: 'rgba(199, 81, 31, 0.15)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(45, 42, 38, 0.65)', justifyContent: 'center', padding: 16 },
  modalContainer: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textMain, marginBottom: 4 },
  cancelBtn: { flex: 1, backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 8, alignItems: 'center' },
  submitBtn: { flex: 1, backgroundColor: colors.brand, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 }
});
