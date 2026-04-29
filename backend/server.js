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

// Overdue check — every 5 minutes
setInterval(() => {
  const db = require('./database/db');
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE incidents
    SET is_overdue = 1
    WHERE sla_deadline < ?
    AND status NOT IN ('Resolved','Closed')
    AND is_overdue = 0
  `).run(now);
}, 5 * 60 * 1000);

app.listen(process.env.PORT, () => {
  console.log(`DHL Incident System backend running on port ${process.env.PORT}`);
});
