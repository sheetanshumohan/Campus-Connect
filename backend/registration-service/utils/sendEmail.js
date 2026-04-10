const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
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
  }
};

/**
 * Registration confirmation email.
 */
const sendRegistrationConfirmation = async (to, name, eventTitle, eventDate, ticketNumber) => {
  const formattedDate = new Date(eventDate).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6366f1;">🎟️ Registration Confirmed!</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>You're registered for <strong>${eventTitle}</strong>.</p>
      <div style="background: #f4f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>📅 Date:</strong> ${formattedDate}</p>
        <p><strong>🎫 Ticket Number:</strong> <span style="color:#6366f1; font-weight:bold;">${ticketNumber}</span></p>
      </div>
      <p>See you there! 🎉</p>
      <p style="color: #888; font-size: 12px;">Campus Connect Team</p>
    </div>
  `;
  return sendEmail({ to, subject: `Registration Confirmed: ${eventTitle}`, html });
};

/**
 * Waitlist notification email.
 */
const sendWaitlistEmail = async (to, name, eventTitle, position) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f59e0b;">⏳ You're on the Waitlist</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>The event <strong>${eventTitle}</strong> is currently full. You've been added to the waitlist.</p>
      <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <p><strong>Your position:</strong> #${position}</p>
      </div>
      <p>We'll notify you immediately if a spot opens up!</p>
      <p style="color: #888; font-size: 12px;">Campus Connect Team</p>
    </div>
  `;
  return sendEmail({ to, subject: `Waitlisted: ${eventTitle}`, html });
};

/**
 * Waitlist promotion email.
 */
const sendWaitlistPromotionEmail = async (to, name, eventTitle, ticketNumber) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">🎉 A Spot Opened Up!</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Great news! A spot is now available for <strong>${eventTitle}</strong> and you've been automatically confirmed!</p>
      <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
        <p><strong>🎫 Ticket Number:</strong> <span style="color:#10b981; font-weight:bold;">${ticketNumber}</span></p>
      </div>
      <p>See you at the event! 🚀</p>
      <p style="color: #888; font-size: 12px;">Campus Connect Team</p>
    </div>
  `;
  return sendEmail({ to, subject: `You're In! Spot Confirmed: ${eventTitle}`, html });
};

/**
 * Cancellation email.
 */
const sendCancellationEmail = async (to, name, eventTitle) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ef4444;">❌ Registration Cancelled</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your registration for <strong>${eventTitle}</strong> has been cancelled.</p>
      <p>If this was a mistake, please re-register on Campus Connect.</p>
      <p style="color: #888; font-size: 12px;">Campus Connect Team</p>
    </div>
  `;
  return sendEmail({ to, subject: `Registration Cancelled: ${eventTitle}`, html });
};

module.exports = {
  sendEmail,
  sendRegistrationConfirmation,
  sendWaitlistEmail,
  sendWaitlistPromotionEmail,
  sendCancellationEmail,
};
