import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { LogOut, Globe, Shield, Feather } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();

  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'var(--brand-gradient)', width: '38px', height: '38px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <Feather size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }} className="gradient-text">
            {t('appTitle')}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {user?.farmName || 'Multi-tenant Poultry SaaS'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Language Switcher */}
        <button
          onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          title="Switch Language"
        >
          <Globe size={16} />
          {lang === 'en' ? 'বাংলা' : 'English'}
        </button>

        {/* User Info */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface-elevated)', padding: '6px 14px', borderRadius: 'var(--radius-md)' }}>
            <Shield size={16} color="var(--brand-primary)" />
            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {t(`role${user.role.charAt(0).toUpperCase() + user.role.slice(1)}` as any)}
              </div>
            </div>
            <button
              onClick={logout}
              style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', marginLeft: '8px', display: 'flex', alignItems: 'center' }}
              title={t('logout')}
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
