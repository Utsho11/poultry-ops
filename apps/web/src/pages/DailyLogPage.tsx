import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LangContext';
import { fetchWithAuth } from '../services/api';
import { IBatch, IDailyLog } from '@poultry-ops/types';
import { ClipboardList, Plus, Egg, AlertTriangle, Scale, Droplet, FileText, CheckCircle2 } from 'lucide-react';
import { formatEggCount, cratesAndLooseToTotal } from '../utils/crates';

export const DailyLogPage: React.FC = () => {
  const { t } = useLang();
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [logs, setLogs] = useState<IDailyLog[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  // Form fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [crates, setCrates] = useState<number>(0);
  const [looseEggs, setLooseEggs] = useState<number>(0);
  const [brokenEggCount, setBrokenEggCount] = useState<number>(0);
  const [deadCount, setDeadCount] = useState<number>(0);
  const [feedGivenKg, setFeedGivenKg] = useState<number>(50);
  const [waterGivenLiters, setWaterGivenLiters] = useState<number>(100);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const batchesData = await fetchWithAuth('/batches?status=active');
      setBatches(batchesData);
      if (batchesData.length > 0 && !selectedBatchId) {
        setSelectedBatchId(batchesData[0]._id);
      }
      const logsData = await fetchWithAuth('/logs');
      setLogs(logsData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCalculatedEggs = cratesAndLooseToTotal(crates, looseEggs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      setError('Please select an active batch');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      await fetchWithAuth('/logs', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId,
          date,
          eggCount: totalCalculatedEggs,
          brokenEggCount: Number(brokenEggCount),
          deadCount: Number(deadCount),
          feedGivenKg: Number(feedGivenKg),
          waterGivenLiters: Number(waterGivenLiters),
          notes
        })
      });

      setSuccessMsg(`Daily log saved! Recorded ${formatEggCount(totalCalculatedEggs)}.`);
      setShowForm(false);
      setCrates(0);
      setLooseEggs(0);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit log entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('dailyLog')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fast touch-friendly entry form for daily egg collection (crates + eggs), feed, water & mortality</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          <Plus size={18} />
          {showForm ? 'Close Form' : t('newLog')}
        </button>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--brand-primary)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '14px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {/* Entry Form */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '20px' }}>Log Daily Production & Feed</h2>
          {error && <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '14px' }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Select Active Batch</label>
                <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="input-field">
                  {batches.map(b => (
                    <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Date</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
              </div>
            </div>

            {/* Egg Collection inputs (Crates + Loose) */}
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Egg size={18} /> Egg Collection (1 Crate = 30 Eggs)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Full Crates (30 eggs/crate)</label>
                  <input type="number" min="0" placeholder="e.g. 10" value={crates} onChange={(e) => setCrates(Number(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Loose Eggs</label>
                  <input type="number" min="0" placeholder="e.g. 15" value={looseEggs} onChange={(e) => setLooseEggs(Number(e.target.value))} className="input-field" />
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.88rem', fontWeight: 700, color: '#10b981' }}>
                Total Yield: {formatEggCount(totalCalculatedEggs)} ({totalCalculatedEggs} eggs total)
              </div>
            </div>

            {/* Metrics inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} color="var(--accent-amber)" /> {t('brokenEggs')}
                </label>
                <input type="number" min="0" value={brokenEggCount} onChange={(e) => setBrokenEggCount(Number(e.target.value))} className="input-field" />
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} color="var(--accent-rose)" /> {t('deadBirds')}
                </label>
                <input type="number" min="0" value={deadCount} onChange={(e) => setDeadCount(Number(e.target.value))} className="input-field" />
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Scale size={16} color="var(--accent-blue)" /> {t('feedKg')}
                </label>
                <input type="number" min="0" value={feedGivenKg} onChange={(e) => setFeedGivenKg(Number(e.target.value))} className="input-field" />
              </div>

              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Droplet size={16} color="var(--accent-blue)" /> {t('waterLiters')}
                </label>
                <input type="number" min="0" value={waterGivenLiters} onChange={(e) => setWaterGivenLiters(Number(e.target.value))} className="input-field" />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>{t('notes')}</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows={2} placeholder="Optional notes regarding bird health or feed batch..." />
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ height: '44px' }}>
              {submitting ? 'Saving Log...' : t('saveLog')}
            </button>
          </form>
        </div>
      )}

      {/* Daily Logs Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Historical Log Entries</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Eggs (Crates + Loose)</th>
                <th style={{ padding: '12px' }}>Broken</th>
                <th style={{ padding: '12px' }}>Dead Birds</th>
                <th style={{ padding: '12px' }}>Feed (kg)</th>
                <th style={{ padding: '12px' }}>Water (L)</th>
                <th style={{ padding: '12px' }}>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{log.date}</td>
                  <td style={{ padding: '12px', color: 'var(--brand-primary)', fontWeight: 700 }}>
                    +{formatEggCount(log.eggCount)} <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>({log.eggCount} total)</span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--accent-amber)' }}>{log.brokenEggCount}</td>
                  <td style={{ padding: '12px', color: log.deadCount > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>{log.deadCount}</td>
                  <td style={{ padding: '12px' }}>{log.feedGivenKg} kg</td>
                  <td style={{ padding: '12px' }}>{log.waterGivenLiters} L</td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{(log as any).recordedBy?.name || 'Worker'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
