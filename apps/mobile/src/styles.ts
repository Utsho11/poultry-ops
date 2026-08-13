import { StyleSheet, Platform, StatusBar } from "react-native";

export const STATUS_BAR_PADDING =
  Platform.OS === "android"
    ? (StatusBar.currentHeight || 28) + 8
    : Platform.OS === "ios"
    ? 48
    : 16;

export const colors = {
  bg: "#FAF7F2", // Warm off-white background
  surface: "#FFFFFF", // Clean white cards
  surfaceElevated: "#F4EFE6", // Warm soft beige surface
  brand: "#C7511F", // Rustic terracotta/rust orange
  brandDark: "#8B3A0E", // Darker rust
  secondary: "#4A7C59", // Muted sage/forest green (growth/health)
  amber: "#D9A441", // Mustard/amber (feed, grain)
  rose: "#B23A2F", // Muted brick red (dead count/alerts)
  blue: "#3D6B8C", // Dusty blue (info)
  purple: "#C7511F",
  textMain: "#2D2A26", // Near-black warm charcoal
  textMuted: "#6B655C", // Muted brown-gray
  border: "#E8E2D8", // Warm light beige border
  text: "#2D2A26",
};

export const common = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#2D2A26",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#2D2A26",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    marginBottom: 4,
  },
  statValue: {
    color: colors.textMain,
    fontSize: 20,
    fontWeight: "800" as const,
  },
  statSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  label: {
    color: colors.textMain,
    fontSize: 14,
    fontWeight: "700" as const,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.textMain,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    backgroundColor: colors.brand,
    padding: 14,
    borderRadius: 10,
    alignItems: "center" as const,
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    gap: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  btnSecondary: {
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    borderRadius: 10,
    alignItems: "center" as const,
  },
  btnSecondaryText: {
    color: colors.textMain,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  sectionTitle: {
    color: colors.textMain,
    fontSize: 22,
    fontWeight: "800" as const,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 11,
    fontWeight: "700" as const,
  },
});
