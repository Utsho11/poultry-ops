import React, { useEffect, useState, useCallback } from 'react';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth } from '../services/api';
import { IBatch, IUser } from '@poultry-ops/types';
import { Layers, Plus, Calendar, Bird, Home, CheckCircle2, Lock, Users, UserCheck } from 'lucide-react';

export const BatchesPage: React.FC = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [teamWorkers, setTeamWorkers] = useState<IUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [assignModalBatch, setAssignModalBatch] = useState<IBatch | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Form fields for create
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('Cobb 500');
  const [type, setType] = useState<'layer' | 'broiler'>('broiler');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialCount, setInitialCount] = useState<number>(1000);
  const [shed, setShed] = useState('Shed A');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canManage = user?.role === 'owner' || user?.role === 'manager';

  const loadData = useCallback(async () => {
    try {
      const [batchesData, usersData] = await Promise.all([
        fetchWithAuth('/batches'),
        canManage ? fetchWithAuth('/team') : Promise.resolve([])
      ]);
      setBatches(batchesData);
      if (Array.isArray(usersData)) {
        setTeamWorkers(usersData.filter((u: IUser) => u.role === 'worker'));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await fetchWithAuth('/batches', {
        method: 'POST',
        body: JSON.stringify({
          name, breed, type, startDate,
          initialCount: Number(initialCount), shed,
          assignedWorkerIds: selectedWorkerIds
        })
      });
      setShowModal(false);
      setName('');
      setSelectedWorkerIds([]);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAssignModal = (batch: IBatch) => {
    setAssignModalBatch(batch);
    setSelectedWorkerIds(batch.assignedWorkerIds || []);
  };

  const handleSaveAssignments = async () => {
    if (!assignModalBatch) return;
    try {
      await fetchWithAuth(`/batches/${assignModalBatch._id}/assign-workers`, {
        method: 'PATCH',
        body: JSON.stringify({ workerIds: selectedWorkerIds })
      });
      setAssignModalBatch(null);
      setSelectedWorkerIds([]);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const handleCloseBatch = async (id: string) => {
    if (!window.confirm('Are you sure you want to close this batch?')) return;
    try {
      await fetchWithAuth(`/batches/${id}/close`, { method: 'POST' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('batches')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {user?.role === 'worker' ? 'Your Assigned Bird Flocks' : 'Track bird flocks, mortality, breeds, and assigned workers'}
          </p>
        </div>
        {canManage && (
          <button onClick={() => { setSelectedWorkerIds([]); setShowModal(true); }} className="btn btn-primary">
            <Plus size={18} />
            {t('addBatch')}
          </button>
        )}
      </div>

      {/* Batches Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {batches.map((batch) => {
          const isClosed = batch.status === 'closed';
          const mortalityCount = batch.initialCount - batch.currentCount;
          const mortalityPct = ((mortalityCount / batch.initialCount) * 100).toFixed(1);
          const assignedWorkers = teamWorkers.filter(w => (batch.assignedWorkerIds || []).includes(w._id));

          return (
            <div key={batch._id} className="glass-panel" style={{ padding: '24px', opacity: isClosed ? 0.75 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{batch.name}</h3>
                <span className={`badge ${isClosed ? 'badge-rose' : 'badge-emerald'}`}>
                  {batch.status.toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bird size={16} color="var(--brand-primary)" />
                  <span>Breed: <strong style={{ color: 'var(--text-main)' }}>{batch.breed} ({batch.type})</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Home size={16} color="var(--accent-amber)" />
                  <span>Location: <strong style={{ color: 'var(--text-main)' }}>{batch.shed || 'Main Shed'}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="var(--accent-blue)" />
                  <span>Started: <strong style={{ color: 'var(--text-main)' }}>{new Date(batch.startDate).toLocaleDateString()}</strong></span>
                </div>
              </div>

              {/* Bird Stats Progress Bar */}
              <div style={{ background: 'var(--bg-surface-elevated)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                  <span>Current Birds: <strong>{batch.currentCount}</strong></span>
                  <span style={{ color: 'var(--accent-rose)' }}>Mortality: {mortalityPct}% ({mortalityCount})</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(batch.currentCount / batch.initialCount) * 100}%`, height: '100%', background: 'var(--brand-primary)', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Assigned Workers List */}
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} /> Assigned Workers ({assignedWorkers.length})
                  </span>
                  {canManage && (
                    <button
                      onClick={() => handleOpenAssignModal(batch)}
                      style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Assign Workers
                    </button>
                  )}
                </div>
                {assignedWorkers.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {assignedWorkers.map(w => (
                      <span key={w._id} style={{ backgroundColor: '#334155', color: '#fff', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        👤 {w.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {canManage ? 'All workers can access (Click Assign Workers to restrict)' : 'Assigned to All Workers'}
                  </span>
                )}
              </div>

              {canManage && !isClosed && (
                <button
                  onClick={() => handleCloseBatch(batch._id)}
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  <Lock size={16} /> Close Batch
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Assign Workers Modal */}
      {assignModalBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px', backgroundColor: '#1e293b' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '6px', color: '#fff' }}>
              Assign Workers to {assignModalBatch.name}
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '18px' }}>
              Selected workers will be able to log daily yields & manage this flock.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', maxHeight: '240px', overflowY: 'auto' }}>
              {teamWorkers.length > 0 ? (
                teamWorkers.map(worker => {
                  const isAssigned = selectedWorkerIds.includes(worker._id);
                  return (
                    <div
                      key={worker._id}
                      onClick={() => toggleWorkerSelection(worker._id)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                        backgroundColor: isAssigned ? 'rgba(16, 185, 129, 0.18)' : '#334155',
                        border: `1px solid ${isAssigned ? '#10b981' : 'rgba(255,255,255,0.08)'}`
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>{worker.name}</div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{worker.email}</div>
                      </div>
                      <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: isAssigned ? '#10b981' : 'transparent', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 800 }}>
                        {isAssigned ? '✓' : ''}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No team workers found. Invite workers in Team Settings tab first!
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setAssignModalBatch(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSaveAssignments} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#10b981' }}>Save Assignments</button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Batch Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '32px', backgroundColor: '#1e293b' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '16px' }}>Add New Poultry Batch</h2>
            {error && <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</div>}

            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Batch Name</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Batch 14 - Broiler" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as any)} className="input-field">
                    <option value="broiler">Broiler</option>
                    <option value="layer">Layer</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Breed</label>
                  <input type="text" required value={breed} onChange={(e) => setBreed(e.target.value)} className="input-field" placeholder="Cobb 500 / Sonali" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Initial Bird Count</label>
                  <input type="number" required min="1" value={initialCount} onChange={(e) => setInitialCount(Number(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Shed / Location</label>
                  <input type="text" value={shed} onChange={(e) => setShed(e.target.value)} className="input-field" placeholder="Shed 1" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Start Date</label>
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
              </div>

              {/* Assign Workers Checkboxes */}
              {teamWorkers.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Assign Workers (Optional)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {teamWorkers.map(w => {
                      const isSel = selectedWorkerIds.includes(w._id);
                      return (
                        <button
                          key={w._id}
                          type="button"
                          onClick={() => toggleWorkerSelection(w._id)}
                          style={{
                            padding: '6px 12px', borderRadius: '8px', border: `1px solid ${isSel ? '#10b981' : '#64748b'}`,
                            backgroundColor: isSel ? 'rgba(16,185,129,0.2)' : 'transparent', color: isSel ? '#10b981' : '#94a3b8',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          {isSel ? '✓ ' : ''}{w.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>{submitting ? 'Creating...' : 'Create Batch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
