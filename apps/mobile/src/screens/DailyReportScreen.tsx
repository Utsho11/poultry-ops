import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config';
import { colors, common } from '../styles';
import { formatEggCount } from '../utils/crates';

export const DailyReportScreen: React.FC<any> = ({ route, navigation }) => {
  const { token } = useAuth();
  const { batchId } = route.params || {};

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

  if (loading) return (
    <View style={[common.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={{ color: colors.textMuted, marginTop: 10 }}>Loading Date-wise Daily Logs...</Text>
    </View>
  );

  return (
    <View style={common.screen}>
      {/* Header */}
      <View style={s.topHeader}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Date-wise Daily Report</Text>
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
                {/* Header Row */}
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
                    <Text style={s.subText}>
                      Yield: <Text style={{ color: colors.secondary, fontWeight: '800' }}>{formatEggCount(log.eggCount)}</Text> ({log.eggCount} eggs)
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
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
                    <Text style={{ color: colors.textMuted, fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <View style={s.accordionBody}>
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

                    <View style={s.detailBox}>
                      <Text style={[s.boxTitle, { color: colors.amber }]}>🌾 FEED & WATER CONSUMPTION</Text>
                      <Text style={s.boxSubText}>Feed: {log.feedGivenKg} kg | Water: {log.waterGivenLiters} L</Text>
                      <Text style={s.boxSubText}>Mortality: {log.deadCount > 0 ? `${log.deadCount} dead` : '0 dead'}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={common.card}>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginVertical: 14 }}>
              No daily logs recorded yet.
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
  headerTitle: { fontSize: 16, fontWeight: '900', color: colors.textMain, marginLeft: 12 },
  accordionCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 10, overflow: 'hidden' },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  dateText: { fontSize: 15, fontWeight: '800', color: colors.textMain },
  subText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rateBadge: { backgroundColor: 'rgba(74, 124, 89, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  rateBadgeText: { color: colors.secondary, fontWeight: '800', fontSize: 10 },
  accordionBody: { padding: 14, borderTopWidth: 1, borderColor: colors.border, gap: 10, backgroundColor: colors.surfaceElevated },
  detailBox: { backgroundColor: colors.surface, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  boxTitle: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  boxValue: { fontSize: 15, fontWeight: '800', color: colors.textMain },
  boxSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  boxSubText: { fontSize: 12, fontWeight: '700', color: colors.textMain, marginTop: 2 }
});
