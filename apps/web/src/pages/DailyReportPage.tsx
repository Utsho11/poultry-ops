import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../services/api';
import { formatEggCount } from '../utils/crates';
import { ArrowLeft, Calendar, Egg, AlertTriangle, ChevronDown, ChevronUp, Scale, Droplet, DollarSign, Filter } from 'lucide-react';
import { IBatch } from '@poultry-ops/types';

export const DailyReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const batchId = searchParams.get('batchId');

  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batchId || 'all');
  const [loading, setLoading] = useState(true);

  // Accordion state: Set of expanded date strings
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

      // Automatically expand the first (newest) date accordion
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

  const selectedBatchObj = batches.find(b => b._id === selectedBatchId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '8px 14px' }}>
            <ArrowLeft size={18} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2D2A26' }}>
              Date-wise Daily Egg Report
            </h1>
            <p style={{ color: '#6B655C', fontSize: '0.9rem' }}>
              {selectedBatchObj ? `Daily egg yield & performance history for ${selectedBatchObj.name}` : 'All daily logs listed date-by-date (Click any row to expand)'}
            </p>
          </div>
        </div>

        {/* Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B655C' }}>Select Flock:</span>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
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
                  border: `1px solid ${isExpanded ? '#4A7C59' : '#E8E2D8'}`,
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
                    <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', padding: '8px', borderRadius: '10px', color: '#4A7C59' }}>
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
                      <div style={{ fontSize: '0.8rem', color: '#6B655C', marginTop: '2px' }}>
                        Collected: <strong style={{ color: '#4A7C59' }}>{formatEggCount(log.eggCount)}</strong> ({log.eggCount} eggs)
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Dynamic Color Change for Laying % Shifts */}
                    {log.rateTrend === 'up' && (
                      <span className="badge" style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', color: '#4A7C59', fontSize: '0.82rem', fontWeight: 800, border: '1px solid rgba(74, 124, 89, 0.4)' }}>
                        ▲ {log.eggLayingRate}% (+{log.rateDiff}%)
                      </span>
                    )}
                    {log.rateTrend === 'down' && (
                      <span className="badge" style={{ backgroundColor: 'rgba(178, 58, 47, 0.15)', color: '#B23A2F', fontSize: '0.82rem', fontWeight: 800, border: '1px solid rgba(178, 58, 47, 0.4)' }}>
                        ▼ {log.eggLayingRate}% ({log.rateDiff}%)
                      </span>
                    )}
                    {log.rateTrend === 'same' && (
                      <span className="badge" style={{ backgroundColor: 'rgba(61, 107, 140, 0.15)', color: '#3D6B8C', fontSize: '0.82rem', fontWeight: 800 }}>
                        {log.eggLayingRate}% Laying
                      </span>
                    )}

                    {log.brokenEggCount > 0 && (
                      <span className="badge" style={{ backgroundColor: 'rgba(178, 58, 47, 0.12)', color: '#B23A2F', fontSize: '0.78rem' }}>
                        {log.brokenEggCount} Broken
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
                      
                      {/* Collected Eggs Breakdown */}
                      <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #4A7C59' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4A7C59', marginBottom: '4px' }}>
                          🥚 COLLECTED EGGS (WHOLE DAY)
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D2A26' }}>
                          {formatEggCount(log.eggCount)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6B655C', marginTop: '2px' }}>
                          Total: {log.eggCount.toLocaleString()} eggs collected
                        </div>
                      </div>

                      {/* Broken / Damaged Eggs */}
                      <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #B23A2F' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#B23A2F', marginBottom: '4px' }}>
                          💔 BROKEN / DAMAGED EGGS
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#B23A2F' }}>
                          {log.brokenEggCount} eggs
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6B655C', marginTop: '2px' }}>
                          Loss percentage: {log.eggCount > 0 ? ((log.brokenEggCount / log.eggCount) * 100).toFixed(1) : 0}%
                        </div>
                      </div>

                      {/* Daily Laying Rate % */}
                      <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #3D6B8C' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3D6B8C', marginBottom: '4px' }}>
                          📈 DAILY LAYING RATE %
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#3D6B8C' }}>
                          {log.eggLayingRate}% Hen-Day Yield
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6B655C', marginTop: '2px' }}>
                          Productivity benchmark for this day
                        </div>
                      </div>

                      {/* Feed & Water Intake */}
                      <div style={{ backgroundColor: '#F4EFE6', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #D9A441' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D9A441', marginBottom: '4px' }}>
                          🌾 FEED & WATER CONSUMPTION
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#2D2A26' }}>
                          Feed: {log.feedGivenKg} kg | Water: {log.waterGivenLiters} L
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6B655C', marginTop: '2px' }}>
                          Mortality: {log.deadCount > 0 ? `${log.deadCount} dead` : '0 dead'}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#6B655C' }}>
          No daily yield logs recorded yet. Log daily entries to view date-wise accordion breakdowns!
        </div>
      )}
    </div>
  );
};
