/**
 * services/mailer.service.js
 * ──────────────────────────
 * Core Mailer Service for AMUST CodeArena.
 * Primary delivery via Brevo (Sendinblue) Transactional Emails API over HTTPS (Port 443).
 * Ensures reliable cloud OTP delivery on Render without domain verification barriers.
 */

import Brevo from '@getbrevo/brevo';
import nodemailer from 'nodemailer';

let apiInstance = null;
let transporterInstance = null;

/**
 * Returns the Brevo TransactionalEmailsApi instance configured with BREVO_API_KEY.
 */
export function getBrevoApiInstance() {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  if (!apiKey) return null;

  if (!apiInstance) {
    apiInstance = new Brevo.TransactionalEmailsApi();
  }
  apiInstance.setApiKey(
    Brevo.TransactionalEmailsApiApiKeys.apiKey,
    apiKey
  );
  return apiInstance;
}

/**
 * Resets instances (for testing).
 */
export function resetMailerClients() {
  apiInstance = null;
  transporterInstance = null;
}

/**
 * Returns the fallback Nodemailer transporter (for local dev when BREVO_API_KEY is omitted).
 */
export function getMailTransporter() {
  if (transporterInstance) return transporterInstance;

  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();

  if (user && pass) {
    transporterInstance = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  return transporterInstance;
}

/**
 * Helper to mask email address for UI disclosure (e.g., "s***t@amust.ac.bd").
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  return `${user[0]}${'*'.repeat(Math.max(1, user.length - 2))}${user[user.length - 1]}@${domain}`;
}

/**
 * Dispatches OTP verification code using Brevo HTTPS API.
 * Supports both signatures:
 *   - sendOtpEmail(email, otp)
 *   - sendOtpEmail({ to, otp, purpose })
 *
 * @param {string|object} param1 - Email address string OR payload object { to, otp, purpose }
 * @param {string} [param2] - 6-digit OTP code (if param1 is email string)
 * @param {string} [param3] - Purpose string (default: 'REGISTRATION')
 * @returns {Promise<{ success: boolean, otp: string, messageId?: string }>}
 */
export async function sendOtpEmail(param1, param2, param3) {
  let email, otp, purpose;
  if (typeof param1 === 'object' && param1 !== null) {
    email = param1.to || param1.email;
    otp = param1.otp;
    purpose = param1.purpose || 'REGISTRATION';
  } else {
    email = param1;
    otp = param2;
    purpose = param3 || 'REGISTRATION';
  }

  const masked = maskEmail(email);
  const purposeLabel =
    purpose === 'PASSWORD_RESET'
      ? 'Password Reset'
      : purpose === 'LOGIN'
      ? 'Secure Login Verification'
      : 'Account Registration';

  // Server console audit logging (preserved for compliance & local testing)
  console.log(`\n📨 [EMAIL OTP DISPATCH]`);
  console.log(`   To: ${email} (${masked})`);
  console.log(`   Purpose: ${purposeLabel}`);
  console.log(`   OTP Code: ${otp}`);
  console.log(`   Expires In: 5 minutes\n`);

  const senderEmail = (
    process.env.BREVO_SENDER_EMAIL ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    'sababsanjid2@gmail.com'
  ).trim();

  const senderName = 'AMUST CodeArena';

  const subject =
    purpose === 'PASSWORD_RESET'
      ? `Your AMUST CodeArena Password Reset Code: ${otp}`
      : `Your AMUST CodeArena Verification Code: ${otp}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>AMUST CodeArena Verification</h2>
      <p>Your one-time verification code is:</p>
      <h1 style="color: #059669; letter-spacing: 4px;">${otp}</h1>
      <p>This code will expire in 5 minutes.</p>
    </div>
  `;

  // 1. Primary Delivery: Brevo HTTPS Transactional API (Port 443)
  const brevoApi = getBrevoApiInstance();
  if (brevoApi) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      sendSmtpEmail.sender = {
        name: senderName,
        email: senderEmail,
      };
      sendSmtpEmail.to = [{ email }];

      const result = await brevoApi.sendTransacEmail(sendSmtpEmail);
      const messageId = result?.body?.messageId || result?.messageId || 'sent';

      console.log(`   ✅ [Brevo Dispatch Success]: Real OTP delivered to ${email} (Message ID: ${messageId})`);
      return { success: true, otp, messageId, body: result?.body };
    } catch (err) {
      console.error(`   ❌ [Brevo Dispatch Error]: Failed to deliver email to ${email} via Brevo API: ${err.message}`, {
        status: err.status || err.statusCode,
        response: err.response?.text || err.response?.body,
      });
      throw new Error(`Could not send email via Brevo (${err.message})`);
    }
  }

  // 2. Fallback: Nodemailer SMTP (for local dev without Brevo API key)
  const transporter = getMailTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: email,
        subject,
        html: htmlContent,
        text: `Your AMUST CodeArena verification code is: ${otp}. It expires in 5 minutes.`,
      });

      console.log(`   ✅ [SMTP Dispatch Success]: Real OTP delivered to ${email} (Message ID: ${info?.messageId || 'sent'})`);
      return { success: true, otp, messageId: info?.messageId };
    } catch (err) {
      console.error(`   ❌ [SMTP Dispatch Error]: Failed to deliver email to ${email} via SMTP: ${err.message}`);
      throw new Error(`Could not send email via SMTP (${err.message})`);
    }
  }

  // 3. Fallback when neither service is configured
  const errorMsg = 'No email service configured: Please set BREVO_API_KEY (recommended) or SMTP_USER/SMTP_PASS.';
  if (process.env.NODE_ENV === 'production') {
    console.error(`   ❌ [Mailer Error]: ${errorMsg}`);
    throw new Error(errorMsg);
  }
  console.warn(`   ⚠️ [Mailer Notice]: ${errorMsg}. Local dev mode active.`);
  return { success: true, otp, messageId: 'dev-mode' };
}

