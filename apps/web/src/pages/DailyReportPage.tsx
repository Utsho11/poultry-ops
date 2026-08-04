import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../services/api';
import { formatEggCount } from '../utils/crates';
import {
  ArrowLeft, Calendar, Egg, AlertTriangle, ChevronDown, ChevronUp,
  Scale, Droplet, DollarSign, ShoppingCart, TrendingUp, Filter
} from 'lucide-react';
import { IBatch } from '@poultry-ops/types';

export type ReportTab = 'egg' | 'mortality' | 'expense' | 'sell' | 'income' | 'food';

export const DailyReportPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const batchId = searchParams.get('batchId') || 'all';
  const activeTab = (searchParams.get('tab') as ReportTab) || 'egg';

  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batchId);
  const [loading, setLoading] = useState(true);

  // Accordion state
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const loadDailyReport = async () => {
    setLoading(true);
    try {
      const query = selectedBatchId !== 'all' ? `?batchId=${selectedBatchId}` : '';
      const [logs, batchesList] = await Promise.all([
        fetchWithAuth(`/reports/daily${query}`),
        fetchWithAuth('/batches')
      ]);
      setDailyLogs(logs);
      setBatches(batchesList);

      if (logs.length > 0) {
        setExpandedDates({ [logs[0].date]: true });
      }
    } catch (err: any) {
      console.error('Failed to load daily report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDailyReport(); }, [selectedBatchId]);

  const toggleAccordion = (dateStr: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  const handleTabChange = (tab: ReportTab) => {
    setSearchParams({ batchId: selectedBatchId, tab });
  };

  const handleBatchChange = (bId: string) => {
    setSelectedBatchId(bId);
    setSearchParams({ batchId: bId, tab: activeTab });
  };

  const selectedBatchObj = batches.find(b => b._id === selectedBatchId);

  const TAB_CONFIGS: Record<ReportTab, { label: string; icon: any; color: string; bg: string }> = {
    egg: { label: '1. Egg Yield', icon: Egg, color: '#4A7C59', bg: 'rgba(74, 124, 89, 0.15)' },
    mortality: { label: '2. Mortality Rate', icon: AlertTriangle, color: '#B23A2F', bg: 'rgba(178, 58, 47, 0.15)' },
    expense: { label: '3. Expenses', icon: DollarSign, color: '#D9A441', bg: 'rgba(217, 164, 65, 0.15)' },
    sell: { label: '4. Sales Volume', icon: ShoppingCart, color: '#3D6B8C', bg: 'rgba(61, 107, 140, 0.15)' },
    income: { label: '5. Income & Net Profit', icon: TrendingUp, color: '#C7511F', bg: 'rgba(199, 81, 31, 0.15)' },
    food: { label: '6. Food & Water', icon: Scale, color: '#4A7C59', bg: 'rgba(74, 124, 89, 0.15)' },
  };

  const currentTabConfig = TAB_CONFIGS[activeTab] || TAB_CONFIGS.egg;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '8px 14px' }}>
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2D2A26' }}>
              Date-wise Daily Performance Report
            </h1>
            <p style={{ color: '#6B655C', fontSize: '0.9rem' }}>
              {selectedBatchObj ? `Daily breakdown for ${selectedBatchObj.name}` : 'All daily logs listed date-by-date'}
            </p>
          </div>
        </div>

        {/* Flock Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B655C' }}>Select Flock:</span>
          <select
            value={selectedBatchId}
            onChange={(e) => handleBatchChange(e.target.value)}
            className="input-field"
            style={{ fontWeight: 700, padding: '8px 14px', minWidth: '200px' }}
          >
            <option value="all">Entire Farm (All Flocks)</option>
            {batches.map(b => (
              <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 SECTION NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '2px solid #E8E2D8' }}>
        {(Object.keys(TAB_CONFIGS) as ReportTab[]).map(tabKey => {
          const cfg = TAB_CONFIGS[tabKey];
          const Icon = cfg.icon;
          const isActive = activeTab === tabKey;
          return (
            <button
              key={tabKey}
              onClick={() => handleTabChange(tabKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px 10px 0 0',
                border: 'none',
                fontWeight: isActive ? 800 : 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                backgroundColor: isActive ? cfg.color : '#F4EFE6',
                color: isActive ? '#FFFFFF' : '#6B655C',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={18} />
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#6B655C' }}>Loading Date-wise Daily Logs...</div>
      ) : dailyLogs.length > 0 ? (
        /* ACCORDION LIST OF DAYS */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {dailyLogs.map((log: any) => {
            const isExpanded = !!expandedDates[log.date];
            return (
              <div
                key={log.date}
                className="glass-panel"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: `1px solid ${isExpanded ? currentTabConfig.color : '#E8E2D8'}`,
                  overflow: 'hidden',
                  transition: 'border-color 0.2s'
                }}
              >
                {/* Accordion Header Row */}
                <div
                  onClick={() => toggleAccordion(log.date)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    padding: '16px 20px',
                    backgroundColor: isExpanded ? '#F4EFE6' : '#FFFFFF',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: currentTabConfig.bg, padding: '8px', borderRadius: '10px', color: currentTabConfig.color }}>
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#2D2A26', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {log.dayNumber && (
                          <span className="badge" style={{ backgroundColor: 'rgba(199, 81, 31, 0.15)', color: '#C7511F', fontWeight: 800, fontSize: '0.78rem' }}>
                            Day {log.dayNumber} ({log.formattedAge})
                          </span>
                        )}
                        <span>Date: {log.date}</span>
                      </div>

                      {/* Header summary text customized per active tab */}
                      <div style={{ fontSize: '0.82rem', color: '#6B655C', marginTop: '3px' }}>
                        {activeTab === 'egg' && (
                          <span>Collected: <strong style={{ color: '#4A7C59' }}>{formatEggCount(log.eggCount)}</strong> ({log.eggCount} eggs)</span>
                        )}
                        {activeTab === 'mortality' && (
                          <span>Dead Birds: <strong style={{ color: log.deadCount > 0 ? '#B23A2F' : '#4A7C59' }}>{log.deadCount} birds</strong></span>
                        )}
                        {activeTab === 'expense' && (
                          <span>Daily Expenses: <strong style={{ color: '#D9A441' }}>৳{log.totalExpenses.toLocaleString()}</strong></span>
                        )}
                        {activeTab === 'sell' && (
                          <span>Sales Revenue: <strong style={{ color: '#3D6B8C' }}>৳{log.totalIncome.toLocaleString()}</strong> ({formatEggCount(log.eggsSold)} sold)</span>
                        )}
                        {activeTab === 'income' && (
                          <span>Net Profit / Loss: <strong style={{ color: log.netProfit >= 0 ? '#4A7C59' : '#B23A2F' }}>৳{log.netProfit.toLocaleString()}</strong></span>
                        )}
                        {activeTab === 'food' && (
                          <span>Feed: <strong>{log.feedGivenKg} kg</strong> | Water: <strong>{log.waterGivenLiters} L</strong></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {activeTab === 'egg' && (
                      <>
                        {log.rateTrend === 'up' && (
                          <span className="badge" style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', color: '#4A7C59', fontSize: '0.82rem', fontWeight: 800 }}>
                            ▲ {log.eggLayingRate}% (+{log.rateDiff}%)
                          </span>
                        )}
                        {log.rateTrend === 'down' && (
                          <span className="badge" style={{ backgroundColor: 'rgba(178, 58, 47, 0.15)', color: '#B23A2F', fontSize: '0.82rem', fontWeight: 800 }}>
                            ▼ {log.eggLayingRate}% ({log.rateDiff}%)
                          </span>
                        )}
                        {log.rateTrend === 'same' && (
                          <span className="badge" style={{ backgroundColor: 'rgba(61, 107, 140, 0.15)', color: '#3D6B8C', fontSize: '0.82rem', fontWeight: 800 }}>
                            {log.eggLayingRate}% Laying
                          </span>
                        )}
                      </>
                    )}

                    {activeTab === 'mortality' && (
                      <span className="badge" style={{ backgroundColor: log.deadCount > 0 ? 'rgba(178, 58, 47, 0.15)' : 'rgba(74, 124, 89, 0.15)', color: log.deadCount > 0 ? '#B23A2F' : '#4A7C59', fontSize: '0.8rem', fontWeight: 800 }}>
                        {log.deadCount > 0 ? `${log.deadCount} Dead` : '0 Deaths'}
                      </span>
                    )}

                    {activeTab === 'expense' && (
                      <span className="badge" style={{ backgroundColor: 'rgba(217, 164, 65, 0.15)', color: '#D9A441', fontSize: '0.85rem', fontWeight: 800 }}>
                        ৳{log.totalExpenses.toLocaleString()}
                      </span>
                    )}

                    {activeTab === 'sell' && (
                      <span className="badge" style={{ backgroundColor: 'rgba(61, 107, 140, 0.15)', color: '#3D6B8C', fontSize: '0.85rem', fontWeight: 800 }}>
                        ৳{log.totalIncome.toLocaleString()} Income
                      </span>
                    )}

                    {activeTab === 'income' && (
                      <span className="badge" style={{ backgroundColor: log.netProfit >= 0 ? 'rgba(74, 124, 89, 0.15)' : 'rgba(178, 58, 47, 0.15)', color: log.netProfit >= 0 ? '#4A7C59' : '#B23A2F', fontSize: '0.85rem', fontWeight: 800 }}>
                        {log.netProfit >= 0 ? 'Profit: ৳' : 'Loss: ৳'}{Math.abs(log.netProfit).toLocaleString()}
                      </span>
                    )}

                    {activeTab === 'food' && (
                      <span className="badge badge-emerald" style={{ fontSize: '0.8rem', fontWeight: 800 }}>
                        {log.feedGivenKg} kg Feed
                      </span>
                    )}

                    <div style={{ color: '#6B655C' }}>
                      {isExpanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
                    </div>
                  </div>
                </div>

                {/* Accordion Expanded Body */}
                {isExpanded && (
                  <div style={{ padding: '20px', borderTop: '1px solid #E8E2D8', backgroundColor: '#FFFFFF' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                      
                      {/* SECTION 1: EGG BREAKDOWN */}
                      {activeTab === 'egg' && (
                        <>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #4A7C59' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4A7C59', marginBottom: '4px' }}>🥚 COLLECTED EGGS</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>{formatEggCount(log.eggCount)}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6B655C', marginTop: '2px' }}>Total: {log.eggCount.toLocaleString()} eggs</div>
                          </div>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #B23A2F' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#B23A2F', marginBottom: '4px' }}>💔 BROKEN / DAMAGED EGGS</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#B23A2F' }}>{log.brokenEggCount} eggs</div>
                          </div>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #3D6B8C' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3D6B8C', marginBottom: '4px' }}>📈 DAILY LAYING RATE %</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#3D6B8C' }}>{log.eggLayingRate}% Hen-Day Yield</div>
                          </div>
                        </>
                      )}

                      {/* SECTION 2: MORTALITY BREAKDOWN */}
                      {activeTab === 'mortality' && (
                        <>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #B23A2F' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#B23A2F', marginBottom: '4px' }}>💀 DAILY MORTALITY / DEAD BIRDS</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#B23A2F' }}>{log.deadCount} birds</div>
                            <div style={{ fontSize: '0.8rem', color: '#6B655C', marginTop: '2px' }}>Reported on {log.date}</div>
                          </div>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #4A7C59' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4A7C59', marginBottom: '4px' }}>🌾 DAILY FEED GIVEN</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>{log.feedGivenKg} kg</div>
                          </div>
                        </>
                      )}

                      {/* SECTION 3: EXPENSE BREAKDOWN */}
                      {activeTab === 'expense' && (
                        <>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #D9A441' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D9A441', marginBottom: '4px' }}>💰 TOTAL DAILY EXPENSES</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2D2A26' }}>৳{log.totalExpenses.toLocaleString()}</div>
                          </div>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #3D6B8C' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3D6B8C', marginBottom: '4px' }}>CATEGORICAL BREAKDOWN</div>
                            <div style={{ fontSize: '0.85rem', color: '#2D2A26', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span>Feed Expense: ৳{log.feedExpense.toLocaleString()}</span>
                              <span>Medicine Expense: ৳{log.medicineExpense.toLocaleString()}</span>
                              <span>Labor Expense: ৳{log.laborExpense.toLocaleString()}</span>
                              <span>Utility Expense: ৳{log.utilityExpense.toLocaleString()}</span>
                            </div>
                          </div>
                        </>
                      )}

                      {/* SECTION 4: SELL BREAKDOWN */}
                      {activeTab === 'sell' && (
                        <>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #3D6B8C' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3D6B8C', marginBottom: '4px' }}>🏷️ DAILY SALES REVENUE</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3D6B8C' }}>৳{log.totalIncome.toLocaleString()}</div>
                          </div>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #4A7C59' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4A7C59', marginBottom: '4px' }}>EGGS & BIRDS SOLD</div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2D2A26' }}>
                              Eggs Sold: {formatEggCount(log.eggsSold)}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#6B655C', marginTop: '2px' }}>
                              Chickens Sold: {log.chickensSold} birds
                            </div>
                          </div>
                        </>
                      )}

                      {/* SECTION 5: INCOME BREAKDOWN */}
                      {activeTab === 'income' && (
                        <>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #3D6B8C' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3D6B8C', marginBottom: '4px' }}>📈 DAILY SALES INCOME</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#3D6B8C' }}>৳{log.totalIncome.toLocaleString()}</div>
                          </div>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #D9A441' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D9A441', marginBottom: '4px' }}>💸 DAILY OPERATIONAL COST</div>
                            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#D9A441' }}>৳{log.totalExpenses.toLocaleString()}</div>
                          </div>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: `4px solid ${log.netProfit >= 0 ? '#4A7C59' : '#B23A2F'}` }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: log.netProfit >= 0 ? '#4A7C59' : '#B23A2F', marginBottom: '4px' }}>⚖️ DAILY NET PROFIT / LOSS</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: log.netProfit >= 0 ? '#4A7C59' : '#B23A2F' }}>৳{log.netProfit.toLocaleString()}</div>
                          </div>
                        </>
                      )}

                      {/* SECTION 6: FOOD BREAKDOWN */}
                      {activeTab === 'food' && (
                        <>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #4A7C59' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4A7C59', marginBottom: '4px' }}>🌾 DAILY FEED GIVEN</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2D2A26' }}>{log.feedGivenKg} kg</div>
                            <div style={{ fontSize: '0.8rem', color: '#6B655C', marginTop: '2px' }}>{(log.feedGivenKg / 50).toFixed(1)} 50kg bags</div>
                          </div>
                          <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #3D6B8C' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3D6B8C', marginBottom: '4px' }}>💧 DAILY WATER PROVIDED</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3D6B8C' }}>{log.waterGivenLiters} Liters</div>
                          </div>
                        </>
                      )}

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#6B655C' }}>
          No daily records found for this section filter.
        </div>
      )}
    </div>
  );
};
