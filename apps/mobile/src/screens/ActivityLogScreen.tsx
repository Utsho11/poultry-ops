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
  Activity,
  Egg,
  Bird,
  Tag,
  CircleDollarSign,
  Wheat,
  Heart,
  ClipboardList,
  ArrowLeft,
  Clock,
  User,
} from "lucide-react-native";

interface ActivityItem {
  type: string;
  description: string;
  user?: string;
  timestamp: string;
  metadata?: any;
}

const typeConfig: Record<string, { icon: React.FC<any>; color: string; label: string }> = {
  log: { icon: ClipboardList, color: colors.secondary, label: "Daily Log" },
  sale: { icon: Tag, color: colors.brand, label: "Sale" },
  expense: { icon: CircleDollarSign, color: colors.rose, label: "Expense" },
  feed_stock: { icon: Wheat, color: colors.amber, label: "Feed Stock" },
  batch: { icon: Bird, color: colors.blue, label: "Flock" },
  health: { icon: Heart, color: "#E05B8E", label: "Health" },
  payment: { icon: Tag, color: colors.secondary, label: "Payment" },
};

export const ActivityLogScreen: React.FC<any> = ({ navigation }) => {
  const { token, activeFarm } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch("/reports/activity-log", {}, token, activeFarm?._id);
      setActivities(data || []);
    } catch (e) {
      // Endpoint may not exist yet, show empty state
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, activeFarm?._id]);

  useEffect(() => {
    load();
  }, [load]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return ts;
    }
  };

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
          <Text style={s.headerTitle}>Activity Log</Text>
          <Text style={s.headerSub}>Last {activities.length} activities</Text>
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
        {activities.length === 0 ? (
          <View style={s.emptyCard}>
            <Activity size={32} color={colors.border} />
            <Text style={{ color: colors.textMuted, marginTop: 8, fontWeight: "600" }}>
              No activity recorded yet.
            </Text>
            <Text style={{ color: colors.border, marginTop: 4, fontSize: 12, textAlign: "center" }}>
              Activities will appear here as you log data, record sales, and manage your farm.
            </Text>
          </View>
        ) : (
          activities.map((item, idx) => {
            const config = typeConfig[item.type] || typeConfig.log;
            const IconComp = config.icon;
            return (
              <View key={idx} style={s.activityItem}>
                {/* Timeline Line */}
                {idx < activities.length - 1 && <View style={s.timelineLine} />}

                <View style={[s.iconBubble, { backgroundColor: `${config.color}14` }]}>
                  <IconComp size={14} color={config.color} />
                </View>

                <View style={s.activityBody}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[s.typeLabel, { color: config.color }]}>
                          {config.label}
                        </Text>
                      </View>
                      <Text style={s.description} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                    <View style={s.timeChip}>
                      <Clock size={9} color={colors.textMuted} />
                      <Text style={s.timeText}>{formatTime(item.timestamp)}</Text>
                    </View>
                  </View>

                  {item.user && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <User size={10} color={colors.border} />
                      <Text style={{ fontSize: 10, color: colors.border, fontWeight: "600" }}>
                        {item.user}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
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
  emptyCard: {
    backgroundColor: colors.surface,
    padding: 40,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 4,
    paddingBottom: 4,
  },
  timelineLine: {
    position: "absolute",
    left: 16,
    top: 36,
    bottom: -4,
    width: 1.5,
    backgroundColor: colors.border,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityBody: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMain,
    marginTop: 2,
    lineHeight: 18,
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  timeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
  },
});
