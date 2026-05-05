const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', auth, (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  const todayStart = now - (now % 86400);
  const yesterdayStart = todayStart - 86400;

  const total_today = db.prepare(
    'SELECT COUNT(*) as c FROM incidents WHERE created_at >= ?'
  ).get(todayStart).c;

  const pending = db.prepare(
    "SELECT COUNT(*) as c FROM incidents WHERE status NOT IN ('Resolved','Closed','Cancelled')"
  ).get().c;

  const resolved_today = db.prepare(
    "SELECT COUNT(*) as c FROM incidents WHERE resolved_at >= ? AND status IN ('Resolved','Closed')"
  ).get(todayStart).c;

  const overdue = db.prepare(
    "SELECT COUNT(*) as c FROM incidents WHERE is_overdue = 1"
  ).get().c;

  const yesterday_count = db.prepare(
    'SELECT COUNT(*) as c FROM incidents WHERE created_at >= ? AND created_at < ?'
  ).get(yesterdayStart, todayStart).c;

  const change_percent = yesterday_count === 0
    ? (total_today > 0 ? 100 : 0)
    : Math.round(((total_today - yesterday_count) / yesterday_count) * 100);

  const critical_watchlist = db.prepare(`
    SELECT incident_ref, category, primary_department, sla_deadline,
           (sla_deadline - ?) as time_remaining, severity, id, status,
           sla_state, created_at, sla_hours
    FROM incidents
    WHERE sla_state IN ('AT_RISK','CRITICAL','BREACHED')
    AND status NOT IN ('Resolved','Closed','Cancelled')
    ORDER BY sla_deadline ASC
    LIMIT 10
  `).all(now);

  const recent_activity = db.prepare(`
    SELECT a.created_at, a.actor, a.action, i.incident_ref, i.id as incident_id
    FROM audit_trail a
    JOIN incidents i ON a.incident_id = i.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all();

  // Weekly by category — last 7 days
  const days = [];
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const dayStart = todayStart - i * 86400;
    days.push(dayStart);
  }

  const categories = ['COD Dispute', 'Late Delivery', 'Damaged Parcel', 'Missing Parcel',
    'Wrong Address', 'System Error', 'Customer Complaint', 'Other'];

  const weekly_by_category = { labels: [], datasets: {} };

  // Build ordered day labels starting from 7 days ago
  for (let i = 6; i >= 0; i--) {
    const ts = todayStart - i * 86400;
    const d = new Date(ts * 1000);
    weekly_by_category.labels.push(dayNames[d.getDay()]);
  }

  for (const cat of categories) {
    weekly_by_category.datasets[cat] = days.map(dayStart => {
      const row = db.prepare(`
        SELECT COUNT(*) as c FROM incidents
        WHERE category = ? AND created_at >= ? AND created_at < ?
      `).get(cat, dayStart, dayStart + 86400);
      return row.c;
    });
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
