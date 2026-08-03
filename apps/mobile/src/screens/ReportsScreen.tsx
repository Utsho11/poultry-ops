import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config';
import { colors, common } from '../styles';
import { formatEggCount } from '../utils/crates';

export const ReportsScreen: React.FC = () => {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [batchData, setBatchData] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
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

      const [sum, batchRes, salesRes, allBatches] = await Promise.all([
        apiFetch(`/reports/summary${queryString}`, {}, token),
        apiFetch('/reports/batch-breakdown', {}, token),
        apiFetch('/sales', {}, token),
        apiFetch('/batches', {}, token),
      ]);
      setSummary(sum);
      setBatchData(batchRes);
      setSalesData(salesRes);
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
  const totalCost = summary?.totalCost || 0;
  const totalIncome = summary?.totalIncome || 0;
  const netProfit = totalIncome - totalCost;
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
        <Text style={common.sectionTitle}>Reports & Sales Revenue</Text>
        <Text style={common.sectionSubtitle}>Egg stock, sales income & profit performance.</Text>

        {/* Functional Filters Row */}
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

        {/* Sales & Revenue Highlights */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <View style={[s.highlightCard, { borderColor: colors.blue }]}>
            <Text style={s.metricLabel}>SALES INCOME</Text>
            <Text style={[s.metricValue, { color: colors.blue }]}>৳{totalIncome.toLocaleString()}</Text>
            <Text style={s.trendText}>Eggs: {summary?.totalEggsSold || 0} | Birds: {summary?.totalChickensSold || 0}</Text>
          </View>

          <View style={[s.highlightCard, { borderColor: netProfit >= 0 ? colors.brand : colors.rose }]}>
            <Text style={s.metricLabel}>NET PROFIT</Text>
            <Text style={[s.metricValue, { color: netProfit >= 0 ? colors.brand : colors.rose }]}>৳{netProfit.toLocaleString()}</Text>
            <Text style={s.trendText}>Income - Expenses</Text>
          </View>
        </View>

        {/* Performance Stats per Chicken (Laying % and Feed per Bird) */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <View style={[s.highlightCard, { borderColor: colors.brand }]}>
            <Text style={s.metricLabel}>EGG LAYING RATE %</Text>
            <Text style={[s.metricValue, { color: colors.brand }]}>{summary?.eggLayingRate || 0}%</Text>
            <Text style={s.trendText}>Laid eggs per active hen</Text>
          </View>

          <View style={[s.highlightCard, { borderColor: colors.amber }]}>
            <Text style={s.metricLabel}>FEED / CHICKEN</Text>
            <Text style={[s.metricValue, { color: colors.amber }]}>{summary?.feedPerChickenGrams || 0}g</Text>
            <Text style={s.trendText}>{summary?.feedPerChickenPercentage || 0}% of target intake (110g)</Text>
          </View>
        </View>

        {/* 2x2 Metric Grid */}
        <View style={s.metricGrid}>
          {/* Tile 1: Current Egg Stock */}
          <View style={s.metricCard}>
            <View style={common.row}>
              <Text style={s.metricLabel}>EGG STOCK</Text>
              <Text style={{ fontSize: 16 }}>🥚</Text>
            </View>
            <Text style={[s.metricValue, { fontSize: 16, color: colors.brand }]}>{formatEggCount(summary?.currentEggCount || 0)}</Text>
            <Text style={[s.trendText, { color: colors.textMuted }]}>Unsold stock</Text>
          </View>

          {/* Tile 2: Total Eggs Collected */}
          <View style={s.metricCard}>
            <View style={common.row}>
              <Text style={s.metricLabel}>ALL-TIME EGGS</Text>
              <Text style={{ fontSize: 16 }}>🥚</Text>
            </View>
            <Text style={[s.metricValue, { fontSize: 16 }]}>{formatEggCount(summary?.allTimeEggCount || 0)}</Text>
            <Text style={[s.trendText, { color: colors.amber }]}>Total collected</Text>
          </View>

          {/* Tile 3: Mortality */}
          <View style={s.metricCard}>
            <View style={common.row}>
              <Text style={s.metricLabel}>MORTALITY</Text>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
            </View>
            <Text style={s.metricValue}>{summary?.mortalityRate || 0}%</Text>
            <Text style={[s.trendText, { color: colors.rose }]}>Dead: {summary?.totalDead || 0}</Text>
          </View>

          {/* Tile 4: Total Expenses */}
          <View style={s.metricCard}>
            <View style={common.row}>
              <Text style={s.metricLabel}>TOTAL EXPENSES</Text>
              <Text style={{ fontSize: 16 }}>💰</Text>
            </View>
            <Text style={s.metricValue}>৳{totalCost.toLocaleString()}</Text>
            <Text style={[s.trendText, { color: colors.textMuted }]}>Cost/Egg: ৳{summary?.costPerEgg || 0}</Text>
          </View>
        </View>

        {/* Recent Sales History */}
        <View style={common.card}>
          <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 16, marginBottom: 10 }}>Sales Income History</Text>
          {salesData.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 10 }}>No sales recorded yet.</Text>
          ) : (
            salesData.slice(0, 5).map(sale => (
              <View key={sale._id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 8 }}>
                <View style={common.row}>
                  <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 14 }}>
                    {sale.itemType === 'egg' ? '🥚 Egg Sale' : '🐔 Chicken Sale'}
                  </Text>
                  <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 14 }}>+৳{sale.totalAmount.toLocaleString()}</Text>
                </View>
                <View style={[common.row, { marginTop: 4 }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    Qty: {sale.itemType === 'egg' ? formatEggCount(sale.quantity) : `${sale.quantity} birds`} @ ৳{sale.unitPrice}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{sale.date}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Cost Breakdown Card */}
        <View style={[common.card, { marginTop: 14 }]}>
          <Text style={{ color: colors.textMain, fontWeight: '800', fontSize: 16 }}>Cost Breakdown</Text>
          <View style={{ gap: 8, marginTop: 12 }}>
            {Object.entries(costByCategory).map(([cat, amt]) => {
              const pct = Math.round(((amt as number) / (totalCost || 1)) * 100) || 0;
              return (
                <View key={cat} style={common.row}>
                  <Text style={{ color: colors.textMuted, fontSize: 13, textTransform: 'capitalize' }}>{cat}</Text>
                  <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '700' }}>৳{(amt as number).toLocaleString()} ({pct}%)</Text>
                </View>
              );
            })}
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
  highlightCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: { width: '48%', backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
  metricLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  metricValue: { fontSize: 18, fontWeight: '800', color: colors.textMain, marginTop: 4 },
  trendText: { fontSize: 11, fontWeight: '600', marginTop: 4, color: colors.textMuted },
});
