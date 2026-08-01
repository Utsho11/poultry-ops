import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { BatchesPage } from './pages/BatchesPage';
import { DailyLogPage } from './pages/DailyLogPage';
import { ExpensesHealthPage } from './pages/ExpensesHealthPage';
import { RemindersPage } from './pages/RemindersPage';
import { ReportsPage } from './pages/ReportsPage';
import { TeamSettingsPage } from './pages/TeamSettingsPage';
import { useReminderAlerts } from './hooks/useReminderAlerts';
import { ReminderAlertToasts } from './components/ReminderAlertToasts';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { activeAlerts, dismissAlert } = useReminderAlerts();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isWorker = user?.role === 'worker';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ReminderAlertToasts alerts={activeAlerts} onDismiss={dismissAlert} />
      <Navbar />
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/batches" element={<BatchesPage />} />
            <Route path="/logs" element={<DailyLogPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            {!isWorker && <Route path="/expenses-health" element={<ExpensesHealthPage />} />}
            {!isWorker && <Route path="/reports" element={<ReportsPage />} />}
            {!isWorker && <Route path="/team-settings" element={<TeamSettingsPage />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  );
};

export default App;
