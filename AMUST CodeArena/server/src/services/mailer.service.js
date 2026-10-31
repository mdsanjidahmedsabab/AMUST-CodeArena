/**
 * services/mailer.service.js
 * ──────────────────────────
 * Core Mailer Service for AMUST CodeArena.
 * Preconfigured with native Gmail service preset for Render cloud compatibility.
 *
 * Requirements:
 * 1. Native Gmail preset (service: 'gmail') to avoid host/port connection timeouts on Render.
 * 2. Clean access to process.env.SMTP_USER and process.env.SMTP_PASS.
 * 3. Sends reject with a proper rejected Promise or throw an error on failure without silent fallback.
 */

import nodemailer from 'nodemailer';

let transporterInstance = null;

/**
 * Returns the singleton Nodemailer transporter configured for Gmail.
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
 * Sends an email using the configured Gmail transporter.
 * Returns a rejected Promise or throws an error if email fails, rather than hanging or failing silently.
 *
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} [options.from] - Sender address
 * @param {string} [options.replyTo] - Reply-To address
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {object} [options.headers] - Additional email headers
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
export async function sendEmail({ to, from, replyTo, subject, text, html, headers = {} }) {
  const transporter = getMailTransporter();
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();

  const fromAddr =
    from ||
    process.env.SMTP_FROM ||
    (user ? `"AMUST CodeArena" <${user}>` : '"AMUST CodeArena" <support@amust.ac.bd>');

  if (!transporter) {
    const errorMsg = 'SMTP transporter is not configured: Missing SMTP_USER or SMTP_PASS';
    if (process.env.NODE_ENV === 'production') {
      console.error(`   ❌ [Mailer Error]: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.warn(`   ⚠️ [Mailer Notice]: ${errorMsg}. Local dev mode active.`);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddr,
      to,
      replyTo: replyTo || process.env.SMTP_REPLY_TO || fromAddr,
      subject,
      text,
      html,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        ...headers,
      },
    });

    console.log(`   ✅ [SMTP Dispatch Success]: Real email delivered to ${to} (Message ID: ${info?.messageId || 'sent'})`);
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    console.error(`   ❌ [SMTP Dispatch Error]: Failed to deliver email to ${to} via Gmail SMTP: ${err.message}`, {
      code: err.code,
      command: err.command,
      response: err.response,
    });
    throw new Error(`Could not send email via SMTP (${err.message})`);
  }
}

export default {
  getMailTransporter,
  sendEmail,
};
