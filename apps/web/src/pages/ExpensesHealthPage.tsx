import React, { useEffect, useState } from 'react';
import { useLang } from '../context/LangContext';
import { fetchWithAuth } from '../services/api';
import { IExpense, IHealthRecord, IBatch } from '@poultry-ops/types';
import { DollarSign, ShieldAlert, Plus, Tag, Calendar, UserCheck } from 'lucide-react';

export const ExpensesHealthPage: React.FC = () => {
  const { t } = useLang();
  const [expenses, setExpenses] = useState<IExpense[]>([]);
  const [healthRecords, setHealthRecords] = useState<IHealthRecord[]>([]);
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [activeTab, setActiveTab] = useState<'expenses' | 'health'>('expenses');

  // Filters
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');

  // Expense form state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expBatchId, setExpBatchId] = useState('');
  const [expCategory, setExpCategory] = useState<'feed' | 'medicine' | 'labor' | 'utility' | 'equipment' | 'other'>('feed');
  const [feedCategory, setFeedCategory] = useState<'layer_starter' | 'layer_grower' | 'layer_layer_1' | 'broiler_starter' | 'broiler_grower' | 'broiler_finisher'>('layer_layer_1');
  const [stockBags, setStockBags] = useState<number>(10);
  const [bagPrice, setBagPrice] = useState<number>(2500);
  const [expAmount, setExpAmount] = useState<number>(5000);
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expNote, setExpNote] = useState('');

  // Health form state
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthBatchId, setHealthBatchId] = useState('');
  const [healthDate, setHealthDate] = useState(new Date().toISOString().split('T')[0]);
  const [healthType, setHealthType] = useState<'checkup' | 'vaccination' | 'injection' | 'treatment'>('vaccination');
  const [healthDesc, setHealthDesc] = useState('');
  const [healthMedicine, setHealthMedicine] = useState('');
  const [healthVet, setHealthVet] = useState('');
  const [healthCost, setHealthCost] = useState<number>(0);

  const loadData = async () => {
    try {
      const [expData, healthData, batchData] = await Promise.all([
        fetchWithAuth('/expenses'),
        fetchWithAuth('/health-records'),
        fetchWithAuth('/batches')
      ]);
      setExpenses(expData);
      setHealthRecords(healthData);
      setBatches(batchData);
      if (batchData.length > 0) {
        if (!expBatchId) setExpBatchId(batchData[0]._id);
        if (!healthBatchId) setHealthBatchId(batchData[0]._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (expCategory === 'feed') {
        await fetchWithAuth('/feed-stock', {
          method: 'POST',
          body: JSON.stringify({
            category: feedCategory,
            bagPrice: Number(bagPrice),
            bags: Number(stockBags),
            date: expDate,
            note: expNote ? `Vendor/Details: ${expNote}` : undefined
          })
        });
      } else {
        if (!expBatchId) {
          alert('Please select a target Flock / Batch.');
          return;
        }
        if (expCategory === 'labor') {
          const selectedBatch = batches.find(b => b._id === expBatchId);
          if (!selectedBatch?.assignedWorkerIds || selectedBatch.assignedWorkerIds.length === 0) {
            alert('Cannot add labor expense to this batch because no workers are assigned to this flock/batch. Please assign a worker to the batch first.');
            return;
          }
        }
        await fetchWithAuth('/expenses', {
          method: 'POST',
          body: JSON.stringify({
            batchId: expBatchId,
            category: expCategory,
            amount: Number(expAmount),
            currency: 'BDT',
            date: expDate,
            note: expNote
          })
        });
      }
      setShowExpenseModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateHealthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!healthBatchId) {
      alert('Please select a target Flock / Batch.');
      return;
    }
    try {
      await fetchWithAuth('/health-records', {
        method: 'POST',
        body: JSON.stringify({
          batchId: healthBatchId,
          date: healthDate,
          type: healthType,
          description: healthDesc,
          medicineUsed: healthMedicine,
          performedBy: healthVet,
          cost: Number(healthCost)
        })
      });
      setShowHealthModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered lists
  const filteredExpenses = expenses.filter(exp => {
    const matchesBatch = selectedBatchFilter === 'all' || exp.batchId === selectedBatchFilter;
    const matchesDate = !selectedDateFilter || exp.date === selectedDateFilter;
    return matchesBatch && matchesDate;
  });

  const filteredHealthRecords = healthRecords.filter(hr => {
    const matchesBatch = selectedBatchFilter === 'all' || hr.batchId === selectedBatchFilter;
    const matchesDate = !selectedDateFilter || hr.date === selectedDateFilter;
    return matchesBatch && matchesDate;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('expensesHealth')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Record batch-wise expenses and track bird vaccination logs with manual date picking</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'expenses' ? (
            <button onClick={() => setShowExpenseModal(true)} className="btn btn-primary" style={{ fontWeight: 700 }}>
              <Plus size={18} /> Add Batch Expense
            </button>
          ) : (
            <button onClick={() => setShowHealthModal(true)} className="btn btn-primary" style={{ fontWeight: 700 }}>
              <Plus size={18} /> Add Health Record
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('expenses')}
            style={{
              padding: '10px 20px',
              borderRadius: '10px 10px 0 0',
              border: 'none',
              fontWeight: activeTab === 'expenses' ? 800 : 600,
              fontSize: '0.9rem',
              backgroundColor: activeTab === 'expenses' ? '#C7511F' : '#F4EFE6',
              color: activeTab === 'expenses' ? '#FFFFFF' : '#6B655C',
              cursor: 'pointer'
            }}
          >
            💰 Batch Expenses ({expenses.length})
          </button>
          <button
            onClick={() => setActiveTab('health')}
            style={{
              padding: '10px 20px',
              borderRadius: '10px 10px 0 0',
              border: 'none',
              fontWeight: activeTab === 'health' ? 800 : 600,
              fontSize: '0.9rem',
              backgroundColor: activeTab === 'health' ? '#C7511F' : '#F4EFE6',
              color: activeTab === 'health' ? '#FFFFFF' : '#6B655C',
              cursor: 'pointer'
            }}
          >
            🏥 Health & Vaccination ({healthRecords.length})
          </button>
        </div>

        {/* Filter Bar (Batch & Date) */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: '#F4EFE6', padding: '8px 14px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2D2A26' }}>🐔 Flock:</span>
            <select
              value={selectedBatchFilter}
              onChange={(e) => setSelectedBatchFilter(e.target.value)}
              className="input-field"
              style={{ padding: '4px 8px', fontSize: '0.82rem', fontWeight: 700 }}
            >
              <option value="all">All Flocks / Batches</option>
              {batches.map(b => (
                <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2D2A26' }}>📅 Date:</span>
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="input-field"
              style={{ padding: '4px 8px', fontSize: '0.82rem', fontWeight: 700 }}
            />
            {selectedDateFilter && (
              <button
                onClick={() => setSelectedDateFilter('')}
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', backgroundColor: '#E8E2D8', cursor: 'pointer', fontWeight: 700 }}
              >
                Clear Date
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      {activeTab === 'expenses' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Batch Expenses Ledger</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Flock / Batch</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Amount</th>
                  <th style={{ padding: '12px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => {
                  const bObj = batches.find(b => b._id === exp.batchId);
                  return (
                    <tr key={exp._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{exp.date}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#3D6B8C' }}>{bObj ? bObj.name : 'All Flocks'}</td>
                      <td style={{ padding: '12px' }}>
                        <span className="badge badge-amber">{exp.category.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--brand-primary)' }}>৳{exp.amount.toLocaleString()}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{exp.note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Health Records Table */}
      {activeTab === 'health' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Vaccination & Treatment Records</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Flock / Batch</th>
                  <th style={{ padding: '12px' }}>Type</th>
                  <th style={{ padding: '12px' }}>Description</th>
                  <th style={{ padding: '12px' }}>Medicine Used</th>
                  <th style={{ padding: '12px' }}>Performed By</th>
                  <th style={{ padding: '12px' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredHealthRecords.map((hr) => {
                  const bObj = batches.find(b => b._id === hr.batchId);
                  return (
                    <tr key={hr._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{hr.date}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#3D6B8C' }}>{bObj ? bObj.name : '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <span className="badge badge-emerald">{hr.type.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px' }}>{hr.description}</td>
                      <td style={{ padding: '12px', color: 'var(--accent-blue)' }}>{hr.medicineUsed || '—'}</td>
                      <td style={{ padding: '12px' }}>{hr.performedBy}</td>
                      <td style={{ padding: '12px' }}>৳{hr.cost || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Add Batch Expense</h2>
            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Select Flock / Batch *</label>
                <select value={expBatchId} onChange={(e) => setExpBatchId(e.target.value)} className="input-field" required>
                  <option value="" disabled>-- Select Batch (Required) --</option>
                  {batches.map(b => <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Category *</label>
                <select value={expCategory} onChange={(e) => setExpCategory(e.target.value as any)} className="input-field">
                  <option value="feed">🌾 Feed (খাবার Stock)</option>
                  <option value="medicine">💊 Medicine (ঔষধ / ভ্যাকসিন)</option>
                  <option value="labor">👷 Labor (শ্রমিক বেতন)</option>
                  <option value="utility">💡 Utility (বিদ্যুৎ / পানি)</option>
                  <option value="equipment">🔧 Equipment (যন্ত্রপাতি)</option>
                  <option value="other">📝 Other (অন্যান্য)</option>
                </select>
              </div>

              {expCategory === 'feed' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#D9A441', marginBottom: '4px' }}>
                      Feed Type / Sub-category *
                    </label>
                    <select value={feedCategory} onChange={(e: any) => setFeedCategory(e.target.value)} className="input-field" required>
                      <optgroup label="🥚 Layer Feed Categories">
                        <option value="layer_starter">Layer Starter</option>
                        <option value="layer_grower">Layer Grower</option>
                        <option value="layer_layer_1">Layer Layer-1</option>
                      </optgroup>
                      <optgroup label="🍗 Broiler Feed Categories">
                        <option value="broiler_starter">Broiler Starter</option>
                        <option value="broiler_grower">Broiler Grower</option>
                        <option value="broiler_finisher">Broiler Finisher</option>
                      </optgroup>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#D9A441', marginBottom: '4px' }}>Number of Bags *</label>
                      <input type="number" required min="1" placeholder="10" value={stockBags} onChange={(e) => setStockBags(Number(e.target.value))} className="input-field" />
                      <div style={{ fontSize: '0.78rem', color: '#4A7C59', fontWeight: 700, marginTop: '4px' }}>
                        = {(stockBags * 50).toLocaleString()} kg feed
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#D9A441', marginBottom: '4px' }}>Price per Bag (৳) *</label>
                      <input type="number" required min="1" step="0.01" placeholder="2500" value={bagPrice} onChange={(e) => setBagPrice(Number(e.target.value))} className="input-field" />
                      <div style={{ fontSize: '0.78rem', color: '#3D6B8C', fontWeight: 700, marginTop: '4px' }}>
                        Total: ৳{(stockBags * bagPrice).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Expense Date *</label>
                    <input type="date" required value={expDate} onChange={(e) => setExpDate(e.target.value)} className="input-field" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Select Flock / Batch *</label>
                    <select value={expBatchId} onChange={(e) => setExpBatchId(e.target.value)} className="input-field" required>
                      <option value="" disabled>-- Select Batch (Required) --</option>
                      {batches.map(b => <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Amount (BDT ৳) *</label>
                      <input type="number" required min="1" value={expAmount} onChange={(e) => setExpAmount(Number(e.target.value))} className="input-field" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Expense Date *</label>
                      <input type="date" required value={expDate} onChange={(e) => setExpDate(e.target.value)} className="input-field" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Notes / Supplier</label>
                <input type="text" value={expNote} onChange={(e) => setExpNote(e.target.value)} className="input-field" placeholder="Receipt or vendor details..." />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowExpenseModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Health Modal */}
      {showHealthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Add Vaccination / Treatment Record</h2>
            <form onSubmit={handleCreateHealthRecord} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Select Flock / Batch *</label>
                <select value={healthBatchId} onChange={(e) => setHealthBatchId(e.target.value)} className="input-field" required>
                  <option value="" disabled>-- Select Batch (Required) --</option>
                  {batches.map(b => <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Type</label>
                  <select value={healthType} onChange={(e) => setHealthType(e.target.value as any)} className="input-field">
                    <option value="vaccination">Vaccination (ভ্যাকসিন)</option>
                    <option value="checkup">Vet Checkup (ডাক্তার পর্যবেক্ষণ)</option>
                    <option value="injection">Injection</option>
                    <option value="treatment">Treatment</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Record Date (Manual) *</label>
                  <input type="date" required value={healthDate} onChange={(e) => setHealthDate(e.target.value)} className="input-field" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                <input type="text" required value={healthDesc} onChange={(e) => setHealthDesc(e.target.value)} className="input-field" placeholder="e.g. Gumboro Vaccine 1st Dose" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Medicine Used</label>
                  <input type="text" value={healthMedicine} onChange={(e) => setHealthMedicine(e.target.value)} className="input-field" placeholder="Vaccine Name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Performed By</label>
                  <input type="text" required value={healthVet} onChange={(e) => setHealthVet(e.target.value)} className="input-field" placeholder="Dr. Rahat / Staff" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowHealthModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
