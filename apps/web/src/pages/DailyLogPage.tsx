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

  // Form Sections: 'log' (Daily Feeding & Production) vs 'stock' (Store Feed Stock Entry)
  const [activeFormTab, setActiveFormTab] = useState<'log' | 'stock'>('log');
  const [summaryData, setSummaryData] = useState<any>(null);

  // Daily Log Form fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [crates, setCrates] = useState<number>(0);
  const [looseEggs, setLooseEggs] = useState<number>(0);
  const [brokenEggCount, setBrokenEggCount] = useState<number>(0);
  const [deadCount, setDeadCount] = useState<number>(0);
  const [feedBags, setFeedBags] = useState<number>(1);
  const [feedLooseKg, setFeedLooseKg] = useState<number>(0);
  const [waterGivenLiters, setWaterGivenLiters] = useState<number>(100);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Store Feed Stock Form fields
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0]);
  const [stockBags, setStockBags] = useState<number>(10);
  const [bagPrice, setBagPrice] = useState<number>(2500);
  const [stockBatchId, setStockBatchId] = useState('');
  const [stockVendor, setStockVendor] = useState('');
  const [submittingStock, setSubmittingStock] = useState(false);

  const loadData = async () => {
    try {
      const [batchesData, logsData, summaryRes] = await Promise.all([
        fetchWithAuth('/batches?status=active'),
        fetchWithAuth('/logs'),
        fetchWithAuth('/reports/summary')
      ]);
      setBatches(batchesData);
      if (batchesData.length > 0 && !selectedBatchId) {
        setSelectedBatchId(batchesData[0]._id);
      }
      setLogs(logsData);
      setSummaryData(summaryRes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCalculatedEggs = cratesAndLooseToTotal(crates, looseEggs);
  const totalFeedGivenKg = (Number(feedBags || 0) * 50) + Number(feedLooseKg || 0);

  const availableStockKg = summaryData?.availableFeedStockKg ?? Infinity;
  const isFeedExceeded = (summaryData?.purchasedFeedKg || 0) > 0 && totalFeedGivenKg > availableStockKg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      setError('Please select an active batch');
      return;
    }

    if (isFeedExceeded) {
      setError(`Invalid Feed Amount! Total feed (${totalFeedGivenKg} kg) exceeds available Feed Stock (${availableStockKg} kg / ${summaryData?.availableFeedStockBags} Bags).`);
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
          feedGivenKg: totalFeedGivenKg,
          waterGivenLiters: Number(waterGivenLiters),
          notes
        })
      });

      setSuccessMsg(`Daily log saved! Recorded ${formatEggCount(totalCalculatedEggs)} and ${totalFeedGivenKg} kg (${feedBags} Bags + ${feedLooseKg} kg) feed given.`);
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

  const handleSubmitStoreFeedStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stockBags <= 0 || bagPrice <= 0) {
      setError('Please enter valid Bags and Price per Bag');
      return;
    }

    setSubmittingStock(true);
    setError('');
    setSuccessMsg('');

    const totalKgAdded = stockBags * 50;
    const totalExpenseAmount = stockBags * bagPrice;
    const expenseNote = `Purchased ${stockBags} Bags (${totalKgAdded.toLocaleString()} kg) of Feed @ ৳${bagPrice.toLocaleString()}/bag${stockVendor ? ` from ${stockVendor}` : ''}`;

    try {
      await fetchWithAuth('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          batchId: stockBatchId || undefined,
          category: 'feed',
          amount: totalExpenseAmount,
          date: stockDate,
          note: expenseNote
        })
      });

      setSuccessMsg(`🌾 Success! Added ${stockBags} Bags (${totalKgAdded.toLocaleString()} kg) to Feed Stock & recorded ৳${totalExpenseAmount.toLocaleString()} expense.`);
      setShowForm(false);
      setStockBags(10);
      setBagPrice(2500);
      setStockVendor('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add feed stock');
    } finally {
      setSubmittingStock(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('dailyLog')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fast touch-friendly entry form for daily egg collection, flock feeding & store feed stock</p>
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

      {/* Entry Form Container */}
      {showForm && (
        <div className="glass-panel" style={{ padding: '28px' }}>
          {/* Section Tabs */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <button
              type="button"
              onClick={() => setActiveFormTab('log')}
              style={{
                padding: '10px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer',
                backgroundColor: activeFormTab === 'log' ? 'rgba(74, 124, 89, 0.15)' : 'transparent',
                color: activeFormTab === 'log' ? '#4A7C59' : '#6B655C',
                border: `1px solid ${activeFormTab === 'log' ? '#4A7C59' : '#E8E2D8'}`
              }}
            >
              ⚡ 1. Daily Feeding & Yield Log
            </button>
            <button
              type="button"
              onClick={() => setActiveFormTab('stock')}
              style={{
                padding: '10px 18px', borderRadius: '10px', fontWeight: 800, fontSize: '0.92rem', cursor: 'pointer',
                backgroundColor: activeFormTab === 'stock' ? 'rgba(217, 164, 65, 0.15)' : 'transparent',
                color: activeFormTab === 'stock' ? '#D9A441' : '#6B655C',
                border: `1px solid ${activeFormTab === 'stock' ? '#D9A441' : '#E8E2D8'}`
              }}
            >
              🌾 2. Store Feed Stock Entry (Buy Feed Bags)
            </button>
          </div>

          {error && <div style={{ color: 'var(--accent-rose)', fontSize: '0.85rem', marginBottom: '14px' }}>{error}</div>}

          {/* SECTION 1: DAILY FEEDING & PRODUCTION LOG */}
          {activeFormTab === 'log' ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Select Active Batch *</label>
                  <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="input-field">
                    {batches.map(b => (
                      <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Date *</label>
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

                {/* Feed Given Additive Input (Full Bags + Loose kg) with Stock Validation */}
                <div style={{ background: isFeedExceeded ? 'rgba(239, 68, 68, 0.1)' : 'rgba(217, 164, 65, 0.1)', padding: '16px', borderRadius: '12px', border: `1px solid ${isFeedExceeded ? '#EF4444' : 'rgba(217, 164, 65, 0.3)'}`, gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.88rem', fontWeight: 800, color: isFeedExceeded ? '#EF4444' : '#D9A441', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Scale size={18} color={isFeedExceeded ? '#EF4444' : '#D9A441'} /> Feed Given (Full Bags + Loose kg) *
                    </label>
                    <span className="badge" style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', color: '#4A7C59', fontSize: '0.78rem', fontWeight: 800 }}>
                      🌾 Available Stock: {(summaryData?.availableFeedStockKg || 0).toLocaleString()} kg ({summaryData?.availableFeedStockBags || 0} Bags)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B655C', marginBottom: '4px', display: 'block' }}>Full Bags (50 kg / bag)</label>
                      <input type="number" min="0" placeholder="e.g. 1" value={feedBags} onChange={(e) => setFeedBags(Number(e.target.value))} className="input-field" />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B655C', marginBottom: '4px', display: 'block' }}>Loose Feed (kg)</label>
                      <input type="number" min="0" placeholder="e.g. 5" value={feedLooseKg} onChange={(e) => setFeedLooseKg(Number(e.target.value))} className="input-field" />
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isFeedExceeded ? '#EF4444' : '#2D2A26' }}>
                      Total Feed Given: <strong>{totalFeedGivenKg.toLocaleString()} kg</strong> <span style={{ fontSize: '0.8rem', color: '#6B655C' }}>({feedBags} Bags + {feedLooseKg} kg)</span>
                    </div>
                    {isFeedExceeded && (
                      <div style={{ color: '#EF4444', fontSize: '0.82rem', fontWeight: 800 }}>
                        ❌ Feed amount exceeds available stock ({availableStockKg.toLocaleString()} kg max)!
                      </div>
                    )}
                  </div>
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
          ) : (
            /* SECTION 2: STORE FEED STOCK ENTRY FORM (BUY FEED BAGS) */
            <form onSubmit={handleSubmitStoreFeedStock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: 'rgba(217, 164, 65, 0.08)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(217, 164, 65, 0.25)' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#D9A441', marginBottom: '4px' }}>🌾 Buy & Add Bags to Store Feed Stock</h3>
                <p style={{ fontSize: '0.8rem', color: '#6B655C' }}>Enter purchased feed bags and bag price to add to store inventory & record expense automatically (1 Bag = 50 kg).</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Date *</label>
                  <input type="date" required value={stockDate} onChange={(e) => setStockDate(e.target.value)} className="input-field" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Assign Batch (Optional)</label>
                  <select value={stockBatchId} onChange={(e) => setStockBatchId(e.target.value)} className="input-field">
                    <option value="">-- All / General Stock --</option>
                    {batches.map(b => (
                      <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#D9A441', marginBottom: '4px' }}>Number of Feed Bags Purchased *</label>
                  <input type="number" min="1" required placeholder="e.g. 10" value={stockBags} onChange={(e) => setStockBags(Number(e.target.value))} className="input-field" />
                  <div style={{ fontSize: '0.78rem', color: '#4A7C59', fontWeight: 700, marginTop: '4px' }}>
                    = {(stockBags * 50).toLocaleString()} kg feed added to stock
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#D9A441', marginBottom: '4px' }}>Price per Bag (৳) *</label>
                  <input type="number" min="1" step="0.01" required placeholder="e.g. 2500" value={bagPrice} onChange={(e) => setBagPrice(Number(e.target.value))} className="input-field" />
                  <div style={{ fontSize: '0.78rem', color: '#3D6B8C', fontWeight: 700, marginTop: '4px' }}>
                    Total Cost: ৳{(stockBags * bagPrice).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Feed Brand / Vendor Name (Optional)</label>
                <input type="text" placeholder="e.g. Sona Feed Mills Co." value={stockVendor} onChange={(e) => setStockVendor(e.target.value)} className="input-field" />
              </div>

              <button type="submit" disabled={submittingStock} className="btn btn-primary" style={{ backgroundColor: '#D9A441', height: '44px' }}>
                {submittingStock ? 'Adding Feed Stock...' : '🌾 Save & Add to Store Feed Stock'}
              </button>
            </form>
          )}
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
