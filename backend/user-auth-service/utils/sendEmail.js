const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 5000, // 5 second timeout for connection
    socketTimeout: 5000,     // 5 second timeout for socket operations
  });
};

/**
 * Send an email via Nodemailer.
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    // Skip email sending if EMAIL_HOST is not configured (development mode)
    if (!process.env.EMAIL_HOST) {
      console.log(`📧 [DEV MODE] Email to ${to} skipped (EMAIL_HOST not configured):`);
      console.log(`   Subject: ${subject}`);
      console.log(`   OTP or content would be sent here.`);
      return { messageId: 'dev-mode-skipped' };
    }

    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text: text || '',
      html: html || '',
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    // Don't throw — email failure shouldn't break the request
  }
};

/**
 * Send password reset email.
 */
const sendPasswordResetEmail = async (to, name, resetLink) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #6366f1;">Campus Connect — Password Reset</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Click the button below to reset your password. This link expires in <strong>30 minutes</strong>.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background: #6366f1; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p style="color: #888; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
    </div>
  `;
  return sendEmail({ to, subject: 'Campus Connect — Password Reset Request', html });
};

module.exports = { sendEmail, sendPasswordResetEmail };
