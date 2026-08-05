import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth } from '../services/api';
import { IBatch, IUser } from '@poultry-ops/types';
import { Layers, Plus, Calendar, Bird, Home, Users, DollarSign, Egg, AlertTriangle, Scale, ShoppingCart, TrendingUp, BarChart2, ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { formatEggCount } from '../utils/crates';

function getBatchAgeText(startDateStr: string) {
  if (!startDateStr) return 'N/A';
  const start = new Date(startDateStr);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const w = Math.floor(diffDays / 7);
  const d = diffDays % 7;
  const dayNumber = diffDays + 1;
  const formatted = w === 0 ? `${d}d` : d === 0 ? `${w}w` : `${w}w ${d}d`;
  return `${formatted} (Day ${dayNumber})`;
}

export const BatchesPage: React.FC = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialBatchId = searchParams.get('batchId');

  const [batches, setBatches] = useState<IBatch[]>([]);
  const [teamWorkers, setTeamWorkers] = useState<IUser[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [assignModalBatch, setAssignModalBatch] = useState<IBatch | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Dedicated Batchwise Dashboard state
  const [activeBatchId, setActiveBatchId] = useState<string | null>(initialBatchId);
  const [batchDashboardData, setBatchDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Form fields for create
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('Cobb 500');
  const [type, setType] = useState<'layer' | 'broiler'>('layer');
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

  useEffect(() => {
    const bId = searchParams.get('batchId');
    if (bId) {
      loadBatchDashboard(bId);
    }
  }, [searchParams]);

  const loadBatchDashboard = async (batchId: string) => {
    setActiveBatchId(batchId);
    setLoadingDashboard(true);
    try {
      const data = await fetchWithAuth(`/reports/batch-dashboard/${batchId}`);
      setBatchDashboardData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load batch dashboard');
    } finally {
      setLoadingDashboard(false);
    }
  };

  // bKash-style Password Security Verification Modal state
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityAction, setSecurityAction] = useState<'create' | 'delete' | 'close' | null>(null);
  const [batchTarget, setBatchTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [verifyingSecurity, setVerifyingSecurity] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Trigger Create Security Verification Modal
  const handleOpenCreateSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !breed || !initialCount || Number(initialCount) <= 0) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    setSecurityAction('create');
    setConfirmPassword('');
    setSecurityError('');
    setSecurityModalOpen(true);
  };

  // Trigger Delete Security Verification Modal
  const handleOpenDeleteSecurity = (id: string, batchName: string) => {
    if (!canManage) {
      alert('Unauthorized! Only farm Owners and Managers can delete flocks.');
      return;
    }
    setBatchTarget({ id, name: batchName });
    setSecurityAction('delete');
    setConfirmPassword('');
    setSecurityError('');
    setSecurityModalOpen(true);
  };

  // Trigger Close Security Verification Modal
  const handleOpenCloseSecurity = (id: string, batchName: string) => {
    if (!canManage) {
      alert('Unauthorized! Only farm Owners and Managers can close flocks.');
      return;
    }
    setBatchTarget({ id, name: batchName });
    setSecurityAction('close');
    setConfirmPassword('');
    setSecurityError('');
    setSecurityModalOpen(true);
  };

  // Confirm and Execute Action with Password Verification (bKash Style)
  const handleConfirmSecurityAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmPassword) {
      setSecurityError('Please enter your account password to verify');
      return;
    }

    setVerifyingSecurity(true);
    setSecurityError('');

    try {
      if (securityAction === 'create') {
        await fetchWithAuth('/batches', {
          method: 'POST',
          body: JSON.stringify({
            name, breed, type, startDate,
            initialCount: Number(initialCount), shed,
            assignedWorkerIds: selectedWorkerIds,
            password: confirmPassword
          })
        });
        setSecurityModalOpen(false);
        setShowModal(false);
        setName('');
        setSelectedWorkerIds([]);
        loadData();
      } else if (securityAction === 'delete' && batchTarget) {
        await fetchWithAuth(`/batches/${batchTarget.id}`, {
          method: 'DELETE',
          body: JSON.stringify({ password: confirmPassword })
        });
        setSecurityModalOpen(false);
        if (activeBatchId === batchTarget.id) {
          setActiveBatchId(null);
          setBatchDashboardData(null);
        }
        setBatchTarget(null);
        loadData();
      } else if (securityAction === 'close' && batchTarget) {
        await fetchWithAuth(`/batches/${batchTarget.id}/close`, {
          method: 'POST',
          body: JSON.stringify({ password: confirmPassword })
        });
        setSecurityModalOpen(false);
        if (activeBatchId === batchTarget.id) loadBatchDashboard(batchTarget.id);
        setBatchTarget(null);
        loadData();
      }
    } catch (err: any) {
      setSecurityError(err.message || 'Security verification failed. Check your password.');
    } finally {
      setVerifyingSecurity(false);
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
      if (activeBatchId === id) loadBatchDashboard(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#6B655C' }}>Loading Batches...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{t('batches')}</h1>
          <p style={{ color: '#6B655C', fontSize: '0.9rem' }}>
            {user?.role === 'worker' ? 'Your Assigned Bird Flocks' : 'Batchwise Performance Analytics, Egg Yields, Food Info & Income'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeBatchId && (
            <button onClick={() => setActiveBatchId(null)} className="btn btn-secondary">
              <ArrowLeft size={18} /> Back to All Batches
            </button>
          )}
          {canManage && (
            <button onClick={() => { setSelectedWorkerIds([]); setShowModal(true); }} className="btn btn-primary">
              <Plus size={18} />
              {t('addBatch')}
            </button>
          )}
        </div>
      </div>

      {/* 📊 DEDICATED BATCHWISE DASHBOARD VIEW */}
      {activeBatchId ? (
        loadingDashboard || !batchDashboardData ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#6B655C' }}>
            Loading Batchwise Dashboard...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Batch Header Bar & Dropdown Switcher */}
            <div className="glass-panel" style={{ padding: '20px', borderLeft: '6px solid #C7511F', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span className="badge badge-emerald" style={{ backgroundColor: 'rgba(199, 81, 31, 0.15)', color: '#C7511F', border: '1px solid rgba(199, 81, 31, 0.3)' }}>
                    {batchDashboardData.batch.type.toUpperCase()} FLOCK
                  </span>
                  <span className="badge" style={{ backgroundColor: batchDashboardData.batch.status === 'active' ? 'rgba(74, 124, 89, 0.15)' : 'rgba(107, 101, 92, 0.15)', color: batchDashboardData.batch.status === 'active' ? '#4A7C59' : '#6B655C' }}>
                    {batchDashboardData.batch.status.toUpperCase()}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{batchDashboardData.batch.name} Dashboard</h2>
                <p style={{ fontSize: '0.85rem', color: '#6B655C' }}>Breed: <strong>{batchDashboardData.batch.breed}</strong> | Shed: <strong>{batchDashboardData.batch.shed || 'Main Shed'}</strong> | Started: <strong>{new Date(batchDashboardData.batch.startDate).toLocaleDateString()}</strong></p>
              </div>

              {/* Batch Switcher Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#6B655C', marginBottom: '4px' }}>Switch Batch Dashboard:</label>
                <select
                  value={activeBatchId}
                  onChange={(e) => loadBatchDashboard(e.target.value)}
                  className="input-field"
                  style={{ fontWeight: 700, minWidth: '220px' }}
                >
                  {batches.map(b => (
                    <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 6 STRUCTURED SECTIONS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {/* SECTION 1: 🥚 EGG */}
              <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #4A7C59' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', padding: '6px', borderRadius: '8px', color: '#4A7C59' }}>
                      <Egg size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>1. Egg Yield</h3>
                  </div>
                  <span className="badge badge-emerald">{batchDashboardData.eggSection.eggLayingRate}% Laying Rate</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Eggs Collected</span>
                    <strong style={{ fontSize: '1.1rem', color: '#4A7C59' }}>{formatEggCount(batchDashboardData.eggSection.totalEggs)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Raw Egg Count</span>
                    <strong>{batchDashboardData.eggSection.totalEggs.toLocaleString()} eggs</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Broken / Damaged Eggs</span>
                    <strong style={{ color: '#B23A2F' }}>{batchDashboardData.eggSection.totalBrokenEggs.toLocaleString()} eggs</strong>
                  </div>
                </div>
              </div>

              {/* SECTION 2: 💀 MORTALITY RATE */}
              <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #B23A2F' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(178, 58, 47, 0.15)', padding: '6px', borderRadius: '8px', color: '#B23A2F' }}>
                      <AlertTriangle size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>2. Mortality Rate</h3>
                  </div>
                  <span className="badge badge-rose">{batchDashboardData.mortalitySection.mortalityRate}% Mortality</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Dead Birds</span>
                    <strong style={{ fontSize: '1.1rem', color: '#B23A2F' }}>{batchDashboardData.mortalitySection.totalDead} birds</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Current Active Birds</span>
                    <strong style={{ color: '#4A7C59' }}>{batchDashboardData.mortalitySection.currentCount.toLocaleString()} birds</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Initial Bird Population</span>
                    <strong>{batchDashboardData.mortalitySection.initialCount.toLocaleString()} birds</strong>
                  </div>
                </div>
              </div>

              {/* SECTION 3: 💸 EXPENSE (BATCHWISE) */}
              <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #D9A441' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(217, 164, 65, 0.15)', padding: '6px', borderRadius: '8px', color: '#D9A441' }}>
                      <DollarSign size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>3. Batch Expenses</h3>
                  </div>
                  <strong style={{ fontSize: '1.1rem', color: '#D9A441' }}>৳{batchDashboardData.expenseSection.totalExpenses.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B655C', textTransform: 'uppercase' }}>Cost Breakdown:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem' }}>
                    <div style={{ backgroundColor: '#F4EFE6', padding: '6px 10px', borderRadius: '6px' }}>💊 Meds: ৳{(batchDashboardData.expenseSection.costByCategory.medicine || 0).toLocaleString()}</div>
                    <div style={{ backgroundColor: '#F4EFE6', padding: '6px 10px', borderRadius: '6px' }}>👷 Labor: ৳{(batchDashboardData.expenseSection.costByCategory.labor || 0).toLocaleString()}</div>
                    <div style={{ backgroundColor: '#F4EFE6', padding: '6px 10px', borderRadius: '6px' }}>💡 Utility: ৳{(batchDashboardData.expenseSection.costByCategory.utility || 0).toLocaleString()}</div>
                    <div style={{ backgroundColor: '#F4EFE6', padding: '6px 10px', borderRadius: '6px' }}>🔧 Equip: ৳{(batchDashboardData.expenseSection.costByCategory.equipment || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6B655C', marginTop: '4px' }}>
                    <span>Cost / Bird: <strong>৳{batchDashboardData.expenseSection.costPerBird}</strong></span>
                    <span>Cost / Egg: <strong>৳{batchDashboardData.expenseSection.costPerEgg}</strong></span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: 🏷️ SELL (BATCHWISE) */}
              <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #3D6B8C' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(61, 107, 140, 0.15)', padding: '6px', borderRadius: '8px', color: '#3D6B8C' }}>
                      <ShoppingCart size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>4. Batch Sales</h3>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Eggs Sold</span>
                    <strong style={{ color: '#3D6B8C' }}>{formatEggCount(batchDashboardData.sellSection.totalEggsSold)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Chickens Sold</span>
                    <strong>{batchDashboardData.sellSection.totalChickensSold.toLocaleString()} birds</strong>
                  </div>
                </div>
              </div>

              {/* SECTION 5: 📈 INCOME (BATCHWISE) */}
              <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #C7511F' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(199, 81, 31, 0.15)', padding: '6px', borderRadius: '8px', color: '#C7511F' }}>
                      <TrendingUp size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>5. Income & Profit</h3>
                  </div>
                  <span className="badge" style={{ backgroundColor: batchDashboardData.incomeSection.netProfit >= 0 ? 'rgba(74, 124, 89, 0.15)' : 'rgba(178, 58, 47, 0.15)', color: batchDashboardData.incomeSection.netProfit >= 0 ? '#4A7C59' : '#B23A2F' }}>
                    {batchDashboardData.incomeSection.profitMargin}% Margin
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Revenue</span>
                    <strong style={{ color: '#3D6B8C' }}>৳{batchDashboardData.incomeSection.totalIncome.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Net Batch Profit / Loss</span>
                    <strong style={{ fontSize: '1.15rem', color: batchDashboardData.incomeSection.netProfit >= 0 ? '#4A7C59' : '#B23A2F' }}>
                      ৳{batchDashboardData.incomeSection.netProfit.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* SECTION 6: 🌾 FOOD INFO (BATCHWISE) */}
              <div className="glass-panel" style={{ padding: '20px', borderTop: '4px solid #4A7C59' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', padding: '6px', borderRadius: '8px', color: '#4A7C59' }}>
                      <Scale size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>6. Food Info</h3>
                  </div>
                  <span className="badge badge-emerald">{batchDashboardData.foodSection.feedPerChickenPercentage}% Intake</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Feed Consumed</span>
                    <strong style={{ color: '#4A7C59' }}>{batchDashboardData.foodSection.totalFeedKg.toLocaleString()} kg ({Math.round(batchDashboardData.foodSection.totalFeedKg / 50)} bags)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Daily Feed / Chicken</span>
                    <strong>{batchDashboardData.foodSection.feedPerChickenGrams} g / bird / day</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Water Provided</span>
                    <strong>{batchDashboardData.foodSection.totalWaterLiters.toLocaleString()} Liters</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        /* STANDARD BATCHES GRID */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {batches.map((batch) => {
            const isClosed = batch.status === 'closed';
            const mortalityCount = batch.initialCount - batch.currentCount;
            const mortalityPct = ((mortalityCount / batch.initialCount) * 100).toFixed(1);
            const assignedWorkers = teamWorkers.filter(w => (batch.assignedWorkerIds || []).includes(w._id));

            return (
              <div key={batch._id} className="glass-panel" style={{ padding: '24px', opacity: isClosed ? 0.75 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{batch.name}</h3>
                  <span className={`badge ${isClosed ? 'badge-rose' : 'badge-emerald'}`}>
                    {batch.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: '#6B655C', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bird size={16} color="#C7511F" />
                    <span>Breed: <strong style={{ color: '#2D2A26' }}>{batch.breed} ({batch.type})</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Home size={16} color="#D9A441" />
                    <span>Location: <strong style={{ color: '#2D2A26' }}>{batch.shed || 'Main Shed'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} color="#3D6B8C" />
                    <span>Age: <strong style={{ color: '#4A7C59' }}>{getBatchAgeText(batch.startDate)}</strong> (Started {new Date(batch.startDate).toLocaleDateString()})</span>
                  </div>
                </div>

                {/* Bird Stats Progress Bar */}
                <div style={{ background: '#F4EFE6', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span>Current Birds: <strong>{batch.currentCount}</strong></span>
                    <span style={{ color: '#B23A2F' }}>Mortality: {mortalityPct}% ({mortalityCount})</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#E8E2D8', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(batch.currentCount / batch.initialCount) * 100}%`, height: '100%', background: '#4A7C59', borderRadius: '4px' }} />
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button
                    onClick={() => window.location.href = `/batch-dashboard/${batch._id}`}
                    className="btn btn-primary"
                    style={{ flex: 1, backgroundColor: '#C7511F', fontSize: '0.85rem', padding: '8px 12px' }}
                  >
                    <BarChart2 size={16} /> 📊 Dedicated Batch Dashboard
                  </button>
                </div>

                {/* Assigned Workers List */}
                <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.08)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4A7C59', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} /> Assigned Workers ({assignedWorkers.length})
                    </span>
                    {canManage && (
                      <button
                        onClick={() => handleOpenAssignModal(batch)}
                        style={{ background: 'none', border: 'none', color: '#4A7C59', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Assign Workers
                      </button>
                    )}
                  </div>
                  {assignedWorkers.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {assignedWorkers.map(w => (
                        <span key={w._id} style={{ backgroundColor: '#F4EFE6', color: '#2D2A26', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', fontWeight: 600, border: '1px solid #E8E2D8' }}>
                          👤 {w.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#6B655C' }}>
                      {canManage ? 'All workers can access (Click Assign Workers to restrict)' : 'Assigned to All Workers'}
                    </span>
                  )}
                </div>

                {canManage && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid #E8E2D8', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {!isClosed && (
                      <button
                        onClick={() => handleOpenCloseSecurity(batch._id, batch.name)}
                        style={{ background: 'none', border: 'none', color: '#B23A2F', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                        title="Close Flock with Password Verification"
                      >
                        Close Batch
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenDeleteSecurity(batch._id, batch.name)}
                      style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', fontSize: '0.78rem', fontWeight: 800, padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', marginLeft: 'auto' }}
                      title="Delete Flock with Password Verification"
                    >
                      🗑️ Delete Flock
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE BATCH MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45, 42, 38, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '28px', backgroundColor: '#FFFFFF' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '16px' }}>{t('addBatch')}</h2>
            {error && <div style={{ color: '#B23A2F', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}

            <form onSubmit={handleOpenCreateSecurity} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Batch / Flock Name *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Batch 2026-A" className="input-field" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Breed *</label>
                  <input type="text" required value={breed} onChange={(e) => setBreed(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Type *</label>
                  <select value={type} onChange={(e: any) => setType(e.target.value)} className="input-field">
                    <option value="layer">🥚 Layer (Egg Production)</option>
                    <option value="broiler">🍗 Broiler (Meat Production)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Initial Bird Count *</label>
                  <input type="number" min="1" required value={initialCount} onChange={(e) => setInitialCount(Number(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Start Date *</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Shed / House Name</label>
                <input type="text" value={shed} onChange={(e) => setShed(e.target.value)} className="input-field" />
              </div>

              {teamWorkers.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#4A7C59', marginBottom: '6px' }}>Assign Workers (Optional)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    {teamWorkers.map(w => {
                      const isSel = selectedWorkerIds.includes(w._id);
                      return (
                        <div
                          key={w._id}
                          onClick={() => toggleWorkerSelection(w._id)}
                          style={{
                            padding: '6px 12px', borderRadius: '8px', border: `1px solid ${isSel ? '#4A7C59' : '#E8E2D8'}`,
                            backgroundColor: isSel ? 'rgba(74,124,89,0.15)' : '#F4EFE6', color: isSel ? '#4A7C59' : '#6B655C',
                            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          {isSel ? '✓ ' : '+ '} {w.name} ({w.email})
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#C7511F' }}>
                  {submitting ? 'Creating...' : t('addBatch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WORKER ASSIGNMENT MODAL */}
      {assignModalBatch && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45, 42, 38, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '24px', backgroundColor: '#FFFFFF' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '6px' }}>Assign Workers</h2>
            <p style={{ fontSize: '0.82rem', color: '#6B655C', marginBottom: '16px' }}>
              Select workers who are allowed to log data for <strong>{assignModalBatch.name}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', marginBottom: '20px' }}>
              {teamWorkers.map(w => {
                const isAssigned = selectedWorkerIds.includes(w._id);
                return (
                  <div
                    key={w._id}
                    onClick={() => toggleWorkerSelection(w._id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                      border: `1px solid ${isAssigned ? '#4A7C59' : '#E8E2D8'}`,
                      backgroundColor: isAssigned ? 'rgba(74,124,89,0.15)' : '#F4EFE6'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2D2A26' }}>{w.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6B655C' }}>{w.email}</div>
                    </div>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: isAssigned ? '#4A7C59' : 'transparent', border: '1px solid #4A7C59', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 800 }}>
                      {isAssigned ? '✓' : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setAssignModalBatch(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSaveAssignments} className="btn btn-primary" style={{ flex: 1, backgroundColor: '#4A7C59' }}>Save Assignments</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔐 BKASH-STYLE PASSWORD SECURITY VERIFICATION MODAL */}
      {securityModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45, 42, 38, 0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '2px solid #E2136E', boxShadow: '0 20px 40px rgba(226, 19, 110, 0.2)' }}>
            
            {/* Header with bKash Security Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #E8E2D8' }}>
              <div style={{ backgroundColor: '#E2136E', color: '#FFFFFF', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={26} />
              </div>
              <div>
                <span className="badge" style={{ backgroundColor: 'rgba(226, 19, 110, 0.12)', color: '#E2136E', fontWeight: 800, fontSize: '0.75rem' }}>
                  bKash-Style Security Verification
                </span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#2D2A26', marginTop: '2px' }}>Enter Password to Authorize</h2>
              </div>
            </div>

            {/* Account & Action Card */}
            <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid #E8E2D8' }}>
              <div style={{ fontSize: '0.78rem', color: '#6B655C', fontWeight: 700, textTransform: 'uppercase' }}>Account User</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#2D2A26', marginBottom: '8px' }}>👤 {user?.name} ({user?.email})</div>
              
              <div style={{ fontSize: '0.78rem', color: '#6B655C', fontWeight: 700, textTransform: 'uppercase' }}>Target Action</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 800, color: securityAction === 'delete' || securityAction === 'close' ? '#B23A2F' : '#4A7C59' }}>
                {securityAction === 'create' ? `➕ Create New Flock '${name}'` : securityAction === 'delete' ? `🗑️ Delete Flock '${batchTarget?.name}'` : `🔒 Close Flock '${batchTarget?.name}'`}
              </div>
            </div>

            {securityError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                {securityError}
              </div>
            )}

            <form onSubmit={handleConfirmSecurityAction}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#2D2A26', marginBottom: '6px' }}>
                  🔑 Enter Your Account Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Enter login password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field"
                    style={{ paddingRight: '40px', fontSize: '1rem', border: '2px solid #E2136E' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6B655C', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setSecurityModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingSecurity}
                  className="btn btn-primary"
                  style={{ flex: 1, backgroundColor: securityAction === 'delete' ? '#B23A2F' : '#E2136E', fontWeight: 800 }}
                >
                  {verifyingSecurity ? 'Verifying...' : '⚡ Confirm & Proceed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