/**
 * Generic sendEmail function for general email dispatches.
 */
export async function sendEmail({ to, subject, html, text, from, replyTo }) {
  const brevoApi = getBrevoApiInstance();
  const recipient = Array.isArray(to) ? to : [to];

  const senderEmail = (
    process.env.BREVO_SENDER_EMAIL ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    'sababsanjid2@gmail.com'
  ).trim();

  const senderName = 'AMUST CodeArena';

  if (brevoApi) {
    try {
      const sendSmtpEmail = new Brevo.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = html || `<p>${text || ''}</p>`;
      sendSmtpEmail.sender = {
        name: senderName,
        email: senderEmail,
      };
      sendSmtpEmail.to = recipient.map((e) => (typeof e === 'string' ? { email: e } : e));
      if (replyTo) sendSmtpEmail.replyTo = { email: replyTo };

      const result = await brevoApi.sendTransacEmail(sendSmtpEmail);
      const messageId = result?.body?.messageId || result?.messageId || 'sent';

      console.log(`   ✅ [Brevo Dispatch Success]: Real email delivered to ${JSON.stringify(to)} (Message ID: ${messageId})`);
      return { success: true, messageId, body: result?.body };
    } catch (err) {
      console.error(`   ❌ [Brevo Dispatch Error]: Failed to deliver email to ${JSON.stringify(to)}: ${err.message}`);
      throw new Error(`Could not send email via Brevo (${err.message})`);
    }
  }

  const transporter = getMailTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: from || `"${senderName}" <${senderEmail}>`,
        to,
        replyTo,
        subject,
        html,
        text,
      });
      return { success: true, messageId: info?.messageId };
    } catch (err) {
      throw new Error(`Could not send email via SMTP (${err.message})`);
    }
  }

  return { success: true, messageId: 'dev-mode' };
}

export default {
  getBrevoApiInstance,
  getMailTransporter,
  sendOtpEmail,
  sendEmail,
};
