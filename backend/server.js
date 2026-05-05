const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/uploads',   require('./routes/uploads'));
app.use('/api/reports',   require('./routes/reports'));

// SLA state update — every 5 minutes
setInterval(() => {
  const db = require('./database/db');
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    UPDATE incidents SET is_overdue = 1, sla_state = 'BREACHED'
    WHERE sla_deadline < ?
    AND status NOT IN ('Resolved','Closed','Cancelled')
  `).run(now);

  db.prepare(`
    UPDATE incidents SET sla_state = 'CRITICAL'
    WHERE sla_deadline >= ?
    AND ((? - created_at) * 1.0 / (sla_hours * 3600)) >= 0.8
    AND status NOT IN ('Resolved','Closed','Cancelled')
    AND sla_state != 'BREACHED'
  `).run(now, now);

  db.prepare(`
    UPDATE incidents SET sla_state = 'AT_RISK'
    WHERE sla_deadline >= ?
    AND ((? - created_at) * 1.0 / (sla_hours * 3600)) >= 0.5
    AND status NOT IN ('Resolved','Closed','Cancelled')
    AND sla_state NOT IN ('BREACHED','CRITICAL')
  `).run(now, now);
}, 5 * 60 * 1000);

app.listen(process.env.PORT, () => {
  console.log(`DHL Incident System backend running on port ${process.env.PORT}`);
});
