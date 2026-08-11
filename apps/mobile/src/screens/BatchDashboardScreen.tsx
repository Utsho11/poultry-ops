import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { apiFetch, showAlert } from "../config";
import { colors, common } from "../styles";
import { formatEggCount, cratesAndLooseToTotal } from "../utils/crates";
import { Zap, Tag, Calendar, Egg, Wheat, Skull, TrendingUp, CircleDollarSign, Bird, Package, X, Plus } from "lucide-react-native";

export const BatchDashboardScreen: React.FC<any> = ({ route, navigation }) => {
  const { token, user, activeFarm } = useAuth();
  const { batchId } = route.params || {};

  const [data, setData] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  // Quick Daily Log Modal State for this batch
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [crates, setCrates] = useState("0");
  const [looseEggs, setLooseEggs] = useState("0");
  const [brokenEggCount, setBrokenEggCount] = useState("0");
  const [deadCount, setDeadCount] = useState("0");
  const [feedBags, setFeedBags] = useState("1");
  const [feedLooseKg, setFeedLooseKg] = useState("0");
  const [waterGivenLiters, setWaterGivenLiters] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

  // Record Sale Modal State for this batch
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleItemType, setSaleItemType] = useState<"egg" | "chicken">("egg");
  const [saleCrates, setSaleCrates] = useState("0");
  const [saleLooseEggs, setSaleLooseEggs] = useState("0");
  const [saleChickenQty, setSaleChickenQty] = useState("");
  const [saleUnitPrice, setSaleUnitPrice] = useState("");
  const [saleCustomer, setSaleCustomer] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [submittingSale, setSubmittingSale] = useState(false);

  const isOwner = user?.role === "owner";
  const canManage = user?.role === "owner" || user?.role === "manager";

  // Worker Management Modal State inside Batch Dashboard
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [teamWorkers, setTeamWorkers] = useState<any[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!batchId) return;
    try {
      const [dashData, batchesList, teamList] = await Promise.all([
        apiFetch(`/reports/batch-dashboard/${batchId}`, {}, token),
        apiFetch("/batches", {}, token),
        canManage ? apiFetch("/team", {}, token) : Promise.resolve([]),
      ]);
      setData(dashData);
      setBatches(batchesList);
      if (Array.isArray(teamList)) {
        setTeamWorkers(
          teamList.filter(
            (u: any) => u.role === "worker" || u.role === "manager",
          ),
        );
      }
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to load batch dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [batchId, token, canManage]);

  const handleOpenAssignModal = () => {
    const ids = (data?.batch?.assignedWorkerIds || []).map((id: any) =>
      String(id?._id || id),
    );
    setSelectedWorkerIds(ids);
    setAssignModalOpen(true);
  };

  const handleSaveAssignments = async () => {
    try {
      await apiFetch(
        `/batches/${batchId}/assign-workers`,
        {
          method: "PATCH",
          body: JSON.stringify({ workerIds: selectedWorkerIds }),
        },
        token,
      );
      setAssignModalOpen(false);
      loadData();
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to save worker assignments");
    }
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId],
    );
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalLogEggs = cratesAndLooseToTotal(crates, looseEggs);
  const totalSaleEggQty =
    saleItemType === "egg"
      ? cratesAndLooseToTotal(saleCrates, saleLooseEggs)
      : Number(saleChickenQty || 0);

  const totalLogFeedKg = Number(feedBags || 0) * 50 + Number(feedLooseKg || 0);

  const handleQuickLog = async () => {
    if (totalLogEggs <= 0 || totalLogFeedKg <= 0 || !waterGivenLiters) {
      showAlert(
        "Error",
        "Please enter Egg count (Crates/Loose), Feed, and Water",
      );
      return;
    }
    setSubmittingLog(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await apiFetch(
        "/logs",
        {
          method: "POST",
          body: JSON.stringify({
            batchId,
            date: today,
            eggCount: totalLogEggs,
            brokenEggCount: Number(brokenEggCount || 0),
            deadCount: Number(deadCount || 0),
            feedGivenKg: totalLogFeedKg,
            waterGivenLiters: Number(waterGivenLiters),
          }),
        },
        token,
      );
      setQuickLogOpen(false);
      setCrates("0");
      setLooseEggs("0");
      setFeedBags("1");
      setFeedLooseKg("0");
      setWaterGivenLiters("");
      loadData();
      showAlert(
        "Success",
        `Logged ${formatEggCount(totalLogEggs)} successfully!`,
      );
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleRecordSale = async () => {
    if (totalSaleEggQty <= 0 || !saleUnitPrice) {
      showAlert("Error", "Quantity and Unit Price are required");
      return;
    }
    setSubmittingSale(true);
    try {
      await apiFetch(
        "/sales",
        {
          method: "POST",
          body: JSON.stringify({
            itemType: saleItemType,
            batchId,
            quantity: totalSaleEggQty,
            unitPrice: Number(saleUnitPrice),
            date: saleDate,
            customerName: saleCustomer || undefined,
          }),
        },
        token,
      );
      setSaleModalOpen(false);
      setSaleCrates("0");
      setSaleLooseEggs("0");
      setSaleChickenQty("");
      setSaleUnitPrice("");
      setSaleCustomer("");
      loadData();
      showAlert("Success", "Sale recorded successfully!");
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setSubmittingSale(false);
    }
  };

  if (loading || !data) {
    return (
      <View
        style={[
          common.screen,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.textMuted, marginTop: 10 }}>
          Loading Dedicated Batch Dashboard...
        </Text>
      </View>
    );
  }

  const {
    batch,
    latestLogSection,
    eggSection,
    mortalitySection,
    expenseSection,
    sellSection,
    incomeSection,
    foodSection,
  } = data || {};

  const latest = latestLogSection || {
    date: "N/A",
    totalEggs: 0,
    brokenEggs: 0,
    layingRate: 0,
    feedKg: 0,
    feedPerBirdGrams: 0,
    waterLiters: 0,
    deadCount: 0,
  };

  const safeEggSection = eggSection || { totalEggs: 0, totalBrokenEggs: 0, eggLayingRate: 0, goodEggs: 0 };
  const safeMortalitySection = mortalitySection || { totalDead: 0, mortalityRate: 0, currentCount: 0, initialCount: 0 };
  const safeExpenseSection = expenseSection || { totalExpenses: 0, calculatedFeedExpense: 0, otherExpenses: 0, costByCategory: { feed: 0, medicine: 0, labor: 0, utility: 0, equipment: 0, other: 0 }, costPerEgg: 0, costPerBird: 0 };
  const safeSellSection = sellSection || { totalEggsSold: 0, totalChickensSold: 0 };
  const safeIncomeSection = incomeSection || { totalIncome: 0, netProfit: 0 };
  const safeFoodSection = foodSection || { totalFeedKg: 0, totalWaterLiters: 0, avgFeedPerChickenGrams: 0, feedPerChickenGrams: 0, feedPerChickenPercentage: 0 };

  return (
    <View style={common.screen}>
      {/* Top Navigation Bar */}
      <View style={s.topHeader}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={s.batchTitle} numberOfLines={1}>
            {batch.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            {batch.breed}
          </Text>
        </View>

        <TouchableOpacity
          style={s.logHeaderBtn}
          onPress={() => setQuickLogOpen(true)}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
            ⚡ Log
          </Text>
        </TouchableOpacity>

        {isOwner && (
          <TouchableOpacity
            style={[
              s.logHeaderBtn,
              { backgroundColor: colors.blue, marginLeft: 6 },
            ]}
            onPress={() => setSaleModalOpen(true)}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Tag size={13} color="#fff" style={{ marginRight: 4 }} />
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
                Sale
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={common.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
          />
        }
      >
        {/* Batch Status Banner */}
        <View style={s.statusBanner}>
          <View style={common.row}>
            <View>
              <Text
                style={{
                  color: colors.textMain,
                  fontWeight: "800",
                  fontSize: 16,
                }}
              >
                {batch.name} Dashboard
              </Text>
              <Text
                style={{
                  color: colors.secondary,
                  fontWeight: "800",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                📅 Age: {batch.formattedAge || "N/A"} (Day{" "}
                {batch.dayNumber || 1})
              </Text>
              <Text
                style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}
              >
                Started: {new Date(batch.startDate).toLocaleDateString()}
              </Text>
            </View>
            <View
              style={[
                s.badge,
                {
                  backgroundColor:
                    batch.status === "active"
                      ? "rgba(74, 124, 89, 0.15)"
                      : "rgba(107, 101, 92, 0.15)",
                },
              ]}
            >
              <Text
                style={{
                  color:
                    batch.status === "active"
                      ? colors.secondary
                      : colors.textMuted,
                  fontWeight: "800",
                  fontSize: 11,
                }}
              >
                {batch.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* 📌 LATEST LOG TOP KPI CARDS */}
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: colors.textMain,
            marginBottom: 8,
            marginTop: 4,
          }}
        >
          📌 Latest Log Summary ({latest.date})
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <View style={[s.topKpiCard, { borderColor: colors.secondary }]}>
            <Text style={[s.topKpiLabel, { color: colors.secondary }]}>
              🥚 Total Eggs
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 2,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.topKpiVal,
                    {
                      color: colors.secondary,
                      fontSize: 17,
                      fontWeight: "900",
                    },
                  ]}
                >
                  {latest.totalEggs.toLocaleString()}{" "}
                  <Text style={{ fontSize: 11, fontWeight: "700" }}>Eggs</Text>
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  📦 {formatEggCount(latest.totalEggs)}
                </Text>
              </View>

              {/* Circular Progress Badge */}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  borderWidth: 3,
                  borderColor: colors.secondary,
                  backgroundColor: "rgba(74, 124, 89, 0.12)",
                  alignItems: "center",
                  justifyContent: "center", // added
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "900",
                    color: colors.secondary,
                    lineHeight: 12,
                    textAlign: "center",
                  }}
                >
                  {latest.layingRate}%
                </Text>
                <Text
                  style={{
                    fontSize: 8,
                    fontWeight: "700",
                    color: colors.textMuted,
                  }}
                >
                  Laying
                </Text>
              </View>
            </View>
          </View>

          <View style={[s.topKpiCard, { borderColor: colors.amber }]}>
            <Text style={[s.topKpiLabel, { color: colors.amber }]}>
              🌾 Feed per Bird
            </Text>
            <Text style={s.topKpiVal}>{latest.feedPerBirdGrams} g / bird</Text>
            <Text style={[s.topKpiSub, { color: colors.amber }]}>
              {latest.feedKg} kg feed logged
            </Text>
          </View>

          <View style={[s.topKpiCard, { borderColor: colors.blue }]}>
            <Text style={[s.topKpiLabel, { color: colors.blue }]}>
              💧 Water Intake
            </Text>
            <Text style={s.topKpiVal}>{latest.waterLiters} Liters</Text>
            <Text
              style={[s.topKpiSub, { color: colors.blue, fontWeight: "800" }]}
            >
              💧{" "}
              {latest.waterPerBirdMl ||
                (batch.currentCount > 0
                  ? ((latest.waterLiters * 1000) / batch.currentCount).toFixed(
                      1,
                    )
                  : 0)}{" "}
              mL / bird
            </Text>
          </View>

          <View style={[s.topKpiCard, { borderColor: colors.rose }]}>
            <Text style={[s.topKpiLabel, { color: colors.rose }]}>
              💀 Mortality
            </Text>
            <Text
              style={[
                s.topKpiVal,
                {
                  color: latest.deadCount > 0 ? colors.rose : colors.secondary,
                },
              ]}
            >
              {latest.deadCount} Dead Birds
            </Text>
            <Text
              style={[
                s.topKpiSub,
                {
                  color: latest.deadCount > 0 ? colors.rose : colors.secondary,
                },
              ]}
            >
              {latest.deadCount > 0 ? "Dead reported today" : "Zero mortality"}
            </Text>
          </View>
        </View>

        {/* 👷 ASSIGNED WORKERS CARD - ALWAYS VISIBLE BELOW LATEST LOG SUMMARY */}
        <View
          style={[s.dashCard, { borderColor: colors.blue, marginBottom: 12 }]}
        >
          <View style={common.row}>
            <Text style={[s.sectionHeader, { color: colors.blue }]}>
              👷 Assigned Flock Workers
            </Text>
            {canManage && (
              <TouchableOpacity
                onPress={handleOpenAssignModal}
                style={{
                  backgroundColor: colors.surfaceElevated,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.textMain,
                  }}
                >
                  ⚙️ Manage
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {data.assignedWorkers && data.assignedWorkers.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {data.assignedWorkers.map((w: any) => (
                <View key={w._id} style={s.workerChip}>
                  <Text style={s.workerChipText}>👷 {w.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.allWorkersText}>
              All farm workers can access this flock. Tap Manage to restrict.
            </Text>
          )}
        </View>

        {/* 📋 MORE BATCH DETAILS TOGGLE BUTTON */}
        <TouchableOpacity
          style={s.moreDetailsBtn}
          onPress={() => setShowMoreDetails(!showMoreDetails)}
        >
          <Text style={s.moreDetailsBtnText}>
            📋 More Batch Details{" "}
            {showMoreDetails ? "▲ (Hide)" : "▼ (Show Full Sections)"}
          </Text>
        </TouchableOpacity>

        {/* STRUCTURED BATCH SECTIONS REARRANGED BY IMPORTANCE */}
        {showMoreDetails && (
          <View style={{ marginTop: 10 }}>
            {/* 1. EGG YIELD & PRODUCTIVITY */}
            {/* 1. EGG PRODUCTIVITY SECTION (LAYER FLOCKS ONLY) */}
            {(batch?.type === "layer" || activeFarm?.animalType === "layer") && (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("DailyReport", {
                    batchId,
                    initialTab: "egg",
                  })
                }
                activeOpacity={0.8}
              >
                <View style={[s.dashCard, { borderColor: colors.secondary }]}>
                  <View style={common.row}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Egg size={14} color={colors.secondary} />
                      <Text style={[s.sectionHeader, { color: colors.secondary }]}>
                        1. Egg Productivity
                      </Text>
                    </View>
                    <View style={s.rateBadge}>
                      <Text style={s.rateBadgeText}>
                        {eggSection.eggLayingRate}% Laying Rate
                      </Text>
                    </View>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Total Eggs Collected:</Text>
                    <Text
                      style={[
                        s.dashVal,
                        { color: colors.secondary, fontSize: 15 },
                      ]}
                    >
                      {formatEggCount(eggSection.totalEggs)}
                    </Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Raw Egg Count:</Text>
                    <Text style={s.dashVal}>
                      {eggSection.totalEggs.toLocaleString()} eggs
                    </Text>
                  </View>
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Broken Eggs:</Text>
                    <Text style={[s.dashVal, { color: colors.rose }]}>
                      {eggSection.totalBrokenEggs} eggs
                    </Text>
                  </View>
                  <View
                    style={{
                      marginTop: 8,
                      padding: 8,
                      backgroundColor: "rgba(74, 124, 89, 0.12)",
                      borderRadius: 6,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.secondary,
                        fontWeight: "800",
                        fontSize: 11,
                      }}
                    >
                      View Date-wise Daily Egg Report →
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* 2. FOOD INFO SECTION */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("DailyReport", {
                  batchId,
                  initialTab: "food",
                })
              }
              activeOpacity={0.8}
            >
              <View style={[s.dashCard, { borderColor: colors.secondary }]}>
                <View style={common.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Wheat size={14} color={colors.secondary} />
                    <Text style={[s.sectionHeader, { color: colors.secondary }]}>
                      2. Food Info
                    </Text>
                  </View>
                  <View style={s.rateBadge}>
                    <Text style={s.rateBadgeText}>
                      {foodSection.feedPerChickenPercentage}% Target
                    </Text>
                  </View>
                </View>
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Total Feed Consumed:</Text>
                  <Text style={[s.dashVal, { color: colors.secondary }]}>
                    {foodSection.totalFeedKg} kg (
                    {Math.round(foodSection.totalFeedKg / 50)} bags)
                  </Text>
                </View>
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Daily Feed / Chicken:</Text>
                  <Text style={s.dashVal}>
                    {foodSection.feedPerChickenGrams} g/bird/day
                  </Text>
                </View>
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Total Water Provided:</Text>
                  <Text style={s.dashVal}>
                    {foodSection.totalWaterLiters} Liters
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: "rgba(74, 124, 89, 0.12)",
                    borderRadius: 6,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.secondary,
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    View Date-wise Daily Food Report →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* 3. MORTALITY RATE SECTION */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("DailyReport", {
                  batchId,
                  initialTab: "mortality",
                })
              }
              activeOpacity={0.8}
            >
              <View style={[s.dashCard, { borderColor: colors.rose }]}>
                <View style={common.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Skull size={14} color={colors.rose} />
                    <Text style={[s.sectionHeader, { color: colors.rose }]}>
                      3. Mortality Rate
                    </Text>
                  </View>
                  <View
                    style={[
                      s.rateBadge,
                      { backgroundColor: "rgba(178, 58, 47, 0.15)" },
                    ]}
                  >
                    <Text style={[s.rateBadgeText, { color: colors.rose }]}>
                      {mortalitySection.mortalityRate}% Mortality
                    </Text>
                  </View>
                </View>
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Total Dead Birds:</Text>
                  <Text
                    style={[s.dashVal, { color: colors.rose, fontSize: 15 }]}
                  >
                    {mortalitySection.totalDead} birds
                  </Text>
                </View>
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Current Active Birds:</Text>
                  <Text style={[s.dashVal, { color: colors.secondary }]}>
                    {mortalitySection.currentCount.toLocaleString()} birds
                  </Text>
                </View>
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Initial Birds Population:</Text>
                  <Text style={s.dashVal}>
                    {mortalitySection.initialCount.toLocaleString()} birds
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: "rgba(178, 58, 47, 0.12)",
                    borderRadius: 6,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.rose,
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    View Date-wise Daily Mortality Report →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* 4. FINANCIAL TOP PRIORITY: INCOME & NET PROFIT */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("DailyReport", {
                  batchId,
                  initialTab: "income",
                })
              }
              activeOpacity={0.8}
            >
              <View style={[s.dashCard, { borderColor: colors.brand }]}>
                <View style={common.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={14} color={colors.brand} />
                    <Text style={[s.sectionHeader, { color: colors.brand }]}>
                      4. Income & Net Profit
                    </Text>
                  </View>
                  <View
                    style={[
                      s.rateBadge,
                      {
                        backgroundColor:
                          incomeSection.netProfit >= 0
                            ? "rgba(74, 124, 89, 0.15)"
                            : "rgba(178, 58, 47, 0.15)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.rateBadgeText,
                        {
                          color:
                            incomeSection.netProfit >= 0
                              ? colors.secondary
                              : colors.rose,
                        },
                      ]}
                    >
                      {incomeSection.profitMargin}% Margin
                    </Text>
                  </View>
                </View>
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Total Sales Revenue:</Text>
                  <Text
                    style={[s.dashVal, { color: colors.blue, fontSize: 15 }]}
                  >
                    ৳{incomeSection.totalIncome.toLocaleString()}
                  </Text>
                </View>
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Net Batch Profit:</Text>
                  <Text
                    style={[
                      s.dashVal,
                      {
                        color:
                          incomeSection.netProfit >= 0
                            ? colors.secondary
                            : colors.rose,
                        fontSize: 16,
                      },
                    ]}
                  >
                    ৳{incomeSection.netProfit.toLocaleString()}
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: "rgba(199, 81, 31, 0.12)",
                    borderRadius: 6,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.brand,
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    View Date-wise Daily Income Report →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* 5. SELL SECTION */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("DailyReport", {
                  batchId,
                  initialTab: "sell",
                })
              }
              activeOpacity={0.8}
            >
              <View style={[s.dashCard, { borderColor: colors.blue }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Tag size={14} color={colors.blue} />
                  <Text style={[s.sectionHeader, { color: colors.blue }]}>
                    5. Sales Volume
                  </Text>
                </View>
                {(batch?.type === "layer" || activeFarm?.animalType === "layer") && (
                  <View style={s.dashRow}>
                    <Text style={s.dashLabel}>Eggs Sold:</Text>
                    <Text
                      style={[s.dashVal, { color: colors.blue, fontSize: 15 }]}
                    >
                      {formatEggCount(sellSection.totalEggsSold)}
                    </Text>
                  </View>
                )}
                <View style={s.dashRow}>
                  <Text style={s.dashLabel}>Chickens Sold:</Text>
                  <Text style={s.dashVal}>
                    {sellSection.totalChickensSold.toLocaleString()} birds
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: "rgba(61, 107, 140, 0.12)",
                    borderRadius: 6,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.blue,
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    View Date-wise Daily Sales Report →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* 6. EXPENSE SECTION */}
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("DailyReport", {
                  batchId,
                  initialTab: "expense",
                })
              }
              activeOpacity={0.8}
            >
              <View style={[s.dashCard, { borderColor: colors.amber }]}>
                <View style={common.row}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CircleDollarSign size={14} color={colors.amber} />
                    <Text style={[s.sectionHeader, { color: colors.amber }]}>
                      6. Expenses
                    </Text>
                  </View>
                  <Text
                    style={[s.dashVal, { color: colors.amber, fontSize: 15 }]}
                  >
                    ৳{expenseSection.totalExpenses.toLocaleString()}
                  </Text>
                </View>
                <View style={s.gridBox}>
                  <Text style={s.gridItem}>
                    Feed: ৳
                    {(safeExpenseSection.costByCategory?.feed || safeExpenseSection.calculatedFeedExpense || 0).toLocaleString()}
                  </Text>
                  <Text style={s.gridItem}>
                    Meds: ৳
                    {(
                      safeExpenseSection.costByCategory?.medicine || 0
                    ).toLocaleString()}
                  </Text>
                  <Text style={s.gridItem}>
                    Labor: ৳
                    {(
                      safeExpenseSection.costByCategory?.labor || 0
                    ).toLocaleString()}
                  </Text>
                  <Text style={s.gridItem}>
                    Utility: ৳
                    {(
                      safeExpenseSection.costByCategory?.utility || 0
                    ).toLocaleString()}
                  </Text>
                  <Text style={s.gridItem}>
                    Equip: ৳
                    {(
                      safeExpenseSection.costByCategory?.equipment || 0
                    ).toLocaleString()}
                  </Text>
                </View>
                <View style={[s.dashRow, { marginTop: 6 }]}>
                  <Text style={s.dashLabel}>
                    Cost / Bird: ৳{expenseSection.costPerBird}
                  </Text>
                  <Text style={s.dashLabel}>
                    Cost / Egg: ৳{expenseSection.costPerEgg}
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 8,
                    padding: 8,
                    backgroundColor: "rgba(217, 164, 65, 0.12)",
                    borderRadius: 6,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.amber,
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    📅 View Date-wise Daily Expense Report →
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* QUICK LOG MODAL */}
      <Modal visible={quickLogOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <Text style={s.modalTitle}>⚡ Log Daily Yield ({batch.name})</Text>
            <ScrollView>
              <View style={s.eggInputBox}>
                <Text
                  style={{
                    color: colors.secondary,
                    fontWeight: "800",
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  🥚 Eggs Collected (1 Crate = 30 Eggs)
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Full Crates</Text>
                    <TextInput
                      style={common.input}
                      keyboardType="numeric"
                      value={crates}
                      onChangeText={setCrates}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Loose Eggs</Text>
                    <TextInput
                      style={common.input}
                      keyboardType="numeric"
                      value={looseEggs}
                      onChangeText={setLooseEggs}
                    />
                  </View>
                </View>
                <Text
                  style={{
                    color: colors.secondary,
                    fontWeight: "800",
                    marginTop: 6,
                    fontSize: 13,
                  }}
                >
                  Total: {formatEggCount(totalLogEggs)} ({totalLogEggs} eggs)
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={common.label}>Broken Eggs</Text>
                  <TextInput
                    style={common.input}
                    keyboardType="numeric"
                    value={brokenEggCount}
                    onChangeText={setBrokenEggCount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={common.label}>Dead Birds</Text>
                  <TextInput
                    style={common.input}
                    keyboardType="numeric"
                    value={deadCount}
                    onChangeText={setDeadCount}
                  />
                </View>
              </View>

              <View
                style={[
                  s.eggInputBox,
                  {
                    borderColor: "rgba(217, 164, 65, 0.3)",
                    backgroundColor: "rgba(217, 164, 65, 0.08)",
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.amber,
                    fontWeight: "800",
                    fontSize: 13,
                    marginBottom: 6,
                  }}
                >
                  🌾 Feed Given (Full Bags + Loose kg)
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Full Bags (50kg/bag)</Text>
                    <TextInput
                      style={common.input}
                      keyboardType="numeric"
                      value={feedBags}
                      onChangeText={setFeedBags}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={common.label}>Loose kg</Text>
                    <TextInput
                      style={common.input}
                      keyboardType="numeric"
                      value={feedLooseKg}
                      onChangeText={setFeedLooseKg}
                    />
                  </View>
                </View>
                <Text
                  style={{
                    color: colors.amber,
                    fontWeight: "700",
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  Total: {totalLogFeedKg} kg ({feedBags || 0} Bags +{" "}
                  {feedLooseKg || 0} kg)
                </Text>
              </View>

              <Text style={common.label}>Water Given (L)</Text>
              <TextInput
                style={common.input}
                keyboardType="numeric"
                placeholder="200"
                placeholderTextColor="#6B655C"
                value={waterGivenLiters}
                onChangeText={setWaterGivenLiters}
              />
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setQuickLogOpen(false)}
              >
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.submitBtn}
                onPress={handleQuickLog}
                disabled={submittingLog}
              >
                <Text style={s.btnText}>
                  {submittingLog ? "Saving..." : "⚡ Save Log"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RECORD SALE MODAL */}
      <Modal visible={saleModalOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Tag size={18} color={colors.blue} />
              <Text style={s.modalTitle}>Record Sale ({batch.name})</Text>
            </View>
            <ScrollView>
              {(batch?.type === "layer" || activeFarm?.animalType === "layer") && (
                <>
                  <Text style={common.label}>Item to Sell</Text>
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[
                        s.typeBtn,
                        saleItemType === "egg" && s.typeBtnSelectedEgg,
                      ]}
                      onPress={() => setSaleItemType("egg")}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Egg size={14} color={saleItemType === "egg" ? colors.secondary : colors.textMuted} />
                        <Text
                          style={{
                            color:
                              saleItemType === "egg"
                                ? colors.secondary
                                : colors.textMuted,
                            fontWeight: "800",
                          }}
                        >
                          Eggs
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        s.typeBtn,
                        saleItemType === "chicken" && s.typeBtnSelectedChicken,
                      ]}
                      onPress={() => setSaleItemType("chicken")}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Bird size={14} color={saleItemType === "chicken" ? colors.blue : colors.textMuted} />
                        <Text
                          style={{
                            color:
                              saleItemType === "chicken"
                                ? colors.blue
                                : colors.textMuted,
                            fontWeight: "800",
                          }}
                        >
                          Chickens
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {saleItemType === "egg" ? (
                <View style={s.eggInputBox}>
                  <Text
                    style={{
                      color: colors.secondary,
                      fontWeight: "800",
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    Egg Selling Quantity (1 Crate = 30 Eggs)
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Full Crates</Text>
                      <TextInput
                        style={common.input}
                        keyboardType="numeric"
                        value={saleCrates}
                        onChangeText={setSaleCrates}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={common.label}>Loose Eggs</Text>
                      <TextInput
                        style={common.input}
                        keyboardType="numeric"
                        value={saleLooseEggs}
                        onChangeText={setSaleLooseEggs}
                      />
                    </View>
                  </View>
                  <Text
                    style={{
                      color: colors.secondary,
                      fontWeight: "800",
                      marginTop: 6,
                      fontSize: 13,
                    }}
                  >
                    Selling: {formatEggCount(totalSaleEggQty)} (
                    {totalSaleEggQty} eggs)
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={common.label}>Number of Chickens</Text>
                  <TextInput
                    style={common.input}
                    keyboardType="numeric"
                    placeholder="50"
                    placeholderTextColor="#6B655C"
                    value={saleChickenQty}
                    onChangeText={setSaleChickenQty}
                  />
                </View>
              )}

              <Text style={common.label}>
                {saleItemType === "egg"
                  ? "Price per Egg (৳)"
                  : "Price per Chicken (৳)"}
              </Text>
              <TextInput
                style={common.input}
                keyboardType="numeric"
                placeholder="10.50"
                placeholderTextColor="#6B655C"
                value={saleUnitPrice}
                onChangeText={setSaleUnitPrice}
              />

              {totalSaleEggQty > 0 && Number(saleUnitPrice) > 0 && (
                <Text
                  style={{
                    color: colors.blue,
                    fontWeight: "800",
                    marginVertical: 6,
                    fontSize: 14,
                  }}
                >
                  Total Income: ৳
                  {(totalSaleEggQty * Number(saleUnitPrice)).toLocaleString()}
                </Text>
              )}

              <Text style={common.label}>Customer Name</Text>
              <TextInput
                style={common.input}
                placeholder="Wholesale Buyer"
                placeholderTextColor="#6B655C"
                value={saleCustomer}
                onChangeText={setSaleCustomer}
              />
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setSaleModalOpen(false)}
              >
                <Text style={s.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.blue }]}
                onPress={handleRecordSale}
                disabled={submittingSale}
              >
                <Text style={s.btnText}>
                  {submittingSale ? "Recording..." : "Record Revenue"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 👷 WORKER ASSIGNMENT MODAL INSIDE MOBILE BATCH DASHBOARD */}
      <Modal visible={assignModalOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={[s.modalContainer, { maxHeight: "80%" }]}>
            <Text style={s.modalTitle}>Manage Flock Workers</Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginBottom: 14,
              }}
            >
              Select workers allowed to access and log data for '
              {data?.batch?.name}'
            </Text>

            <ScrollView style={{ maxHeight: 250, marginBottom: 16 }}>
              {teamWorkers.length > 0 ? (
                teamWorkers.map((w) => {
                  const isAssigned = selectedWorkerIds.includes(w._id);
                  return (
                    <TouchableOpacity
                      key={w._id}
                      onPress={() => toggleWorkerSelection(w._id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: isAssigned
                          ? colors.secondary
                          : colors.border,
                        backgroundColor: isAssigned
                          ? "rgba(74, 124, 89, 0.15)"
                          : colors.surfaceElevated,
                        marginBottom: 8,
                      }}
                    >
                      <View>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: colors.textMain,
                          }}
                        >
                          👷 {w.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>
                          {w.email || w.phone || "Worker"}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          backgroundColor: isAssigned
                            ? colors.secondary
                            : "transparent",
                          borderWidth: 1,
                          borderColor: colors.secondary,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isAssigned && (
                          <Text
                            style={{
                              color: "#fff",
                              fontWeight: "800",
                              fontSize: 12,
                            }}
                          >
                            ✓
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 13,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No team members found. Create workers in Team Management
                  screen first.
                </Text>
              )}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setAssignModalOpen(false)}
              >
                <Text style={[s.btnText, { color: colors.textMain }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.secondary }]}
                onPress={handleSaveAssignments}
              >
                <Text style={s.btnText}>Save Assignments</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  workerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border ?? "#E0E0E0",
    backgroundColor: colors.surface ?? "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },

  workerChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },

  allWorkersText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.secondary,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: { color: colors.brand, fontWeight: "800", fontSize: 12 },
  batchTitle: { fontSize: 16, fontWeight: "900", color: colors.textMain },
  logHeaderBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBanner: {
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  dashCard: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionHeader: { fontWeight: "900", fontSize: 15 },
  rateBadge: {
    backgroundColor: "rgba(74, 124, 89, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rateBadgeText: { color: colors.secondary, fontWeight: "800", fontSize: 11 },
  dashRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  dashLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  dashVal: { color: colors.textMain, fontSize: 13, fontWeight: "800" },
  gridBox: {
    backgroundColor: colors.surfaceElevated,
    padding: 10,
    borderRadius: 8,
    gap: 4,
    marginVertical: 6,
  },
  gridItem: { color: colors.textMain, fontSize: 12, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(45, 42, 38, 0.65)",
    justifyContent: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMain,
    marginBottom: 12,
  },
  eggInputBox: {
    backgroundColor: "rgba(74, 124, 89, 0.08)",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 124, 89, 0.2)",
    marginVertical: 8,
  },
  typeBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
  },
  typeBtnSelectedEgg: {
    borderColor: colors.secondary,
    backgroundColor: "rgba(74, 124, 89, 0.15)",
  },
  typeBtnSelectedChicken: {
    borderColor: colors.blue,
    backgroundColor: "rgba(61, 107, 140, 0.15)",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  submitBtn: {
    flex: 1,
    backgroundColor: colors.secondary,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  topKpiCard: {
    width: "48%",
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  topKpiLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  topKpiVal: { fontSize: 14, fontWeight: "800", color: colors.textMain },
  topKpiSub: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  moreDetailsBtn: {
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    marginVertical: 8,
  },
  moreDetailsBtnText: {
    color: colors.textMain,
    fontWeight: "800",
    fontSize: 13,
  },
});
