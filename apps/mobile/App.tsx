import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StatusBar, ActivityIndicator } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { BatchesScreen } from './src/screens/BatchesScreen';
import { DailyLogScreen } from './src/screens/DailyLogScreen';
import { ExpensesScreen } from './src/screens/ExpensesScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { TeamScreen } from './src/screens/TeamScreen';
import { BatchDashboardScreen } from './src/screens/BatchDashboardScreen';
import { DailyReportScreen } from './src/screens/DailyReportScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Dashboard: '🏠',
  Batches: '🐔',
  'Daily Log': '📋',
  Expenses: '💰',
  Reports: '📊',
  Team: '👥',
};

function MainTabs() {
  const { user } = useAuth();
  const isWorker = user?.role === 'worker';

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.55 }}>
              {TAB_ICONS[route.name] || '●'}
            </Text>
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={{
              fontSize: 9, fontWeight: focused ? '800' : '500',
              color: focused ? '#C7511F' : '#6B655C',
              marginBottom: 2, textAlign: 'center'
            }}>
              {route.name}
            </Text>
          ),
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E8E2D8',
            borderTopWidth: 1,
            height: 72,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#C7511F',
          tabBarInactiveTintColor: '#6B655C',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Batches" component={BatchesScreen} />
        <Tab.Screen name="Daily Log" component={DailyLogScreen} />

        {!isWorker && <Tab.Screen name="Expenses" component={ExpensesScreen} />}
        {!isWorker && <Tab.Screen name="Reports" component={ReportsScreen} />}
        {!isWorker && <Tab.Screen name="Team" component={TeamScreen} />}
      </Tab.Navigator>
    </View>
  );
}

function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAF7F2', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🐔</Text>
        <ActivityIndicator size="large" color="#C7511F" />
        <Text style={{ color: '#6B655C', marginTop: 12, fontWeight: '600' }}>Loading PoultryOps...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="BatchDashboard" component={BatchDashboardScreen} />
          <Stack.Screen name="DailyReport" component={DailyReportScreen} />
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
        <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" translucent={false} />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
