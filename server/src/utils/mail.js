const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('./logger');

let transporter = null;
let transporterChecked = false;

const getTransporter = () => {
  if (transporterChecked) return transporter;
  transporterChecked = true;
  if (!env.mail.host || !env.mail.user) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: { user: env.mail.user, pass: env.mail.pass },
  });
  return transporter;
};

const sendMail = async ({ to, subject, html, text }) => {
  if (!to) return { skipped: true, reason: 'missing recipient' };
  const client = getTransporter();
  if (!client) {
    logger.info(`[mail:disabled] To: ${to} | Subject: ${subject}`);
    return { skipped: true, reason: 'smtp not configured' };
  }
  try {
    const info = await client.sendMail({ from: env.mail.from, to, subject, html, text });
    return { skipped: false, messageId: info.messageId };
  } catch (error) {
    logger.error(`Email send failed for ${to}: ${error.message}`);
    return { skipped: true, error: error.message };
  }
};

const baseTemplate = (title, body) => `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#1e3a8a;color:#ffffff;padding:20px 24px">
        <h2 style="margin:0;font-size:18px">${title}</h2>
      </div>
      <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">${body}</div>
      <div style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px">
        This is an automated message from the HRMS platform.
      </div>
    </div>
  </div>
`;

const sendPasswordResetEmail = async (user, resetUrl) =>
  sendMail({
    to: user.email,
    subject: 'Reset your HRMS password',
    html: baseTemplate(
      'Password reset request',
      `<p>Hello ${user.name},</p>
       <p>We received a request to reset your password. Click the button below to choose a new password. The link expires in 30 minutes.</p>
       <p style="margin:24px 0"><a href="${resetUrl}" style="background:#1e3a8a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Reset password</a></p>
       <p>If you did not request this, you can safely ignore this email.</p>`,
    ),
  });

const sendWelcomeEmail = async ({ to, name, employeeId, temporaryPassword }) =>
  sendMail({
    to,
    subject: 'Welcome to the HRMS platform',
    html: baseTemplate(
      'Your HRMS account is ready',
      `<p>Hello ${name},</p>
       <p>Your employee account has been created.</p>
       <ul>
         <li><strong>Employee ID:</strong> ${employeeId}</li>
         <li><strong>Email:</strong> ${to}</li>
         <li><strong>Temporary password:</strong> ${temporaryPassword}</li>
       </ul>
       <p>Please sign in and change your password immediately.</p>`,
    ),
  });

const sendEmailChangeOtp = async ({ to, name, otp, emailType, expiresMinutes, requestedBy }) => {
  const label = emailType === 'WORK' ? 'official work email' : 'personal email';
  return sendMail({
    to,
    subject: `Verify your new ${label}`,
    html: baseTemplate(
      'Confirm your email change',
      `<p>Hello ${name},</p>
       <p>A request was made${requestedBy ? ` by ${requestedBy}` : ''} to use this address as your ${label} in the HRMS.</p>
       <p>Enter the verification code below to confirm that you own this mailbox. The code expires in ${expiresMinutes} minutes.</p>
       <p style="margin:24px 0;font-size:26px;letter-spacing:6px;font-weight:bold;color:#1e3a8a">${otp}</p>
       <p>If you did not request this change, ignore this email and contact HR. The address will not be changed.</p>`,
    ),
  });
};

const sendNotificationEmail = async ({ to, name, title, message, link }) =>
  sendMail({
    to,
    subject: title,
    html: baseTemplate(
      title,
      `<p>Hello ${name},</p><p>${message}</p>${
        link ? `<p><a href="${link}" style="color:#1e3a8a">Open in HRMS</a></p>` : ''
      }`,
    ),
  });

module.exports = { sendMail, sendPasswordResetEmail, sendWelcomeEmail, sendEmailChangeOtp, sendNotificationEmail };
