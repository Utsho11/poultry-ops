import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../config";
import { colors, common, STATUS_BAR_PADDING } from "../styles";
import {
  Wheat,
  Calendar,
  Package,
  Filter,
  ArrowLeft,
} from "lucide-react-native";

export const FeedStockHistoryScreen: React.FC<any> = ({ navigation }) => {
  const { token, activeFarm } = useAuth();
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch("/feed-stock", {}, token, activeFarm?._id);
      setStocks(data || []);
    } catch (e) {
      // handled silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, activeFarm?._id]);

  useEffect(() => {
    load();
  }, [load]);

  const totalBags = stocks.reduce((sum, s) => sum + (s.bags || 0), 0);
  const totalCost = stocks.reduce((sum, s) => sum + (s.totalCost || 0), 0);
  const totalKg = stocks.reduce((sum, s) => sum + (s.totalKg || 0), 0);

  const formatCategory = (cat: string) =>
    cat?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Feed";

  if (loading) {
    return (
      <View style={[common.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={common.screen}>
      {/* Header */}
      <View style={s.topHeader}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={16} color={colors.brand} />
        </TouchableOpacity>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={s.headerTitle}>Feed Stock History</Text>
          <Text style={s.headerSub}>{stocks.length} purchase records</Text>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, { borderLeftColor: colors.amber }]}>
          <Text style={[s.summaryLabel, { color: colors.amber }]}>Total Bags</Text>
          <Text style={s.summaryValue}>{totalBags}</Text>
        </View>
        <View style={[s.summaryCard, { borderLeftColor: colors.secondary }]}>
          <Text style={[s.summaryLabel, { color: colors.secondary }]}>Total Kg</Text>
          <Text style={s.summaryValue}>{totalKg.toLocaleString()}</Text>
        </View>
        <View style={[s.summaryCard, { borderLeftColor: colors.brand }]}>
          <Text style={[s.summaryLabel, { color: colors.brand }]}>Total Cost</Text>
          <Text style={s.summaryValue}>{totalCost.toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[colors.brand]}
          />
        }
      >
        {stocks.length === 0 ? (
          <View style={s.emptyCard}>
            <Wheat size={32} color={colors.border} />
            <Text style={{ color: colors.textMuted, marginTop: 8, fontWeight: "600" }}>
              No feed stock purchases recorded yet.
            </Text>
          </View>
        ) : (
          stocks.map((stock, idx) => (
            <View key={stock._id || idx} style={common.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Package size={14} color={colors.amber} />
                    <Text style={{ fontSize: 14, fontWeight: "800", color: colors.textMain }}>
                      {formatCategory(stock.category)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Calendar size={11} color={colors.textMuted} />
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{stock.date}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 16, fontWeight: "900", color: colors.brand }}>
                  {stock.totalCost?.toLocaleString()}
                </Text>
              </View>

              <View style={s.detailRow}>
                <View style={s.detailChip}>
                  <Text style={s.detailChipText}>{stock.bags} bags</Text>
                </View>
                <View style={s.detailChip}>
                  <Text style={s.detailChipText}>{stock.bagPrice}/bag</Text>
                </View>
                <View style={s.detailChip}>
                  <Text style={s.detailChipText}>{stock.totalKg} kg</Text>
                </View>
              </View>

              {stock.note ? (
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6 }}>
                  {stock.note}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: STATUS_BAR_PADDING,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    backgroundColor: colors.surfaceElevated,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.textMain,
  },
  headerSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.textMain,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    padding: 40,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  detailChip: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMain,
  },
});
