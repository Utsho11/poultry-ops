import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Layers, ClipboardList, DollarSign, BarChart3, Users, Plus, HelpCircle, LogOut, Bell } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { t } = useLang();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isWorker = user?.role === 'worker';

  const allNavItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'manager', 'worker'] },
    { path: '/batches', label: 'Flocks', icon: Layers, roles: ['owner', 'manager', 'worker'] },
    { path: '/logs', label: 'Daily Log', icon: ClipboardList, roles: ['owner', 'manager', 'worker'] },
    { path: '/reminders', label: 'Reminders', icon: Bell, roles: ['owner', 'manager', 'worker'] },
    { path: '/expenses-health', label: 'Health & Finance', icon: DollarSign, roles: ['owner', 'manager'] },
    { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'manager'] },
    { path: '/team-settings', label: 'Team', icon: Users, roles: ['owner', 'manager'] }
  ];

  const visibleItems = allNavItems.filter(item => item.roles.includes(user?.role || 'worker'));

  return (
    <aside className="sidebar" style={{
      width: '260px',
      backgroundColor: '#1e293b',
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '24px 18px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: '100vh'
    }}>
      <div>
        {/* Logo Brand Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.jpg" alt="PoultryOps" style={{ width: '34px', height: '34px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(16, 185, 129, 0.4)' }} />
            PoultryOps
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginTop: '2px', letterSpacing: '0.04em' }}>
            {isWorker ? 'Worker Hub' : 'Precision Husbandry'}
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate('/logs')}
          style={{
            width: '100%',
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            marginBottom: '24px',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
          }}
        >
          <Plus size={18} /> {isWorker ? 'Submit Daily Log' : 'Add New Batch'}
        </button>

        {/* Nav Items (Filtered by Role) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '11px 16px',
                  borderRadius: '12px',
                  fontSize: '0.92rem',
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none',
                  backgroundColor: isActive ? '#10b981' : 'transparent',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.15s ease'
                })}
              >
                <Icon size={19} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.88rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer' }}>
          <HelpCircle size={18} /> Help
        </button>
        <button onClick={logout} style={{ background: 'none', border: 'none', color: '#f43f5e', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', cursor: 'pointer' }}>
          <LogOut size={18} /> Logout ({user?.name || user?.role})
        </button>
      </div>
    </aside>
  );
};
