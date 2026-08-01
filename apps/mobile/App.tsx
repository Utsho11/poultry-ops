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
import { RemindersScreen } from './src/screens/RemindersScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { TeamScreen } from './src/screens/TeamScreen';
import { useReminderAlerts } from './src/hooks/useReminderAlerts';
import { ReminderAlertToasts } from './src/components/ReminderAlertToasts';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Dashboard: '🏠',
  Batches: '🐔',
  'Daily Log': '📋',
  Expenses: '💰',
  Reminders: '⏰',
  Reports: '📊',
  Team: '👥',
};

function MainTabs() {
  const { user, token } = useAuth();
  const { activeAlerts, dismissAlert } = useReminderAlerts(token);
  const isWorker = user?.role === 'worker';

  return (
    <View style={{ flex: 1 }}>
      <ReminderAlertToasts alerts={activeAlerts} onDismiss={dismissAlert} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.55 }}>
              {TAB_ICONS[route.name] || '●'}
            </Text>
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={{
              fontSize: 9, fontWeight: focused ? '700' : '500',
              color: focused ? '#10b981' : '#64748b',
              marginBottom: 2, textAlign: 'center'
            }}>
              {route.name}
            </Text>
          ),
          tabBarStyle: {
            backgroundColor: '#1e293b',
            borderTopColor: 'rgba(255,255,255,0.07)',
            borderTopWidth: 1,
            height: 72,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#10b981',
          tabBarInactiveTintColor: '#64748b',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Batches" component={BatchesScreen} />
        <Tab.Screen name="Daily Log" component={DailyLogScreen} />
        <Tab.Screen name="Reminders" component={RemindersScreen} />

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
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🐔</Text>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ color: '#94a3b8', marginTop: 12 }}>Loading PoultryOps...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainTabs} />
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
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
