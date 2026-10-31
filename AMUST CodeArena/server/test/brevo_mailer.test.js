/**
 * test/brevo_mailer.test.js
 * ─────────────────────────
 * Validates Brevo (Sendinblue) Transactional Email API integration,
 * SendSmtpEmail payload structure, audit logging, and rejection handling.
 */

import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
dotenv.config();

import assert from 'node:assert/strict';
import Brevo from '@getbrevo/brevo';
import {
  getBrevoApiInstance,
  sendOtpEmail,
  sendEmail,
  resetMailerClients,
} from '../src/services/mailer.service.js';

async function testBrevoMailer() {
  console.log('\n======================================================');
  console.log('   Testing Brevo (Sendinblue) Transactional API       ');
  console.log('======================================================\n');

  // 1. Test Brevo client initialization
  console.log('▶ [Test 1] Testing Brevo TransactionalEmailsApi Initialization...');
  process.env.BREVO_API_KEY = 'xkeysib-test-mock-api-key-999';
  resetMailerClients();

  const apiInstance = getBrevoApiInstance();
  assert.ok(apiInstance, 'Brevo API instance should be initialized when BREVO_API_KEY is present');
  assert.ok(apiInstance instanceof Brevo.TransactionalEmailsApi, 'Instance should be a TransactionalEmailsApi');
  console.log('  ✓ Brevo TransactionalEmailsApi successfully instantiated with apiKey.');

  // 2. Test sendOtpEmail(email, otp) with Brevo
  console.log('\n▶ [Test 2] Testing sendOtpEmail(email, otp) Dispatch & Payload...');
  let sentSmtpEmail = null;
  apiInstance.sendTransacEmail = async (smtpEmail) => {
    sentSmtpEmail = smtpEmail;
    return {
      body: { messageId: '<brevo-mock-message-id-12345@smtp-relay.mailin.fr>' },
      response: { statusCode: 201 },
    };
  };

  const testEmail = 'student-test@amust.ac.bd';
  const testOtp = '654321';

  const result1 = await sendOtpEmail(testEmail, testOtp);
  assert.equal(result1.success, true);
  assert.equal(result1.otp, testOtp);
  assert.equal(result1.messageId, '<brevo-mock-message-id-12345@smtp-relay.mailin.fr>');

  assert.ok(sentSmtpEmail instanceof Brevo.SendSmtpEmail, 'Should create Brevo.SendSmtpEmail');
  assert.equal(sentSmtpEmail.sender.name, 'AMUST CodeArena');
  assert.equal(sentSmtpEmail.sender.email, process.env.SMTP_USER || 'sababsanjid2@gmail.com');
  assert.deepEqual(sentSmtpEmail.to, [{ email: testEmail }]);
  assert.match(sentSmtpEmail.subject, /654321/);
  assert.match(sentSmtpEmail.htmlContent, /654321/);
  assert.match(sentSmtpEmail.htmlContent, /AMUST CodeArena Verification/);
  console.log('  ✓ sendOtpEmail(email, otp) properly constructed Brevo.SendSmtpEmail and dispatched.');

  // 3. Test polymorphic object form sendOtpEmail({ to, otp, purpose })
  console.log('\n▶ [Test 3] Testing polymorphic sendOtpEmail({ to, otp, purpose })...');
  sentSmtpEmail = null;
  const result2 = await sendOtpEmail({
    to: 'faculty@amust.ac.bd',
    otp: '789123',
    purpose: 'PASSWORD_RESET',
  });

  assert.equal(result2.success, true);
  assert.deepEqual(sentSmtpEmail.to, [{ email: 'faculty@amust.ac.bd' }]);
  assert.match(sentSmtpEmail.subject, /Password Reset Code: 789123/);
  console.log('  ✓ Polymorphic object format dispatched with correct password reset subject.');

  // 4. Test Error Handling & Rejection on Brevo API failure
  console.log('\n▶ [Test 4] Testing Error Throwing on Brevo API Rejection...');
  apiInstance.sendTransacEmail = async () => {
    const error = new Error('Unauthorized: Key not found or IP not whitelisted');
    error.status = 401;
    throw error;
  };

  let threw = false;
  try {
    await sendOtpEmail('fail@amust.ac.bd', '000000');
  } catch (err) {
    threw = true;
    assert.match(err.message, /Could not send email via Brevo \(Unauthorized/i);
    console.log(`  ✓ Correctly threw expected rejected error: "${err.message}"`);
  }
  assert.ok(threw, 'sendOtpEmail MUST throw when Brevo API call fails');

  // 5. Test generic sendEmail function
  console.log('\n▶ [Test 5] Testing Generic sendEmail via Brevo...');
  apiInstance.sendTransacEmail = async (smtpEmail) => {
    sentSmtpEmail = smtpEmail;
    return {
      body: { messageId: '<generic-msg-999@brevo.com>' },
    };
  };

  const genericResult = await sendEmail({
    to: 'notification@amust.ac.bd',
    subject: 'Contest Starting Soon',
    html: '<p>Round 1 starts in 15 minutes.</p>',
  });
  assert.equal(genericResult.success, true);
  assert.equal(sentSmtpEmail.subject, 'Contest Starting Soon');
  assert.deepEqual(sentSmtpEmail.to, [{ email: 'notification@amust.ac.bd' }]);
  console.log('  ✓ Generic sendEmail dispatches correctly via Brevo API.');

  console.log('\n======================================================');
  console.log('   ALL BREVO MAILER SERVICE TESTS PASSED!             ');
  console.log('======================================================\n');
  process.exit(0);
}

testBrevoMailer().catch((err) => {
  console.error('\n❌ Test execution failed with error:', err);
  process.exit(1);
});
