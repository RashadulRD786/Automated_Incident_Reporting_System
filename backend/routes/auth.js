const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database/db');
const { sendPasswordResetEmail } = require('../services/emailService');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    await db.prepare('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?')
      .run(resetToken, expiry, user.id);
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    console.log(`\n[DEMO] Password reset link for ${user.email}:\n${resetUrl}\n`);
    try {
      await sendPasswordResetEmail(user.email, resetToken);
    } catch (err) {
      console.error('Email send error:', err.message);
    }
  }
  res.json({ message: 'Reset link sent if email exists' });
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password required' });
  }
  const now = Math.floor(Date.now() / 1000);
  const user = await db.prepare(
    'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?'
  ).get(token, now);
  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?')
    .run(hash, user.id);
  res.json({ message: 'Password updated successfully' });
});

module.exports = router;