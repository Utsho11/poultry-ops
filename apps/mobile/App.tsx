import React, { useRef } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, StatusBar, ActivityIndicator } from "react-native";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { DrawerProvider } from "./src/context/DrawerContext";
import { CustomDrawer } from "./src/components/CustomDrawer";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { BatchesScreen } from "./src/screens/BatchesScreen";
import { DailyLogScreen } from "./src/screens/DailyLogScreen";
import { ExpensesScreen } from "./src/screens/ExpensesScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { TeamScreen } from "./src/screens/TeamScreen";
import { BatchDashboardScreen } from "./src/screens/BatchDashboardScreen";
import { DailyReportScreen } from "./src/screens/DailyReportScreen";
import { SalesScreen } from "./src/screens/SalesScreen";
import { FirmSelectionScreen } from "./src/screens/FirmSelectionScreen";
import { FeedStockHistoryScreen } from "./src/screens/FeedStockHistoryScreen";
import { ActivityLogScreen } from "./src/screens/ActivityLogScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { FirmHeader } from "./src/components/FirmHeader";
import { colors } from "./src/styles";

import {
  LayoutDashboard,
  Bird,
  ClipboardList,
  Tag,
  CircleDollarSign,
  BarChart3,
  Users,
} from "lucide-react-native";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef<any>();

function renderTabIcon(routeName: string, focused: boolean) {
  const color = focused ? colors.brand : colors.textMuted;
  const size = focused ? 22 : 18;

  switch (routeName) {
    case "Dashboard":
      return <LayoutDashboard size={size} color={color} />;
    case "Batches":
      return <Bird size={size} color={color} />;
    case "Daily Log":
      return <ClipboardList size={size} color={color} />;
    case "Sales":
      return <Tag size={size} color={color} />;
    case "Expenses":
      return <CircleDollarSign size={size} color={color} />;
    default:
      return <LayoutDashboard size={size} color={color} />;
  }
}

function MainTabs() {
  const { user } = useAuth();
  const isWorker = user?.role === "worker";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FirmHeader />
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => renderTabIcon(route.name, focused),
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                fontSize: 10,
                fontWeight: focused ? "800" : "600",
                color: focused ? colors.brand : colors.textMuted,
                marginBottom: 3,
                textAlign: "center",
              }}
            >
              {route.name === "Batches" ? "Flocks" : route.name}
            </Text>
          ),
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 68,
            paddingTop: 6,
          },
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.textMuted,
          headerShown: false,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Batches" component={BatchesScreen} />
        <Tab.Screen name="Daily Log" component={DailyLogScreen} />

        {!isWorker && <Tab.Screen name="Sales" component={SalesScreen} />}
        {!isWorker && <Tab.Screen name="Expenses" component={ExpensesScreen} />}
      </Tab.Navigator>
    </View>
  );
}

function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={{ color: colors.textMuted, marginTop: 12, fontWeight: "600" }}>
          Loading PoultryDex...
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="FirmSelection" component={FirmSelectionScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="BatchDashboard"
            component={BatchDashboardScreen}
          />
          <Stack.Screen name="DailyReport" component={DailyReportScreen} />
          <Stack.Screen
            name="FeedStockHistory"
            component={FeedStockHistoryScreen}
          />
          <Stack.Screen
            name="ActivityLog"
            component={ActivityLogScreen}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
          />
          <Stack.Screen
            name="Batches"
            component={BatchesScreen}
          />
          <Stack.Screen
            name="Sales"
            component={SalesScreen}
          />
          <Stack.Screen
            name="Expenses"
            component={ExpensesScreen}
          />
          <Stack.Screen
            name="Reports"
            component={ReportsScreen}
          />
          <Stack.Screen
            name="Team"
            component={TeamScreen}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DrawerProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor="transparent"
            translucent
          />
          <AppNavigator />
          <CustomDrawer navigation={navigationRef} />
        </NavigationContainer>
      </DrawerProvider>
    </AuthProvider>
  );
}
