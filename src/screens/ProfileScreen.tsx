import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { apiFetch, showAlert } from "../config";
import { colors, common, STATUS_BAR_PADDING } from "../styles";
import {
  User,
  Mail,
  Phone,
  Shield,
  Lock,
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  Building2,
  Calendar,
} from "lucide-react-native";

export const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const { user, token, activeFarm, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) return showAlert("Error", "Name is required");
    setSaving(true);
    try {
      const body: any = { name: name.trim() };
      if (email.trim()) body.email = email.trim();
      if (phone.trim()) body.phone = phone.trim();
      const res = await apiFetch(
        `/users/me`,
        { method: "PUT", body: JSON.stringify(body) },
        token!,
        activeFarm?._id
      );
      if (updateUser && res) {
        updateUser({ ...user, ...body });
      }
      showAlert("Success", "Profile updated successfully");
    } catch (e: any) {
      showAlert("Error", e.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) return showAlert("Error", "Enter your current password");
    if (!newPassword || newPassword.length < 6) return showAlert("Error", "New password must be at least 6 characters");
    if (newPassword !== confirmNewPassword) return showAlert("Error", "New passwords do not match");

    setSavingPassword(true);
    try {
      await apiFetch(
        `/users/me/password`,
        {
          method: "PUT",
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        token!,
        activeFarm?._id
      );
      showAlert("Success", "Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowPasswordSection(false);
    } catch (e: any) {
      showAlert("Error", e.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const roleBadgeColor: Record<string, string> = {
    owner: colors.brand,
    manager: colors.blue,
    worker: colors.secondary,
  };

  return (
    <View style={common.screen}>
      {/* Header */}
      <View style={s.topHeader}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={16} color={colors.brand} />
        </TouchableOpacity>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={s.headerTitle}>Profile & Settings</Text>
          <Text style={s.headerSub}>Manage your account</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={common.scrollContent}>
        {/* Avatar Card */}
        <View style={s.avatarCard}>
          <View style={s.avatar}>
            <User size={32} color={colors.surface} />
          </View>
          <Text style={s.avatarName}>{user?.name || "User"}</Text>
          <View style={[s.roleBadge, { backgroundColor: `${roleBadgeColor[user?.role || "worker"]}14` }]}>
            <Shield size={10} color={roleBadgeColor[user?.role || "worker"]} />
            <Text style={[s.roleText, { color: roleBadgeColor[user?.role || "worker"] }]}>
              {(user?.role || "worker").toUpperCase()}
            </Text>
          </View>
          <View style={s.farmInfo}>
            <Building2 size={12} color={colors.textMuted} />
            <Text style={s.farmText}>{activeFarm?.name || "No Firm Selected"}</Text>
          </View>
        </View>

        {/* Profile Form */}
        <View style={common.card}>
          <Text style={s.sectionTitle}>Personal Information</Text>

          <Text style={s.label}>Full Name</Text>
          <View style={s.inputRow}>
            <User size={14} color={colors.textMuted} />
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={s.label}>Email Address</Text>
          <View style={s.inputRow}>
            <Mail size={14} color={colors.textMuted} />
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={s.label}>Phone Number</Text>
          <View style={s.inputRow}>
            <Phone size={14} color={colors.textMuted} />
            <TextInput
              style={s.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity
            style={common.btn}
            onPress={handleSaveProfile}
            disabled={saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Save size={14} color={colors.surface} />
                <Text style={common.btnText}>Save Changes</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Password Section */}
        <View style={common.card}>
          <TouchableOpacity
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            onPress={() => setShowPasswordSection(!showPasswordSection)}
            activeOpacity={0.7}
          >
            <Text style={s.sectionTitle}>Change Password</Text>
            <View style={[s.toggleChip, showPasswordSection && { backgroundColor: `${colors.brand}14` }]}>
              <Lock size={11} color={showPasswordSection ? colors.brand : colors.textMuted} />
              <Text style={{ fontSize: 10, fontWeight: "700", color: showPasswordSection ? colors.brand : colors.textMuted }}>
                {showPasswordSection ? "HIDE" : "SHOW"}
              </Text>
            </View>
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={{ marginTop: 14 }}>
              <Text style={s.label}>Current Password</Text>
              <View style={s.inputRow}>
                <Lock size={14} color={colors.textMuted} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showCurrentPwd}
                />
                <TouchableOpacity onPress={() => setShowCurrentPwd(!showCurrentPwd)}>
                  {showCurrentPwd ? (
                    <EyeOff size={16} color={colors.textMuted} />
                  ) : (
                    <Eye size={16} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={s.label}>New Password</Text>
              <View style={s.inputRow}>
                <Lock size={14} color={colors.textMuted} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min 6 chars)"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showNewPwd}
                />
                <TouchableOpacity onPress={() => setShowNewPwd(!showNewPwd)}>
                  {showNewPwd ? (
                    <EyeOff size={16} color={colors.textMuted} />
                  ) : (
                    <Eye size={16} color={colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={s.label}>Confirm New Password</Text>
              <View style={s.inputRow}>
                <Lock size={14} color={colors.textMuted} />
                <TextInput
                  style={s.input}
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[common.btn, { backgroundColor: colors.secondary }]}
                onPress={handleChangePassword}
                disabled={savingPassword}
                activeOpacity={0.7}
              >
                {savingPassword ? (
                  <ActivityIndicator color={colors.surface} size="small" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Lock size={14} color={colors.surface} />
                    <Text style={common.btnText}>Change Password</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
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
  avatarCard: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarName: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.textMain,
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 10,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  farmInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  farmText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.textMain,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMain,
    padding: 0,
  },
  toggleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
