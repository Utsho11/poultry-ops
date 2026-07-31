import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LangContext';
import { fetchWithAuth } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { IBatch, IDailyLog, IReportMetrics } from '@poultry-ops/types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Bird, Egg, AlertTriangle, Scale, DollarSign, PlusCircle, ArrowUpRight, Bell, Clock, CheckCircle2, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [logs, setLogs] = useState<IDailyLog[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [summary, setSummary] = useState<IReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick Daily Log Modal State
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [logBatchId, setLogBatchId] = useState('');
  const [eggCount, setEggCount] = useState('');
  const [brokenEggCount, setBrokenEggCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedGivenKg, setFeedGivenKg] = useState('');
  const [waterGivenLiters, setWaterGivenLiters] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  const loadDashboardData = async () => {
    try {
      const [batchesData, logsData, summaryData, remindersData] = await Promise.all([
        fetchWithAuth('/batches?status=active'),
        fetchWithAuth('/logs'),
        fetchWithAuth('/reports/summary'),
        fetchWithAuth('/reminders')
      ]);
      setBatches(batchesData);
      if (batchesData.length > 0 && !logBatchId) setLogBatchId(batchesData[0]._id);
      setLogs(logsData.slice(0, 5));
      setSummary(summaryData);
      setReminders(remindersData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

  const handleSubmitQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logBatchId || !eggCount || !feedGivenKg || !waterGivenLiters) {
      alert('Please fill out all required log fields');
      return;
    }
    setSubmittingLog(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await fetchWithAuth('/logs', {
        method: 'POST',
        body: JSON.stringify({
          batchId: logBatchId,
          date: today,
          eggCount: Number(eggCount),
          brokenEggCount: Number(brokenEggCount || 0),
          deadCount: Number(deadCount || 0),
          feedGivenKg: Number(feedGivenKg),
          waterGivenLiters: Number(waterGivenLiters),
        })
      });
      setQuickLogOpen(false);
      setEggCount('');
      setFeedGivenKg('');
      setWaterGivenLiters('');
      loadDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingLog(false);
    }
  };

  const totalActiveBirds = batches.reduce((acc, b) => acc + b.currentCount, 0);

  // Helper to format time into 12-hour AM/PM format
  const format12Hour = (timeStr?: string) => {
    if (!timeStr) return '08:00 AM';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const [h, m] = timeStr.split(':');
    let hours = parseInt(h, 10);
    const minutes = m || '00';
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours < 10 ? '0' + hours : hours}:${minutes} ${period}`;
  };

  const chartData = [...logs].reverse().map(l => ({
    date: l.date,
    eggs: l.eggCount,
    dead: l.deadCount,
    feed: l.feedGivenKg
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Quick Log Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('dashboard')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time overview of active batches, daily yields & financial metrics</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setQuickLogOpen(true)} className="btn btn-primary" style={{ backgroundColor: '#10b981' }}>
            <Zap size={18} />
            ⚡ Quick Save Daily Log
          </button>
          {user?.role !== 'worker' && (
            <Link to="/batches" className="btn btn-secondary">
              {t('addBatch')}
            </Link>
          )}
        </div>
      </div>

      {/* Front Page Reminders & Alarms Section */}
      <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.08) 100%)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: '10px' }}>
              <Bell size={20} style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Upcoming Farm Alarms & Reminders</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scheduled feeding, vaccination, and task reminders (12-Hour AM/PM)</p>
            </div>
          </div>
          <span style={{ fontSize: '0.82rem', color: '#3b82f6', fontWeight: 600, background: 'rgba(59,130,246,0.15)', padding: '4px 12px', borderRadius: '20px' }}>
            {reminders.length} Active Alarms
          </span>
        </div>

        {reminders.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {reminders.slice(0, 4).map(rem => (
              <div key={rem._id} style={{ backgroundColor: 'var(--bg-surface-elevated, #334155)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontSize: '0.75rem' }}>
                    {rem.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {format12Hour(rem.dueTime)}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>{rem.message}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {rem.repeat && rem.repeat !== 'none' ? `Repeats: ${rem.repeat}` : `Date: ${rem.dueDate || 'Today'}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            No scheduled reminders. Add alarms to keep your farm tasks organized!
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{t('activeBirds')}</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--brand-primary)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bird size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalActiveBirds.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpRight size={14} /> {batches.length} Active Batches
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{t('dailyEggCount')}</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Egg size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{(summary?.totalEggs || 0).toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', marginTop: '4px' }}>
            Broken Eggs: {summary?.totalBrokenEggs || 0}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{t('mortalityRate')}</span>
            <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{summary?.mortalityRate || 0}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', marginTop: '4px' }}>
            Total Dead: {summary?.totalDead || 0} Birds
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{t('fcr')}</span>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{summary?.feedConversionRatio || 0}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', marginTop: '4px' }}>
            Feed: {summary?.totalFeedKg || 0} kg
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{t('monthlyExpenses')}</span>
            <div style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>৳{(summary?.totalCost || 0).toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Cost / Egg: ৳{summary?.costPerEgg || 0}
          </div>
        </div>
      </div>

      {/* Production Chart & Recent Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Egg Production Yield Trend</h3>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="eggGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} />
                  <Area type="monotone" dataKey="eggs" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#eggGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              No production entries recorded yet. Click '⚡ Quick Save Daily Log' to log today's yield.
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('recentLogs')}</h3>
            <Link to="/logs" style={{ fontSize: '0.85rem', color: 'var(--brand-primary)', textDecoration: 'none', fontWeight: 600 }}>View All →</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.length > 0 ? (
              logs.map(log => (
                <div key={log._id} style={{ background: 'var(--bg-surface-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Date: {log.date}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Feed: {log.feedGivenKg}kg | Water: {log.waterGivenLiters}L
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-emerald">+{log.eggCount} Eggs</span>
                    {log.deadCount > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', marginTop: '2px' }}>-{log.deadCount} Dead</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No daily logs submitted yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ⚡ Quick Save Daily Log Modal */}
      {quickLogOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '28px', backgroundColor: '#1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: '8px', borderRadius: '10px', color: '#10b981' }}>
                <Zap size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>Quick Save Daily Log</h2>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Log today's yield & feed in 1 click</p>
              </div>
            </div>

            <form onSubmit={handleSubmitQuickLog} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Select Batch *</label>
                <select value={logBatchId} onChange={(e) => setLogBatchId(e.target.value)} className="input-field" required>
                  {batches.map(b => <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Total Eggs *</label>
                  <input type="number" required placeholder="e.g. 450" value={eggCount} onChange={(e) => setEggCount(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Broken Eggs</label>
                  <input type="number" placeholder="0" value={brokenEggCount} onChange={(e) => setBrokenEggCount(e.target.value)} className="input-field" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Feed (kg) *</label>
                  <input type="number" required placeholder="50" value={feedGivenKg} onChange={(e) => setFeedGivenKg(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Water (L) *</label>
                  <input type="number" required placeholder="120" value={waterGivenLiters} onChange={(e) => setWaterGivenLiters(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Dead Birds</label>
                  <input type="number" placeholder="0" value={deadCount} onChange={(e) => setDeadCount(e.target.value)} className="input-field" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setQuickLogOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={submittingLog} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#10b981' }}>
                  {submittingLog ? 'Saving...' : '⚡ Save Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
