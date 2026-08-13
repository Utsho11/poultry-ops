import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar
} from "react-native";
import { useAuth, IFirm } from "../context/AuthContext";
import { useDrawer } from "../context/DrawerContext";
import { apiFetch, showAlert } from "../config";
import { colors, STATUS_BAR_PADDING } from "../styles";
import { CreateFirmModal } from "./CreateFirmModal";

import {
  Egg,
  Bird,
  ChevronDown,
  Building2,
  Plus,
  X,
  Menu,
} from "lucide-react-native";

export const FirmHeader: React.FC = () => {
  const { token, activeFarm, switchFarm } = useAuth();
  const { toggleDrawer } = useDrawer();
  const [modalVisible, setModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [firmList, setFirmList] = useState<IFirm[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFirms = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch("/farms", {}, token);
      setFirmList(data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPicker = () => {
    setModalVisible(true);
    fetchFirms();
  };

  const handleSelectFirm = async (firm: IFirm) => {
    try {
      const data = await apiFetch(
        "/auth/switch-firm",
        {
          method: "POST",
          body: JSON.stringify({ farmId: firm._id }),
        },
        token,
      );
      await switchFarm(firm, data.accessToken);
      setModalVisible(false);
    } catch (err: any) {
      showAlert("Error", err.message);
    }
  };

  return (
    <View style={s.container}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {/* Hamburger Menu Button */}
        <TouchableOpacity
          style={s.menuBtn}
          onPress={toggleDrawer}
          activeOpacity={0.7}
        >
          <Menu size={18} color={colors.textMain} />
        </TouchableOpacity>

        {/* Farm Badge */}
        <TouchableOpacity
          style={[s.firmBadge, { flex: 1 }]}
          onPress={handleOpenPicker}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {activeFarm?.animalType === "layer" ? (
              <Egg size={18} color={colors.brand} />
            ) : (
              <Bird size={18} color={colors.amber} />
            )}
            <View>
              <Text style={s.firmName} numberOfLines={1}>
                {activeFarm?.name || "Select Firm"}
              </Text>
              <Text style={s.firmType}>
                {activeFarm?.animalType
                  ? `${activeFarm.animalType.toUpperCase()} FARM`
                  : "FIRM"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: colors.brand, fontSize: 12, fontWeight: "800" }}>
              Switch
            </Text>
            <ChevronDown size={14} color={colors.brand} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Firm Switcher Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Building2 size={20} color={colors.brand} />
                <Text style={s.modalTitle}>Your Firms / Farms</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={colors.brand}
                style={{ marginVertical: 20 }}
              />
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {firmList.map((firm) => {
                  const isActive = activeFarm?._id === firm._id;
                  return (
                    <TouchableOpacity
                      key={firm._id}
                      style={[s.firmItem, isActive && s.firmItemActive]}
                      onPress={() => handleSelectFirm(firm)}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          flex: 1,
                        }}
                      >
                        {firm.animalType === "layer" ? (
                          <Egg size={20} color={colors.brand} />
                        ) : (
                          <Bird size={20} color={colors.amber} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              s.firmItemTitle,
                              isActive && { color: colors.brand },
                            ]}
                          >
                            {firm.name}
                          </Text>
                          <Text style={s.firmItemSub}>
                            {firm.animalType?.toUpperCase()} |{" "}
                            {firm.location || "No Location"}
                          </Text>
                        </View>
                      </View>
                      {isActive && <Text style={s.activeBadge}>ACTIVE</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={s.createBtn}
              onPress={() => {
                setModalVisible(false);
                setCreateModalVisible(true);
              }}
            >
              <Plus size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={s.createBtnText}>Create New Firm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CreateFirmModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: STATUS_BAR_PADDING,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  menuBtn: {
    backgroundColor: colors.surfaceElevated,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  firmBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  firmName: { fontSize: 14, fontWeight: "800", color: colors.textMain },
  firmType: { fontSize: 10, fontWeight: "700", color: colors.brand },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.textMain },
  firmItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  firmItemActive: {
    borderColor: colors.brand,
    backgroundColor: "rgba(199, 81, 31, 0.08)",
  },
  firmItemTitle: { fontSize: 14, fontWeight: "800", color: colors.textMain },
  firmItemSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  activeBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brand,
    backgroundColor: "rgba(199, 81, 31, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  createBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 10,
  },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
