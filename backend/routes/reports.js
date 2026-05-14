const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/dashboard', auth, async (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const todayStart = now - (now % 86400);
  const yesterdayStart = todayStart - 86400;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const total_today_row = await db.prepare(
    'SELECT COUNT(*) as c FROM incidents WHERE created_at >= ?'
  ).get(todayStart);
  const total_today = parseInt(total_today_row.c);

  const pending_row = await db.prepare(
    "SELECT COUNT(*) as c FROM incidents WHERE status NOT IN ('Resolved','Closed','Cancelled')"
  ).get();
  const pending = parseInt(pending_row.c);

  const resolved_today_row = await db.prepare(
    "SELECT COUNT(*) as c FROM incidents WHERE resolved_at >= ? AND status IN ('Resolved','Closed')"
  ).get(todayStart);
  const resolved_today = parseInt(resolved_today_row.c);

  const overdue_row = await db.prepare(
    "SELECT COUNT(*) as c FROM incidents WHERE sla_state = 'BREACHED' AND status NOT IN ('Resolved','Closed','Cancelled')"
  ).get();
  const overdue = parseInt(overdue_row.c);

  const yesterday_row = await db.prepare(
    'SELECT COUNT(*) as c FROM incidents WHERE created_at >= ? AND created_at < ?'
  ).get(yesterdayStart, todayStart);
  const yesterday_count = parseInt(yesterday_row.c);

  const change_percent = yesterday_count === 0
    ? (total_today > 0 ? 100 : 0)
    : Math.round(((total_today - yesterday_count) / yesterday_count) * 100);

  const critical_watchlist = await db.prepare(`
    SELECT incident_ref, category, primary_department, sla_deadline,
           (sla_deadline - ?) as time_remaining, severity, id, status,
           sla_state, created_at, sla_hours
    FROM incidents
    WHERE sla_state IN ('AT_RISK','CRITICAL','BREACHED')
    AND status NOT IN ('Resolved','Closed','Cancelled')
    ORDER BY sla_deadline ASC
    LIMIT 10
  `).all(now);

  const recent_activity = await db.prepare(`
    SELECT a.created_at, a.actor, a.action, i.incident_ref, i.id as incident_id
    FROM audit_trail a
    JOIN incidents i ON a.incident_id = i.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all();

  const days = [];
  for (let i = 6; i >= 0; i--) {
    days.push(todayStart - i * 86400);
  }

  const categories = ['COD Dispute', 'Late Delivery', 'Damaged Parcel', 'Missing Parcel',
    'Wrong Address', 'System Error', 'Customer Complaint', 'Other'];

  const weekly_by_category = { labels: [], datasets: {} };
  for (let i = 6; i >= 0; i--) {
    const d = new Date((todayStart - i * 86400) * 1000);
    weekly_by_category.labels.push(dayNames[d.getDay()]);
  }

  for (const cat of categories) {
    const counts = [];
    for (const dayStart of days) {
      const row = await db.prepare(`
        SELECT COUNT(*) as c FROM incidents
        WHERE category = ? AND created_at >= ? AND created_at < ?
      `).get(cat, dayStart, dayStart + 86400);
      counts.push(parseInt(row.c));
    }
    weekly_by_category.datasets[cat] = counts;
  }

  res.json({
    total_today,
    pending,
    resolved_today,
    overdue,
    trend: { today: total_today, yesterday: yesterday_count, change_percent },
    critical_watchlist,
    recent_activity,
    weekly_by_category,
  });
});


router.get('/summary', auth, async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);
    const yesterdayStart = todayStart - 86400;
    const weekStart = todayStart - 6 * 86400;
    const lastWeekStart = weekStart - 7 * 86400;
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const categories = ['COD Dispute','Late Delivery','Damaged Parcel','Missing Parcel',
      'Wrong Address','System Error','Customer Complaint','Other'];

    // ─── SECTION 1: Daily Operational Summary ─────────────────────────────
    const total_today_row = await db.prepare(
      'SELECT COUNT(*) as c FROM incidents WHERE created_at >= ?'
    ).get(todayStart);
    const total_today = parseInt(total_today_row.c);

    const yesterday_row = await db.prepare(
      'SELECT COUNT(*) as c FROM incidents WHERE created_at >= ? AND created_at < ?'
    ).get(yesterdayStart, todayStart);
    const yesterday_count = parseInt(yesterday_row.c);

    const change_percent = yesterday_count === 0
      ? (total_today > 0 ? 100 : 0)
      : Math.round(((total_today - yesterday_count) / yesterday_count) * 100);

    const resolved_today_row = await db.prepare(
      "SELECT COUNT(*) as c FROM incidents WHERE resolved_at >= ? AND status IN ('Resolved','Closed')"
    ).get(todayStart);
    const resolved_today = parseInt(resolved_today_row.c);

    const pending_row = await db.prepare(
      "SELECT COUNT(*) as c FROM incidents WHERE status NOT IN ('Resolved','Closed','Cancelled')"
    ).get();
    const pending = parseInt(pending_row.c);

    const breached_row = await db.prepare(
      "SELECT COUNT(*) as c FROM incidents WHERE sla_state = 'BREACHED' AND status NOT IN ('Resolved','Closed','Cancelled')"
    ).get();
    const breached_active = parseInt(breached_row.c);

    const daily_by_status = await db.prepare(`
      SELECT status, COUNT(*) as count
      FROM incidents
      WHERE created_at >= ?
      GROUP BY status
    `).all(todayStart);

    const daily_by_category = await db.prepare(`
      SELECT category, COUNT(*) as count
      FROM incidents
      WHERE created_at >= ?
      GROUP BY category
      ORDER BY count DESC
    `).all(todayStart);

    // ─── SECTION 2: SLA Performance ───────────────────────────────────────
    const sla_by_severity_rows = await db.prepare(`
      SELECT severity, sla_state, COUNT(*) as count
      FROM incidents
      WHERE status NOT IN ('Cancelled')
      GROUP BY severity, sla_state
    `).all();

    const severities = ['Critical','High','Medium','Low'];
    const sla_by_severity = severities.map(sev => {
      const rows = sla_by_severity_rows.filter(r => r.severity === sev);
      const total = rows.reduce((s, r) => s + parseInt(r.count), 0);
      const breached = rows.filter(r => r.sla_state === 'BREACHED')
        .reduce((s, r) => s + parseInt(r.count), 0);
      const compliant = total - breached;
      const compliance_rate = total === 0 ? 100 : Math.round((compliant / total) * 100);
      return { severity: sev, total, breached, compliant, compliance_rate };
    });

    const sla_by_dept_rows = await db.prepare(`
      SELECT primary_department, sla_state, COUNT(*) as count
      FROM incidents
      WHERE status NOT IN ('Cancelled')
      GROUP BY primary_department, sla_state
    `).all();

    const depts = [...new Set(sla_by_dept_rows.map(r => r.primary_department))];
    const sla_by_department = depts.map(dept => {
      const rows = sla_by_dept_rows.filter(r => r.primary_department === dept);
      const total = rows.reduce((s, r) => s + parseInt(r.count), 0);
      const breached = rows.filter(r => r.sla_state === 'BREACHED')
        .reduce((s, r) => s + parseInt(r.count), 0);
      const compliant = total - breached;
      const compliance_rate = total === 0 ? 100 : Math.round((compliant / total) * 100);
      return { department: dept, total, breached, compliant, compliance_rate };
    }).sort((a, b) => a.compliance_rate - b.compliance_rate);

    const avg_resolution_rows = await db.prepare(`
      SELECT severity,
        AVG(resolved_at - created_at) as avg_seconds
      FROM incidents
      WHERE status IN ('Resolved','Closed')
      AND resolved_at IS NOT NULL
      GROUP BY severity
    `).all();

    const avg_resolution_by_severity = avg_resolution_rows.map(r => ({
      severity: r.severity,
      avg_hours: r.avg_seconds ? Math.round(parseFloat(r.avg_seconds) / 3600 * 10) / 10 : null
    }));

    // ─── SECTION 3: Critical Watch List ───────────────────────────────────
    const critical_watchlist = await db.prepare(`
      SELECT incident_ref, category, primary_department, sla_deadline,
             (sla_deadline - ?) as time_remaining, severity, id,
             sla_state, created_at, sla_hours
      FROM incidents
      WHERE sla_state IN ('AT_RISK','CRITICAL','BREACHED')
      AND status NOT IN ('Resolved','Closed','Cancelled')
      ORDER BY sla_deadline ASC
      LIMIT 10
    `).all(now);

    // ─── SECTION 4: Pipeline Health ───────────────────────────────────────
    const pipeline_rows = await db.prepare(`
      SELECT processing_status, COUNT(*) as count
      FROM raw_inputs
      GROUP BY processing_status
    `).all();

    const pipeline_map = {};
    pipeline_rows.forEach(r => { pipeline_map[r.processing_status] = parseInt(r.count); });

    const total_processed = pipeline_map['processed'] || 0;
    const total_failed = pipeline_map['failed'] || 0;
    const total_quarantined = pipeline_map['pending'] || 0;

    const fallback_row = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN processed_via_fallback = 1 THEN 1 ELSE 0 END) as fallback_count
      FROM incidents
    `).get();

    const total_incidents = parseInt(fallback_row.total);
    const fallback_count = parseInt(fallback_row.fallback_count) || 0;
    const genai_count = total_incidents - fallback_count;
    const fallback_rate = total_incidents === 0 ? 0
      : Math.round((fallback_count / total_incidents) * 100);
    const genai_success_rate = total_incidents === 0 ? 0
      : Math.round((genai_count / total_incidents) * 100);

    const avg_confidence_row = await db.prepare(`
      SELECT AVG(llm_confidence) as avg_conf
      FROM incidents
      WHERE processed_via_fallback = 0
      AND llm_confidence IS NOT NULL
    `).get();
    const avg_llm_confidence = avg_confidence_row?.avg_conf
      ? Math.round(parseFloat(avg_confidence_row.avg_conf) * 100)
      : 0;

    // ─── SECTION 5: Weekly Trend Intelligence ─────────────────────────────
    const days = [];
    const weekly_labels = [];
    for (let i = 6; i >= 0; i--) {
      days.push(todayStart - i * 86400);
      const d = new Date((todayStart - i * 86400) * 1000);
      weekly_labels.push(dayNames[d.getDay()]);
    }

    const weekly_datasets = {};
    for (const cat of categories) {
      const counts = [];
      for (const dayStart of days) {
        const row = await db.prepare(`
          SELECT COUNT(*) as c FROM incidents
          WHERE category = ? AND created_at >= ? AND created_at < ?
        `).get(cat, dayStart, dayStart + 86400);
        counts.push(parseInt(row.c));
      }
      weekly_datasets[cat] = counts;
    }

    const top3_rows = await db.prepare(`
      SELECT category, COUNT(*) as count
      FROM incidents
      WHERE created_at >= ?
      GROUP BY category
      ORDER BY count DESC
      LIMIT 3
    `).all(weekStart);

    const week_vs_week_rows = await db.prepare(`
      SELECT category,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) as last_week
      FROM incidents
      WHERE created_at >= ?
      GROUP BY category
    `).all(weekStart, lastWeekStart, weekStart, lastWeekStart);

    const trending_categories = week_vs_week_rows
      .map(r => {
        const tw = parseInt(r.this_week);
        const lw = parseInt(r.last_week);
        const change = lw === 0
          ? (tw > 0 ? 100 : 0)
          : Math.round(((tw - lw) / lw) * 100);
        return { category: r.category, this_week: tw, last_week: lw, change_percent: change };
      })
      .filter(r => r.change_percent >= 20 && r.last_week > 0)
      .sort((a, b) => b.change_percent - a.change_percent);

    const breach_by_dept = await db.prepare(`
      SELECT primary_department,
        COUNT(*) as total,
        SUM(CASE WHEN sla_state = 'BREACHED' THEN 1 ELSE 0 END) as breached
      FROM incidents
      WHERE status NOT IN ('Cancelled')
      GROUP BY primary_department
      HAVING COUNT(*) > 0
      ORDER BY (SUM(CASE WHEN sla_state = 'BREACHED' THEN 1 ELSE 0 END)::float / COUNT(*)) DESC
      LIMIT 1
    `).get();

    const highest_breach_dept = breach_by_dept ? {
      department: breach_by_dept.primary_department,
      breach_rate: Math.round((parseInt(breach_by_dept.breached) / parseInt(breach_by_dept.total)) * 100),
      breached: parseInt(breach_by_dept.breached),
      total: parseInt(breach_by_dept.total)
    } : null;

    // ─── RESPONSE ─────────────────────────────────────────────────────────
    res.json({
      generated_at: now,
      daily_summary: {
        total_today,
        resolved_today,
        pending,
        breached_active,
        yesterday_count,
        change_percent,
        by_status: daily_by_status,
        by_category: daily_by_category
      },
      sla_performance: {
        by_severity: sla_by_severity,
        by_department: sla_by_department,
        avg_resolution_by_severity
      },
      critical_watchlist,
      pipeline_health: {
        total_processed,
        total_failed,
        total_quarantined,
        fallback_count,
        genai_count,
        fallback_rate,
        genai_success_rate,
        avg_llm_confidence
      },
      weekly_trend: {
        labels: weekly_labels,
        datasets: weekly_datasets,
        top3_categories: top3_rows,
        trending_up: trending_categories,
        highest_breach_department: highest_breach_dept
      }
    });

  } catch (err) {
    console.error('Reports summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;