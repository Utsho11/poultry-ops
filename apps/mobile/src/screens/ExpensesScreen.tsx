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
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../context/AuthContext";
import { apiFetch, showAlert } from "../config";
import { colors, common } from "../styles";
import { DatePickerInput } from "../components/DatePickerInput";
import { Plus, CircleDollarSign, Bird, User, Package, Wheat, Calendar, Trash2, HeartPulse, Filter } from "lucide-react-native";

const CATEGORIES = [
  "feed",
  "medicine",
  "labor",
  "utility",
  "equipment",
  "other",
];
const HEALTH_TYPES = ["vaccination", "checkup", "injection", "treatment"];

const categoryColor: Record<string, string> = {
  feed: colors.amber,
  medicine: colors.blue,
  labor: colors.amber,
  utility: colors.purple,
  equipment: "#14b8a6",
  other: colors.textMuted,
};

export const ExpensesScreen: React.FC = () => {
  const { token, user, activeFarm } = useAuth();
  const [activeTab, setActiveTab] = useState<"expenses" | "health">("expenses");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const canManage = user?.role === "owner" || user?.role === "manager";

  // Filters for Expense History
  const [filterBatchId, setFilterBatchId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Expense form & Edit state
  const [expModal, setExpModal] = useState(false);
  const [editExpModal, setEditExpModal] = useState(false);
  const [editingExpId, setEditingExpId] = useState("");
  const [expBatchId, setExpBatchId] = useState("");
  const [expWorkerId, setExpWorkerId] = useState("");
  const [teamWorkers, setTeamWorkers] = useState<any[]>([]);
  const [expCategory, setExpCategory] = useState("feed");
  const [feedCategory, setFeedCategory] = useState("layer_layer_1");
  const [stockBags, setStockBags] = useState("10");
  const [bagPrice, setBagPrice] = useState("2500");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [expNote, setExpNote] = useState("");
  const [expSubmitting, setExpSubmitting] = useState(false);

  // Health form
  const [healthModal, setHealthModal] = useState(false);
  const [healthBatchId, setHealthBatchId] = useState("");
  const [healthDate, setHealthDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [healthType, setHealthType] = useState("vaccination");
  const [healthDesc, setHealthDesc] = useState("");
  const [healthMedicine, setHealthMedicine] = useState("");
  const [healthVet, setHealthVet] = useState("");
  const [healthSubmitting, setHealthSubmitting] = useState(false);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [expData, healthData, batchData, usersData, logsData] =
        await Promise.all([
          apiFetch("/expenses", {}, token),
          apiFetch("/health-records", {}, token),
          apiFetch("/batches", {}, token),
          apiFetch("/users", {}, token),
          apiFetch("/logs", {}, token),
        ]);
      setExpenses(expData);
      setHealth(healthData);
      setBatches(batchData);
      setDailyLogs(logsData || []);
      setTeamWorkers((usersData || []).filter((u: any) => u.role === "worker"));
      if (batchData.length > 0) {
        if (!expBatchId) setExpBatchId(batchData[0]._id);
        if (!healthBatchId) setHealthBatchId(batchData[0]._id);
      }
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setRefreshing(false);
    }
  }, [token, expBatchId, healthBatchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (expCategory === "labor" && expBatchId) {
      const selectedBatch = batches.find((b) => b._id === expBatchId);
      const batchWorkerIds = (selectedBatch?.assignedWorkerIds || []).map(
        (id: any) => String(id?._id || id),
      );
      const workers = teamWorkers.filter((w) =>
        batchWorkerIds.includes(String(w._id)),
      );
      if (workers.length > 0) {
        setExpWorkerId(workers[0]._id);
      } else {
        setExpWorkerId("");
      }
    }
  }, [expCategory, expBatchId, batches, teamWorkers]);

  const handleCreateExpense = async () => {
    if (!expDate) {
      showAlert("Error", "Date is required (YYYY-MM-DD)");
      return;
    }

    setExpSubmitting(true);
    try {
      if (expCategory === "feed") {
        const bagsNum = Number(stockBags || 0);
        const priceNum = Number(bagPrice || 0);
        if (bagsNum <= 0 || priceNum <= 0) {
          showAlert(
            "Error",
            "Please enter valid Bags count and Price per Bag.",
          );
          setExpSubmitting(false);
          return;
        }
        await apiFetch(
          "/feed-stock",
          {
            method: "POST",
            body: JSON.stringify({
              category: feedCategory,
              bagPrice: priceNum,
              bags: bagsNum,
              date: expDate,
              note: expNote ? `Vendor: ${expNote}` : undefined,
            }),
          },
          token,
        );
      } else {
        if (!expBatchId) {
          showAlert("Error", "Please select a target Flock / Batch.");
          setExpSubmitting(false);
          return;
        }
        if (!expAmount) {
          showAlert("Error", "Amount is required");
          setExpSubmitting(false);
          return;
        }
        if (expCategory === "labor") {
          const selectedBatch = batches.find((b) => b._id === expBatchId);
          const batchWorkerIds = (selectedBatch?.assignedWorkerIds || []).map(
            (id: any) => String(id?._id || id),
          );
          if (!selectedBatch || batchWorkerIds.length === 0) {
            showAlert(
              "Worker Required",
              "Cannot add labor expense to this batch because no workers are assigned to this flock/batch. Please assign a worker to the batch first.",
            );
            setExpSubmitting(false);
            return;
          }
          if (!expWorkerId) {
            showAlert(
              "Worker Required",
              "Please select an assigned worker/laborer receiving this payment.",
            );
            setExpSubmitting(false);
            return;
          }
        }
        await apiFetch(
          "/expenses",
          {
            method: "POST",
            body: JSON.stringify({
              batchId: expBatchId,
              workerId: expCategory === "labor" ? expWorkerId : undefined,
              category: expCategory,
              amount: Number(expAmount),
              currency: "BDT",
              date: expDate,
              note: expNote,
            }),
          },
          token,
        );
      }
      setExpModal(false);
      setExpAmount("");
      setExpNote("");
      load();
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setExpSubmitting(false);
    }
  };

  const openEditModal = (exp: any) => {
    setEditingExpId(exp._id);
    setExpBatchId(
      typeof exp.batchId === "object" ? exp.batchId._id : exp.batchId || "",
    );
    setExpCategory(exp.category);
    setExpAmount(String(exp.amount || ""));
    setExpDate(exp.date || new Date().toISOString().split("T")[0]);
    setExpNote(exp.note || "");
    setStockBags(String(exp.feedBags || 10));
    if (exp.workerId) {
      setExpWorkerId(
        typeof exp.workerId === "object" ? exp.workerId._id : exp.workerId,
      );
    }
    setEditExpModal(true);
  };

  const handleUpdateExpense = async () => {
    if (!expDate) {
      showAlert("Error", "Date is required");
      return;
    }
    if (!expAmount || Number(expAmount) <= 0) {
      showAlert("Error", "Valid amount is required");
      return;
    }

    setExpSubmitting(true);
    try {
      let bagsNum = expCategory === "feed" ? Number(stockBags || 0) : undefined;
      let kgNum =
        expCategory === "feed" ? Number(stockBags || 0) * 50 : undefined;

      await apiFetch(
        `/expenses/${editingExpId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            batchId: expBatchId,
            workerId: expCategory === "labor" ? expWorkerId : undefined,
            category: expCategory,
            amount: Number(expAmount),
            date: expDate,
            note: expNote,
            feedBags: bagsNum,
            feedKg: kgNum,
          }),
        },
        token,
      );

      showAlert("Success", "Expense updated successfully");
      setEditExpModal(false);
      load();
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setExpSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    showAlert(
      "Confirm Delete",
      "Are you sure you want to delete this expense record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/expenses/${id}`, { method: "DELETE" }, token);
              showAlert("Success", "Expense record deleted");
              load();
            } catch (err: any) {
              showAlert("Error", err.message);
            }
          },
        },
      ],
    );
  };

  const handleCreateHealth = async () => {
    if (!healthBatchId) {
      showAlert("Error", "Please select a target Flock / Batch.");
      return;
    }
    if (!healthDesc || !healthVet) {
      showAlert("Error", "Description and vet name required");
      return;
    }
    if (!healthDate) {
      showAlert("Error", "Date is required (YYYY-MM-DD)");
      return;
    }

    setHealthSubmitting(true);
    try {
      await apiFetch(
        "/health-records",
        {
          method: "POST",
          body: JSON.stringify({
            batchId: healthBatchId,
            date: healthDate,
            type: healthType,
            description: healthDesc,
            medicineUsed: healthMedicine,
            performedBy: healthVet,
          }),
        },
        token,
      );
      setHealthModal(false);
      setHealthDesc("");
      setHealthMedicine("");
      setHealthVet("");
      load();
    } catch (err: any) {
      showAlert("Error", err.message);
    } finally {
      setHealthSubmitting(false);
    }
  };

  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <View style={common.screen}>
      {/* Tabs */}
      <View style={s.tabBar}>
        {(["expenses", "health"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {tab === "expenses" ? (
                <CircleDollarSign size={14} color={activeTab === tab ? colors.brand : colors.textMuted} />
              ) : (
                <HeartPulse size={14} color={activeTab === tab ? colors.brand : colors.textMuted} />
              )}
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
                {tab === "expenses" ? "Expenses" : "Health Records"}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
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
            tintColor={colors.brand}
          />
        }
      >
        {activeTab === "expenses" ? (
          <>
            <View style={[common.row, { marginBottom: 12 }]}>
              <View>
                <Text style={common.sectionTitle}>Batch Expenses</Text>
                <Text style={common.sectionSubtitle}>
                  Total: ৳{totalExpenses.toLocaleString()}
                </Text>
              </View>
              {canManage && (
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => setExpModal(true)}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>
                    + Add
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Bar using Picker components */}
            <View style={{ marginBottom: 14 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: colors.textMuted,
                  marginBottom: 4,
                  textTransform: "uppercase",
                }}
              >
                Filter Expenses:
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                  }}
                >
                  <Picker
                    selectedValue={filterBatchId}
                    onValueChange={(val) => setFilterBatchId(val)}
                    style={{ color: colors.textMain }}
                    dropdownIconColor={colors.textMain}
                  >
                    <Picker.Item label="All Flocks" value="all" />
                    {batches.map((b) => (
                      <Picker.Item key={b._id} label={b.name} value={b._id} />
                    ))}
                  </Picker>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: "hidden",
                  }}
                >
                  <Picker
                    selectedValue={filterCategory}
                    onValueChange={(val) => setFilterCategory(val)}
                    style={{ color: colors.textMain }}
                    dropdownIconColor={colors.textMain}
                  >
                    <Picker.Item label="All Categories" value="all" />
                    {CATEGORIES.map((c) => (
                      <Picker.Item key={c} label={c.toUpperCase()} value={c} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            {(() => {
              const totalFeedExpAmount = expenses
                .filter((e) => e.category === "feed")
                .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
              const totalFeedExpKg = expenses
                .filter((e) => e.category === "feed")
                .reduce(
                  (acc, e) =>
                    acc + (Number(e.feedKg) || Number(e.feedBags) * 50 || 0),
                  0,
                );
              const avgFeedCostPerKg =
                totalFeedExpKg > 0 ? totalFeedExpAmount / totalFeedExpKg : 50;

              // Build feed consumption expense entries from daily logs
              const feedConsumptionEntries = dailyLogs
                .filter((l: any) => Number(l.feedGivenKg) > 0)
                .map((l: any) => {
                  const feedKg = Number(l.feedGivenKg) || 0;
                  const feedBags = Number((feedKg / 50).toFixed(1));
                  const amount = Math.round(feedKg * avgFeedCostPerKg);
                  const bId = String(l.batchId?._id || l.batchId);
                  return {
                    _id: `feed-consumed-${l._id}`,
                    batchId: bId,
                    date: l.date,
                    category: "feed_consumption",
                    amount: amount,
                    note: `🌾 Feed Consumed: ${feedKg} kg (${feedBags} bags @ ৳${avgFeedCostPerKg.toFixed(1)}/kg)`,
                    isFeedConsumption: true,
                    feedKg,
                    feedBags,
                  };
                });

              const combinedExpenses = [
                ...expenses,
                ...feedConsumptionEntries,
              ].sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              );

              const filteredList = combinedExpenses.filter((exp) => {
                const eBatchId =
                  typeof exp.batchId === "object"
                    ? String((exp.batchId as any)?._id)
                    : String(exp.batchId);
                if (
                  filterBatchId !== "all" &&
                  eBatchId !== String(filterBatchId)
                )
                  return false;
                if (filterCategory !== "all") {
                  if (filterCategory === "feed") {
                    if (
                      exp.category !== "feed" &&
                      exp.category !== "feed_consumption"
                    )
                      return false;
                  } else if (exp.category !== filterCategory) {
                    return false;
                  }
                }
                return true;
              });

              return (
                <>
                  {/* 🌾 BATCH FEED CONSUMPTION & COST SUMMARY CARDS (MOBILE) */}
                  <View
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      backgroundColor: "rgba(217, 164, 65, 0.08)",
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "rgba(217, 164, 65, 0.3)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "800",
                        color: colors.amber,
                        marginBottom: 8,
                      }}
                    >
                      🌾 Batch Feed Consumption Costs:
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {(filterBatchId === "all"
                        ? batches
                        : batches.filter((b) => b._id === filterBatchId)
                      ).map((b) => {
                        const bLogs = dailyLogs.filter(
                          (l) =>
                            String(l.batchId?._id || l.batchId) ===
                            String(b._id),
                        );
                        const totalFeedKg = bLogs.reduce(
                          (acc, l) => acc + (Number(l.feedGivenKg) || 0),
                          0,
                        );
                        const totalFeedBags = Number(
                          (totalFeedKg / 50).toFixed(1),
                        );
                        const consumedFeedCost = Math.round(
                          totalFeedKg * avgFeedCostPerKg,
                        );
                        const bFeedExpenses = expenses
                          .filter(
                            (e) =>
                              String(e.batchId?._id || e.batchId) ===
                                String(b._id) && e.category === "feed",
                          )
                          .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

                        return (
                          <View
                            key={b._id}
                            style={{
                              padding: 10,
                              backgroundColor: colors.surfaceElevated,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: colors.border,
                              minWidth: 180,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "800",
                                color: colors.textMain,
                              }}
                            >
                              🐔 {b.name}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "800",
                                color: colors.amber,
                                marginTop: 2,
                              }}
                            >
                              🌾 {totalFeedKg.toLocaleString()} kg{" "}
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: colors.textMuted,
                                }}
                              >
                                ({totalFeedBags} bags)
                              </Text>
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "900",
                                color: colors.brand,
                                marginTop: 2,
                              }}
                            >
                              ⚡ Cost: ৳{consumedFeedCost.toLocaleString()}
                            </Text>
                            <Text
                              style={{
                                fontSize: 10,
                                color: colors.textMuted,
                                marginTop: 1,
                              }}
                            >
                              Stock Purchased: ৳{bFeedExpenses.toLocaleString()}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {filteredList.length === 0 ? (
                    <Text>No matching expenses found.</Text>
                  ) : (
                    filteredList.map((exp) => {
                      const bObj = batches.find(
                        (b) =>
                          b._id === exp.batchId ||
                          b._id === (exp.batchId as any)?._id,
                      );
                      const isFeedIntake = exp.category === "feed_consumption";

                      return (
                        <View key={exp._id} style={[common.card]}>
                          <View style={common.row}>
                            <View
                              style={[
                                s.catBadge,
                                {
                                  backgroundColor: isFeedIntake
                                    ? "rgba(217,164,65,0.2)"
                                    : `${categoryColor[exp.category] || colors.amber}20`,
                                },
                              ]}
                            >
                              <Text
                                style={{
                                  color: isFeedIntake
                                    ? colors.amber
                                    : categoryColor[exp.category] ||
                                      colors.amber,
                                  fontSize: 10,
                                  fontWeight: "800",
                                  textTransform: "uppercase",
                                }}
                              >
                                {isFeedIntake
                                  ? "FEED CONSUMPTION"
                                  : exp.category}
                              </Text>
                            </View>
                            <Text
                              style={{
                                color: isFeedIntake
                                  ? colors.brand
                                  : colors.brand,
                                fontSize: 17,
                                fontWeight: "800",
                              }}
                            >
                              ৳{exp.amount.toLocaleString()}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                            <Bird size={12} color={colors.blue} />
                            <Text
                              style={{
                                color: colors.blue,
                                fontSize: 12,
                                fontWeight: "800",
                              }}
                            >
                              Flock: {bObj ? bObj.name : "All Flocks"}
                            </Text>
                          </View>

                          {exp.workerId && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <User size={11} color={colors.textMuted} />
                              <Text
                                style={{
                                  color: colors.textMuted,
                                  fontSize: 11,
                                  fontWeight: "700",
                                }}
                              >
                                Worker:{" "}
                                {typeof exp.workerId === "object"
                                  ? exp.workerId.name
                                  : exp.workerId}
                              </Text>
                            </View>
                          )}

                          {exp.category === "feed" && (exp as any).feedBags && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <Package size={11} color={colors.amber} />
                              <Text
                                style={{
                                  color: colors.amber,
                                  fontSize: 11,
                                  fontWeight: "800",
                                }}
                              >
                                Stock Purchased: {(exp as any).feedBags} Bags (
                                {(exp as any).feedKg ||
                                  (exp as any).feedBags * 50}{" "}
                                kg)
                              </Text>
                            </View>
                          )}

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <Calendar size={12} color={colors.textMuted} />
                            <Text
                              style={{
                                color: colors.textMuted,
                                fontSize: 12,
                              }}
                            >
                              {exp.date} {exp.note ? `• ${exp.note}` : ""}
                            </Text>
                          </View>

                          {!isFeedIntake && (
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "flex-end",
                                gap: 16,
                                marginTop: 8,
                                paddingTop: 8,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                              }}
                            >
                              <TouchableOpacity
                                onPress={() => openEditModal(exp)}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: "800",
                                    color: colors.blue,
                                  }}
                                >
                                  ✏️ Edit
                                </Text>
                              </TouchableOpacity>
                              {canManage && (
                                <TouchableOpacity
                                  onPress={() => handleDeleteExpense(exp._id)}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: "800",
                                      color: "#DC2626",
                                    }}
                                  >
                                    🗑️ Delete
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </>
              );
            })()}
          </>
        ) : (
          <>
            <View style={[common.row, { marginBottom: 16 }]}>
              <View>
                <Text style={common.sectionTitle}>Health Records</Text>
                <Text style={common.sectionSubtitle}>
                  {health.length} records
                </Text>
              </View>
              <TouchableOpacity
                style={s.addBtn}
                onPress={() => setHealthModal(true)}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {health.length === 0 ? (
              <Text>No health records yet.</Text>
            ) : (
              health.map((hr) => {
                const bObj = batches.find((b) => b._id === hr.batchId);
                return (
                  <View key={hr._id} style={common.card}>
                    <View style={common.row}>
                      <View
                        style={[
                          s.catBadge,
                          { backgroundColor: "rgba(16,185,129,0.15)" },
                        ]}
                      >
                        <Text
                          style={{
                            color: colors.brand,
                            fontSize: 11,
                            fontWeight: "700",
                            textTransform: "uppercase",
                          }}
                        >
                          {hr.type}
                        </Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        📅 {hr.date}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.blue,
                        fontSize: 11,
                        fontWeight: "700",
                        marginTop: 4,
                      }}
                    >
                      🐔 Flock: {bObj ? bObj.name : "—"}
                    </Text>
                    <Text
                      style={{
                        color: colors.textMain,
                        fontWeight: "600",
                        marginTop: 6,
                      }}
                    >
                      {hr.description}
                    </Text>
                    {hr.medicineUsed && (
                      <Text
                        style={{
                          color: colors.blue,
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        💊 {hr.medicineUsed}
                      </Text>
                    )}
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      👨‍⚕️ {hr.performedBy}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Expense Modal */}
      <Modal visible={expModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text
              style={{
                color: colors.textMain,
                fontSize: 18,
                fontWeight: "800",
                marginBottom: 16,
              }}
            >
              {expCategory === "feed"
                ? "🌾 Add Feed Stock Purchase"
                : "💸 Add Farm Expense"}
            </Text>

            <Text style={common.label}>Expense Category *</Text>
            <View style={s.pickerWrapper}>
              <Picker
                selectedValue={expCategory}
                onValueChange={(val) => setExpCategory(val)}
                dropdownIconColor={colors.textMain}
                style={s.pickerStyle}
              >
                <Picker.Item label="🌾 Feed Stock (খাবার Stock)" value="feed" />
                <Picker.Item
                  label="💊 Medicine (ঔষধ / ভ্যাকসিন)"
                  value="medicine"
                />
                <Picker.Item label="👷 Labor (শ্রমিক বেতন)" value="labor" />
                <Picker.Item
                  label="💡 Utility (বিদ্যুৎ / পানি)"
                  value="utility"
                />
                <Picker.Item
                  label="🔧 Equipment (যন্ত্রপাতি)"
                  value="equipment"
                />
                <Picker.Item label="📝 Other (অন্যান্য)" value="other" />
              </Picker>
            </View>

            <DatePickerInput
              label="Purchase / Expense Date *"
              value={expDate}
              onChange={setExpDate}
              style={{ marginBottom: 14 }}
            />

            {expCategory === "feed" ? (
              <View>
                <Text style={common.label}>Feed Category *</Text>
                <View style={[s.pickerWrapper, { borderColor: colors.amber }]}>
                  <Picker
                    selectedValue={feedCategory}
                    onValueChange={(val) => setFeedCategory(val)}
                    dropdownIconColor={colors.amber}
                    style={s.pickerStyle}
                  >
                    {activeFarm?.animalType === 'layer' ? (
                      <>
                        <Picker.Item label="Layer Starter" value="layer_starter" />
                        <Picker.Item label="Layer Grower" value="layer_grower" />
                        <Picker.Item label="Layer Layer-1" value="layer_layer_1" />
                      </>
                    ) : (
                      <>
                        <Picker.Item label="Broiler Starter" value="broiler_starter" />
                        <Picker.Item label="Broiler Grower" value="broiler_grower" />
                        <Picker.Item label="Broiler Finisher" value="broiler_finisher" />
                      </>
                    )}
                  </Picker>
                </View>

                <Text style={common.label}>Number of Bags (50kg/bag) *</Text>
                <TextInput
                  style={common.input}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#64748b"
                  value={stockBags}
                  onChangeText={setStockBags}
                />
                <Text
                  style={{
                    color: colors.secondary,
                    fontWeight: "700",
                    fontSize: 12,
                    marginBottom: 10,
                  }}
                >
                  = {(Number(stockBags || 0) * 50).toLocaleString()} kg feed
                  added
                </Text>

                <Text style={common.label}>Price per Bag (৳) *</Text>
                <TextInput
                  style={common.input}
                  keyboardType="numeric"
                  placeholder="2500"
                  placeholderTextColor="#64748b"
                  value={bagPrice}
                  onChangeText={setBagPrice}
                />
                <Text
                  style={{
                    color: colors.blue,
                    fontWeight: "800",
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                >
                  Total Cost: ৳
                  {(
                    Number(stockBags || 0) * Number(bagPrice || 0)
                  ).toLocaleString()}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={common.label}>Select Flock / Batch *</Text>
                <View style={s.pickerWrapper}>
                  <Picker
                    selectedValue={expBatchId}
                    onValueChange={(val) => setExpBatchId(val)}
                    dropdownIconColor={colors.textMain}
                    style={s.pickerStyle}
                  >
                    {batches.map((b) => (
                      <Picker.Item
                        key={b._id}
                        label={`🐔 ${b.name} (${b.breed})`}
                        value={b._id}
                      />
                    ))}
                  </Picker>
                </View>

                {expCategory === "labor" && (
                  <View>
                    <Text style={[common.label, { color: colors.blue }]}>
                      Select Assigned Worker / Laborer *
                    </Text>
                    {(() => {
                      const selectedBatch = batches.find(
                        (b) => b._id === expBatchId,
                      );
                      const batchWorkerIds = (
                        selectedBatch?.assignedWorkerIds || []
                      ).map((id: any) => String(id?._id || id));
                      const assignedWorkers = teamWorkers.filter((w) =>
                        batchWorkerIds.includes(String(w._id)),
                      );
                      return assignedWorkers.length > 0 ? (
                        <View
                          style={[
                            s.pickerWrapper,
                            { borderColor: colors.blue },
                          ]}
                        >
                          <Picker
                            selectedValue={expWorkerId}
                            onValueChange={(val) => setExpWorkerId(val)}
                            dropdownIconColor={colors.blue}
                            style={s.pickerStyle}
                          >
                            {assignedWorkers.map((w) => (
                              <Picker.Item
                                key={w._id}
                                label={`👷 ${w.name}`}
                                value={w._id}
                              />
                            ))}
                          </Picker>
                        </View>
                      ) : (
                        <View
                          style={{
                            padding: 10,
                            backgroundColor: "rgba(239,68,68,0.15)",
                            borderRadius: 8,
                            marginBottom: 14,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.rose,
                              fontSize: 13,
                              fontWeight: "700",
                            }}
                          >
                            ⚠️ No workers assigned to this batch. Please assign
                            a worker first.
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                )}

                <Text style={common.label}>Amount (BDT ৳) *</Text>
                <TextInput
                  style={common.input}
                  keyboardType="numeric"
                  placeholder="5000"
                  placeholderTextColor="#64748b"
                  value={expAmount}
                  onChangeText={setExpAmount}
                />
              </View>
            )}

            <Text style={common.label}>Notes / Vendor</Text>
            <TextInput
              style={common.input}
              placeholder="Receipt or vendor details..."
              placeholderTextColor="#64748b"
              value={expNote}
              onChangeText={setExpNote}
            />

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 40 }}>
              <TouchableOpacity
                style={[common.btnSecondary, { flex: 1 }]}
                onPress={() => setExpModal(false)}
              >
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[common.btn, { flex: 1 }]}
                onPress={handleCreateExpense}
                disabled={expSubmitting}
              >
                {expSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={common.btnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Health Modal */}
      <Modal visible={healthModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <Text
              style={{
                color: colors.textMain,
                fontSize: 18,
                fontWeight: "800",
                marginBottom: 16,
              }}
            >
              Add Health Record
            </Text>

            <Text style={common.label}>Select Flock / Batch *</Text>
            <View style={s.pickerWrapper}>
              <Picker
                selectedValue={healthBatchId}
                onValueChange={(val) => setHealthBatchId(val)}
                dropdownIconColor={colors.textMain}
                style={s.pickerStyle}
              >
                {batches.map((b) => (
                  <Picker.Item
                    key={b._id}
                    label={`🐔 ${b.name} (${b.breed})`}
                    value={b._id}
                  />
                ))}
              </Picker>
            </View>

            <DatePickerInput
              label="Record Date *"
              value={healthDate}
              onChange={setHealthDate}
              style={{ marginBottom: 14 }}
            />

            <Text style={common.label}>Health Record Type *</Text>
            <View style={s.pickerWrapper}>
              <Picker
                selectedValue={healthType}
                onValueChange={(val) => setHealthType(val)}
                dropdownIconColor={colors.textMain}
                style={s.pickerStyle}
              >
                <Picker.Item
                  label="💉 Vaccination (টিকা)"
                  value="vaccination"
                />
                <Picker.Item
                  label="🩺 Checkup (চিকিৎসা পরীক্ষা)"
                  value="checkup"
                />
                <Picker.Item label="💉 Injection (ইনজেকশন)" value="injection" />
                <Picker.Item label="💊 Treatment (চিকিৎসা)" value="treatment" />
              </Picker>
            </View>

            <Text style={common.label}>Description *</Text>
            <TextInput
              style={common.input}
              placeholder="e.g. Gumboro Vaccine 1st Dose"
              placeholderTextColor="#64748b"
              value={healthDesc}
              onChangeText={setHealthDesc}
            />

            <Text style={common.label}>Medicine Used</Text>
            <TextInput
              style={common.input}
              placeholder="Vaccine/Medicine Name"
              placeholderTextColor="#64748b"
              value={healthMedicine}
              onChangeText={setHealthMedicine}
            />

            <Text style={common.label}>Performed By (Vet/Staff) *</Text>
            <TextInput
              style={common.input}
              placeholder="Dr. Rahat / Staff Name"
              placeholderTextColor="#64748b"
              value={healthVet}
              onChangeText={setHealthVet}
            />

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 40 }}>
              <TouchableOpacity
                style={[common.btnSecondary, { flex: 1 }]}
                onPress={() => setHealthModal(false)}
              >
                <Text style={common.btnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[common.btn, { flex: 1 }]}
                onPress={handleCreateHealth}
                disabled={healthSubmitting}
              >
                {healthSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={common.btnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* EDIT EXPENSE MODAL */}
      <Modal visible={editExpModal} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text>✏️ Edit Expense Record</Text>
              <TouchableOpacity
                onPress={() => setEditExpModal(false)}
                style={{ padding: 4 }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    color: colors.textMuted,
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={common.label}>Target Flock / Batch</Text>
              <View style={s.pickerWrapper}>
                <Picker
                  selectedValue={expBatchId}
                  onValueChange={(val) => setExpBatchId(val)}
                  dropdownIconColor={colors.textMain}
                  style={s.pickerStyle}
                >
                  {batches.map((b) => (
                    <Picker.Item key={b._id} label={b.name} value={b._id} />
                  ))}
                </Picker>
              </View>

              <Text style={common.label}>Category</Text>
              <View style={s.pickerWrapper}>
                <Picker
                  selectedValue={expCategory}
                  onValueChange={(val) => setExpCategory(val)}
                  dropdownIconColor={colors.textMain}
                  style={s.pickerStyle}
                >
                  {CATEGORIES.map((c) => (
                    <Picker.Item key={c} label={c.toUpperCase()} value={c} />
                  ))}
                </Picker>
              </View>

              <Text style={common.label}>Amount (৳) *</Text>
              <TextInput
                style={common.input}
                keyboardType="numeric"
                value={expAmount}
                onChangeText={setExpAmount}
              />

              <DatePickerInput
                label="Date *"
                value={expDate}
                onChange={setExpDate}
              />

              <Text style={common.label}>Notes</Text>
              <TextInput
                style={common.input}
                value={expNote}
                onChangeText={setExpNote}
              />

              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  marginTop: 16,
                  marginBottom: 20,
                }}
              >
                <TouchableOpacity
                  style={[common.btnSecondary, { flex: 1 }]}
                  onPress={() => setEditExpModal(false)}
                >
                  <Text style={common.btnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[common.btn, { flex: 1 }]}
                  onPress={handleUpdateExpense}
                  disabled={expSubmitting}
                >
                  {expSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={common.btnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  tabBar: { flexDirection: "row", backgroundColor: colors.surface, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: colors.brand },
  addBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    marginBottom: 14,
    justifyContent: "center",
    overflow: "hidden",
  },
  pickerStyle: {
    color: colors.textMain,
    height: 50,
  },
});
