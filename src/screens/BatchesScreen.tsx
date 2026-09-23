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
import { CreateBatchModal } from '../components/CreateBatchModal';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);

  // Dedicated Batchwise Dashboard Modal state
  const [activeBatchDashboard, setActiveBatchDashboard] = useState<any | null>(null);
  const [dashboardModalVisible, setDashboardModalVisible] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const load = useCallback(async () => {
    try {
      const batchData = await apiFetch('/batches', {}, token, activeFarm?._id);
      setBatches(batchData);
    } catch (e: any) {
      console.warn('Failed to load batches:', e?.message || e);
      showAlert('Connection Error', e?.message || 'Failed to load flocks. Please check your internet connection.');
    }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, activeFarm?._id]);

  useEffect(() => {
    let mounted = true;
    load();
    return () => { mounted = false; };
  }, [load]);

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
  const [securityAction, setSecurityAction] = useState<'delete' | 'close' | null>(null);
  const [batchTarget, setBatchTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securitySubmitting, setSecuritySubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleOpenDeleteSecurity = (id: string, batchName: string) => {
    if (user?.role !== 'owner') {
      showAlert('Unauthorized', 'Only farm Owners are authorized to delete flocks.');
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
    setBatchTarget(null);
  };

  const handleConfirmSecurityAction = async () => {
    if (!confirmPassword) {
      showAlert('Security Check', 'Please enter your account password');
      return;
    }

    setSecuritySubmitting(true);
    try {
      if (securityAction === 'delete' && batchTarget) {
        await apiFetch(`/batches/${batchTarget.id}`, {
          method: 'DELETE',
          body: JSON.stringify({ password: confirmPassword })
        }, token, activeFarm?._id);
        setSecurityModalVisible(false);
        showAlert('Deleted', `Flock '${batchTarget.name}' deleted successfully.`);
        setBatchTarget(null);
        load();
      } else if (securityAction === 'close' && batchTarget) {
        await apiFetch(`/batches/${batchTarget.id}/close`, {
          method: 'POST',
          body: JSON.stringify({ password: confirmPassword })
        }, token, activeFarm?._id);
        setSecurityModalVisible(false);
        showAlert('Closed', `Flock '${batchTarget.name}' has been closed.`);
        setBatchTarget(null);
        load();
      }
    } catch (err: any) {
      showAlert('Action Failed', err.message || 'Operation failed. Please check your credentials and try again.');
    } finally {
      setSecuritySubmitting(false);
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
            <TouchableOpacity style={common.btn} onPress={() => setModalVisible(true)}>
              <Plus size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={common.btnText}>New Batch</Text>
            </TouchableOpacity>
          )}
        </View>

        {batches.map(batch => {
          const isClosed = batch.status === 'closed';
          const mortalityCount = batch.initialCount - batch.currentCount;
          const mortalityPct = ((mortalityCount / batch.initialCount) * 100).toFixed(1);

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



              {canManage && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                  {!isClosed && (
                    <TouchableOpacity onPress={() => handleOpenCloseSecurity(batch._id, batch.name)}>
                      <Text style={s.closeText}>Discontinue Batch</Text>
                    </TouchableOpacity>
                  )}
                  {user?.role === 'owner' && (
                    <TouchableOpacity
                      style={{ backgroundColor: 'rgba(244,63,94,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={() => handleOpenDeleteSecurity(batch._id, batch.name)}
                    >
                      <Trash2 size={13} color={colors.rose} />
                      <Text style={{ color: colors.rose, fontSize: 12, fontWeight: '800' }}>Delete Batch</Text>
                    </TouchableOpacity>
                  )}
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
                    <Text style={s.modalTitle}>{activeBatchDashboard.batch?.name || 'Flock Details'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Breed: {activeBatchDashboard.batch?.breed || 'Standard'} • Shed: {activeBatchDashboard.batch?.shed || 'Main Shed'}
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
                    <Text style={[s.dashVal, { color: colors.secondary }]}>{formatEggCount(activeBatchDashboard.eggSection?.totalEggs ?? 0)}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Broken Eggs:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>{activeBatchDashboard.eggSection?.totalBrokenEggs ?? 0} eggs</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Laying Rate %:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.eggSection?.eggLayingRate ?? 0}%</Text>
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
                    <Text style={[s.dashVal, { color: colors.rose }]}>{activeBatchDashboard.mortalitySection?.totalDead ?? 0} birds</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Mortality Rate %:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>{activeBatchDashboard.mortalitySection?.mortalityRate ?? 0}%</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Active / Initial Birds:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.mortalitySection?.currentCount ?? 0} / {activeBatchDashboard.mortalitySection?.initialCount ?? 0}</Text>
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
                    <Text style={[s.dashVal, { color: colors.amber }]}>৳{(activeBatchDashboard.expenseSection?.totalExpenses ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Cost / Bird:</Text>
                    <Text style={s.dashVal}>৳{activeBatchDashboard.expenseSection?.costPerBird ?? 0}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Cost / Egg:</Text>
                    <Text style={s.dashVal}>৳{activeBatchDashboard.expenseSection?.costPerEgg ?? 0}</Text>
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
                    <Text style={[s.dashVal, { color: colors.blue }]}>{formatEggCount(activeBatchDashboard.sellSection?.totalEggsSold ?? 0)}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Chickens Sold:</Text>
                    <Text style={s.dashVal}>{(activeBatchDashboard.sellSection?.totalChickensSold ?? 0).toLocaleString()} birds</Text>
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
                    <Text style={[s.dashVal, { color: colors.blue }]}>৳{(activeBatchDashboard.incomeSection?.totalIncome ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Net Batch Profit:</Text>
                    <Text style={[s.dashVal, { color: (activeBatchDashboard.incomeSection?.netProfit ?? 0) >= 0 ? colors.secondary : colors.rose }]}>
                      ৳{(activeBatchDashboard.incomeSection?.netProfit ?? 0).toLocaleString()} ({activeBatchDashboard.incomeSection?.profitMargin ?? 0}%)
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
                    <Text style={[s.dashVal, { color: colors.secondary }]}>{activeBatchDashboard.foodSection?.totalFeedKg ?? 0} kg</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Daily Feed / Chicken:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.foodSection?.feedPerChickenGrams ?? 0} g/bird ({activeBatchDashboard.foodSection?.feedPerChickenPercentage ?? 0}%)</Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Water Provided:</Text>
                    <Text style={s.dashVal}>{activeBatchDashboard.foodSection?.totalWaterLiters ?? 0} L</Text>
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

      {/* REUSABLE CREATE FLOCK / BATCH MODAL */}
      <CreateBatchModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => load()}
      />

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
                {securityAction === 'delete' ? <Trash2 size={14} color={colors.rose} /> : <Lock size={14} color={colors.rose} />}
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.rose }}>
                  {securityAction === 'delete' ? `Delete Flock '${batchTarget?.name}'` : `Close Flock '${batchTarget?.name}'`}
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
