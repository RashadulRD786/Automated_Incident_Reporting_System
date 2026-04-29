const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendPasswordResetEmail(toEmail, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await transporter.sendMail({
    from: `"DHL Incident System" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Password Reset Request – DHL Incident Management',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:#D40511;padding:20px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">DHL Incident Management System</h1>
        </div>
        <div style="padding:30px;background:#fff;border:1px solid #eee;">
          <h2 style="color:#333;">Password Reset Request</h2>
          <p>You requested a password reset. Click the button below to set a new password.</p>
          <p>This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#D40511;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;margin:16px 0;">
            Reset Password
          </a>
          <p style="color:#999;font-size:12px;">If you did not request this, ignore this email. Your password will not change.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
