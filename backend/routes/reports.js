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

module.exports = router;