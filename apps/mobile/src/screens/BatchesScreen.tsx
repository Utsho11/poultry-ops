import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch, showAlert } from '../config';
import { colors, common } from '../styles';
import { DatePickerInput } from '../components/DatePickerInput';
import { formatEggCount } from '../utils/crates';
import { Bird, Egg, Home, Calendar, Users, BarChart3, Lock, Plus, Trash2, Check, X, ShieldAlert, CircleDollarSign, Skull, TrendingUp, Feather, Droplet, Tag, User, Wheat, HardHat, Eye, EyeOff, KeyRound, Zap } from 'lucide-react-native';

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
  const { token, user, activeFarm } = useAuth();
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

  const load = useCallback(async () => {
    try {
      const [batchData, usersData] = await Promise.all([
        apiFetch('/batches', {}, token, activeFarm?._id),
        canManage ? apiFetch('/team', {}, token, activeFarm?._id) : Promise.resolve([])
      ]);
      setBatches(batchData);
      if (Array.isArray(usersData)) {
        setTeamWorkers(usersData.filter((u: any) => u.role === 'worker' || u.role === 'manager'));
      }
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [canManage, token, activeFarm?._id]);

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

  // bKash-style Password Security Verification Modal state
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [securityAction, setSecurityAction] = useState<'create' | 'delete' | 'close' | null>(null);
  const [batchTarget, setBatchTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securitySubmitting, setSecuritySubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleOpenCreateSecurity = () => {
    if (!name) { showAlert('Error', 'Batch name is required'); return; }
    if (!startDate) { showAlert('Error', 'Start date is required (YYYY-MM-DD)'); return; }
    setModalVisible(false);
    setSecurityAction('create');
    setConfirmPassword('');
    setTimeout(() => setSecurityModalVisible(true), 300);
  };

  const handleOpenDeleteSecurity = (id: string, batchName: string) => {
    if (!canManage) {
      showAlert('Unauthorized', 'Only farm Owners and Managers are authorized to delete flocks.');
      return;
    }
    setBatchTarget({ id, name: batchName });
    setSecurityAction('delete');
    setConfirmPassword('');
    setSecurityModalVisible(true);
  };

  const handleOpenCloseSecurity = (id: string, batchName: string) => {
    if (!canManage) {
      showAlert('Unauthorized', 'Only farm Owners and Managers are authorized to close flocks.');
      return;
    }
    setBatchTarget({ id, name: batchName });
    setSecurityAction('close');
    setConfirmPassword('');
    setSecurityModalVisible(true);
  };

  const handleCancelSecurity = () => {
    setSecurityModalVisible(false);
    if (securityAction === 'create') {
      setTimeout(() => setModalVisible(true), 300);
    }
  };

  const handleConfirmSecurityAction = async () => {
    if (!confirmPassword) {
      showAlert('Security Check', 'Please enter your account password');
      return;
    }

    setSecuritySubmitting(true);
    try {
      if (securityAction === 'create') {
        await apiFetch('/batches', {
          method: 'POST',
          body: JSON.stringify({
            name, breed, type: activeFarm?.animalType === 'broiler' ? 'broiler' : 'layer', startDate,
            initialCount: Number(initialCount),
            assignedWorkerIds: selectedWorkerIds,
            password: confirmPassword
          })
        }, token);
        setSecurityModalVisible(false);
        setName('');
        setSelectedWorkerIds([]);
        showAlert('Success', `Flock created successfully!`);
        load();
      } else if (securityAction === 'delete' && batchTarget) {
        await apiFetch(`/batches/${batchTarget.id}`, {
          method: 'DELETE',
          body: JSON.stringify({ password: confirmPassword })
        }, token);
        setSecurityModalVisible(false);
        showAlert('Deleted', `Flock '${batchTarget.name}' deleted successfully.`);
        setBatchTarget(null);
        load();
      } else if (securityAction === 'close' && batchTarget) {
        await apiFetch(`/batches/${batchTarget.id}/close`, {
          method: 'POST',
          body: JSON.stringify({ password: confirmPassword })
        }, token);
        setSecurityModalVisible(false);
        showAlert('Closed', `Flock '${batchTarget.name}' has been closed.`);
        setBatchTarget(null);
        load();
      }
    } catch (err: any) {
      showAlert('Verification Failed', err.message || 'Incorrect password! Security check failed.');
    } finally {
      setSecuritySubmitting(false);
    }
  };

  const handleOpenAssignModal = (batch: any) => {
    setAssignModalBatch(batch);
    const existingWorkerIds = (batch.assignedWorkerIds || []).map((w: any) => String(w._id || w));
    setSelectedWorkerIds(existingWorkerIds);
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const handleSaveAssignments = async () => {
    if (!assignModalBatch) return;
    try {
      await apiFetch(`/batches/${assignModalBatch._id}`, {
        method: 'PUT',
        body: JSON.stringify({ assignedWorkerIds: selectedWorkerIds })
      }, token);
      showAlert('Success', 'Worker assignments updated');
      setAssignModalBatch(null);
      setSelectedWorkerIds([]);
      load();
    } catch (err: any) {
      showAlert('Error', err.message);
    }
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
            <Text style={common.sectionTitle}>Flocks & Batches</Text>
            <Text style={common.sectionSubtitle}>{batches.length} active flocks recorded</Text>
          </View>

          {canManage && (
            <TouchableOpacity style={common.btn} onPress={() => { setSelectedWorkerIds([]); setModalVisible(true); }}>
              <Plus size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={common.btnText}>New Batch</Text>
            </TouchableOpacity>
          )}
        </View>

        {batches.map(batch => {
          const isClosed = batch.status === 'closed';
          const mortalityCount = batch.initialCount - batch.currentCount;
          const mortalityPct = ((mortalityCount / batch.initialCount) * 100).toFixed(1);
          const batchWorkerIds = (batch.assignedWorkerIds || []).map((id: any) => String(id?._id || id));
          const assignedWorkers = teamWorkers.filter(w => batchWorkerIds.includes(String(w._id)));

          return (
            <View key={batch._id} style={[common.card, isClosed && { opacity: 0.6 }]}>
              {/* Touchable Main Card Content -> Navigates to Batch Dashboard */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate('BatchDashboard', { batchId: batch._id })}
              >
                <View style={common.row}>
                  <Text style={s.batchName}>{batch.name}</Text>
                  <View style={[s.badge, { backgroundColor: isClosed ? 'rgba(178, 58, 47, 0.15)' : 'rgba(74, 124, 89, 0.15)' }]}>
                    <Text style={{ color: isClosed ? colors.rose : colors.secondary, fontWeight: '800', fontSize: 10 }}>
                      {batch.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 6, flexWrap: 'wrap' }}>
                  <Bird size={14} color={colors.brand} />
                  <Text style={s.breedText}>{batch.breed}</Text>
                  <Text style={{ color: colors.textMuted }}>•</Text>
                  <Calendar size={14} color={colors.textMuted} />
                  <Text style={s.breedText}>Age: {getBatchAgeText(batch.startDate)}</Text>
                </View>

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
              </TouchableOpacity>

              {/* Assigned Workers Management */}
              <View style={s.workerBox}>
                <View style={common.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Users size={14} color={colors.textMain} />
                    <Text style={s.workerTitle}>Assigned Workers ({assignedWorkers.length})</Text>
                  </View>
                  {canManage && (
                    <TouchableOpacity onPress={() => handleOpenAssignModal(batch)}>
                      <Text style={s.assignBtnText}>+ Add / Assign Worker</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {assignedWorkers.length > 0 ? (
                  <View style={s.workerChipRow}>
                    {assignedWorkers.map(w => (
                      <View key={w._id} style={s.workerChip}>
                        <User size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={s.workerChipText}>{w.name}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={s.allWorkersText}>
                    {canManage ? 'All workers can access (Click "+ Add / Assign Worker" to restrict)' : 'Assigned to All Workers'}
                  </Text>
                )}
              </View>

              {canManage && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                  {!isClosed && (
                    <TouchableOpacity onPress={() => handleOpenCloseSecurity(batch._id, batch.name)}>
                      <Text style={s.closeText}>Discontinue Batch</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={{ backgroundColor: 'rgba(244,63,94,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={() => handleOpenDeleteSecurity(batch._id, batch.name)}
                  >
                    <Trash2 size={13} color={colors.rose} />
                    <Text style={{ color: colors.rose, fontSize: 12, fontWeight: '800' }}>Delete Batch</Text>
                  </TouchableOpacity>
                </View>
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
                    <X size={18} color={colors.brand} />
                  </TouchableOpacity>
                </View>

                {/* 1. EGG SECTION */}
                <View style={[s.dashCard, { borderColor: colors.secondary }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Egg size={14} color={colors.secondary} />
                    <Text style={[s.sectionHeader, { color: colors.secondary }]}>1. Egg Yield</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Skull size={14} color={colors.rose} />
                    <Text style={[s.sectionHeader, { color: colors.rose }]}>2. Mortality Rate</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <CircleDollarSign size={14} color={colors.amber} />
                    <Text style={[s.sectionHeader, { color: colors.amber }]}>3. Expenses</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Tag size={14} color={colors.blue} />
                    <Text style={[s.sectionHeader, { color: colors.blue, marginBottom: 0 }]}>4. Sales Volume</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <TrendingUp size={14} color={colors.brand} />
                    <Text style={[s.sectionHeader, { color: colors.brand, marginBottom: 0 }]}>5. Income & Net Profit</Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Wheat size={14} color={colors.secondary} />
                    <Text style={[s.sectionHeader, { color: colors.secondary, marginBottom: 0 }]}>6. Food Info</Text>
                  </View>
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
              <TextInput style={common.input} placeholder="e.g. Batch 2026-A" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

              <Text style={common.label}>Breed</Text>
              <TextInput style={common.input} placeholder="Cobb 500" placeholderTextColor={colors.textMuted} value={breed} onChangeText={setBreed} />

              <Text style={common.label}>Firm Animal Type</Text>
              <View style={{ backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {activeFarm?.animalType === 'layer' ? <Egg size={16} color={colors.brand} /> : <Bird size={16} color={colors.brand} />}
                  <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 13 }}>
                    {activeFarm?.animalType === 'layer' ? 'LAYER FARM' : 'BROILER / POULTRY FARM'}
                  </Text>
                </View>
              </View>

              <Text style={common.label}>Initial Birds Count</Text>
              <TextInput style={common.input} keyboardType="numeric" value={initialCount} onChangeText={setInitialCount} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Calendar size={14} color={colors.textMuted} />
                <Text style={[common.label, { marginBottom: 0 }]}>Start Date *</Text>
              </View>
              <DatePickerInput
                value={startDate}
                onChange={setStartDate}
                style={{ marginBottom: 14 }}
              />

              <Text style={[common.label, { marginTop: 8 }]}>Assign Workers (Optional)</Text>
              <View style={{ marginBottom: 14 }}>
                {teamWorkers.length > 0 ? (
                  teamWorkers.map(w => {
                    const isSelected = selectedWorkerIds.includes(w._id);
                    return (
                      <TouchableOpacity
                        key={w._id}
                        onPress={() => toggleWorkerSelection(w._id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.secondary : colors.border,
                          backgroundColor: isSelected ? 'rgba(74, 124, 89, 0.15)' : colors.surfaceElevated,
                          marginBottom: 6
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <HardHat size={14} color={colors.textMain} />
                          <Text style={{ color: colors.textMain, fontWeight: '600', fontSize: 13 }}>{w.name}</Text>
                        </View>
                        {isSelected && <Text style={{ color: colors.secondary, fontWeight: '800' }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>All workers can access</Text>
                )}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={[s.btnText,{color:colors.rose}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={handleOpenCreateSecurity}>
                <Text style={s.btnText}>Create Batch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 👷 WORKER ASSIGNMENT MODAL FOR MOBILE */}
      <Modal visible={!!assignModalBatch} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContainer, { maxHeight: '80%' }]}>
            <Text style={s.modalTitle}>Assign Workers</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginBottom: 14 }}>
              Select workers allowed to view and log data for flock '{assignModalBatch?.name}'
            </Text>

            <ScrollView style={{ maxHeight: 250, marginBottom: 16 }}>
              {teamWorkers.length > 0 ? (
                teamWorkers.map(w => {
                  const isAssigned = selectedWorkerIds.includes(w._id);
                  return (
                    <TouchableOpacity
                      key={w._id}
                      onPress={() => toggleWorkerSelection(w._id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isAssigned ? colors.secondary : colors.border,
                        backgroundColor: isAssigned ? 'rgba(74, 124, 89, 0.15)' : colors.surfaceElevated,
                        marginBottom: 8
                      }}
                    >
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <HardHat size={14} color={colors.textMain} />
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textMain }}>{w.name}</Text>
                        </View>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>{w.email || w.phone || 'Worker'}</Text>
                      </View>
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        backgroundColor: isAssigned ? colors.secondary : 'transparent',
                        borderWidth: 1,
                        borderColor: colors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isAssigned && <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>
                  No workers found. Add workers in Team Management screen first.
                </Text>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setAssignModalBatch(null)}>
                <Text style={[s.btnText, { color: colors.textMain }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.secondary }]} onPress={handleSaveAssignments}>
                <Text style={s.btnText}>Save Assignments</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔐 BKASH-STYLE PASSWORD SECURITY VERIFICATION MODAL FOR MOBILE */}
      <Modal visible={securityModalVisible} animationType="fade" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContainer, { borderLeftWidth: 6, borderLeftColor: '#E2136E', padding: 22 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
              <View style={{ backgroundColor: '#E2136E', padding: 8, borderRadius: 10 }}>
                <Lock size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#E2136E', textTransform: 'uppercase' }}>bKash-Style Security Check</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textMain }}>Password Verification</Text>
              </View>
            </View>

            <View style={{ backgroundColor: colors.surfaceElevated, padding: 12, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>ACCOUNT USER</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <User size={14} color={colors.textMain} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textMain }}>{user?.name} ({user?.email})</Text>
              </View>

              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '700' }}>TARGET ACTION</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {securityAction === 'create' ? <Plus size={14} color={colors.brand} /> : securityAction === 'delete' ? <Trash2 size={14} color={colors.rose} /> : <Lock size={14} color={colors.rose} />}
                <Text style={{ fontSize: 13, fontWeight: '800', color: securityAction === 'delete' || securityAction === 'close' ? colors.rose : colors.brand }}>
                  {securityAction === 'create' ? `Create Flock '${name}'` : securityAction === 'delete' ? `Delete Flock '${batchTarget?.name}'` : `Close Flock '${batchTarget?.name}'`}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <KeyRound size={14} color={colors.textMain} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textMain }}>Enter Account Password *</Text>
            </View>
            <View style={{ position: 'relative', marginBottom: 16 }}>
              <TextInput
                style={[common.input, { borderColor: '#E2136E', borderWidth: 2, fontSize: 15, paddingRight: 40 }]}
                secureTextEntry={!showPassword}
                placeholder="Enter login password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: 12 }}
              >
                {showPassword ? <Eye size={16} color={colors.textMuted} /> : <EyeOff size={16} color={colors.textMuted} />}
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={handleCancelSecurity}>
                <Text style={[s.btnText, { color: colors.textMain }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: securityAction === 'delete' ? colors.rose : '#E2136E', flexDirection: 'row', justifyContent: 'center', gap: 6 }]}
                onPress={handleConfirmSecurityAction}
                disabled={securitySubmitting}
              >
                {!securitySubmitting && <Zap size={16} color="#fff" />}
                <Text style={s.btnText}>{securitySubmitting ? 'Verifying...' : 'Confirm & Proceed'}</Text>
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
