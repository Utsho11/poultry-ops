import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth } from '../services/api';
import { IUser, IReminder } from '@poultry-ops/types';
import { Users, Bell, UserPlus, Shield, CheckCircle2, Clock, Trash2 } from 'lucide-react';

export const TeamSettingsPage: React.FC = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [team, setTeam] = useState<IUser[]>([]);
  const [reminders, setReminders] = useState<IReminder[]>([]);

  // User form
  const [showUserModal, setShowUserModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'manager' | 'worker'>('worker');
  const [phone, setPhone] = useState('');

  // Reminder form
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [remType, setRemType] = useState<'feed' | 'water' | 'medicine' | 'custom'>('feed');
  const [remMsg, setRemMsg] = useState('Daily Morning Feed & Egg Collection');
  const [remCron, setRemCron] = useState('0 7 * * *');

  const loadData = async () => {
    try {
      if (user?.role === 'owner' || user?.role === 'manager') {
        const [teamData, remData] = await Promise.all([
          fetchWithAuth('/users'),
          fetchWithAuth('/reminders')
        ]);
        setTeam(teamData);
        setReminders(remData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role, phone })
      });
      setShowUserModal(false);
      setName('');
      setEmail('');
      setPassword('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (targetUser: IUser) => {
    if (targetUser.role === 'owner') {
      alert('Cannot delete farm owner');
      return;
    }
    if (!window.confirm(`Delete worker ${targetUser.name}? This will remove them from DB and unassign them from batches (batch data will be preserved).`)) return;

    try {
      await fetchWithAuth(`/users/${targetUser._id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/reminders', {
        method: 'POST',
        body: JSON.stringify({
          type: remType,
          message: remMsg,
          cronExpression: remCron,
          assignedTo: [],
          channel: ['push']
        })
      });
      setShowReminderModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await fetchWithAuth(`/reminders/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('teamSettings')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Manage team members, batch assignments & farm reminders</p>
        </div>

        {user?.role === 'owner' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowUserModal(true)} className="btn btn-primary">
              <UserPlus size={18} /> Invite Team Member
            </button>
            <button onClick={() => setShowReminderModal(true)} className="btn btn-secondary">
              <Bell size={18} /> Add Cron Reminder
            </button>
          </div>
        )}
      </div>

      {/* Team Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Farm Team Members</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px' }}>Name</th>
                <th style={{ padding: '12px' }}>Email</th>
                <th style={{ padding: '12px' }}>Phone</th>
                <th style={{ padding: '12px' }}>Role</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {team.map((u) => (
                <tr key={u._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: '12px' }}>{u.email}</td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <span className={`badge ${u.role === 'owner' ? 'badge-emerald' : u.role === 'manager' ? 'badge-amber' : 'badge-rose'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {user?.role === 'owner' && u._id !== user.userId && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.82rem' }}
                      >
                        <Trash2 size={16} /> Delete Worker
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminders List */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Automated Cron Reminders</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reminders.map((rem) => (
            <div key={rem._id} style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <Bell size={20} color="var(--brand-primary)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{rem.message}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Cron: <code>{rem.cronExpression}</code> | Type: {rem.type.toUpperCase()}
                  </div>
                </div>
              </div>
              <button onClick={() => handleDeleteReminder(rem._id)} style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }}>
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Invite User Modal */}
      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px', backgroundColor: '#1e293b' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Add Team Member</h2>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Full Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Worker Name" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="worker@farm.com" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as any)} className="input-field">
                  <option value="worker">Worker (দৈনিক তথ্য এন্ট্রি)</option>
                  <option value="manager">Manager (ব্যাচ ও অর্থনৈতিক নিয়ন্ত্রণ)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowUserModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px', backgroundColor: '#1e293b' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Configure Cron Reminder</h2>
            <form onSubmit={handleCreateReminder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Reminder Message</label>
                <input type="text" required value={remMsg} onChange={(e) => setRemMsg(e.target.value)} className="input-field" placeholder="Daily Feed & Water Check" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Cron Schedule Expression</label>
                <input type="text" required value={remCron} onChange={(e) => setRemCron(e.target.value)} className="input-field" placeholder="0 7 * * * (Every morning at 7:00 AM)" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowReminderModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Schedule Reminder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
