import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, RefreshControl, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config';
import { colors, common, STATUS_BAR_PADDING } from '../styles';
import { formatEggCount } from '../utils/crates';

import { Egg, Skull, CircleDollarSign, Tag, TrendingUp, Wheat, ArrowLeft, Edit2, Calendar, Pencil, Trash2, X, HeartCrack, Droplets } from 'lucide-react-native';

export type MobileReportTab = 'egg' | 'mortality' | 'expense' | 'sell' | 'income' | 'food';

export const DailyReportScreen: React.FC<any> = ({ route, navigation }) => {
  const { token, user, activeFarm } = useAuth();
  const { batchId: routeBatchId, initialTab = 'egg' } = route.params || {};

  const [activeTab, setActiveTab] = useState<MobileReportTab>(initialTab as MobileReportTab);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Accordion state
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Edit Log State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [editEggCount, setEditEggCount] = useState('0');
  const [editBrokenEggCount, setEditBrokenEggCount] = useState('0');
  const [editDeadCount, setEditDeadCount] = useState('0');
  const [editFeedKg, setEditFeedKg] = useState('0');
  const [editWaterLiters, setEditWaterLiters] = useState('0');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Helper to find individual raw log entry for a date
  const getRawLogForDate = (date: string) => {
    return rawLogs.find(l => l.date === date && (!routeBatchId || String(l.batchId?._id || l.batchId) === String(routeBatchId)));
  };

  const openEditModal = (log: any) => {
    const raw = getRawLogForDate(log.date);
    const logToEdit = raw || log;
    setEditingLog(logToEdit);
    setEditEggCount(String(logToEdit.eggCount || 0));
    setEditBrokenEggCount(String(logToEdit.brokenEggCount || 0));
    setEditDeadCount(String(logToEdit.deadCount || 0));
    setEditFeedKg(String(logToEdit.feedGivenKg || 0));
    setEditWaterLiters(String(logToEdit.waterGivenLiters || 0));
    setEditModalOpen(true);
  };

  const handleUpdateLog = async () => {
    let targetId = editingLog?._id || editingLog?.logId;
    if (!targetId && editingLog?.date) {
      const raw = getRawLogForDate(editingLog.date);
      targetId = raw?._id;
    }

    if (!targetId) {
      Alert.alert('Error', 'Daily log ID not found for editing.');
      return;
    }

    setEditSubmitting(true);
    try {
      await apiFetch(`/logs/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify({
          eggCount: Number(editEggCount),
          brokenEggCount: Number(editBrokenEggCount),
          deadCount: Number(editDeadCount),
          feedGivenKg: Number(editFeedKg),
          waterGivenLiters: Number(editWaterLiters)
        })
      }, token);
      Alert.alert('Success', 'Daily log entry updated successfully');
      setEditModalOpen(false);
      loadLogs();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteLog = async (log: any) => {
    const raw = getRawLogForDate(log.date);
    const targetId = raw?._id || log._id || log.logId;

    if (!targetId) {
      Alert.alert('Not Found', 'Could not find individual log entry to delete. Please refresh.');
      return;
    }

    Alert.alert('Confirm Delete', 'Deleting this daily log will adjust flock mortality stats. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Log',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/logs/${targetId}`, { method: 'DELETE' }, token);
            Alert.alert('Success', 'Daily log entry deleted');
            loadLogs();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        }
      }
    ]);
  };

  const loadLogs = useCallback(async () => {
    try {
      const query = routeBatchId ? `?batchId=${routeBatchId}` : '';
      const [logs, raw] = await Promise.all([
        apiFetch(`/reports/daily${query}`, {}, token),
        apiFetch(`/logs${query}`, {}, token)
      ]);
      setDailyLogs(logs);
      setRawLogs(raw);
      if (logs.length > 0) {
        setExpandedDates({ [logs[0].date]: true });
      }
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [routeBatchId, token]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const onRefresh = () => { setRefreshing(true); loadLogs(); };

  const toggleAccordion = (dateStr: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

    const isLayerFarm = activeFarm?.animalType === 'layer';

    const ALL_TABS: { id: MobileReportTab; label: string; icon: any; color: string }[] = [
      { id: 'egg', label: 'Egg Yield', icon: Egg, color: colors.secondary },
      { id: 'mortality', label: 'Mortality', icon: Skull, color: colors.rose },
      { id: 'expense', label: 'Expenses', icon: CircleDollarSign, color: colors.amber },
      { id: 'sell', label: 'Sales', icon: Tag, color: colors.blue },
      { id: 'income', label: 'Income', icon: TrendingUp, color: colors.brand },
      { id: 'food', label: 'Food & Water', icon: Wheat, color: colors.secondary },
    ];

    const TABS = isLayerFarm ? ALL_TABS : ALL_TABS.filter(t => t.id !== 'egg');

    if (loading) return (
      <View style={[common.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.textMuted, marginTop: 10 }}>Loading Date-wise Daily Logs...</Text>
      </View>
    );

    return (
      <View style={common.screen}>
        {/* Header Bar */}
        <View style={s.topHeader}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={16} color={colors.brand} />
              <Text style={s.backBtnText}>Back</Text>
            </View>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Date-wise Daily Report</Text>
        </View>

        {/* Horizontal Tabs Scroll */}
        <View style={s.tabBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 6 }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const IconComp = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    s.tabChip,
                    isActive && { backgroundColor: tab.color, borderColor: tab.color }
                  ]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <IconComp size={14} color={isActive ? '#FFFFFF' : tab.color} />
                  <Text style={[s.tabChipText, isActive && { color: '#FFFFFF', fontWeight: '800' }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={common.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        >
          {dailyLogs.length > 0 ? (
            dailyLogs.map(log => {
              const isExpanded = !!expandedDates[log.date];
              return (
                <View key={log.date} style={[s.accordionCard, isExpanded && { borderColor: colors.secondary }]}>
                  {/* Accordion Header Row */}
                  <TouchableOpacity
                    style={[s.accordionHeader, isExpanded && { backgroundColor: colors.surfaceElevated }]}
                    onPress={() => toggleAccordion(log.date)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Calendar size={13} color={colors.brand} />
                        <Text style={s.dateText}>{log.date}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                        {log.dayNumber && (
                          <View style={{ backgroundColor: 'rgba(199, 81, 31, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ color: colors.brand, fontSize: 10, fontWeight: '800' }}>Day {log.dayNumber} ({log.formattedAge})</Text>
                          </View>
                        )}
                      </View>

                      {/* Subtext header per tab */}
                      <Text style={s.subText}>
                        {activeTab === 'egg' && `Yield: ${formatEggCount(log.eggCount)} (${log.eggCount} eggs)`}
                        {activeTab === 'mortality' && `Mortality: ${log.deadCount} dead birds`}
                        {activeTab === 'expense' && `Expenses: ৳${log.totalExpenses.toLocaleString()}`}
                        {activeTab === 'sell' && `Sales Revenue: ৳${log.totalIncome.toLocaleString()}`}
                        {activeTab === 'income' && `Net Profit: ৳${log.netProfit.toLocaleString()}`}
                        {activeTab === 'food' && `Feed: ${log.feedGivenKg} kg | Water: ${log.waterGivenLiters} L`}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {activeTab === 'egg' && (
                        <>
                          {log.rateTrend === 'up' && (
                            <View style={[s.rateBadge, { backgroundColor: 'rgba(74, 124, 89, 0.15)', borderColor: colors.secondary, borderWidth: 1 }]}>
                              <Text style={[s.rateBadgeText, { color: colors.secondary }]}>▲ {log.eggLayingRate}% (+{log.rateDiff}%)</Text>
                            </View>
                          )}
                          {log.rateTrend === 'down' && (
                            <View style={[s.rateBadge, { backgroundColor: 'rgba(178, 58, 47, 0.15)', borderColor: colors.rose, borderWidth: 1 }]}>
                              <Text style={[s.rateBadgeText, { color: colors.rose }]}>▼ {log.eggLayingRate}% (-{log.rateDiff}%)</Text>
                            </View>
                          )}
                          {log.rateTrend === 'stable' && (
                            <View style={s.rateBadge}>
                              <Text style={s.rateBadgeText}>— {log.eggLayingRate}%</Text>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={s.accordionBody}>
                      {activeTab === 'egg' && (
                        <>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.secondary }]}>TOTAL EGGS COLLECTED</Text>
                            <Text style={s.boxValue}>{formatEggCount(log.eggCount)}</Text>
                            <Text style={s.boxSub}>{log.eggCount} total eggs collected</Text>
                          </View>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.rose }]}>BROKEN / DAMAGED EGGS</Text>
                            <Text style={[s.boxValue, { color: colors.rose }]}>{log.brokenEggCount} eggs</Text>
                          </View>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.blue }]}>DAILY LAYING RATE %</Text>
                            <Text style={[s.boxValue, { color: colors.blue }]}>{log.eggLayingRate}% Hen-Day Yield</Text>
                          </View>
                        </>
                      )}

                      {activeTab === 'mortality' && (
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.rose }]}>DAILY MORTALITY / DEAD BIRDS</Text>
                          <Text style={[s.boxValue, { color: colors.rose }]}>{log.deadCount} dead birds</Text>
                          <Text style={s.boxSub}>Reported on {log.date}</Text>
                        </View>
                      )}

                      {activeTab === 'expense' && (
                        <>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.amber }]}>TOTAL DAILY EXPENSES</Text>
                            <Text style={[s.boxValue, { color: colors.amber }]}>৳{log.totalExpenses.toLocaleString()}</Text>
                          </View>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.blue }]}>COST BREAKDOWN</Text>
                            <Text style={s.boxSubText}>Feed Expense: ৳{log.feedExpense.toLocaleString()}</Text>
                            <Text style={s.boxSubText}>Medicine Expense: ৳{log.medicineExpense.toLocaleString()}</Text>
                            <Text style={s.boxSubText}>Labor Expense: ৳{log.laborExpense.toLocaleString()}</Text>
                            <Text style={s.boxSubText}>Utility Expense: ৳{log.utilityExpense.toLocaleString()}</Text>
                          </View>
                        </>
                      )}

                      {activeTab === 'sell' && (
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.blue }]}>DAILY SALES REVENUE</Text>
                          <Text style={[s.boxValue, { color: colors.blue }]}>৳{log.totalIncome.toLocaleString()}</Text>
                          <Text style={s.boxSub}>{isLayerFarm ? `Eggs Sold: ${formatEggCount(log.eggsSold)} | ` : ''}Chickens Sold: {log.chickensSold} birds</Text>
                        </View>
                      )}

                      {activeTab === 'income' && (
                        <>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.blue }]}>DAILY SALES INCOME</Text>
                            <Text style={[s.boxValue, { color: colors.blue }]}>৳{log.totalIncome.toLocaleString()}</Text>
                          </View>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.amber }]}>DAILY OPERATIONAL COST</Text>
                            <Text style={[s.boxValue, { color: colors.amber }]}>৳{log.totalExpenses.toLocaleString()}</Text>
                          </View>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: log.netProfit >= 0 ? colors.secondary : colors.rose }]}>DAILY NET PROFIT / LOSS</Text>
                            <Text style={[s.boxValue, { color: log.netProfit >= 0 ? colors.secondary : colors.rose }]}>৳{log.netProfit.toLocaleString()}</Text>
                          </View>
                        </>
                      )}

                      {activeTab === 'food' && (
                        <>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.secondary }]}>DAILY FEED GIVEN</Text>
                            <Text style={s.boxValue}>{log.feedGivenKg} kg ({ (log.feedGivenKg / 50).toFixed(1) } 50kg bags)</Text>
                          </View>
                          <View style={s.detailBox}>
                            <Text style={[s.boxTitle, { color: colors.blue }]}>DAILY WATER PROVIDED</Text>
                            <Text style={[s.boxValue, { color: colors.blue }]}>{log.waterGivenLiters} Liters</Text>
                          </View>
                        </>
                      )}

                    {/* ALWAYS VISIBLE Edit / Delete Actions */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                      <TouchableOpacity onPress={() => openEditModal(log)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(61, 107, 140, 0.12)', borderRadius: 6 }}>
                        <Pencil size={12} color={colors.blue} />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.blue }}>Edit Log</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteLog(log)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(220, 38, 38, 0.12)', borderRadius: 6 }}>
                        <Trash2 size={12} color="#DC2626" />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>Delete Log</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={common.card}>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 14 }}>
              No daily logs recorded for this section.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* EDIT LOG MODAL */}
      <Modal visible={editModalOpen} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Pencil size={16} color={colors.textMain} />
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textMain }}>Edit Daily Log — {editingLog?.date}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalOpen(false)}>
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Egg size={14} color={colors.textMain} />
                <Text style={common.label}>Egg Count</Text>
              </View>
              <TextInput style={common.input} keyboardType="numeric" value={editEggCount} onChangeText={setEditEggCount} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <HeartCrack size={14} color={colors.textMain} />
                <Text style={common.label}>Broken Egg Count</Text>
              </View>
              <TextInput style={common.input} keyboardType="numeric" value={editBrokenEggCount} onChangeText={setEditBrokenEggCount} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Skull size={14} color={colors.textMain} />
                <Text style={common.label}>Dead Birds Count</Text>
              </View>
              <TextInput style={common.input} keyboardType="numeric" value={editDeadCount} onChangeText={setEditDeadCount} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Wheat size={14} color={colors.textMain} />
                <Text style={common.label}>Feed Given (kg)</Text>
              </View>
              <TextInput style={common.input} keyboardType="numeric" value={editFeedKg} onChangeText={setEditFeedKg} />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Droplets size={14} color={colors.textMain} />
                <Text style={common.label}>Water Given (Liters)</Text>
              </View>
              <TextInput style={common.input} keyboardType="numeric" value={editWaterLiters} onChangeText={setEditWaterLiters} />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 20 }}>
                <TouchableOpacity style={[common.btnSecondary, { flex: 1 }]} onPress={() => setEditModalOpen(false)}>
                  <Text style={common.btnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[common.btn, { flex: 1 }]} onPress={handleUpdateLog} disabled={editSubmitting}>
                  {editSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={common.btnText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  topHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: STATUS_BAR_PADDING, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  backBtn: { backgroundColor: colors.surfaceElevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  backBtnText: { color: colors.brand, fontWeight: '800', fontSize: 12 },
  headerTitle: { fontSize: 15, fontWeight: '900', color: colors.textMain, marginLeft: 12 },
  tabBarContainer: { backgroundColor: colors.surface, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  tabChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  accordionCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  dateText: { fontSize: 14, fontWeight: '800', color: colors.textMain },
  subText: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  rateBadge: { backgroundColor: 'rgba(74, 124, 89, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  rateBadgeText: { color: colors.secondary, fontWeight: '800', fontSize: 10 },
  accordionBody: { padding: 14, borderTopWidth: 1, borderColor: colors.border, gap: 10, backgroundColor: colors.surfaceElevated },
  detailBox: { backgroundColor: colors.surface, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  boxTitle: { fontSize: 10, fontWeight: '800', marginBottom: 2 },
  boxValue: { fontSize: 14, fontWeight: '800', color: colors.textMain },
  boxSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  boxSubText: { fontSize: 11, fontWeight: '700', color: colors.textMain, marginTop: 2 }
});
