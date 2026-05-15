import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import SeverityBadge from '../components/SeverityBadge';
import StatusBadge from '../components/StatusBadge';
import SLATimer from '../components/SLATimer';
import api from '../utils/api';

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('en-MY', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const VALID_TRANSITIONS = {
  'New':         ['Assigned', 'Cancelled'],
  'Assigned':    ['In Progress', 'Cancelled'],
  'In Progress': ['Pending', 'Resolved', 'Cancelled'],
  'Pending':     ['In Progress', 'Resolved', 'Cancelled'],
  'Resolved':    ['Closed'],
};

const SLA_STATE_STYLES = {
  ON_TRACK:  'bg-green-100 text-green-800',
  AT_RISK:   'bg-amber-100 text-amber-800',
  CRITICAL:  'bg-red-100 text-red-700',
  BREACHED:  'bg-red-200 text-red-900 font-bold',
  COMPLETED: 'bg-gray-100 text-gray-500',
};

const SENTIMENT_STYLES = {
  Positive: 'bg-green-100 text-green-800',
  Neutral:  'bg-gray-100 text-gray-700',
  Negative: 'bg-orange-100 text-orange-800',
  Urgent:   'bg-red-100 text-red-800',
};

// ─── List View ────────────────────────────────────────────────────────────────

const STATUSES   = ['New', 'Assigned', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Cancelled'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const CATEGORIES = ['COD Dispute', 'Late Delivery', 'Damaged Parcel', 'Missing Parcel',
  'Wrong Address', 'System Error', 'Customer Complaint', 'Other'];
const SLA_STATES = ['ON_TRACK', 'AT_RISK', 'CRITICAL', 'BREACHED', 'COMPLETED'];

function IncidentListView() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSlaState, setFilterSlaState] = useState('');
  const searchTimeout = useRef(null);

  const fetchIncidents = useCallback(async (s, st, sv, cat, sla, pg) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: 20 };
      if (s)   params.search    = s;
      if (st)  params.status    = st;
      if (sv)  params.severity  = sv;
      if (cat) params.category  = cat;
      if (sla) params.sla_state = sla;
      const { data } = await api.get('/incidents', { params });
      setIncidents(data.incidents);
      setTotal(data.total);
      setPages(data.pages);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchIncidents(search, filterStatus, filterSeverity, filterCategory, filterSlaState, page);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search, filterStatus, filterSeverity, filterCategory, filterSlaState, page, fetchIncidents]);

  function clearFilters() {
    setSearch(''); setFilterStatus(''); setFilterSeverity('');
    setFilterCategory(''); setFilterSlaState(''); setPage(1);
  }

  const pageStart = (page - 1) * 20 + 1;
  const pageEnd = Math.min(page * 20, total);

  const selectCls = "border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-dhl-red";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navbar />
      <main className="ml-60 flex-1 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Incident Management</h1>
            <p className="text-gray-500 text-sm mt-0.5">{total} total incidents</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search ref, title, summary..."
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-dhl-red"
          />
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSeverity} onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">All Severities</option>
            {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterSlaState} onChange={(e) => { setFilterSlaState(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">All SLA States</option>
            {SLA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50">
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-gray-400">Loading...</div>
          ) : incidents.length === 0 ? (
            <div className="py-12 text-center text-gray-400">No incidents found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Ref', 'Received', 'Category', 'Severity', 'Status', 'SLA State', 'Department', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${
                      inc.is_overdue ? 'bg-red-50 border-l-red-500' : 'border-l-transparent'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 font-medium">{inc.incident_ref}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(inc.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{inc.category}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                    <td className="px-4 py-3"><StatusBadge status={inc.status} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SLA_STATE_STYLES[inc.sla_state] || SLA_STATE_STYLES.ON_TRACK}`}>
                        {inc.sla_state || 'ON_TRACK'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{inc.primary_department}</td>
                    <td className="px-4 py-3">
                      <span className="text-dhl-red text-xs font-medium">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">Showing {pageStart}–{pageEnd} of {total} incidents</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline text-sm py-1.5 px-3 disabled:opacity-40">Previous</button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn-outline text-sm py-1.5 px-3 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function IncidentDetailView({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [statusUpdate, setStatusUpdate] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/incidents/${id}`);
      setData(d);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function handleStatusUpdate(newStatus) {
    const target = newStatus || statusUpdate;
    if (!target) return;
    setUpdating(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await api.patch(`/incidents/${id}/status`, { status: target, actor: user.name || 'Agent' });
      await fetchDetail();
      setStatusUpdate('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
    setUpdating(false);
  }

  async function handleTaskUpdate(taskId, newStatus) {
    try {
      await api.patch(`/incidents/${id}/tasks/${taskId}`, { task_status: newStatus });
      await fetchDetail();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update task');
    }
  }

  if (loading) return <LoadingShell />;
  if (!data) return <LoadingShell msg="Incident not found" />;

  const { incident, raw_inputs, department_tasks, audit_trail } = data;
  const allowedNext = VALID_TRANSITIONS[incident.status] || [];
  const primaryTask = department_tasks.find(t => t.role === 'primary');
  const supportingTasks = department_tasks.filter(t => t.role === 'supporting');
  const allComplete = department_tasks.length > 0 && department_tasks.every(t => t.task_status === 'Completed');

  const TABS = ['overview', 'sources', 'departments', 'audit'];
  const TAB_LABELS = { overview: 'Overview', sources: 'Source Inputs', departments: 'Departments', audit: 'Audit Trail' };

  function exportAuditCSV() {
    const headers = ['Timestamp', 'Actor', 'Action', 'Previous', 'New', 'Notes'];
    const rows = audit_trail.map(e => [
      formatDate(e.created_at), e.actor, e.action,
      e.previous_value || '', e.new_value || '', e.notes || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit_trail_${incident.incident_ref}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navbar />
      <main className="ml-60 flex-1 flex flex-col">
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-3">
            <button onClick={() => navigate('/incidents')} className="text-sm text-gray-500 hover:text-dhl-red mb-2 flex items-center gap-1">
              ← Back to Incidents
            </button>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono font-bold text-lg text-gray-900">{incident.incident_ref}</span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{incident.category}</span>
              <SeverityBadge severity={incident.severity} />
              <StatusBadge status={incident.status} />
              <span className={`text-xs px-2 py-0.5 rounded-full ${SLA_STATE_STYLES[incident.sla_state] || SLA_STATE_STYLES.ON_TRACK}`}>
                {incident.sla_state || 'ON_TRACK'}
              </span>
              <div className="ml-auto">
                <SLATimer sla_deadline={incident.sla_deadline} sla_state={incident.sla_state} is_overdue={incident.is_overdue} />
              </div>
            </div>
          </div>
          <div className="px-6 flex border-t border-gray-100">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}>
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 max-w-4xl">

          {/* ── TAB 1: OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">

              {/* AI Analysis */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">AI Generated</span>
                  <h3 className="font-semibold text-gray-900">AI Analysis</h3>
                </div>

                <p className="text-gray-700 text-sm leading-relaxed mb-4">{incident.summary}</p>

                {/* Sentiment Badge */}
                {incident.sentiment_score && (
                  <div className="mb-4">
                    <span className="text-xs text-gray-500 mr-2">Sentiment:</span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${SENTIMENT_STYLES[incident.sentiment_score] || SENTIMENT_STYLES.Neutral}`}>
                      {incident.sentiment_score}
                    </span>
                  </div>
                )}

                {/* LLM Confidence */}
                {incident.llm_confidence != null && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 font-medium">LLM Confidence</span>
                      <span className="text-xs font-bold text-gray-700">{Math.round(incident.llm_confidence * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full ${incident.llm_confidence >= 0.8 ? 'bg-green-500' : incident.llm_confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.round(incident.llm_confidence * 100)}%` }} />
                    </div>
                  </div>
                )}

                {/* Fallback Warning */}
                {incident.processed_via_fallback === 1 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">⚠</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Processed via rule-based fallback</p>
                      <p className="text-xs text-amber-700 mt-0.5">LLM was unavailable. Manual review recommended.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Root Cause Analysis */}
              {(incident.root_cause_hypothesis || incident.root_cause_suggestion) && (
                <div className="card p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Root Cause Analysis</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Hypothesis</p>
                      <p className="text-sm italic text-gray-700">
                        {incident.root_cause_hypothesis || incident.root_cause_suggestion}
                      </p>
                    </div>
                    {incident.root_cause_evidence && (
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Evidence</p>
                        <p className="text-sm text-gray-700">{incident.root_cause_evidence}</p>
                      </div>
                    )}
                    {incident.root_cause_confidence != null && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Confidence</p>
                          <span className="text-xs font-bold text-gray-700">{Math.round(incident.root_cause_confidence * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${incident.root_cause_confidence >= 0.8 ? 'bg-green-500' : incident.root_cause_confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.round(incident.root_cause_confidence * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Classification */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Classification</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Category</p>
                    <p className="text-sm font-medium text-gray-800">📁 {incident.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Severity</p>
                    <SeverityBadge severity={incident.severity} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Primary Department</p>
                    <p className="text-sm font-medium text-gray-700">{incident.primary_department}</p>
                  </div>
                </div>

                {incident.is_duplicate === 1 && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-amber-600">⚠</span>
                      <p className="font-semibold text-amber-800 text-sm">Possible Duplicate Detected</p>
                    </div>
                    <p className="text-amber-700 text-sm">{incident.duplicate_reason}</p>
                  </div>
                )}
              </div>

              {/* Status Management */}
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Status Management</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Current Status</p>
                    <StatusBadge status={incident.status} />
                  </div>
                  {allowedNext.length > 0 && (
                    <>
                      <div className="text-gray-300 text-xl mt-4">→</div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">Update To</p>
                        <select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)}
                          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-dhl-red">
                          <option value="">Select next status</option>
                          {allowedNext.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="mt-4">
                        <button onClick={() => handleStatusUpdate()} disabled={!statusUpdate || updating}
                          className="bg-dhl-red text-white text-sm font-semibold px-4 py-1.5 rounded-md hover:bg-dhl-red-dark disabled:opacity-50 transition-colors">
                          {updating ? 'Updating...' : 'Update'}
                        </button>
                      </div>
                    </>
                  )}
                  {allowedNext.length === 0 && (
                    <p className="text-sm text-gray-400 italic mt-4">No further transitions available</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: SOURCE INPUTS ── */}
          {activeTab === 'sources' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h2 className="font-semibold text-gray-900">Raw Fragments Merged Into This Incident</h2>
                <p className="text-gray-500 text-sm mt-0.5">{raw_inputs.length} source(s) processed by UiPath GenAI pipeline</p>
              </div>
              {raw_inputs.length === 0
                ? <div className="card p-8 text-center text-gray-400 text-sm">No source inputs linked</div>
                : raw_inputs.map(ri => <SourceCard key={ri.id} input={ri} />)
              }
            </div>
          )}

          {/* ── TAB 3: DEPARTMENTS ── */}
          {activeTab === 'departments' && (
            <div className="space-y-5">
              {primaryTask && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Primary Owner</span>
                    <h3 className="font-bold text-gray-900 text-lg">{primaryTask.department}</h3>
                  </div>

                  {primaryTask.problem_statement && (
                    <div className="mb-2">
                      <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide mb-0.5">Problem Statement</p>
                      <p className="text-sm text-gray-700">{primaryTask.problem_statement}</p>
                    </div>
                  )}
                  {primaryTask.action_required && (
                    <div className="mb-2">
                      <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide mb-0.5">Action Required</p>
                      <p className="text-sm text-gray-700">{primaryTask.action_required}</p>
                    </div>
                  )}
                  {primaryTask.expected_output && (
                    <div className="mb-3">
                      <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide mb-0.5">Expected Output</p>
                      <p className="text-sm text-gray-700">{primaryTask.expected_output}</p>
                    </div>
                  )}
                  {/* Fallback to old task_description */}
                  {!primaryTask.problem_statement && primaryTask.task_description && (
                    <p className="text-gray-700 text-sm mb-3">{primaryTask.task_description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-3">
                    <StatusBadge status={primaryTask.task_status} />
                    {primaryTask.task_status === 'Not Started' && (
                      <button onClick={() => handleTaskUpdate(primaryTask.id, 'In Progress')}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors">
                        Mark In Progress
                      </button>
                    )}
                    {primaryTask.task_status === 'In Progress' && (
                      <button onClick={() => handleTaskUpdate(primaryTask.id, 'Completed')}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors">
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              )}

              {supportingTasks.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Supporting Departments</h3>
                  <div className="space-y-3">
                    {supportingTasks.map(task => (
                      <div key={task.id} className="card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 text-sm mb-2">{task.department}</p>
                            {task.problem_statement && (
                              <div className="mb-1.5">
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Problem</p>
                                <p className="text-sm text-gray-700">{task.problem_statement}</p>
                              </div>
                            )}
                            {task.action_required && (
                              <div className="mb-1.5">
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Action Required</p>
                                <p className="text-sm text-gray-700">{task.action_required}</p>
                              </div>
                            )}
                            {task.expected_output && (
                              <div className="mb-1.5">
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Expected Output</p>
                                <p className="text-sm text-gray-700">{task.expected_output}</p>
                              </div>
                            )}
                            {!task.problem_statement && task.task_description && (
                              <p className="text-sm text-gray-600 mb-1.5">{task.task_description}</p>
                            )}
                            <p className="text-gray-400 text-xs mt-1">Updated {timeAgo(task.updated_at)}</p>
                          </div>
                          <select value={task.task_status} onChange={(e) => handleTaskUpdate(task.id, e.target.value)}
                            className="border border-gray-300 rounded text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-dhl-red">
                            <option>Not Started</option>
                            <option>In Progress</option>
                            <option>Completed</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolve Section */}
              <div className={`card p-5 border-2 ${allComplete ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
                <h3 className="font-semibold text-gray-900 mb-3">Resolution</h3>
                {allComplete ? (
                  <button onClick={() => handleStatusUpdate('Resolved')}
                    className="bg-green-600 text-white font-semibold px-5 py-2 rounded-md hover:bg-green-700 transition-colors">
                    ✓ Mark as Resolved
                  </button>
                ) : (
                  <div>
                    <button disabled title="All department tasks must be completed first"
                      className="flex items-center gap-2 bg-gray-100 text-gray-400 font-semibold px-5 py-2 rounded-md cursor-not-allowed">
                      🔒 Resolve (pending tasks)
                    </button>
                    <p className="text-xs text-gray-400 mt-2">All department tasks must be completed first</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 4: AUDIT TRAIL ── */}
          {activeTab === 'audit' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Audit Trail</h2>
                <button onClick={exportAuditCSV}
                  className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50">
                  Export CSV
                </button>
              </div>
              {audit_trail.length === 0
                ? <div className="card p-8 text-center text-gray-400 text-sm">No audit entries</div>
                : (
                  <div className="space-y-2">
                    {audit_trail.map(entry => (
                      <div key={entry.id} className="card px-5 py-3.5">
                        <div className="flex items-start gap-3">
                          <ActorBadge actor={entry.actor} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-800">{entry.action}</p>
                              {entry.previous_value && entry.new_value && (
                                <span className="text-xs text-gray-500">
                                  <span className="bg-gray-100 px-1.5 py-0.5 rounded">{entry.previous_value}</span>
                                  {' → '}
                                  <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{entry.new_value}</span>
                                </span>
                              )}
                            </div>
                            {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                            <p className="text-xs text-gray-400 mt-1">{formatDate(entry.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({ input }) {
  const [expanded, setExpanded] = useState(false);
  const preview = input.raw_text ? input.raw_text.slice(0, 300) : null;
  const hasMore = input.raw_text && input.raw_text.length > 300;

  const CONTENT_ICONS = { pdf: '📄', docx: '📝', image: '🖼', text: '💬' };
  const SOURCE_STYLES = {
    manual:     'bg-gray-100 text-gray-700',
    uipath:     'bg-yellow-100 text-yellow-800',
    text_paste: 'bg-gray-100 text-gray-600',
  };

  const missingFields = input.missing_fields
    ? input.missing_fields.split(',').map(f => f.trim()).filter(Boolean)
    : [];

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-lg">{CONTENT_ICONS[input.content_type] || '📄'}</span>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize">{input.content_type}</span>
        <span className={`text-xs px-2 py-0.5 rounded capitalize ${SOURCE_STYLES[input.source_type] || SOURCE_STYLES.manual}`}>
          {input.source_type === 'text_paste' ? 'Text Input' : input.source_type}
        </span>
        <span className="text-xs text-gray-400 ml-auto">{formatDate(input.uploaded_at)}</span>
      </div>

      {input.filename && (
        <p className="text-xs text-gray-500 font-medium mb-2">📎 {input.filename}</p>
      )}

      {/* Language Detection Badge */}
      {input.detected_language && (
        <div className="mb-2">
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
            🌐 {input.detected_language}
          </span>
        </div>
      )}

      {/* Missing Fields Warning */}
      {missingFields.length > 0 && (
        <div className="mb-2 flex items-center flex-wrap gap-1">
          <span className="text-xs text-amber-700 font-medium">⚠ Missing fields:</span>
          {missingFields.map(f => (
            <span key={f} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{f}</span>
          ))}
        </div>
      )}

      {/* Content Preview */}
      {preview ? (
        <div className="bg-gray-50 rounded p-3 text-xs text-gray-700 leading-relaxed font-mono whitespace-pre-wrap">
          {expanded ? input.raw_text : preview}
          {hasMore && (
            <button onClick={() => setExpanded(!expanded)} className="block mt-2 text-dhl-red hover:underline font-sans font-medium">
              {expanded ? 'Show less' : 'Show more...'}
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">No text content available</p>
      )}

      {/* OCR Confidence (images only) */}
      {input.content_type === 'image' && input.ocr_confidence != null && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">OCR Confidence</span>
            <span className="text-xs font-bold">{Math.round(input.ocr_confidence * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${input.ocr_confidence >= 0.8 ? 'bg-green-500' : input.ocr_confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.round(input.ocr_confidence * 100)}%` }} />
          </div>
          {input.ocr_confidence < 0.5 && (
            <p className="text-xs text-red-500 mt-1">⚠ Low confidence — human review recommended</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Actor Badge ──────────────────────────────────────────────────────────────

function ActorBadge({ actor }) {
  const styles = {
    System: 'bg-gray-100 text-gray-700',
    UiPath: 'bg-yellow-100 text-yellow-800',
    GenAI:  'bg-purple-100 text-purple-800',
    LLM:    'bg-purple-100 text-purple-800',
  };
  const style = styles[actor] || 'bg-blue-100 text-blue-800';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${style}`}>
      {actor}
    </span>
  );
}

function LoadingShell({ msg = 'Loading...' }) {
  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="ml-60 flex-1 flex items-center justify-center text-gray-400">{msg}</main>
    </div>
  );
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export default function IncidentPage() {
  const { id } = useParams();
  return id ? <IncidentDetailView id={id} /> : <IncidentListView />;
}
