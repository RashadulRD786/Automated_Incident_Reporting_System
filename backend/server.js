const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    
  ],
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/uploads',   require('./routes/uploads'));
app.use('/api/reports',   require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));

const updateSLAStates = async () => {
  const db = require('./database/db');
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  try {
    // ── Detect new BREACHED incidents ──────────────────────────────────
    const newlyBreached = await db.prepare(`
      SELECT id, incident_ref, category, primary_department,
             (sla_deadline - ?) as time_remaining
      FROM incidents
      WHERE sla_deadline < ?
      AND status NOT IN ('Resolved','Closed','Cancelled')
      AND sla_state != 'BREACHED'
    `).all(now, now);

    await db.prepare(`
      UPDATE incidents SET sla_state = 'BREACHED'
      WHERE sla_deadline < ?
      AND status NOT IN ('Resolved','Closed','Cancelled')
    `).run(now);

    for (const inc of newlyBreached) {
      const exists = await db.prepare(`
        SELECT id FROM notifications
        WHERE incident_id = ? AND type = 'BREACHED'
        AND created_at > ?
      `).get(inc.id, oneDayAgo);
      if (!exists) {
        await db.prepare(`
          INSERT INTO notifications
          (incident_id, incident_ref, message, type, category, primary_department, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          inc.id,
          inc.incident_ref,
          `${inc.incident_ref} has breached SLA — immediate action required`,
          'BREACHED',
          inc.category,
          inc.primary_department,
          now
        );
      }
    }

    // ── Detect new CRITICAL incidents ──────────────────────────────────
    const newlyCritical = await db.prepare(`
      SELECT id, incident_ref, category, primary_department,
             (sla_deadline - ?) as time_remaining
      FROM incidents
      WHERE sla_deadline >= ?
      AND ((? - created_at) * 1.0 / (sla_hours * 3600)) >= 0.8
      AND status NOT IN ('Resolved','Closed','Cancelled')
      AND sla_state NOT IN ('BREACHED','CRITICAL')
    `).all(now, now, now);

    await db.prepare(`
      UPDATE incidents SET sla_state = 'CRITICAL'
      WHERE sla_deadline >= ?
      AND ((? - created_at) * 1.0 / (sla_hours * 3600)) >= 0.8
      AND status NOT IN ('Resolved','Closed','Cancelled')
      AND sla_state != 'BREACHED'
    `).run(now, now);

    for (const inc of newlyCritical) {
      const timeLeft = inc.time_remaining;
      const hoursLeft = Math.max(0, Math.floor(timeLeft / 3600));
      const minsLeft = Math.max(0, Math.floor((timeLeft % 3600) / 60));
      const exists = await db.prepare(`
        SELECT id FROM notifications
        WHERE incident_id = ? AND type = 'CRITICAL'
        AND created_at > ?
      `).get(inc.id, oneDayAgo);
      if (!exists) {
        await db.prepare(`
          INSERT INTO notifications
          (incident_id, incident_ref, message, type, category, primary_department, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          inc.id,
          inc.incident_ref,
          `${inc.incident_ref} is in CRITICAL state — ${hoursLeft}h ${minsLeft}m remaining`,
          'CRITICAL',
          inc.category,
          inc.primary_department,
          now
        );
      }
    }

    // ── Detect new AT_RISK incidents ───────────────────────────────────
    const newlyAtRisk = await db.prepare(`
      SELECT id, incident_ref, category, primary_department,
             (sla_deadline - ?) as time_remaining
      FROM incidents
      WHERE sla_deadline >= ?
      AND ((? - created_at) * 1.0 / (sla_hours * 3600)) >= 0.5
      AND status NOT IN ('Resolved','Closed','Cancelled')
      AND sla_state NOT IN ('BREACHED','CRITICAL','AT_RISK')
    `).all(now, now, now);

    await db.prepare(`
      UPDATE incidents SET sla_state = 'AT_RISK'
      WHERE sla_deadline >= ?
      AND ((? - created_at) * 1.0 / (sla_hours * 3600)) >= 0.5
      AND status NOT IN ('Resolved','Closed','Cancelled')
      AND sla_state NOT IN ('BREACHED','CRITICAL')
    `).run(now, now);

    for (const inc of newlyAtRisk) {
      const timeLeft = inc.time_remaining;
      const hoursLeft = Math.max(0, Math.floor(timeLeft / 3600));
      const minsLeft = Math.max(0, Math.floor((timeLeft % 3600) / 60));
      const exists = await db.prepare(`
        SELECT id FROM notifications
        WHERE incident_id = ? AND type = 'AT_RISK'
        AND created_at > ?
      `).get(inc.id, oneDayAgo);
      if (!exists) {
        await db.prepare(`
          INSERT INTO notifications
          (incident_id, incident_ref, message, type, category, primary_department, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          inc.id,
          inc.incident_ref,
          `${inc.incident_ref} is AT_RISK — ${hoursLeft}h ${minsLeft}m remaining`,
          'AT_RISK',
          inc.category,
          inc.primary_department,
          now
        );
      }
    }

    // ── Auto-delete notifications older than 7 days ────────────────────
    await db.prepare(`
      DELETE FROM notifications WHERE created_at < ?
    `).run(now - 7 * 86400);

  } catch (err) {
    console.error('[SLA Update Error]', err.message);
  }
};

setInterval(updateSLAStates, 5 * 60 * 1000);
updateSLAStates();

app.listen(process.env.PORT, () => {
  console.log(`DHL Incident System backend running on port ${process.env.PORT}`);
});