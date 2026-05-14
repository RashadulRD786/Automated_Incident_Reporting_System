const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/authMiddleware');
const router = express.Router();

// GET all unread notifications
router.get('/', auth, async (req, res) => {
  try {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const notifications = await db.prepare(`
      SELECT id, incident_id, incident_ref, message, type,
             category, primary_department, is_read, created_at
      FROM notifications
      WHERE created_at > ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(sevenDaysAgo);

    const unread_count = notifications.filter(n => !n.is_read).length;

    res.json({ notifications, unread_count });
  } catch (err) {
    console.error('Notifications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark single notification as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    await db.prepare(`
      UPDATE notifications SET is_read = TRUE WHERE id = ?
    `).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH mark all as read
router.patch('/read-all', auth, async (req, res) => {
  try {
    await db.prepare(`
      UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE
    `).run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;