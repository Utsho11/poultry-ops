import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config';
import { colors, common } from '../styles';
import { formatEggCount } from '../utils/crates';

export type MobileReportTab = 'egg' | 'mortality' | 'expense' | 'sell' | 'income' | 'food';

export const DailyReportScreen: React.FC<any> = ({ route, navigation }) => {
  const { token } = useAuth();
  const { batchId, initialTab = 'egg' } = route.params || {};

  const [activeTab, setActiveTab] = useState<MobileReportTab>(initialTab as MobileReportTab);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Accordion state
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const loadLogs = useCallback(async () => {
    try {
      const query = batchId ? `?batchId=${batchId}` : '';
      const logs = await apiFetch(`/reports/daily${query}`, {}, token);
      setDailyLogs(logs);
      if (logs.length > 0) {
        setExpandedDates({ [logs[0].date]: true });
      }
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [batchId, token]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const onRefresh = () => { setRefreshing(true); loadLogs(); };

  const toggleAccordion = (dateStr: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const TABS: { id: MobileReportTab; label: string; icon: string; color: string }[] = [
    { id: 'egg', label: 'Egg Yield', icon: '🥚', color: colors.secondary },
    { id: 'mortality', label: 'Mortality', icon: '💀', color: colors.rose },
    { id: 'expense', label: 'Expenses', icon: '💸', color: colors.amber },
    { id: 'sell', label: 'Sales', icon: '🏷️', color: colors.blue },
    { id: 'income', label: 'Income', icon: '📈', color: colors.brand },
    { id: 'food', label: 'Food & Water', icon: '🌾', color: colors.secondary },
  ];

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
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Date-wise Daily Report</Text>
      </View>

      {/* Horizontal Tabs Scroll */}
      <View style={s.tabBarContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 6 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  s.tabChip,
                  isActive && { backgroundColor: tab.color, borderColor: tab.color }
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={{ fontSize: 13 }}>{tab.icon}</Text>
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
                    <Text style={s.dateText}>📅 {log.date}</Text>
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
                            <Text style={[s.rateBadgeText, { color: colors.rose }]}>▼ {log.eggLayingRate}% ({log.rateDiff}%)</Text>
                          </View>
                        )}
                        {log.rateTrend === 'same' && (
                          <View style={s.rateBadge}>
                            <Text style={s.rateBadgeText}>{log.eggLayingRate}% Laying</Text>
                          </View>
                        )}
                      </>
                    )}

                    {activeTab === 'mortality' && (
                      <View style={[s.rateBadge, { backgroundColor: log.deadCount > 0 ? 'rgba(178, 58, 47, 0.15)' : 'rgba(74, 124, 89, 0.15)' }]}>
                        <Text style={[s.rateBadgeText, { color: log.deadCount > 0 ? colors.rose : colors.secondary }]}>
                          {log.deadCount} Dead
                        </Text>
                      </View>
                    )}

                    {activeTab === 'expense' && (
                      <View style={[s.rateBadge, { backgroundColor: 'rgba(217, 164, 65, 0.15)' }]}>
                        <Text style={[s.rateBadgeText, { color: colors.amber }]}>৳{log.totalExpenses}</Text>
                      </View>
                    )}

                    {activeTab === 'sell' && (
                      <View style={[s.rateBadge, { backgroundColor: 'rgba(61, 107, 140, 0.15)' }]}>
                        <Text style={[s.rateBadgeText, { color: colors.blue }]}>৳{log.totalIncome}</Text>
                      </View>
                    )}

                    {activeTab === 'income' && (
                      <View style={[s.rateBadge, { backgroundColor: log.netProfit >= 0 ? 'rgba(74, 124, 89, 0.15)' : 'rgba(178, 58, 47, 0.15)' }]}>
                        <Text style={[s.rateBadgeText, { color: log.netProfit >= 0 ? colors.secondary : colors.rose }]}>
                          ৳{log.netProfit}
                        </Text>
                      </View>
                    )}

                    {activeTab === 'food' && (
                      <View style={s.rateBadge}>
                        <Text style={s.rateBadgeText}>{log.feedGivenKg} kg Feed</Text>
                      </View>
                    )}

                    <Text style={{ color: colors.textMuted, fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <View style={s.accordionBody}>
                    {activeTab === 'egg' && (
                      <>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.secondary }]}>🥚 COLLECTED EGGS</Text>
                          <Text style={s.boxValue}>{formatEggCount(log.eggCount)}</Text>
                          <Text style={s.boxSub}>{log.eggCount} total eggs collected</Text>
                        </View>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.rose }]}>💔 BROKEN / DAMAGED EGGS</Text>
                          <Text style={[s.boxValue, { color: colors.rose }]}>{log.brokenEggCount} eggs</Text>
                        </View>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.blue }]}>📈 DAILY LAYING RATE %</Text>
                          <Text style={[s.boxValue, { color: colors.blue }]}>{log.eggLayingRate}% Hen-Day Yield</Text>
                        </View>
                      </>
                    )}

                    {activeTab === 'mortality' && (
                      <View style={s.detailBox}>
                        <Text style={[s.boxTitle, { color: colors.rose }]}>💀 DAILY MORTALITY / DEAD BIRDS</Text>
                        <Text style={[s.boxValue, { color: colors.rose }]}>{log.deadCount} dead birds</Text>
                        <Text style={s.boxSub}>Reported on {log.date}</Text>
                      </View>
                    )}

                    {activeTab === 'expense' && (
                      <>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.amber }]}>💸 TOTAL DAILY EXPENSES</Text>
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
                        <Text style={[s.boxTitle, { color: colors.blue }]}>🏷️ DAILY SALES REVENUE</Text>
                        <Text style={[s.boxValue, { color: colors.blue }]}>৳{log.totalIncome.toLocaleString()}</Text>
                        <Text style={s.boxSub}>Eggs Sold: {formatEggCount(log.eggsSold)} | Chickens Sold: {log.chickensSold} birds</Text>
                      </View>
                    )}

                    {activeTab === 'income' && (
                      <>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.blue }]}>📈 DAILY SALES INCOME</Text>
                          <Text style={[s.boxValue, { color: colors.blue }]}>৳{log.totalIncome.toLocaleString()}</Text>
                        </View>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.amber }]}>💸 DAILY OPERATIONAL COST</Text>
                          <Text style={[s.boxValue, { color: colors.amber }]}>৳{log.totalExpenses.toLocaleString()}</Text>
                        </View>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: log.netProfit >= 0 ? colors.secondary : colors.rose }]}>⚖️ DAILY NET PROFIT / LOSS</Text>
                          <Text style={[s.boxValue, { color: log.netProfit >= 0 ? colors.secondary : colors.rose }]}>৳{log.netProfit.toLocaleString()}</Text>
                        </View>
                      </>
                    )}

                    {activeTab === 'food' && (
                      <>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.secondary }]}>🌾 DAILY FEED GIVEN</Text>
                          <Text style={s.boxValue}>{log.feedGivenKg} kg ({ (log.feedGivenKg / 50).toFixed(1) } 50kg bags)</Text>
                        </View>
                        <View style={s.detailBox}>
                          <Text style={[s.boxTitle, { color: colors.blue }]}>💧 DAILY WATER PROVIDED</Text>
                          <Text style={[s.boxValue, { color: colors.blue }]}>{log.waterGivenLiters} Liters</Text>
                        </View>
                      </>
                    )}
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
    </View>
  );
};

const s = StyleSheet.create({
  topHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
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
