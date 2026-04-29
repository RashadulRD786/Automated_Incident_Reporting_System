const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

const VALID_TRANSITIONS = {
  'New':         ['Assigned'],
  'Assigned':    ['In Progress'],
  'In Progress': ['Pending', 'Resolved'],
  'Pending':     ['In Progress', 'Resolved'],
  'Resolved':    ['Closed'],
};

router.get('/', auth, (req, res) => {
  const { status, severity, category, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const now = Math.floor(Date.now() / 1000);

  const conditions = [];
  const params = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (severity) { conditions.push('severity = ?'); params.push(severity); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (search) {
    conditions.push('(title LIKE ? OR summary LIKE ? OR incident_ref LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) as c FROM incidents ${where}`).get(...params).c;

  const rows = db.prepare(`
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

router.get('/:id', auth, (req, res) => {
  const { id } = req.params;

  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  const now = Math.floor(Date.now() / 1000);
  incident.time_remaining = incident.sla_deadline - now;

  const raw_inputs = db.prepare(
    'SELECT * FROM raw_inputs WHERE incident_id = ? ORDER BY uploaded_at ASC'
  ).all(id);

  const department_tasks = db.prepare(
    'SELECT * FROM department_tasks WHERE incident_id = ? ORDER BY assigned_at ASC'
  ).all(id);

  const audit_trail = db.prepare(
    'SELECT * FROM audit_trail WHERE incident_id = ? ORDER BY created_at ASC'
  ).all(id);

  res.json({ incident, raw_inputs, department_tasks, audit_trail });
});

router.patch('/:id/status', auth, (req, res) => {
  const { id } = req.params;
  const { status: newStatus, actor = 'Agent' } = req.body;

  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  const allowed = VALID_TRANSITIONS[incident.status] || [];
  if (!allowed.includes(newStatus)) {
    return res.status(400).json({
      error: `Invalid transition: ${incident.status} → ${newStatus}`,
      allowed,
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const updates = { status: newStatus, updated_at: now };
  if (newStatus === 'Resolved') updates.resolved_at = now;
  if (newStatus === 'Closed') updates.closed_at = now;

  db.prepare(`
    UPDATE incidents SET status=?, updated_at=?
    ${newStatus === 'Resolved' ? ', resolved_at=?' : ''}
    ${newStatus === 'Closed' ? ', closed_at=?' : ''}
    WHERE id=?
  `).run(
    newStatus,
    now,
    ...(newStatus === 'Resolved' ? [now] : []),
    ...(newStatus === 'Closed' ? [now] : []),
    id
  );

  db.prepare(`
    INSERT INTO audit_trail (incident_id, actor, action, previous_value, new_value)
    VALUES (?, ?, 'Status updated', ?, ?)
  `).run(id, actor, incident.status, newStatus);

  res.json({ message: 'Status updated' });
});

router.patch('/:id/tasks/:taskId', auth, (req, res) => {
  const { id, taskId } = req.params;
  const { task_status } = req.body;

  const valid = ['Not Started', 'In Progress', 'Completed'];
  if (!valid.includes(task_status)) {
    return res.status(400).json({ error: 'Invalid task_status' });
  }

  const now = Math.floor(Date.now() / 1000);
  const task = db.prepare('SELECT * FROM department_tasks WHERE id = ? AND incident_id = ?').get(taskId, id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.prepare('UPDATE department_tasks SET task_status=?, updated_at=? WHERE id=?')
    .run(task_status, now, taskId);

  const allTasks = db.prepare('SELECT task_status FROM department_tasks WHERE incident_id = ?').all(id);
  const allComplete = allTasks.every(t => t.task_status === 'Completed');

  db.prepare(`
    INSERT INTO audit_trail (incident_id, actor, action, previous_value, new_value, notes)
    VALUES (?, 'Agent', 'Task status updated', ?, ?, ?)
  `).run(id, task.task_status, task_status, `${task.department} – ${task.role}`);

  res.json({ message: 'Task updated', all_complete: allComplete });
});

module.exports = router;
