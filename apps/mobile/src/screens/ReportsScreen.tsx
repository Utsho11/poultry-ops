import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config';
import { colors, common } from '../styles';

export const ReportsScreen: React.FC = () => {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [batchData, setBatchData] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters: Daily, Last 7 Days, 15 Days, Last Month, All Time
  const [selectedDays, setSelectedDays] = useState<'1' | '7' | '15' | '30' | 'all'>('30');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');

  const [showDaysPicker, setShowDaysPicker] = useState(false);
  const [showBatchPicker, setShowBatchPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      // Calculate date filter
      let fromDateStr = '';
      if (selectedDays !== 'all') {
        const daysAgo = parseInt(selectedDays, 10);
        const d = new Date();
        d.setDate(d.getDate() - (daysAgo - 1));
        fromDateStr = d.toISOString().split('T')[0];
      }

      const queryParams: string[] = [];
      if (selectedBatchId !== 'all') queryParams.push(`batchId=${selectedBatchId}`);
      if (fromDateStr) queryParams.push(`from=${fromDateStr}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

      const [sum, batchRes, allBatches] = await Promise.all([
        apiFetch(`/reports/summary${queryString}`, {}, token),
        apiFetch('/reports/batch-breakdown', {}, token),
        apiFetch('/batches', {}, token),
      ]);
      setSummary(sum);
      setBatchData(batchRes);
      setBatches(allBatches);
    } catch (e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [selectedDays, selectedBatchId, token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <View style={[common.screen, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );

  const costByCategory = summary?.costByCategory || {};
  const totalCost = summary?.totalCost || 1;
  const selectedBatchObj = batches.find(b => b._id === selectedBatchId);

  const DAYS_OPTIONS = [
    { id: '1', label: 'Daily (Today)' },
    { id: '7', label: 'Last 7 Days' },
    { id: '15', label: 'Last 15 Days' },
    { id: '30', label: 'Last Month (30 Days)' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <View style={common.screen}>
      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
      >
        {/* Title */}
        <Text style={common.sectionTitle}>Reports & Analytics</Text>
        <Text style={common.sectionSubtitle}>Performance metrics and husbandry analytics.</Text>

        {/* Functional Filters Row (Daily, 7 Days, 15 Days, Last Month, All Time) */}
        <View style={s.filterRow}>
          {/* Days Filter Dropdown */}
          <TouchableOpacity style={s.dropdown} onPress={() => setShowDaysPicker(!showDaysPicker)}>
            <Text style={s.dropdownText} numberOfLines={1}>
              📅 {DAYS_OPTIONS.find(d => d.id === selectedDays)?.label} ▾
            </Text>
          </TouchableOpacity>

          {/* Batch Filter Dropdown */}
          <TouchableOpacity style={s.dropdown} onPress={() => setShowBatchPicker(!showBatchPicker)}>
            <Text style={s.dropdownText} numberOfLines={1}>
              🐔 {selectedBatchId === 'all' ? 'All Flocks' : selectedBatchObj?.name || 'Selected Batch'} ▾
            </Text>
          </TouchableOpacity>
        </View>

        {/* Days Selection Dropdown Menu */}
        {showDaysPicker && (
          <View style={s.pickerMenu}>
            {DAYS_OPTIONS.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[s.menuItem, selectedDays === item.id && s.menuItemActive]}
                onPress={() => { setSelectedDays(item.id as any); setShowDaysPicker(false); }}
              >
                <Text style={{ color: selectedDays === item.id ? colors.brand : colors.textMain, fontWeight: '700' }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Batch Selection Dropdown Menu */}
        {showBatchPicker && (
          <View style={s.pickerMenu}>
            <TouchableOpacity
              style={[s.menuItem, selectedBatchId === 'all' && s.menuItemActive]}
              onPress={() => { setSelectedBatchId('all'); setShowBatchPicker(false); }}
            >
              <Text style={{ color: selectedBatchId === 'all' ? colors.brand : colors.textMain, fontWeight: '700' }}>All Flocks</Text>
            </TouchableOpacity>
            {batches.map(b => (
              <TouchableOpacity
                key={b._id}
                style={[s.menuItem, selectedBatchId === b._id && s.menuItemActive]}
                onPress={() => { setSelectedBatchId(b._id); setShowBatchPicker(false); }}
              >
                <Text style={{ color: selectedBatchId === b._id ? colors.brand : colors.textMain, fontWeight: '700' }}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 2x2 Metric Grid */}
        <View style={s.metricGrid}>
          {/* Tile 1: Egg Production */}
          <View style={s.metricCard}>
            <View style={common.row}>
              <Text style={s.metricLabel}>EGG PROD.</Text>
              <Text style={{ fontSize: 16 }}>🥚</Text>
            </View>
            <Text style={s.metricValue}>{(summary?.totalEggs || 0).toLocaleString()}</Text>
            <Text style={[s.trendText, { color: colors.brand }]}>↗ +2.1%</Text>
          </View>

          {/* Tile 2: Feed Conversion */}
          <View style={s.metricCard}>
            <View style={common.row}>
              <Text style={s.metricLabel}>FEED CONV.</Text>
              <Text style={{ fontSize: 16 }}>⏳</Text>
            </View>
            <Text style={s.metricValue}>{summary?.feedConversionRatio || 0}</Text>
            <Text style={[s.trendText, { color: colors.rose }]}>↗ +0.05</Text>
          </View>

          {/* Tile 3: Mortality */}
          <View style={s.metricCard}>
            <View style={common.row}>
              <Text style={s.metricLabel}>MORTALITY</Text>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
            </View>
            <Text style={s.metricValue}>{summary?.mortalityRate || 0}%</Text>
            <Text style={[s.trendText, { color: colors.textMuted }]}>→ 0.0%</Text>
          </View>

          {/* Tile 4: Net Cost */}
          <View style={s.metricCard}>
            <View style={common.row}>
              <Text style={s.metricLabel}>COST/EGG</Text>
              <Text style={{ fontSize: 16 }}>💰</Text>
            </View>
            <Text style={s.metricValue}>৳{summary?.costPerEgg || 0}</Text>
            <Text style={[s.trendText, { color: colors.brand }]}>↘ -৳0.03</Text>
          </View>
        </View>

        {/* Chart Panel */}
        <View style={common.card}>
          <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 16 }}>Egg Production vs Feed</Text>
          <View style={{ height: 100, backgroundColor: colors.surfaceElevated, borderRadius: 12, marginTop: 12, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '700' }}>
              📈 Yield: {(summary?.totalEggs || 0).toLocaleString()} eggs | Feed: {summary?.totalFeedKg || 0} kg
            </Text>
          </View>
        </View>

        {/* Cost Breakdown Card */}
        <View style={[common.card, { marginTop: 14 }]}>
          <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 16 }}>Cost Breakdown</Text>
          <View style={{ gap: 8, marginTop: 12 }}>
            {Object.entries(costByCategory).map(([cat, amt]) => {
              const pct = Math.round(((amt as number) / totalCost) * 100) || 0;
              return (
                <View key={cat} style={common.row}>
                  <Text style={{ color: colors.textMuted, fontSize: 13, textTransform: 'capitalize' }}>{cat}</Text>
                  <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '700' }}>৳{(amt as number).toLocaleString()} ({pct}%)</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Batch Performance List */}
        <View style={[common.card, { marginTop: 14 }]}>
          <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Batch Performance</Text>
          <View style={{ gap: 12 }}>
            {batchData.slice(0, 4).map(b => (
              <View key={b.batchId} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <View style={common.row}>
                  <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 15 }}>#{b.batchName}</Text>
                  <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 14 }}>{b.totalFeedKg} kg</Text>
                </View>
                <View style={[common.row, { marginTop: 4 }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{b.breed} ({b.type})</Text>
                  <View style={[s.statusBadge, { backgroundColor: b.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)' }]}>
                    <Text style={{ color: b.status === 'active' ? colors.brand : colors.rose, fontSize: 10, fontWeight: '700' }}>
                      {b.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dropdown: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  dropdownText: { color: colors.textMain, fontWeight: '700', fontSize: 13 },
  pickerMenu: { backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 8, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  menuItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  menuItemActive: { backgroundColor: 'rgba(16,185,129,0.15)' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: { width: '48%', backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  metricLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  metricValue: { fontSize: 20, fontWeight: '800', color: colors.textMain, marginTop: 4 },
  trendText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
});
