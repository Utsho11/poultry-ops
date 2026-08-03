import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LangContext';
import { fetchWithAuth } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { IBatch, IDailyLog, IReportMetrics } from '@poultry-ops/types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { Bird, Egg, AlertTriangle, Scale, DollarSign, PlusCircle, ArrowUpRight, Zap, ShoppingCart, TrendingUp, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatEggCount, cratesAndLooseToTotal } from '../utils/crates';

export const DashboardPage: React.FC = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [logs, setLogs] = useState<IDailyLog[]>([]);
  const [summary, setSummary] = useState<IReportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick Daily Log Modal State (Crates + Loose Eggs)
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [logBatchId, setLogBatchId] = useState('');
  const [crates, setCrates] = useState('');
  const [looseEggs, setLooseEggs] = useState('');
  const [brokenEggCount, setBrokenEggCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedGivenKg, setFeedGivenKg] = useState('');
  const [waterGivenLiters, setWaterGivenLiters] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  // Record Sale Modal State (OWNER ONLY - Crates + Loose Eggs for Egg Sales)
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleItemType, setSaleItemType] = useState<'egg' | 'chicken'>('egg');
  const [saleBatchId, setSaleBatchId] = useState('');
  const [saleCrates, setSaleCrates] = useState('');
  const [saleLooseEggs, setSaleLooseEggs] = useState('');
  const [saleChickenQty, setSaleChickenQty] = useState('');
  const [saleUnitPrice, setSaleUnitPrice] = useState('');
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingSale, setSubmittingSale] = useState(false);

  // Create New Batch Modal State
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [breed, setBreed] = useState('');
  const [batchType, setBatchType] = useState<'layer' | 'broiler'>('layer');
  const [initialCount, setInitialCount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [shed, setShed] = useState('');
  const [submittingBatch, setSubmittingBatch] = useState(false);

  const isOwner = user?.role === 'owner';
  const canManageBatches = user?.role === 'owner' || user?.role === 'manager';

  const loadDashboardData = async () => {
    try {
      const [batchesData, logsData, summaryData] = await Promise.all([
        fetchWithAuth('/batches'),
        fetchWithAuth('/logs'),
        fetchWithAuth('/reports/summary')
      ]);
      setBatches(batchesData);
      const activeBatches = batchesData.filter((b: IBatch) => b.status === 'active');
      if (activeBatches.length > 0 && !logBatchId) setLogBatchId(activeBatches[0]._id);
      else if (batchesData.length > 0 && !logBatchId) setLogBatchId(batchesData[0]._id);
      setLogs(logsData.slice(0, 5));
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, []);

  const totalLogEggs = cratesAndLooseToTotal(crates, looseEggs);
  const totalSaleEggQty = saleItemType === 'egg' ? cratesAndLooseToTotal(saleCrates, saleLooseEggs) : Number(saleChickenQty || 0);

  const handleSubmitQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logBatchId || totalLogEggs <= 0 || !feedGivenKg || !waterGivenLiters) {
      alert('Please enter Egg count (Crates/Loose), Feed, and Water values');
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
          eggCount: totalLogEggs,
          brokenEggCount: Number(brokenEggCount || 0),
          deadCount: Number(deadCount || 0),
          feedGivenKg: Number(feedGivenKg),
          waterGivenLiters: Number(waterGivenLiters),
        })
      });
      setQuickLogOpen(false);
      setCrates('');
      setLooseEggs('');
      setFeedGivenKg('');
      setWaterGivenLiters('');
      loadDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSaleEggQty <= 0 || !saleUnitPrice) {
      alert('Quantity and Unit Price are required');
      return;
    }
    setSubmittingSale(true);
    try {
      await fetchWithAuth('/sales', {
        method: 'POST',
        body: JSON.stringify({
          itemType: saleItemType,
          batchId: saleBatchId || undefined,
          quantity: totalSaleEggQty,
          unitPrice: Number(saleUnitPrice),
          date: saleDate,
          customerName: saleCustomer || undefined
        })
      });
      setSaleModalOpen(false);
      setSaleCrates('');
      setSaleLooseEggs('');
      setSaleChickenQty('');
      setSaleUnitPrice('');
      setSaleCustomer('');
      loadDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingSale(false);
    }
  };

  const handleSubmitCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName || !breed || !initialCount || Number(initialCount) <= 0) {
      alert('Batch Name, Breed, and Initial Bird Count are required');
      return;
    }
    setSubmittingBatch(true);
    try {
      await fetchWithAuth('/batches', {
        method: 'POST',
        body: JSON.stringify({
          name: batchName,
          breed,
          type: batchType,
          initialCount: Number(initialCount),
          startDate,
          shed: shed || undefined
        })
      });
      setCreateBatchOpen(false);
      setBatchName('');
      setBreed('');
      setInitialCount('');
      setShed('');
      loadDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingBatch(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)' }}>Loading PoultryOps Dashboard...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('dashboard')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Real-time overview of active batches, daily yields (crates + eggs), sales income & stock</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => setQuickLogOpen(true)} className="btn btn-primary" style={{ backgroundColor: '#4A7C59' }}>
            <Zap size={18} />
            ⚡ Quick Save Daily Log
          </button>

          {isOwner && (
            <button onClick={() => setSaleModalOpen(true)} className="btn btn-primary" style={{ backgroundColor: '#3D6B8C' }}>
              <ShoppingCart size={18} />
              💰 Record Sale
            </button>
          )}

          {canManageBatches && (
            <button onClick={() => setCreateBatchOpen(true)} className="btn btn-primary" style={{ backgroundColor: '#C7511F' }}>
              <PlusCircle size={18} />
              ➕ Create New Batch
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        {/* Current Available Unsold Egg Stock */}
        <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(74, 124, 89, 0.4)', background: 'linear-gradient(135deg, rgba(74, 124, 89, 0.1) 0%, rgba(255, 255, 255, 1) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#4A7C59', fontSize: '0.85rem', fontWeight: 700 }}>Current Egg Stock</span>
            <div style={{ background: 'rgba(74, 124, 89, 0.15)', color: '#4A7C59', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Egg size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2D2A26' }}>{formatEggCount(summary?.currentEggCount || 0)}</div>
          <div style={{ fontSize: '0.75rem', color: '#4A7C59', marginTop: '4px', fontWeight: 600 }}>
            {(summary?.currentEggCount || 0).toLocaleString()} unsold eggs in stock
          </div>
        </div>

        {/* All Time Egg Count */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>All-Time Egg Count</span>
            <div style={{ background: 'rgba(217, 164, 65, 0.15)', color: '#D9A441', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Egg size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatEggCount(summary?.allTimeEggCount || 0)}</div>
          <div style={{ fontSize: '0.75rem', color: '#D9A441', marginTop: '4px' }}>
            Total eggs collected across all batches
          </div>
        </div>

        {/* Total Sales Income */}
        <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(61, 107, 140, 0.4)', background: 'linear-gradient(135deg, rgba(61, 107, 140, 0.1) 0%, rgba(255, 255, 255, 1) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: '#3D6B8C', fontSize: '0.85rem', fontWeight: 700 }}>Total Sales Revenue</span>
            <div style={{ background: 'rgba(61, 107, 140, 0.15)', color: '#3D6B8C', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2D2A26' }}>৳{(summary?.totalIncome || 0).toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: '#3D6B8C', marginTop: '4px', fontWeight: 600 }}>
            Eggs & Birds Sales Total
          </div>
        </div>

        {/* Total Birds */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Active Hen Population</span>
            <div style={{ background: 'rgba(199, 81, 31, 0.15)', color: '#C7511F', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bird size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {batches.filter(b => b.status === 'active').reduce((acc, b) => acc + b.currentCount, 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#C7511F', marginTop: '4px', fontWeight: 600 }}>
            Across {batches.filter(b => b.status === 'active').length} active flocks
          </div>
        </div>
      </div>

      {/* 🐔 ALL BATCHES & FLOCKS SECTION */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'rgba(199, 81, 31, 0.15)', padding: '8px', borderRadius: '10px', color: '#C7511F' }}>
              <Layers size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2D2A26' }}>All Farm Batches & Flocks</h2>
              <p style={{ fontSize: '0.8rem', color: '#6B655C' }}>List of active and closed flocks for this farm</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {canManageBatches && (
              <button onClick={() => setCreateBatchOpen(true)} className="btn btn-primary" style={{ backgroundColor: '#C7511F', fontSize: '0.85rem', padding: '8px 14px' }}>
                <PlusCircle size={16} /> + New Batch
              </button>
            )}
            <Link to="/batches" style={{ fontSize: '0.85rem', color: '#C7511F', textDecoration: 'none', fontWeight: 700 }}>Manage Batches →</Link>
          </div>
        </div>

        {batches.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {batches.map(batch => (
              <Link
                key={batch._id}
                to={`/batch-dashboard/${batch._id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  style={{
                    backgroundColor: '#F4EFE6', padding: '18px', borderRadius: '14px',
                    border: `1px solid ${batch.status === 'active' ? 'rgba(74, 124, 89, 0.4)' : '#E8E2D8'}`,
                    cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span className="badge" style={{ backgroundColor: batch.type === 'layer' ? 'rgba(61, 107, 140, 0.15)' : 'rgba(217, 164, 65, 0.15)', color: batch.type === 'layer' ? '#3D6B8C' : '#D9A441', fontSize: '0.75rem', fontWeight: 700 }}>
                      {batch.type.toUpperCase()}
                    </span>
                    <span className="badge" style={{ backgroundColor: batch.status === 'active' ? 'rgba(74, 124, 89, 0.15)' : 'rgba(107, 101, 92, 0.15)', color: batch.status === 'active' ? '#4A7C59' : '#6B655C', fontSize: '0.75rem', fontWeight: 700 }}>
                      {batch.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2D2A26', marginBottom: '4px' }}>{batch.name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#6B655C', marginBottom: '12px' }}>Breed: <strong style={{ color: '#2D2A26' }}>{batch.breed}</strong> {batch.shed && `• Shed: ${batch.shed}`}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E8E2D8', fontSize: '0.85rem', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#6B655C' }}>Current Birds</div>
                      <div style={{ fontWeight: 800, color: '#4A7C59', fontSize: '1rem' }}>{batch.currentCount.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: '#6B655C' }}>Initial Birds</div>
                      <div style={{ fontWeight: 700, color: '#2D2A26' }}>{batch.initialCount.toLocaleString()}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: 'rgba(199, 81, 31, 0.12)', borderRadius: '8px', color: '#C7511F', fontSize: '0.82rem', fontWeight: 800 }}>
                    📊 Open Batch Dashboard →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No batches created yet. Click "+ New Batch" to add your first flock!
          </div>
        )}
      </div>

      {/* Main Grid: Performance Chart & Recent Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Daily Egg Yield Trend</h3>
          <div style={{ height: '240px', width: '100%' }}>
            {logs.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...logs].reverse()}>
                  <defs>
                    <linearGradient id="eggGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A7C59" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#4A7C59" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E8E2D8', color: '#2D2A26' }} />
                  <Area type="monotone" dataKey="eggCount" stroke="#4A7C59" strokeWidth={3} fillOpacity={1} fill="url(#eggGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No log data available yet
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('recentLogs')}</h3>
            <Link to="/logs" style={{ fontSize: '0.85rem', color: '#C7511F', textDecoration: 'none', fontWeight: 700 }}>View All →</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.length > 0 ? (
              logs.map(log => (
                <div key={log._id} style={{ background: '#F4EFE6', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid #E8E2D8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D2A26' }}>Date: {log.date}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6B655C' }}>
                      Feed: {log.feedGivenKg}kg | Water: {log.waterGivenLiters}L
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-emerald">+{formatEggCount(log.eggCount)}</span>
                    {log.deadCount > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#B23A2F', marginTop: '2px', fontWeight: 700 }}>-{log.deadCount} Dead</div>
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

      {/* ➕ CREATE NEW BATCH MODAL */}
      {createBatchOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45, 42, 38, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '28px', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(199, 81, 31, 0.15)', padding: '8px', borderRadius: '10px', color: '#C7511F' }}>
                <PlusCircle size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2D2A26' }}>Create New Flock / Batch</h2>
                <p style={{ fontSize: '0.8rem', color: '#6B655C' }}>Add a new chicken flock to your farm</p>
              </div>
            </div>

            <form onSubmit={handleSubmitCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Batch Name *</label>
                <input type="text" required placeholder="e.g. Batch 2026-A" value={batchName} onChange={(e) => setBatchName(e.target.value)} className="input-field" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Breed *</label>
                <input type="text" required placeholder="e.g. Hy-Line Brown / Cobb 500" value={breed} onChange={(e) => setBreed(e.target.value)} className="input-field" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Flock Type *</label>
                <select value={batchType} onChange={(e: any) => setBatchType(e.target.value)} className="input-field">
                  <option value="layer">🥚 Layer (Egg Production)</option>
                  <option value="broiler">🍗 Broiler (Meat Production)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Initial Birds *</label>
                  <input type="number" min="1" required placeholder="1000" value={initialCount} onChange={(e) => setInitialCount(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Start Date *</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Shed / Location Name</label>
                <input type="text" placeholder="e.g. Shed 1" value={shed} onChange={(e) => setShed(e.target.value)} className="input-field" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setCreateBatchOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={submittingBatch} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#C7511F' }}>
                  {submittingBatch ? 'Creating...' : '➕ Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚡ Quick Save Daily Log Modal (Crates + Loose Eggs) */}
      {quickLogOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45, 42, 38, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '28px', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', padding: '8px', borderRadius: '10px', color: '#4A7C59' }}>
                <Zap size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2D2A26' }}>Quick Save Daily Log</h2>
                <p style={{ fontSize: '0.8rem', color: '#6B655C' }}>Log today's yield in Crates + Loose Eggs</p>
              </div>
            </div>

            <form onSubmit={handleSubmitQuickLog} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Select Batch *</label>
                <select value={logBatchId} onChange={(e) => setLogBatchId(e.target.value)} className="input-field" required>
                  {batches.map(b => <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>)}
                </select>
              </div>

              {/* Crates + Loose Eggs Input */}
              <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.08)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(74, 124, 89, 0.2)' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#4A7C59', marginBottom: '8px' }}>🥚 Eggs Collected (1 Crate = 30 Eggs)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#6B655C', marginBottom: '4px' }}>Full Crates</label>
                    <input type="number" min="0" placeholder="0" value={crates} onChange={(e) => setCrates(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#6B655C', marginBottom: '4px' }}>Loose Eggs</label>
                    <input type="number" min="0" placeholder="0" value={looseEggs} onChange={(e) => setLooseEggs(e.target.value)} className="input-field" />
                  </div>
                </div>
                <div style={{ marginTop: '8px', color: '#4A7C59', fontWeight: 800, fontSize: '0.88rem' }}>
                  Total: {formatEggCount(totalLogEggs)} ({totalLogEggs} eggs)
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Broken Eggs</label>
                  <input type="number" placeholder="0" value={brokenEggCount} onChange={(e) => setBrokenEggCount(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Dead Birds</label>
                  <input type="number" placeholder="0" value={deadCount} onChange={(e) => setDeadCount(e.target.value)} className="input-field" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Feed Given (kg) *</label>
                <input type="number" step="0.1" required placeholder="e.g. 50" value={feedGivenKg} onChange={(e) => setFeedGivenKg(e.target.value)} className="input-field" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Water Given (L) *</label>
                <input type="number" step="0.1" required placeholder="e.g. 200" value={waterGivenLiters} onChange={(e) => setWaterGivenLiters(e.target.value)} className="input-field" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setQuickLogOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={submittingLog} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#4A7C59' }}>
                  {submittingLog ? 'Saving...' : '⚡ Save Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Sale Modal (OWNER ONLY) */}
      {saleModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45, 42, 38, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '28px', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(61, 107, 140, 0.15)', padding: '8px', borderRadius: '10px', color: '#3D6B8C' }}>
                <ShoppingCart size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2D2A26' }}>Record Sale Income</h2>
                <p style={{ fontSize: '0.8rem', color: '#6B655C' }}>Sell eggs (Crates + Loose) or Cull Chickens</p>
              </div>
            </div>

            <form onSubmit={handleSubmitSale} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Item to Sell *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSaleItemType('egg')}
                    style={{
                      padding: '10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${saleItemType === 'egg' ? '#4A7C59' : '#E8E2D8'}`,
                      backgroundColor: saleItemType === 'egg' ? 'rgba(74, 124, 89, 0.15)' : 'transparent',
                      color: saleItemType === 'egg' ? '#4A7C59' : '#6B655C'
                    }}
                  >
                    🥚 Eggs
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleItemType('chicken')}
                    style={{
                      padding: '10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${saleItemType === 'chicken' ? '#3D6B8C' : '#E8E2D8'}`,
                      backgroundColor: saleItemType === 'chicken' ? 'rgba(61, 107, 140, 0.15)' : 'transparent',
                      color: saleItemType === 'chicken' ? '#3D6B8C' : '#6B655C'
                    }}
                  >
                    🐔 Chicken / Birds
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Batch / Flock (Optional)</label>
                <select value={saleBatchId} onChange={(e) => setSaleBatchId(e.target.value)} className="input-field">
                  <option value="">Entire Farm</option>
                  {batches.map(b => <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>)}
                </select>
              </div>

              {/* Egg Quantity Inputs: Crates + Loose */}
              {saleItemType === 'egg' ? (
                <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.08)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(74, 124, 89, 0.2)' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#4A7C59', marginBottom: '8px' }}>Egg Quantity (1 Crate = 30 Eggs)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#6B655C', marginBottom: '4px' }}>Full Crates</label>
                      <input type="number" min="0" placeholder="e.g. 1" value={saleCrates} onChange={(e) => setSaleCrates(e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#6B655C', marginBottom: '4px' }}>Loose Eggs</label>
                      <input type="number" min="0" placeholder="e.g. 10" value={saleLooseEggs} onChange={(e) => setSaleLooseEggs(e.target.value)} className="input-field" />
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', color: '#4A7C59', fontWeight: 800, fontSize: '0.88rem' }}>
                    Total Selling: {formatEggCount(totalSaleEggQty)} ({totalSaleEggQty} eggs)
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Number of Chickens / Birds *</label>
                  <input type="number" min="1" required placeholder="e.g. 50" value={saleChickenQty} onChange={(e) => setSaleChickenQty(e.target.value)} className="input-field" />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>
                  {saleItemType === 'egg' ? 'Price per Egg (৳) *' : 'Price per Chicken (৳) *'}
                </label>
                <input type="number" min="0" step="0.01" required placeholder={saleItemType === 'egg' ? 'e.g. 10.50' : 'e.g. 220'} value={saleUnitPrice} onChange={(e) => setSaleUnitPrice(e.target.value)} className="input-field" />
              </div>

              {totalSaleEggQty > 0 && saleUnitPrice && (
                <div style={{ backgroundColor: 'rgba(61, 107, 140, 0.12)', padding: '10px 14px', borderRadius: '8px', color: '#3D6B8C', fontWeight: 800, fontSize: '0.95rem' }}>
                  Total Revenue: ৳{(totalSaleEggQty * Number(saleUnitPrice)).toLocaleString()}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Buyer / Customer Name</label>
                <input type="text" placeholder="e.g. Wholesale Buyer" value={saleCustomer} onChange={(e) => setSaleCustomer(e.target.value)} className="input-field" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Date</label>
                <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="input-field" />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setSaleModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={submittingSale} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#3D6B8C' }}>
                  {submittingSale ? 'Recording...' : '💰 Record Income'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
