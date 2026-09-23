import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useDrawer } from "../context/DrawerContext";
import { colors, STATUS_BAR_PADDING } from "../styles";
import {
  LayoutDashboard,
  Bird,
  ClipboardList,
  Tag,
  CircleDollarSign,
  BarChart3,
  Users,
  User,
  Wheat,
  Activity,
  LogOut,
  ChevronRight,
  Egg,
  Building2,
  X,
} from "lucide-react-native";

interface DrawerItem {
  label: string;
  icon: React.FC<any>;
  route: string;
  screen?: string;
  hideForWorker?: boolean;
}

const drawerItems: DrawerItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, route: "Main", screen: "Dashboard" },
  { label: "Flocks & Batches", icon: Bird, route: "Main", screen: "Batches" },
  { label: "Daily Log", icon: ClipboardList, route: "Main", screen: "Daily Log" },
  { label: "Sales & Revenue", icon: Tag, route: "Main", screen: "Sales", hideForWorker: true },
  { label: "Expenses & Health", icon: CircleDollarSign, route: "Main", screen: "Expenses", hideForWorker: true },
  { label: "Feed Stock History", icon: Wheat, route: "FeedStockHistory", hideForWorker: true },
  { label: "Reports & Analytics", icon: BarChart3, route: "Reports", hideForWorker: true },
  { label: "Activity Log", icon: Activity, route: "ActivityLog" },
  { label: "Team Management", icon: Users, route: "Team", hideForWorker: true },
  { label: "Profile & Settings", icon: User, route: "Profile" },
];

interface DrawerContentProps {
  navigation?: any;
  onClose?: () => void;
}

export const DrawerContent: React.FC<DrawerContentProps> = ({ navigation, onClose }) => {
  const { user, activeFarm, logout } = useAuth();
  const { closeDrawer } = useDrawer();
  const isWorker = user?.role === "worker";
  const isLayerFarm = activeFarm?.animalType === "layer";

  const handleClose = () => {
    if (onClose) onClose();
    closeDrawer();
  };

  const visibleItems = drawerItems.filter(
    (item) => !(item.hideForWorker && isWorker)
  );

  const handleNavigate = (item: DrawerItem) => {
    handleClose();
    if (navigation) {
      if (item.screen) {
        navigation.navigate(item.route, { screen: item.screen });
      } else {
        navigation.navigate(item.route);
      }
    }
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
  };

  const handleSwitchFirm = () => {
    handleClose();
    if (navigation) {
      navigation.reset({
        index: 0,
        routes: [{ name: "FirmSelection" }],
      });
    }
  };

  const roleBadgeColor: Record<string, string> = {
    owner: colors.brand,
    manager: colors.blue,
    worker: colors.secondary,
  };

  return (
    <View style={s.container}>
      {/* User Profile Header */}
      <View style={s.profileSection}>
        <View style={s.avatarContainer}>
          <View style={s.avatar}>
            <User size={28} color={colors.surface} />
          </View>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={handleClose}
          >
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={s.userName} numberOfLines={1}>
          {user?.name || "Farmer"}
        </Text>
        <Text style={s.userEmail} numberOfLines={1}>
          {user?.email || user?.phone || "No contact info"}
        </Text>

        <View style={s.badgeRow}>
          <View
            style={[
              s.roleBadge,
              {
                backgroundColor: `${
                  roleBadgeColor[user?.role || "worker"]
                }20`,
              },
            ]}
          >
            <Text
              style={[
                s.roleBadgeText,
                { color: roleBadgeColor[user?.role || "worker"] },
              ]}
            >
              {(user?.role || "Worker").toUpperCase()}
            </Text>
          </View>

          <View style={s.appVersionBadge}>
            <Text style={s.appVersionText}>v1.1.0</Text>
          </View>
        </View>
      </View>

      {/* Active Farm Card with Quick Switcher */}
      {activeFarm && (
        <View style={s.farmCard}>
          <View style={s.farmCardHeader}>
            <View style={s.farmIconWrapper}>
              {isLayerFarm ? (
                <Egg size={16} color={colors.brand} />
              ) : (
                <Bird size={16} color={colors.amber} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.farmLabel}>ACTIVE FARM</Text>
              <Text style={s.farmName} numberOfLines={1}>
                {activeFarm.name}
              </Text>
            </View>
          </View>

          <View style={s.farmCardFooter}>
            <Text style={s.farmTypeText}>
              {isLayerFarm ? "Layer Egg Farm" : "Broiler Meat Farm"}
              {activeFarm.location ? ` • ${activeFarm.location}` : ""}
            </Text>
            <TouchableOpacity
              style={s.switchFirmBtn}
              onPress={handleSwitchFirm}
            >
              <Building2 size={12} color={colors.brand} />
              <Text style={s.switchFirmText}>Switch</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Navigation Items */}
      <ScrollView
        style={s.menuScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        <Text style={s.sectionHeader}>MAIN NAVIGATION</Text>

        {visibleItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <TouchableOpacity
              key={index}
              style={s.navItem}
              onPress={() => handleNavigate(item)}
              activeOpacity={0.7}
            >
              <View style={s.navItemIconWrapper}>
                <Icon size={18} color={colors.textMain} />
              </View>
              <Text style={s.navItemLabel}>{item.label}</Text>
              <ChevronRight size={14} color={colors.border} />
            </TouchableOpacity>
          );
        })}

        {/* Quick Stats / Info Footer inside drawer */}
        <View style={s.drawerInfoBox}>
          <Text style={s.drawerInfoTitle}>PoultryDex</Text>
          <Text style={s.drawerInfoSub}>
            Smart Poultry & Farm Operations Management
          </Text>
        </View>
      </ScrollView>

      {/* Logout Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <LogOut size={16} color={colors.rose} />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: STATUS_BAR_PADDING + 8,
    paddingBottom: 16,
    backgroundColor: colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMain,
  },
  userEmail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  appVersionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appVersionText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  farmCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  farmCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  farmIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  farmLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  farmName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.textMain,
  },
  farmCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  farmTypeText: {
    fontSize: 11,
    color: colors.textMuted,
    flex: 1,
  },
  switchFirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(199, 81, 31, 0.1)",
    borderRadius: 6,
  },
  switchFirmText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
  },
  menuScroll: {
    flex: 1,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 3,
  },
  navItemIconWrapper: {
    width: 30,
    alignItems: "center",
    marginRight: 10,
  },
  navItemLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMain,
  },
  drawerInfoBox: {
    marginHorizontal: 8,
    marginTop: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  drawerInfoTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.brand,
  },
  drawerInfoSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "rgba(178, 58, 47, 0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(178, 58, 47, 0.2)",
  },
  logoutText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.rose,
  },
});
