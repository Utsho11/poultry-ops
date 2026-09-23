import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { apiFetch, showAlert } from "../config";
import { colors, common } from "../styles";
import { DatePickerInput } from "./DatePickerInput";
import { Plus, X, Egg, Bird, KeyRound, Eye, EyeOff } from "lucide-react-native";

interface CreateBatchModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newBatch?: any) => void;
}

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { token, activeFarm } = useAuth();

  const isLayerFarm = activeFarm?.animalType === "layer";

  const [batchName, setBatchName] = useState("");
  const [breed, setBreed] = useState(
    isLayerFarm ? "Hy-Line Brown" : "Cobb 500",
  );
  const [initialCount, setInitialCount] = useState("1000");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setBatchName("");
      setBreed(isLayerFarm ? "Hy-Line Brown" : "Cobb 500");
      setInitialCount("1000");
      setStartDate(new Date().toISOString().split("T")[0]);
      setPassword("");
      setShowPassword(false);
    }
  }, [visible, isLayerFarm]);

  const handleSubmit = async () => {
    if (!activeFarm?._id) {
      showAlert(
        "Farm Required",
        "Please select or create a firm from the top switcher first.",
      );
      return;
    }

    const trimmedName = batchName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      showAlert(
        "Validation Error",
        "Batch name must be at least 2 characters.",
      );
      return;
    }

    const trimmedBreed = breed.trim();
    if (!trimmedBreed) {
      showAlert(
        "Validation Error",
        "Breed is required (e.g. Cobb 500 or Hy-Line Brown).",
      );
      return;
    }

    const countNum = Number(initialCount);
    if (!initialCount || isNaN(countNum) || countNum <= 0) {
      showAlert(
        "Validation Error",
        "Initial bird count must be a positive number.",
      );
      return;
    }

    if (!startDate) {
      showAlert("Validation Error", "Start date is required (YYYY-MM-DD).");
      return;
    }

    if (!password) {
      showAlert(
        "Security Check",
        "Please enter your account password to confirm flock creation.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: trimmedName,
        breed: trimmedBreed,
        type: isLayerFarm ? "layer" : "broiler",
        startDate,
        initialCount: countNum,
        password,
      };

      const created = await apiFetch(
        "/batches",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        token,
        activeFarm?._id,
      );

      showAlert("Success", `Flock '${trimmedName}' created successfully!`);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      showAlert(
        "Creation Failed",
        err.message || "Failed to create flock. Please check your password.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Header */}
          <View style={s.headerRow}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View style={s.iconBox}>
                <Plus size={18} color="#fff" />
              </View>
              <Text style={s.title}>New Bird Flock</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 480 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Batch Name */}
            <Text style={common.label}>Flock / Batch Name *</Text>
            <TextInput
              style={common.input}
              placeholder="e.g. Flock 2026-A"
              placeholderTextColor={colors.textMuted}
              value={batchName}
              onChangeText={setBatchName}
            />

            {/* Breed */}
            <Text style={common.label}>Breed *</Text>
            <TextInput
              style={common.input}
              placeholder="e.g. Cobb 500, Hy-Line Brown"
              placeholderTextColor={colors.textMuted}
              value={breed}
              onChangeText={setBreed}
            />

            {/* Firm Type Auto Display */}
            <View style={s.firmTypeBox}>
              {isLayerFarm ? (
                <Egg size={16} color={colors.brand} />
              ) : (
                <Bird size={16} color={colors.brand} />
              )}
              <Text style={s.firmTypeText}>
                {isLayerFarm
                  ? "LAYER FLOCK (EGG PRODUCTION)"
                  : "BROILER FLOCK (MEAT PRODUCTION)"}
              </Text>
            </View>

            {/* Initial Bird Count */}
            <Text style={common.label}>Initial Birds Count *</Text>
            <TextInput
              style={common.input}
              keyboardType="numeric"
              placeholder="1000"
              placeholderTextColor={colors.textMuted}
              value={initialCount}
              onChangeText={setInitialCount}
            />

            {/* Start Date */}
            <DatePickerInput
              label="Start Date *"
              value={startDate}
              onChange={setStartDate}
              style={{ marginBottom: 14 }}
            />

            {/* Account Password Confirmation */}
            <Text style={common.label}>
              Account Password (Security Verification) *
            </Text>
            <View style={{ position: "relative", marginBottom: 14 }}>
              <TextInput
                style={[common.input, { paddingRight: 42, marginBottom: 0 }]}
                secureTextEntry={!showPassword}
                placeholder="Enter account password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={s.eyeBtn}
              >
                {showPassword ? (
                  <Eye size={18} color={colors.textMuted} />
                ) : (
                  <EyeOff size={18} color={colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Plus size={16} color="#fff" />
                  <Text style={s.submitBtnText}>Create Flock</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(45, 42, 38, 0.65)",
    justifyContent: "center",
    padding: 16,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: "90%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBox: {
    backgroundColor: colors.brand,
    padding: 6,
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMain,
  },
  firmTypeBox: {
    backgroundColor: colors.surfaceElevated,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  firmTypeText: {
    color: colors.brand,
    fontWeight: "800",
    fontSize: 12,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 14,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.textMain,
    fontWeight: "700",
    fontSize: 15,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.brand,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  submitBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});
