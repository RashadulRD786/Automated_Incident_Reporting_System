const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

const VALID_TRANSITIONS = {
  'New':         ['Assigned', 'Cancelled'],
  'Assigned':    ['In Progress', 'Cancelled'],
  'In Progress': ['Pending', 'Resolved', 'Cancelled'],
  'Pending':     ['In Progress', 'Resolved', 'Cancelled'],
  'Resolved':    ['Closed'],
};

router.get('/', auth, async (req, res) => {
  const { status, severity, category, sla_state, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const now = Math.floor(Date.now() / 1000);
  const conditions = [];
  const params = [];
  if (status)    { conditions.push('status = ?');    params.push(status); }
  if (severity)  { conditions.push('severity = ?');  params.push(severity); }
  if (category)  { conditions.push('category = ?');  params.push(category); }
  if (sla_state) { conditions.push('sla_state = ?'); params.push(sla_state); }
  if (search) {
    conditions.push('(title ILIKE ? OR summary ILIKE ? OR incident_ref ILIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const countRow = await db.prepare(`SELECT COUNT(*) as c FROM incidents ${where}`).get(...params);
  const total = parseInt(countRow.c);
  const rows = await db.prepare(`
    SELECT *, (sla_deadline - ${now}) as time_remaining
    FROM incidents ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);
  res.json({
    incidents: rows,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
  });
});

router.get('/recent-summaries', async (req, res) => {
  const rows = await db.prepare(`
    SELECT summary FROM incidents
    ORDER BY created_at DESC LIMIT 10
  `).all();
  const summaries = rows.map(r => r.summary).join('\n---\n');
  res.json({ summaries: summaries || 'No recent incidents' });
});

router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const incident = await db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  const now = Math.floor(Date.now() / 1000);
  incident.time_remaining = incident.sla_deadline - now;
  const raw_inputs = await db.prepare(
    'SELECT * FROM raw_inputs WHERE incident_id = ? ORDER BY uploaded_at ASC'
  ).all(id);
  const department_tasks = await db.prepare(
    'SELECT * FROM department_tasks WHERE incident_id = ? ORDER BY assigned_at ASC'
  ).all(id);
  const audit_trail = await db.prepare(
    'SELECT * FROM audit_trail WHERE incident_id = ? ORDER BY created_at ASC'
  ).all(id);
  res.json({ incident, raw_inputs, department_tasks, audit_trail });
});

router.patch('/:id/status', auth, async (req, res) => {
  const { id } = req.params;
  const { status: newStatus, actor = 'Agent' } = req.body;
  const incident = await db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  const allowed = VALID_TRANSITIONS[incident.status] || [];
  if (!allowed.includes(newStatus)) {
    return res.status(400).json({
      error: `Invalid transition: ${incident.status} → ${newStatus}`,
      allowed,
    });
  }
  const now = Math.floor(Date.now() / 1000);
  const isTerminal = ['Resolved', 'Closed', 'Cancelled'].includes(newStatus);
  const newSlaState = isTerminal ? 'COMPLETED' : incident.sla_state;
  const firstResponseAt = (!incident.first_response_at && incident.status === 'New')
    ? now
    : incident.first_response_at;
  let sql = `UPDATE incidents SET status=?, updated_at=?, sla_state=?, first_response_at=?`;
  const args = [newStatus, now, newSlaState, firstResponseAt];
  if (newStatus === 'Resolved') { sql += ', resolved_at=?'; args.push(now); }
  if (newStatus === 'Closed')   { sql += ', closed_at=?';   args.push(now); }
  sql += ' WHERE id=?';
  args.push(id);
  await db.prepare(sql).run(...args);
  await db.prepare(`
    INSERT INTO audit_trail (incident_id, actor, action, previous_value, new_value)
    VALUES (?, ?, 'Status updated', ?, ?)
  `).run(id, actor, incident.status, newStatus);
  res.json({ message: 'Status updated' });
});

router.patch('/:id/tasks/:taskId', auth, async (req, res) => {
  const { id, taskId } = req.params;
  const { task_status } = req.body;
  const valid = ['Not Started', 'In Progress', 'Completed'];
  if (!valid.includes(task_status)) {
    return res.status(400).json({ error: 'Invalid task_status' });
  }
  const now = Math.floor(Date.now() / 1000);
  const task = await db.prepare('SELECT * FROM department_tasks WHERE id = ? AND incident_id = ?').get(taskId, id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  await db.prepare('UPDATE department_tasks SET task_status=?, updated_at=? WHERE id=?')
    .run(task_status, now, taskId);
  const allTasks = await db.prepare('SELECT task_status FROM department_tasks WHERE incident_id = ?').all(id);
  const allComplete = allTasks.every(t => t.task_status === 'Completed');
  await db.prepare(`
    INSERT INTO audit_trail (incident_id, actor, action, previous_value, new_value, notes)
    VALUES (?, 'Agent', 'Task status updated', ?, ?, ?)
  `).run(id, task.task_status, task_status, `${task.department} – ${task.role}`);
  res.json({ message: 'Task updated', all_complete: allComplete });
});

module.exports = router;