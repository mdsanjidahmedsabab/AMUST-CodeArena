import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
dotenv.config();
import assert from 'node:assert/strict';
import { getMailTransporter, sendEmail } from '../src/services/mailer.service.js';
import { sendOtpEmail } from '../src/services/otpService.js';

async function testSmtpConfiguration() {
  console.log('\n--- Testing Nodemailer Transporter Gmail Preset Configuration ---');

  const transporter = getMailTransporter();
  assert.ok(transporter, 'Transporter should be instantiated');

  // Verify options
  assert.equal(transporter.options.service, 'gmail', 'Transporter service must be "gmail"');
  assert.equal(transporter.options.tls.rejectUnauthorized, false, 'tls.rejectUnauthorized must be false');
  console.log('✓ Transporter options match Gmail service preset specifications.');

  console.log('\n--- Testing Error Throwing on SMTP Failure ---');
  // Temporarily replace transporter sendMail with a simulated failure
  const originalSendMail = transporter.sendMail;
  transporter.sendMail = async () => {
    const error = new Error('Connection timeout');
    error.code = 'ETIMEDOUT';
    throw error;
  };

  // 1. Direct mailer.service.js sendEmail test
  let mailerThrew = false;
  try {
    await sendEmail({
      to: 'fail-mailer@amust.ac.bd',
      subject: 'Test Failure',
      text: 'Test Failure Message',
    });
  } catch (err) {
    mailerThrew = true;
    assert.match(err.message, /Could not send email via SMTP \(Connection timeout\)/);
    console.log(`✓ sendEmail correctly rejected with error: "${err.message}"`);
  }
  assert.ok(mailerThrew, 'sendEmail MUST throw/reject when SMTP fails');

  // 2. otpService.js sendOtpEmail test
  let otpThrew = false;
  try {
    await sendOtpEmail({
      to: 'fail-test@amust.ac.bd',
      otp: '999999',
      purpose: 'REGISTRATION',
    });
  } catch (err) {
    otpThrew = true;
    assert.match(err.message, /Could not send email via SMTP \(Connection timeout\)/);
    console.log(`✓ sendOtpEmail correctly threw expected error: "${err.message}"`);
  } finally {
    transporter.sendMail = originalSendMail;
  }

  assert.ok(otpThrew, 'sendOtpEmail MUST throw when SMTP dispatch fails');
  console.log('\n🎉 Mailer Module & Error Rejection verification passed!\n');
  process.exit(0);
}

testSmtpConfiguration().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
