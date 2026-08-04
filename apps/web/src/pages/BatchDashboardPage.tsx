import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { fetchWithAuth } from '../services/api';
import { IBatch } from '@poultry-ops/types';
import {
  Egg, AlertTriangle, DollarSign, ShoppingCart, TrendingUp,
  Scale, ArrowLeft, Zap, PlusCircle, Calendar, Bird, Home, Layers, RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { formatEggCount, cratesAndLooseToTotal } from '../utils/crates';

export const BatchDashboardPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLang();

  const [data, setData] = useState<any>(null);
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Daily Log Modal State for this batch
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [crates, setCrates] = useState('');
  const [looseEggs, setLooseEggs] = useState('');
  const [brokenEggCount, setBrokenEggCount] = useState('0');
  const [deadCount, setDeadCount] = useState('0');
  const [feedGivenKg, setFeedGivenKg] = useState('');
  const [waterGivenLiters, setWaterGivenLiters] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  // Record Sale Modal State for this batch
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleItemType, setSaleItemType] = useState<'egg' | 'chicken'>('egg');
  const [saleCrates, setSaleCrates] = useState('');
  const [saleLooseEggs, setSaleLooseEggs] = useState('');
  const [saleChickenQty, setSaleChickenQty] = useState('');
  const [saleUnitPrice, setSaleUnitPrice] = useState('');
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingSale, setSubmittingSale] = useState(false);

  const isOwner = user?.role === 'owner';

  const loadData = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const [dashData, batchesList] = await Promise.all([
        fetchWithAuth(`/reports/batch-dashboard/${batchId}`),
        fetchWithAuth('/batches')
      ]);
      setData(dashData);
      setBatches(batchesList);
    } catch (err: any) {
      console.error('Failed to load batch dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [batchId]);

  const totalLogEggs = cratesAndLooseToTotal(crates, looseEggs);
  const totalSaleEggQty = saleItemType === 'egg' ? cratesAndLooseToTotal(saleCrates, saleLooseEggs) : Number(saleChickenQty || 0);

  const handleSubmitQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalLogEggs <= 0 || !feedGivenKg || !waterGivenLiters) {
      alert('Please enter Egg count (Crates/Loose), Feed, and Water values');
      return;
    }
    setSubmittingLog(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await fetchWithAuth('/logs', {
        method: 'POST',
        body: JSON.stringify({
          batchId,
          date: today,
          eggCount: totalLogEggs,
          brokenEggCount: Number(brokenEggCount || 0),
          deadCount: Number(deadCount || 0),
          feedGivenKg: Number(feedGivenKg),
          waterGivenLiters: Number(waterGivenLiters),
        })
      });
      setQuickLogOpen(false);
      setCrates(''); setLooseEggs(''); setFeedGivenKg(''); setWaterGivenLiters('');
      loadData();
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
          batchId,
          quantity: totalSaleEggQty,
          unitPrice: Number(saleUnitPrice),
          date: saleDate,
          customerName: saleCustomer || undefined
        })
      });
      setSaleModalOpen(false);
      setSaleCrates(''); setSaleLooseEggs(''); setSaleChickenQty(''); setSaleUnitPrice(''); setSaleCustomer('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingSale(false);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#6B655C' }}>
        Loading Dedicated Batch Dashboard...
      </div>
    );
  }

  const { batch, eggSection, mortalitySection, expenseSection, sellSection, incomeSection, foodSection, dailyLogs } = data;
  const survivalRate = mortalitySection.initialCount > 0
    ? ((mortalitySection.currentCount / mortalitySection.initialCount) * 100).toFixed(1)
    : '0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Navigation Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => navigate('/batches')} className="btn btn-secondary" style={{ padding: '8px 14px' }}>
            <ArrowLeft size={18} /> Back to Batches
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2D2A26' }}>{batch.name}</h1>
              <span className="badge" style={{ backgroundColor: batch.type === 'layer' ? 'rgba(61, 107, 140, 0.15)' : 'rgba(217, 164, 65, 0.15)', color: batch.type === 'layer' ? '#3D6B8C' : '#D9A441', fontSize: '0.8rem', fontWeight: 700 }}>
                {batch.type.toUpperCase()}
              </span>
              <span className="badge" style={{ backgroundColor: batch.status === 'active' ? 'rgba(74, 124, 89, 0.15)' : 'rgba(107, 101, 92, 0.15)', color: batch.status === 'active' ? '#4A7C59' : '#6B655C', fontSize: '0.8rem', fontWeight: 700 }}>
                {batch.status.toUpperCase()}
              </span>
              <span className="badge" style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', color: '#4A7C59', fontSize: '0.8rem', fontWeight: 800, border: '1px solid rgba(74, 124, 89, 0.3)' }}>
                📅 Age: {batch.formattedAge} (Day {batch.dayNumber})
              </span>
            </div>
            <p style={{ color: '#6B655C', fontSize: '0.88rem', marginTop: '2px' }}>
              Breed: <strong style={{ color: '#2D2A26' }}>{batch.breed}</strong> | Shed: <strong style={{ color: '#2D2A26' }}>{batch.shed || 'Main Shed'}</strong> | Started: <strong style={{ color: '#2D2A26' }}>{new Date(batch.startDate).toLocaleDateString()}</strong>
            </p>
          </div>
        </div>

        {/* Flock Switcher & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6B655C' }}>Flock:</span>
            <select
              value={batchId}
              onChange={(e) => navigate(`/batch-dashboard/${e.target.value}`)}
              className="input-field"
              style={{ fontWeight: 700, padding: '8px 12px', minWidth: '180px' }}
            >
              {batches.map(b => (
                <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>
              ))}
            </select>
          </div>

          <button onClick={() => setQuickLogOpen(true)} className="btn btn-primary" style={{ backgroundColor: '#4A7C59' }}>
            <Zap size={18} /> ⚡ Log Daily Yield
          </button>

          {isOwner && (
            <button onClick={() => setSaleModalOpen(true)} className="btn btn-primary" style={{ backgroundColor: '#3D6B8C' }}>
              <ShoppingCart size={18} /> 💰 Record Sale
            </button>
          )}
        </div>
      </div>

      {/* 6 STRUCTURED BATCH SECTIONS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
         {/* SECTION 1: 🥚 EGG */}
        <div
          onClick={() => navigate(`/daily-report?batchId=${batchId}&tab=egg`)}
          className="glass-panel"
          style={{ padding: '22px', borderTop: '5px solid #4A7C59', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', padding: '8px', borderRadius: '10px', color: '#4A7C59' }}>
                <Egg size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>1. Egg Yield</h2>
                <p style={{ fontSize: '0.78rem', color: '#6B655C' }}>Eggs collected & laying productivity</p>
              </div>
            </div>
            <span className="badge badge-emerald" style={{ fontSize: '0.8rem' }}>{eggSection.eggLayingRate}% Laying Rate</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Eggs Collected</span>
              <strong style={{ fontSize: '1.15rem', color: '#4A7C59' }}>{formatEggCount(eggSection.totalEggs)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Raw Egg Count</span>
              <strong>{eggSection.totalEggs.toLocaleString()} eggs</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Broken / Damaged Eggs</span>
              <strong style={{ color: '#B23A2F' }}>{eggSection.totalBrokenEggs.toLocaleString()} eggs</strong>
            </div>
            <div style={{ padding: '8px', backgroundColor: 'rgba(74, 124, 89, 0.12)', borderRadius: '8px', textAlign: 'center', color: '#4A7C59', fontWeight: 800, fontSize: '0.82rem' }}>
              📅 View Date-wise Daily Egg Report →
            </div>
          </div>
        </div>

        {/* SECTION 2: 💀 MORTALITY RATE */}
        <div
          onClick={() => navigate(`/daily-report?batchId=${batchId}&tab=mortality`)}
          className="glass-panel"
          style={{ padding: '22px', borderTop: '5px solid #B23A2F', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(178, 58, 47, 0.15)', padding: '8px', borderRadius: '10px', color: '#B23A2F' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>2. Mortality Rate</h2>
                <p style={{ fontSize: '0.78rem', color: '#6B655C' }}>Flock health & survival metrics</p>
              </div>
            </div>
            <span className="badge badge-rose" style={{ fontSize: '0.8rem' }}>{mortalitySection.mortalityRate}% Mortality</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Dead Birds</span>
              <strong style={{ fontSize: '1.15rem', color: '#B23A2F' }}>{mortalitySection.totalDead} birds</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Current Active Birds</span>
              <strong style={{ color: '#4A7C59' }}>{mortalitySection.currentCount.toLocaleString()} birds</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Initial Bird Population</span>
              <strong>{mortalitySection.initialCount.toLocaleString()} birds</strong>
            </div>
            <div style={{ padding: '8px', backgroundColor: 'rgba(178, 58, 47, 0.12)', borderRadius: '8px', textAlign: 'center', color: '#B23A2F', fontWeight: 800, fontSize: '0.82rem' }}>
              📅 View Date-wise Daily Mortality Report →
            </div>
          </div>
        </div>

        {/* SECTION 3: 💸 EXPENSE */}
        <div
          onClick={() => navigate(`/daily-report?batchId=${batchId}&tab=expense`)}
          className="glass-panel"
          style={{ padding: '22px', borderTop: '5px solid #D9A441', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(217, 164, 65, 0.15)', padding: '8px', borderRadius: '10px', color: '#D9A441' }}>
                <DollarSign size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>3. Expenses</h2>
                <p style={{ fontSize: '0.78rem', color: '#6B655C' }}>Total flock operational costs</p>
              </div>
            </div>
            <strong style={{ fontSize: '1.2rem', color: '#D9A441' }}>৳{expenseSection.totalExpenses.toLocaleString()}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6B655C', textTransform: 'uppercase' }}>Cost Breakdown:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem' }}>
              <div style={{ backgroundColor: '#F4EFE6', padding: '8px 10px', borderRadius: '6px' }}>🌾 Feed: ৳{expenseSection.costByCategory.feed.toLocaleString()}</div>
              <div style={{ backgroundColor: '#F4EFE6', padding: '8px 10px', borderRadius: '6px' }}>💊 Meds: ৳{expenseSection.costByCategory.medicine.toLocaleString()}</div>
              <div style={{ backgroundColor: '#F4EFE6', padding: '8px 10px', borderRadius: '6px' }}>👷 Labor: ৳{expenseSection.costByCategory.labor.toLocaleString()}</div>
              <div style={{ backgroundColor: '#F4EFE6', padding: '8px 10px', borderRadius: '6px' }}>💡 Utility: ৳{expenseSection.costByCategory.utility.toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#6B655C', marginTop: '6px' }}>
              <span>Cost / Bird: <strong>৳{expenseSection.costPerBird}</strong></span>
              <span>Cost / Egg: <strong>৳{expenseSection.costPerEgg}</strong></span>
            </div>
            <div style={{ padding: '8px', backgroundColor: 'rgba(217, 164, 65, 0.12)', borderRadius: '8px', textAlign: 'center', color: '#D9A441', fontWeight: 800, fontSize: '0.82rem' }}>
              📅 View Date-wise Daily Expense Report →
            </div>
          </div>
        </div>

        {/* SECTION 4: 🏷️ SELL */}
        <div
          onClick={() => navigate(`/daily-report?batchId=${batchId}&tab=sell`)}
          className="glass-panel"
          style={{ padding: '22px', borderTop: '5px solid #3D6B8C', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(61, 107, 140, 0.15)', padding: '8px', borderRadius: '10px', color: '#3D6B8C' }}>
                <ShoppingCart size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>4. Sales Volume</h2>
                <p style={{ fontSize: '0.78rem', color: '#6B655C' }}>Eggs & Birds sales quantity</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Eggs Sold</span>
              <strong style={{ color: '#3D6B8C', fontSize: '1.1rem' }}>{formatEggCount(sellSection.totalEggsSold)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Chickens / Birds Sold</span>
              <strong>{sellSection.totalChickensSold.toLocaleString()} birds</strong>
            </div>
            <div style={{ padding: '8px', backgroundColor: 'rgba(61, 107, 140, 0.12)', borderRadius: '8px', textAlign: 'center', color: '#3D6B8C', fontWeight: 800, fontSize: '0.82rem' }}>
              📅 View Date-wise Daily Sales Report →
            </div>
          </div>
        </div>

        {/* SECTION 5: 📈 INCOME & NET PROFIT */}
        <div
          onClick={() => navigate(`/daily-report?batchId=${batchId}&tab=income`)}
          className="glass-panel"
          style={{ padding: '22px', borderTop: '5px solid #C7511F', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(199, 81, 31, 0.15)', padding: '8px', borderRadius: '10px', color: '#C7511F' }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>5. Income & Net Profit</h2>
                <p style={{ fontSize: '0.78rem', color: '#6B655C' }}>Revenue vs Expenses profitability</p>
              </div>
            </div>
            <span className="badge" style={{ backgroundColor: incomeSection.netProfit >= 0 ? 'rgba(74, 124, 89, 0.15)' : 'rgba(178, 58, 47, 0.15)', color: incomeSection.netProfit >= 0 ? '#4A7C59' : '#B23A2F', fontSize: '0.8rem' }}>
              {incomeSection.profitMargin}% Margin
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Sales Income</span>
              <strong style={{ color: '#3D6B8C', fontSize: '1.1rem' }}>৳{incomeSection.totalIncome.toLocaleString()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Net Batch Profit / Loss</span>
              <strong style={{ fontSize: '1.2rem', color: incomeSection.netProfit >= 0 ? '#4A7C59' : '#B23A2F' }}>
                ৳{incomeSection.netProfit.toLocaleString()}
              </strong>
            </div>
            <div style={{ padding: '8px', backgroundColor: 'rgba(199, 81, 31, 0.12)', borderRadius: '8px', textAlign: 'center', color: '#C7511F', fontWeight: 800, fontSize: '0.82rem' }}>
              📅 View Date-wise Daily Income Report →
            </div>
          </div>
        </div>

        {/* SECTION 6: 🌾 FOOD INFO */}
        <div
          onClick={() => navigate(`/daily-report?batchId=${batchId}&tab=food`)}
          className="glass-panel"
          style={{ padding: '22px', borderTop: '5px solid #4A7C59', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'transform 0.2s' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', padding: '8px', borderRadius: '10px', color: '#4A7C59' }}>
                <Scale size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>6. Food Info</h2>
                <p style={{ fontSize: '0.78rem', color: '#6B655C' }}>Feed consumption & intake benchmark</p>
              </div>
            </div>
            <span className="badge badge-emerald" style={{ fontSize: '0.8rem' }}>{foodSection.feedPerChickenPercentage}% Target</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Feed Consumed</span>
              <strong style={{ color: '#4A7C59' }}>{foodSection.totalFeedKg.toLocaleString()} kg ({Math.round(foodSection.totalFeedKg / 50)} bags)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Daily Feed / Chicken</span>
              <strong>{foodSection.feedPerChickenGrams} g / bird / day</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', backgroundColor: '#F4EFE6', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: '#6B655C', fontWeight: 600 }}>Total Water Provided</span>
              <strong>{foodSection.totalWaterLiters.toLocaleString()} Liters</strong>
            </div>
            <div style={{ padding: '8px', backgroundColor: 'rgba(74, 124, 89, 0.12)', borderRadius: '8px', textAlign: 'center', color: '#4A7C59', fontWeight: 800, fontSize: '0.82rem' }}>
              📅 View Date-wise Daily Food Report →
            </div>
          </div>
        </div>
      </div>

      {/* Daily Egg Yield Trend Chart for this Batch */}
      <div className="glass-panel" style={{ padding: '24px', backgroundColor: '#FFFFFF' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D2A26', marginBottom: '16px' }}>
          📈 {batch.name} Daily Egg Yield Trend
        </h3>
        <div style={{ height: '260px', width: '100%' }}>
          {dailyLogs.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[...dailyLogs].reverse()}>
                <defs>
                  <linearGradient id="batchEggGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A7C59" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#4A7C59" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#6B655C" fontSize={11} />
                <YAxis stroke="#6B655C" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E8E2D8', color: '#2D2A26' }} />
                <Area type="monotone" dataKey="eggCount" stroke="#4A7C59" strokeWidth={3} fillOpacity={1} fill="url(#batchEggGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B655C' }}>
              No log data recorded yet for this batch. Click "⚡ Log Daily Yield" to add data!
            </div>
          )}
        </div>
      </div>

      {/* QUICK LOG MODAL */}
      {quickLogOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45, 42, 38, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '28px', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', padding: '8px', borderRadius: '10px', color: '#4A7C59' }}>
                <Zap size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2D2A26' }}>Log Daily Yield ({batch.name})</h2>
                <p style={{ fontSize: '0.8rem', color: '#6B655C' }}>Enter today's Crates + Loose Eggs</p>
              </div>
            </div>

            <form onSubmit={handleSubmitQuickLog} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                <input type="number" step="0.1" required placeholder="50" value={feedGivenKg} onChange={(e) => setFeedGivenKg(e.target.value)} className="input-field" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Water Given (L) *</label>
                <input type="number" step="0.1" required placeholder="200" value={waterGivenLiters} onChange={(e) => setWaterGivenLiters(e.target.value)} className="input-field" />
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

      {/* RECORD SALE MODAL */}
      {saleModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(45, 42, 38, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '28px', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(61, 107, 140, 0.15)', padding: '8px', borderRadius: '10px', color: '#3D6B8C' }}>
                <ShoppingCart size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2D2A26' }}>Record Sale ({batch.name})</h2>
                <p style={{ fontSize: '0.8rem', color: '#6B655C' }}>Sell eggs (Crates + Loose) or Chickens</p>
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

              {saleItemType === 'egg' ? (
                <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.08)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(74, 124, 89, 0.2)' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#4A7C59', marginBottom: '8px' }}>Egg Quantity (1 Crate = 30 Eggs)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#6B655C', marginBottom: '4px' }}>Full Crates</label>
                      <input type="number" min="0" placeholder="1" value={saleCrates} onChange={(e) => setSaleCrates(e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: '#6B655C', marginBottom: '4px' }}>Loose Eggs</label>
                      <input type="number" min="0" placeholder="10" value={saleLooseEggs} onChange={(e) => setSaleLooseEggs(e.target.value)} className="input-field" />
                    </div>
                  </div>
                  <div style={{ marginTop: '8px', color: '#4A7C59', fontWeight: 800, fontSize: '0.88rem' }}>
                    Total Selling: {formatEggCount(totalSaleEggQty)} ({totalSaleEggQty} eggs)
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>Number of Chickens / Birds *</label>
                  <input type="number" min="1" required placeholder="50" value={saleChickenQty} onChange={(e) => setSaleChickenQty(e.target.value)} className="input-field" />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#6B655C', marginBottom: '6px' }}>
                  {saleItemType === 'egg' ? 'Price per Egg (৳) *' : 'Price per Chicken (৳) *'}
                </label>
                <input type="number" min="0" step="0.01" required placeholder="10.50" value={saleUnitPrice} onChange={(e) => setSaleUnitPrice(e.target.value)} className="input-field" />
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
