import React, { useEffect, useState, useCallback } from 'react';
import { useLang } from '../context/LangContext';
import { fetchWithAuth } from '../services/api';
import { IReportMetrics } from '@poultry-ops/types';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import {
  Download, Calendar, Bell, Filter, Search,
  Egg, AlertTriangle, DollarSign, Activity, TrendingUp, ShoppingBag, Bird
} from 'lucide-react';
import { formatEggCount } from '../utils/crates';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

export const ReportsPage: React.FC = () => {
  const { t } = useLang();
  
  // Data states
  const [summary, setSummary] = useState<IReportMetrics | null>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [batchData, setBatchData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters: Daily, Last 7 Days, 15 Days, Last Month, All Time
  const [selectedDays, setSelectedDays] = useState<string>('30');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let fromDateStr = '';
      if (selectedDays !== 'all') {
        const daysAgo = parseInt(selectedDays, 10);
        const d = new Date();
        d.setDate(d.getDate() - (daysAgo - 1));
        fromDateStr = d.toISOString().split('T')[0];
      }

      const params: string[] = [];
      if (selectedBatch !== 'all') params.push(`batchId=${selectedBatch}`);
      if (fromDateStr) params.push(`from=${fromDateStr}`);
      const queryString = params.length > 0 ? `?${params.join('&')}` : '';

      const [sum, daily, batch, monthly, sales, activeBatches] = await Promise.all([
        fetchWithAuth(`/reports/summary${queryString}`),
        fetchWithAuth(`/reports/daily${queryString}`),
        fetchWithAuth('/reports/batch-breakdown'),
        fetchWithAuth('/reports/monthly'),
        fetchWithAuth('/sales'),
        fetchWithAuth('/batches'),
      ]);
      setSummary(sum);
      setDailyData(daily);
      setBatchData(batch);
      setMonthlyData(monthly);
      setSalesData(sales);
      setBatches(activeBatches);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDays, selectedBatch]);

  useEffect(() => { loadData(); }, [loadData]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (dailyData.length === 0) return;
    const headers = ['Date', 'Egg Yield', 'Broken Eggs', 'Dead Birds', 'Feed (kg)', 'Water (L)', 'Total Expense (BDT)'];
    const rows = dailyData.map(d => [
      d.date, d.eggCount, d.brokenEggCount, d.deadCount, d.feedGivenKg, d.waterGivenLiters, d.totalExpense
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PoultryOps_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredDaily = dailyData.filter(d =>
    d.date.includes(searchQuery) || String(d.eggCount).includes(searchQuery)
  );

  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredDaily.length / itemsPerPage) || 1;
  const paginatedDaily = filteredDaily.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const pieData = summary?.costByCategory
    ? Object.entries(summary.costByCategory).map(([cat, amount]) => ({
        name: cat.toUpperCase(),
        value: Number(amount)
      })).filter(d => d.value > 0)
    : [];

  const totalIncome = summary?.totalIncome || 0;
  const totalCost = summary?.totalCost || 0;
  const netProfit = totalIncome - totalCost;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Controls Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc' }}>Reports & Sales Income</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>Production analytics, egg stock, sales revenue & profitability breakdown.</p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(e.target.value)}
            style={{
              padding: '9px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#1e293b', color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem'
            }}
          >
            <option value="1">Daily (Today)</option>
            <option value="7">Last 7 Days</option>
            <option value="15">Last 15 Days</option>
            <option value="30">Last Month (30 Days)</option>
            <option value="all">All Time</option>
          </select>

          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            style={{
              padding: '9px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#1e293b', color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem'
            }}
          >
            <option value="all">All Flocks / Batches</option>
            {batches.map(b => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>

          <button onClick={handleExportCSV} className="btn btn-primary">
            <Download size={16} /> Export (CSV)
          </button>
        </div>
      </div>

      {/* KPI Cards Row (Income & Inventory Highlights) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Total Sales Income */}
        <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(59, 130, 246, 0.4)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(30, 41, 59, 1) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="metric-label" style={{ color: '#3b82f6', fontWeight: 700 }}>Total Sales Income</div>
              <div className="metric-value" style={{ color: '#3b82f6' }}>৳{totalIncome.toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', padding: '8px', borderRadius: '50%', color: '#3b82f6' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
            Eggs: {summary?.totalEggsSold || 0} ({formatEggCount(summary?.totalEggsSold || 0)}) | Birds: {summary?.totalChickensSold || 0}
          </div>
        </div>

        {/* Net Profit / Loss */}
        <div className="glass-panel" style={{ padding: '20px', border: `1px solid ${netProfit >= 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="metric-label">Net Profit / (Loss)</div>
              <div className="metric-value" style={{ color: netProfit >= 0 ? '#10b981' : '#f43f5e' }}>
                ৳{netProfit.toLocaleString()}
              </div>
            </div>
            <div style={{ backgroundColor: netProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)', padding: '8px', borderRadius: '50%', color: netProfit >= 0 ? '#10b981' : '#f43f5e' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            Income ৳{totalIncome} - Cost ৳{totalCost}
          </div>
        </div>

        {/* Current Egg Stock */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="metric-label">Current Egg Stock</div>
              <div className="metric-value" style={{ color: '#10b981' }}>{formatEggCount(summary?.currentEggCount || 0)}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '8px', borderRadius: '50%', color: '#10b981' }}>
              <Egg size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '6px' }}>
            {(summary?.currentEggCount || 0).toLocaleString()} eggs available unsold
          </div>
        </div>

        {/* All Time Eggs */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="metric-label">All-Time Eggs</div>
              <div className="metric-value">{(summary?.allTimeEggCount || 0).toLocaleString()}</div>
            </div>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '50%', color: '#f59e0b' }}>
              <Egg size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '6px' }}>
            {formatEggCount(summary?.allTimeEggCount || 0)} total logged
          </div>
        </div>

        {/* Mortality Rate */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="metric-label">Mortality Rate</div>
              <div className="metric-value">{summary?.mortalityRate || 0}%</div>
            </div>
            <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', padding: '8px', borderRadius: '50%', color: '#f43f5e' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#f43f5e', marginTop: '6px' }}>
            Total Dead: {summary?.totalDead || 0} Birds
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Production vs Mortality Chart */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>Production vs Mortality</h3>
          </div>
          {dailyData.length > 0 ? (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff' }} />
                  <Area type="monotone" dataKey="eggCount" name="Egg Yield" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>No yield data recorded.</div>
          )}
        </div>

        {/* Sales Records History List */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>Recent Sales History</h3>
            <span style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600 }}>{salesData.length} Total Sales</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
            {salesData.length > 0 ? (
              salesData.map(sale => (
                <div key={sale._id} style={{ background: '#334155', padding: '12px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
                      {sale.itemType === 'egg' ? '🥚 Egg Sale' : '🐔 Chicken Sale'} — {sale.date}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                      Qty: {sale.itemType === 'egg' ? formatEggCount(sale.quantity) : `${sale.quantity} birds`} @ ৳{sale.unitPrice}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#3b82f6', fontWeight: 800, fontSize: '1rem' }}>+৳{sale.totalAmount.toLocaleString()}</div>
                    {sale.customerName && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{sale.customerName}</div>}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                No sales recorded yet. Use "+ Record Sale" on Dashboard to track sales income.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Records Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>Daily Yield & Production Records</h3>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '36px', height: '38px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>DATE ↓</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>EGGS (CRATES + LOOSE)</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>BROKEN</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>DEAD</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>FEED (KG)</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>WATER (L)</th>
                <th style={{ padding: '12px 10px', fontWeight: 700 }}>COST (৳)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDaily.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 600, color: '#f8fafc' }}>{d.date}</td>
                  <td style={{ padding: '12px 10px', color: '#10b981', fontWeight: 700 }}>
                    {formatEggCount(d.eggCount)} <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>({d.eggCount})</span>
                  </td>
                  <td style={{ padding: '12px 10px', color: '#f59e0b' }}>{d.brokenEggCount}</td>
                  <td style={{ padding: '12px 10px', color: d.deadCount > 0 ? '#f43f5e' : '#f8fafc', fontWeight: d.deadCount > 0 ? 700 : 400 }}>
                    {d.deadCount}
                  </td>
                  <td style={{ padding: '12px 10px' }}>{d.feedGivenKg}</td>
                  <td style={{ padding: '12px 10px' }}>{d.waterGivenLiters}</td>
                  <td style={{ padding: '12px 10px', fontWeight: 600 }}>৳{d.totalExpense.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Showing {paginatedDaily.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredDaily.length)} of {filteredDaily.length} entries
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', cursor: 'pointer',
                  backgroundColor: currentPage === p ? '#10b981' : '#334155', color: '#ffffff', fontWeight: currentPage === p ? 700 : 500
                }}
              >
                {p}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
