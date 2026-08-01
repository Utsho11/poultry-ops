import React, { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Bell, Clock, Plus, Trash2, CheckCircle2, Calendar, Filter } from 'lucide-react';

const TYPES = [
  { id: 'feed', label: '🌾 Feed', color: '#10b981' },
  { id: 'vaccination', label: '💉 Vaccine', color: '#f43f5e' },
  { id: 'checkup', label: '🩺 Health Check', color: '#3b82f6' },
  { id: 'general', label: '📋 General Task', color: '#f59e0b' },
];

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const RemindersPage: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});

  // Form states
  const todayStr = new Date().toISOString().split('T')[0];
  const [message, setMessage] = useState('');
  const [type, setType] = useState('feed');
  const [dueDate, setDueDate] = useState(todayStr);
  const [selectedHour, setSelectedHour] = useState('08');
  const [selectedMin, setSelectedMin] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');
  const [repeat, setRepeat] = useState('daily');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [remData, batchData] = await Promise.all([
        fetchWithAuth('/reminders'),
        fetchWithAuth('/batches?status=active')
      ]);
      setReminders(remData);
      setBatches(batchData);
      // #region agent log
      fetch('http://127.0.0.1:7898/ingest/8aab6805-612d-4a5e-86df-5176f3ce7ab6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2dce91'},body:JSON.stringify({sessionId:'2dce91',location:'RemindersPage.tsx:loadData',message:'Reminders loaded in UI',data:{count:remData?.length??0,sample:remData?.slice(0,2).map((r:any)=>({id:r._id,message:r.message,dueTime:r.dueTime,dueDate:r.dueDate}))},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message) return;
    setSubmitting(true);
    const final12HrTime = `${selectedHour}:${selectedMin} ${selectedPeriod}`;
    try {
      await fetchWithAuth('/reminders', {
        method: 'POST',
        body: JSON.stringify({
          message,
          type,
          dueDate,
          dueTime: final12HrTime,
          repeat,
          batchId: selectedBatchId || undefined,
        })
      });
      setModalOpen(false);
      setMessage('');
      loadData();
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7898/ingest/8aab6805-612d-4a5e-86df-5176f3ce7ab6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2dce91'},body:JSON.stringify({sessionId:'2dce91',location:'RemindersPage.tsx:handleCreate:error',message:'Create reminder failed',data:{error:err?.message},timestamp:Date.now(),runId:'pre-fix',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this alarm reminder?')) return;
    try {
      await fetchWithAuth(`/reminders/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleTaskDone = (id: string) => {
    setCompletedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>Reminders & Alarms</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Manage scheduled farm alarms, feeding routines & health tasks.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary">
          <Plus size={18} /> Set New Alarm
        </button>
      </div>

      {/* Reminders Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {reminders.length > 0 ? (
          reminders.map(rem => {
            const isDone = completedIds[rem._id];
            const typeObj = TYPES.find(t => t.id === rem.type) || TYPES[0];
            return (
              <div key={rem._id} className="glass-panel" style={{ padding: '20px', opacity: isDone ? 0.6 : 1, transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span className="badge" style={{ backgroundColor: `${typeObj.color}20`, color: typeObj.color, border: `1px solid ${typeObj.color}40` }}>
                    {typeObj.label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => toggleTaskDone(rem._id)}
                      style={{ background: isDone ? '#10b981' : 'transparent', border: `1px solid ${isDone ? '#10b981' : '#64748b'}`, borderRadius: '6px', padding: '4px 8px', color: isDone ? '#fff' : '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {isDone ? '✓ Completed' : 'Mark Done'}
                    </button>
                    <button onClick={() => handleDelete(rem._id)} style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '4px' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px', textDecoration: isDone ? 'line-through' : 'none' }}>
                  {rem.message}
                </h3>

                <div style={{ backgroundColor: '#334155', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                  <div style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} /> Alarm: {rem.dueTime || '08:00 AM'}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    {rem.repeat && rem.repeat !== 'none' ? `Repeats: ${rem.repeat}` : `Date: ${rem.dueDate || 'Today'}`}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No alarms set yet. Click "+ Set New Alarm" to schedule your farm tasks!
          </div>
        )}
      </div>

      {/* Set Alarm Modal with Select Components for Hour & Minute */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px', backgroundColor: '#1e293b' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', marginBottom: '20px' }}>Set Reminder Alarm</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Alarm Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Give Newcastle Vaccine to Shed A"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Category</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
                  {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
              </div>

              {/* SELECT Dropdowns for Hour, Minute, and AM/PM */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Select Alarm Time (Hr : Min : AM/PM)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {/* Hour Select Dropdown */}
                  <select value={selectedHour} onChange={(e) => setSelectedHour(e.target.value)} className="input-field">
                    {HOURS.map(h => <option key={h} value={h}>Hour: {h}</option>)}
                  </select>

                  {/* Minute Select Dropdown */}
                  <select value={selectedMin} onChange={(e) => setSelectedMin(e.target.value)} className="input-field">
                    {MINUTES.map(m => <option key={m} value={m}>Min: {m}</option>)}
                  </select>

                  {/* AM/PM Select Dropdown */}
                  <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="input-field">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Repeat Schedule</label>
                <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className="input-field">
                  <option value="none">One-time Alarm</option>
                  <option value="daily">Repeat Daily</option>
                  <option value="weekly">Repeat Weekly</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
                  {submitting ? 'Setting...' : 'Set Alarm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
