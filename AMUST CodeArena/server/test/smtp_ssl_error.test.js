import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
dotenv.config();
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { sendOtpEmail, getMailTransporter } from '../src/services/otpService.js';

async function testSmtpConfiguration() {
  console.log('\n--- Testing Nodemailer Transporter SSL Configuration ---');

  const transporter = getMailTransporter();
  assert.ok(transporter, 'Transporter should be instantiated');

  // Verify options
  assert.equal(transporter.options.port, 465, 'Transporter port must be 465');
  assert.equal(transporter.options.secure, true, 'Transporter secure must be true for SSL');
  assert.equal(transporter.options.connectionTimeout, 15000, 'connectionTimeout must be 15000');
  assert.equal(transporter.options.greetingTimeout, 10000, 'greetingTimeout must be 10000');
  assert.equal(transporter.options.socketTimeout, 15000, 'socketTimeout must be 15000');
  assert.equal(transporter.options.tls.rejectUnauthorized, false, 'tls.rejectUnauthorized must be false');
  console.log('✓ Transporter options match SSL specifications.');

  console.log('\n--- Testing Error Throwing on SMTP Failure ---');
  // Temporarily replace transporter sendMail with a simulated failure
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async () => {
    const error = new Error('Connection timeout');
    error.code = 'ETIMEDOUT';
    throw error;
  };

  let threw = false;
  try {
    await sendOtpEmail({
      to: 'fail-test@amust.ac.bd',
      otp: '999999',
      purpose: 'REGISTRATION',
    });
  } catch (err) {
    threw = true;
    assert.match(err.message, /Could not send email via SMTP \(Connection timeout\)/);
    console.log(`✓ sendOtpEmail correctly threw expected error: "${err.message}"`);
  } finally {
    transporter.sendMail = originalSendMail;
  }

  assert.ok(threw, 'sendOtpEmail MUST throw when SMTP dispatch fails');
  console.log('\n🎉 Transporter SSL & Error Throwing verification passed!\n');
  process.exit(0);
}

testSmtpConfiguration().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
