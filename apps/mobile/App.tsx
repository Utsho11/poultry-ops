import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, StatusBar, ActivityIndicator } from "react-native";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

import {
  LayoutDashboard,
  Bird,
  ClipboardList,
  Tag,
  CircleDollarSign,
  BarChart3,
  Users,
} from "lucide-react-native";
import { FirmHeader } from "./src/components/FirmHeader";

function renderTabIcon(routeName: string, focused: boolean) {
  const color = focused ? "#C7511F" : "#6B655C";
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
    case "Reports":
      return <BarChart3 size={size} color={color} />;
    case "Team":
      return <Users size={size} color={color} />;
    default:
      return <LayoutDashboard size={size} color={color} />;
  }
}

function MainTabs() {
  const { user } = useAuth();
  const isWorker = user?.role === "worker";

  return (
    <View style={{ flex: 1, backgroundColor: "#FAF7F2" }}>
      <FirmHeader />
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => renderTabIcon(route.name, focused),
          tabBarLabel: ({ focused }) => (
            <Text
              style={{
                fontSize: 9,
                fontWeight: focused ? "800" : "500",
                color: focused ? "#C7511F" : "#6B655C",
                marginBottom: 2,
                textAlign: "center",
              }}
            >
              {route.name}
            </Text>
          ),
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#E8E2D8",
            borderTopWidth: 1,
            height: 72,
            paddingTop: 8,
          },
          tabBarActiveTintColor: "#C7511F",
          tabBarInactiveTintColor: "#6B655C",
          headerShown: false,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Daily Log" component={DailyLogScreen} />

        {!isWorker && <Tab.Screen name="Sales" component={SalesScreen} />}
        {!isWorker && <Tab.Screen name="Expenses" component={ExpensesScreen} />}
        {!isWorker && <Tab.Screen name="Reports" component={ReportsScreen} />}
        {!isWorker && <Tab.Screen name="Team" component={TeamScreen} />}
      </Tab.Navigator>
    </View>
  );
}

import { FirmSelectionScreen } from "./src/screens/FirmSelectionScreen";

function AppNavigator() {
  const { isAuthenticated, activeFarm, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FAF7F2",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🐔</Text>
        <ActivityIndicator size="large" color="#C7511F" />
        <Text style={{ color: "#6B655C", marginTop: 12, fontWeight: "600" }}>
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
          <Stack.Screen name="Sales" component={SalesScreen} />
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
      <NavigationContainer>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FAF7F2"
          translucent={false}
        />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
