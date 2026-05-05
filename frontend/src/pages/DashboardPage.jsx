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

function formatTimeRemaining(seconds) {
  if (!seconds || seconds <= 0) return 'OVERDUE';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function timeAgo(unixTs) {
  const diff = Math.floor(Date.now() / 1000) - unixTs;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data: d } = await api.get('/reports/dashboard');
      setData(d);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Navbar />
        <main className="ml-60 flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading dashboard...</div>
        </main>
      </div>
    );
  }

  const chartData = buildChartData(data?.weekly_by_category);
  const activeCategories = Object.keys(CATEGORY_COLORS).filter(cat =>
    chartData.some(d => d[cat] > 0)
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navbar />
      <main className="ml-60 flex-1 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Live incident overview — auto-refreshes every 60s</p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Today"
            value={data?.total_today ?? 0}
            trend={data?.trend?.change_percent}
          />
          <MetricCard
            title="Pending"
            value={data?.pending ?? 0}
            trend={null}
            variant="default"
          />
          <MetricCard
            title="Resolved Today"
            value={data?.resolved_today ?? 0}
            trend={data?.trend?.change_percent ? -data.trend.change_percent : 0}
            variant="success"
          />
          <MetricCard
            title="Overdue"
            value={data?.overdue ?? 0}
            trend={null}
            variant="danger"
          />
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Critical Watch List */}
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="text-amber-500 text-lg">⚠</span>
              <h2 className="font-semibold text-gray-900">Critical Watch List</h2>
            </div>
            <div className="overflow-hidden">
              {data?.critical_watchlist?.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  ✓ No critical incidents — all clear
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2 text-left">Ref</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">SLA State</th>
                      <th className="px-4 py-2 text-left">Dept</th>
                      <th className="px-4 py-2 text-right">Time Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.critical_watchlist?.map((inc) => {
                      const isCriticalOrBreached = ['CRITICAL','BREACHED'].includes(inc.sla_state);
                      const borderColor = isCriticalOrBreached ? 'border-l-red-500' : 'border-l-amber-400';
                      const SLA_STATE_STYLE = {
                        AT_RISK:  'bg-amber-100 text-amber-800',
                        CRITICAL: 'bg-red-100 text-red-700',
                        BREACHED: 'bg-red-200 text-red-900 font-bold',
                      };
                      return (
                        <tr
                          key={inc.id}
                          onClick={() => navigate(`/incidents/${inc.id}`)}
                          className={`border-l-4 ${borderColor} hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0`}
                        >
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{inc.incident_ref}</td>
                          <td className="px-4 py-2.5 text-gray-700 text-xs">{inc.category}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${SLA_STATE_STYLE[inc.sla_state] || 'bg-gray-100 text-gray-600'}`}>
                              {inc.sla_state}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{inc.primary_department}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-mono font-medium ${inc.sla_state === 'BREACHED' ? 'text-red-700 font-bold' : inc.sla_state === 'CRITICAL' ? 'text-red-600' : 'text-amber-600'}`}>
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
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {data?.recent_activity?.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">No activity yet</div>
              ) : (
                data?.recent_activity?.map((entry, i) => (
                  <div
                    key={i}
                    onClick={() => navigate(`/incidents/${entry.incident_id}`)}
                    className="px-5 py-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <p className="text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{timeAgo(entry.created_at)}</span>
                      {' · '}
                      <span className="font-medium">{entry.actor}</span>
                      {' — '}
                      {entry.action}
                      {' on '}
                      <span className="font-mono text-dhl-red">{entry.incident_ref}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Incident Volume This Week by Category</h2>
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
      </main>
    </div>
  );
}
