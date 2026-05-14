import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import Navbar from '../components/Navbar';
import MetricCard from '../components/MetricCard';
import api from '../utils/api';

const CATEGORY_COLORS = {
  'COD Dispute':        '#D40511',
  'Late Delivery':      '#FFCC00',
  'Damaged Parcel':     '#ff7f0e',
  'Missing Parcel':     '#9467bd',
  'Wrong Address':      '#17becf',
  'System Error':       '#e377c2',
  'Customer Complaint': '#7f7f7f',
  'Other':              '#bcbd22',
};

const SEVERITY_COLORS = {
  'Critical': 'text-red-700 bg-red-50',
  'High':     'text-orange-700 bg-orange-50',
  'Medium':   'text-yellow-700 bg-yellow-50',
  'Low':      'text-green-700 bg-green-50',
};

const SLA_STATE_STYLE = {
  AT_RISK:   'bg-amber-100 text-amber-800',
  CRITICAL:  'bg-red-100 text-red-700',
  BREACHED:  'bg-red-200 text-red-900 font-bold',
  ON_TRACK:  'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
};

function formatTimeRemaining(seconds) {
  if (!seconds || seconds <= 0) return 'OVERDUE';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatGeneratedAt(unixTs) {
  if (!unixTs) return '';
  return new Date(unixTs * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildChartData(weekly) {
  if (!weekly) return [];
  return weekly.labels.map((day, i) => {
    const point = { day };
    for (const [cat, counts] of Object.entries(weekly.datasets)) {
      point[cat] = counts[i];
    }
    return point;
  });
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
      <span className="w-1 h-4 bg-dhl-red rounded-full inline-block" />
      {children}
    </h2>
  );
}

function ComplianceBar({ rate }) {
  const color = rate >= 90 ? 'bg-green-500' : rate >= 70 ? 'bg-amber-400' : 'bg-red-500';
  const textColor = rate >= 90 ? 'text-green-700' : rate >= 70 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-xs font-semibold w-10 text-right ${textColor}`}>{rate}%</span>
    </div>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const { data: d } = await api.get('/reports/summary');
      setData(d);
    } catch (err) {
      console.error('Reports fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Navbar />
        <main className="ml-60 flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading reports...</div>
        </main>
      </div>
    );
  }

  const ds = data?.daily_summary;
  const sla = data?.sla_performance;
  const ph = data?.pipeline_health;
  const wt = data?.weekly_trend;

  const chartData = buildChartData(
    wt ? { labels: wt.labels, datasets: wt.datasets } : null
  );
  const activeCategories = Object.keys(CATEGORY_COLORS).filter(cat =>
    chartData.some(d => d[cat] > 0)
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navbar />
      <main className="ml-60 flex-1 p-6">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-500 text-sm mt-1">Auto-refreshes every 60s</p>
          </div>
          {data?.generated_at && (
            <span className="text-xs text-gray-400 mt-1">
              Generated: {formatGeneratedAt(data.generated_at)}
            </span>
          )}
        </div>

        {/* ── Section 1: Daily Operational Summary ────────────────────── */}
        <section className="mb-8">
          <SectionHeading>Daily Operational Summary</SectionHeading>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <MetricCard
              title="Total Today"
              value={ds?.total_today ?? 0}
              trend={ds?.change_percent}
            />
            <MetricCard
              title="Resolved Today"
              value={ds?.resolved_today ?? 0}
              trend={null}
              variant="success"
            />
            <MetricCard
              title="Pending"
              value={ds?.pending ?? 0}
              trend={null}
            />
            <MetricCard
              title="Breached Active"
              value={ds?.breached_active ?? 0}
              trend={null}
              variant="danger"
            />
          </div>

          <div className="card">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Today's Incidents by Category</h3>
            </div>
            {!ds?.by_category?.length ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No incidents today</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-2 text-left">Category</th>
                    <th className="px-5 py-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {ds.by_category.map((row, i) => (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-2.5 text-gray-700">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                          style={{ backgroundColor: CATEGORY_COLORS[row.category] || '#ccc' }}
                        />
                        {row.category}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-gray-900">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Section 2: SLA Performance ──────────────────────────────── */}
        <section className="mb-8">
          <SectionHeading>SLA Performance</SectionHeading>

          <div className="grid grid-cols-3 gap-4">
            {/* Compliance by Severity */}
            <div className="card">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Compliance by Severity</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Severity</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2 text-left w-32">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {sla?.by_severity?.map((row, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[row.severity] || 'bg-gray-100 text-gray-600'}`}>
                          {row.severity}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{row.total}</td>
                      <td className="px-4 py-2.5 w-32">
                        <ComplianceBar rate={row.compliance_rate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Compliance by Department */}
            <div className="card">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Compliance by Department</h3>
                <p className="text-xs text-gray-400 mt-0.5">Worst to best</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Department</th>
                    <th className="px-4 py-2 text-left w-32">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {sla?.by_department?.length ? (
                    sla.by_department.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-4 py-2.5 text-gray-700 text-xs">{row.department}</td>
                        <td className="px-4 py-2.5 w-32">
                          <ComplianceBar rate={row.compliance_rate} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400 text-xs">
                        No department data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Avg Resolution by Severity */}
            <div className="card">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Avg Resolution Time</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Severity</th>
                    <th className="px-4 py-2 text-right">Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sla?.avg_resolution_by_severity?.length ? (
                    sla.avg_resolution_by_severity.map((row, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[row.severity] || 'bg-gray-100 text-gray-600'}`}>
                            {row.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-700">
                          {row.avg_hours != null ? `${row.avg_hours}h` : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-gray-400 text-xs">
                        No resolved incidents yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Section 3: Critical Watch List ──────────────────────────── */}
        <section className="mb-8">
          <SectionHeading>Critical Watch List</SectionHeading>

          <div className="card">
            {!data?.critical_watchlist?.length ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                ✓ No critical incidents — all clear
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Ref</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-left">Department</th>
                    <th className="px-4 py-2 text-left">Severity</th>
                    <th className="px-4 py-2 text-left">SLA State</th>
                    <th className="px-4 py-2 text-right">Time Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.critical_watchlist.map(inc => {
                    const rowHighlight =
                      inc.sla_state === 'BREACHED'
                        ? 'border-l-4 border-l-red-500 bg-red-50/40'
                        : inc.sla_state === 'CRITICAL'
                        ? 'border-l-4 border-l-red-400'
                        : 'border-l-4 border-l-amber-400';
                    return (
                      <tr
                        key={inc.id}
                        onClick={() => navigate(`/incidents/${inc.id}`)}
                        className={`${rowHighlight} hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0`}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{inc.incident_ref}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-700">{inc.category}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{inc.primary_department}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[inc.severity] || 'bg-gray-100 text-gray-600'}`}>
                            {inc.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${SLA_STATE_STYLE[inc.sla_state] || 'bg-gray-100 text-gray-600'}`}>
                            {inc.sla_state}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`text-xs font-mono font-medium ${
                            inc.sla_state === 'BREACHED'
                              ? 'text-red-700 font-bold'
                              : inc.sla_state === 'CRITICAL'
                              ? 'text-red-600'
                              : 'text-amber-600'
                          }`}>
                            {formatTimeRemaining(inc.time_remaining)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Section 4: Pipeline Health ───────────────────────────────── */}
        <section className="mb-8">
          <SectionHeading>Pipeline Health</SectionHeading>

          <div className="grid grid-cols-4 gap-4 mb-4">
            <MetricCard
              title="Total Processed"
              value={ph?.total_processed ?? 0}
              trend={null}
            />
            <MetricCard
              title="GenAI Success Rate"
              value={`${ph?.genai_success_rate ?? 0}%`}
              trend={null}
              variant="success"
            />
            <MetricCard
              title="Fallback Rate"
              value={`${ph?.fallback_rate ?? 0}%`}
              trend={null}
              variant={ph?.fallback_rate > 20 ? 'danger' : 'default'}
            />
            <MetricCard
              title="Avg LLM Confidence"
              value={`${ph?.avg_llm_confidence ?? 0}%`}
              trend={null}
            />
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">GenAI vs Fallback Processing Split</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-14 text-right shrink-0">GenAI</span>
              <div className="flex-1 flex h-6 rounded-full overflow-hidden bg-gray-100">
                {(ph?.genai_count ?? 0) + (ph?.fallback_count ?? 0) > 0 ? (
                  <>
                    <div
                      className="bg-green-500 flex items-center justify-center text-white text-xs font-medium transition-all"
                      style={{ width: `${ph?.genai_success_rate ?? 0}%` }}
                    >
                      {(ph?.genai_success_rate ?? 0) > 12 ? `${ph.genai_success_rate}%` : ''}
                    </div>
                    <div
                      className="bg-amber-400 flex items-center justify-center text-white text-xs font-medium transition-all"
                      style={{ width: `${ph?.fallback_rate ?? 0}%` }}
                    >
                      {(ph?.fallback_rate ?? 0) > 12 ? `${ph.fallback_rate}%` : ''}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">No data yet</div>
                )}
              </div>
              <span className="text-xs text-gray-500 w-14 shrink-0">Fallback</span>
            </div>
            <div className="flex gap-5 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                GenAI ({ph?.genai_count ?? 0} incidents)
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                Fallback ({ph?.fallback_count ?? 0} incidents)
              </div>
              {(ph?.total_failed ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                  Failed ({ph.total_failed} items)
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 5: Weekly Trend Intelligence ─────────────────────── */}
        <section className="mb-8">
          <SectionHeading>Weekly Trend Intelligence</SectionHeading>

          <div className="card p-5 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Incident Volume This Week by Category
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {activeCategories.map(cat => (
                  <Bar key={cat} dataKey={cat} fill={CATEGORY_COLORS[cat]} stackId="a" maxBarSize={40} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Top 3 Categories */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 3 Categories This Week</h3>
              {wt?.top3_categories?.length ? (
                <div className="space-y-3">
                  {wt.top3_categories.map((cat, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                        i === 0 ? 'bg-dhl-red' : i === 1 ? 'bg-orange-400' : 'bg-gray-400'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-700 font-medium truncate">{cat.category}</span>
                          <span className="text-xs font-bold text-gray-900 ml-2 shrink-0">{cat.count}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.round((cat.count / (wt.top3_categories[0].count || 1)) * 100)}%`,
                              backgroundColor: CATEGORY_COLORS[cat.category] || '#ccc',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No data this week</p>
              )}
            </div>

            {/* Trending Up */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Trending Up</h3>
              <p className="text-xs text-gray-400 mb-3">≥20% increase vs last week</p>
              {wt?.trending_up?.length ? (
                <div className="space-y-2.5">
                  {wt.trending_up.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[cat.category] || '#ccc' }}
                        />
                        <span className="text-xs text-gray-700 truncate">{cat.category}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs font-semibold text-red-600">↑ {cat.change_percent}%</span>
                        <p className="text-xs text-gray-400">{cat.last_week} → {cat.this_week}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No categories trending up significantly</p>
              )}
            </div>

            {/* Highest Breach Dept */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Highest Breach Rate Dept
              </h3>
              {wt?.highest_breach_department ? (
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {wt.highest_breach_department.department}
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Breach rate</span>
                      <span className="font-semibold text-red-600">
                        {wt.highest_breach_department.breach_rate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-red-500"
                        style={{ width: `${wt.highest_breach_department.breach_rate}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {wt.highest_breach_department.breached} breached of {wt.highest_breach_department.total} total
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">No breach data available</p>
              )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
