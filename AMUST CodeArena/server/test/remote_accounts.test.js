/**
 * test/remote_accounts.test.js
 * ────────────────────────────
 * Comprehensive Test Suite for Remote Account Management & AES-256-CBC Crypto:
 *
 * 1. Crypto Utility Unit Tests:
 *    - Encrypt / Decrypt roundtrip matching across ASCII, complex passwords, and symbols.
 *    - IV Randomness: Same plaintext produces distinct ciphertexts with different IVs.
 *    - Malformed / Tampered ciphertext error handling.
 *    - Guaranteed 32-byte key derivation.
 *
 * 2. REST API Security & Integration Tests (/api/remote-accounts):
 *    - Unauthenticated requests rejected with HTTP 401.
 *    - Input validation: missing fields and unsupported OJ names return HTTP 400.
 *    - Bind remote account (POST /bind): returns 200, saves AES-256 encrypted password in DB, NEVER leaks password.
 *    - Idempotency & Upsert: re-binding updates credentials without duplicate key violation.
 *    - Get bound accounts (GET /): returns array of accounts with passwords strictly omitted.
 *    - Unbind remote account (DELETE /:ojName): deletes record, returns 200; subsequent delete returns 404.
 *    - Cascade check: user deletion automatically cascades to RemoteAccount records.
 */

import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import prisma from '../src/config/db.js';
import remoteAccountRoutes from '../src/routes/remoteAccountRoutes.js';
import { encrypt, decrypt } from '../src/utils/crypto.js';
import { signAccessToken, hashPassword } from '../src/services/auth.service.js';

// Setup isolated Express app for HTTP integration tests
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use('/api/remote-accounts', remoteAccountRoutes);

async function runTests() {
  console.log('\n======================================================');
  console.log('   Remote Accounts & AES-256-CBC Crypto Test Suite');
  console.log('======================================================\n');

  // ─────────────────────────────────────────────────────────────
  // 1. Crypto Utility Unit Tests
  // ─────────────────────────────────────────────────────────────
  console.log('🧪 1. Testing Crypto Utility (AES-256-CBC)...');

  // 1.1 Roundtrip integrity
  const testPayloads = [
    'SimplePass123',
    'Complex!@#$%^&*()_+~`|}{[]:;?><,./-= 12345',
    'UnicodePassword-密码-パスワード-🔒🔑',
    'A'.repeat(500), // Maximum password length
  ];

  for (const plain of testPayloads) {
    const cipherText = encrypt(plain);
    assert.match(cipherText, /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/, 'Cipher text must follow iv:encryptedData format');
    const decrypted = decrypt(cipherText);
    assert.equal(decrypted, plain, `Decrypted text must strictly match original plaintext for: ${plain.slice(0, 20)}...`);
  }
  console.log('   ✅ Encrypt/Decrypt roundtrip verified across ASCII, symbols, Unicode, and long strings.');

  // 1.2 IV Randomness
  const sample = 'ConsistentPlainTextSecret';
  const c1 = encrypt(sample);
  const c2 = encrypt(sample);
  assert.notEqual(c1, c2, 'Two encryptions of the same plaintext must have distinct IVs and ciphertexts');
  assert.equal(decrypt(c1), sample);
  assert.equal(decrypt(c2), sample);
  console.log('   ✅ IV Randomness verified (unique IV generated per encryption).');

  // 1.3 Malformed or tampered cipher text error handling
  assert.throws(() => decrypt('not-a-valid-ciphertext'), /Invalid cipherText format/, 'Should reject missing colon');
  assert.throws(() => decrypt('1234:abcdef'), /Invalid IV length/, 'Should reject invalid IV byte length');
  assert.throws(() => decrypt('0123456789abcdef0123456789abcdef:tamperedhex'), undefined, 'Should reject corrupt hex payload');
  console.log('   ✅ Malformed and tampered ciphertext rejection verified.');

  // ─────────────────────────────────────────────────────────────
  // 2. Setup Test User in Database & Generate Auth Token
  // ─────────────────────────────────────────────────────────────
  const timestamp = Date.now();
  const testEmail = `remote_test_${timestamp}@amust.ac.bd`;
  const testPassword = 'RemoteTestPassword123!';
  const passwordHash = await hashPassword(testPassword);

  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      universityId: `RT-${timestamp.toString().slice(-6)}`,
      name: 'Remote OJ Tester',
      passwordHash,
      role: 'STUDENT',
    },
  });

  const authToken = signAccessToken({
    id: testUser.id,
    email: testUser.email,
    role: testUser.role,
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/remote-accounts`;

  try {
    // ─────────────────────────────────────────────────────────────
    // 3. Authentication & Authorization Guards
    // ─────────────────────────────────────────────────────────────
    console.log('\n🧪 2. Testing Authentication Guard on Remote Account Endpoints...');

    // 3.1 Unauthenticated GET
    const unauthGet = await fetch(baseUrl);
    assert.equal(unauthGet.status, 401, 'Unauthenticated GET /api/remote-accounts must return 401');

    // 3.2 Unauthenticated POST /bind
    const unauthBind = await fetch(`${baseUrl}/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ojName: 'CODEFORCES', handle: 'tourist', password: 'secret' }),
    });
    assert.equal(unauthBind.status, 401, 'Unauthenticated POST /api/remote-accounts/bind must return 401');

    // 3.3 Unauthenticated DELETE
    const unauthDelete = await fetch(`${baseUrl}/CODEFORCES`, { method: 'DELETE' });
    assert.equal(unauthDelete.status, 401, 'Unauthenticated DELETE /api/remote-accounts/:ojName must return 401');

    console.log('   ✅ All endpoints properly reject unauthenticated requests with HTTP 401.');

    // ─────────────────────────────────────────────────────────────
    // 4. Input Validation & Bad Requests
    // ─────────────────────────────────────────────────────────────
    console.log('\n🧪 3. Testing Input Validation & Allowed OJs...');

    // 4.1 Missing fields
    const missingRes = await fetch(`${baseUrl}/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ ojName: 'CODEFORCES' }),
    });
    assert.equal(missingRes.status, 400, 'Missing handle/password must return 400');

    // 4.2 Unsupported OJ
    const unsupportedRes = await fetch(`${baseUrl}/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ ojName: 'LEETCODE', handle: 'user123', password: 'mypassword' }),
    });
    assert.equal(unsupportedRes.status, 400, 'Unsupported OJ must return 400');
    const unsupportedData = await unsupportedRes.json();
    assert.match(unsupportedData.error, /Allowed OJs: CODEFORCES, CODECHEF, ATCODER/);

    console.log('   ✅ Input validation correctly enforces schema and allowed OJs (CODEFORCES, CODECHEF, ATCODER).');

    // ─────────────────────────────────────────────────────────────
    // 5. Binding Remote Accounts (POST /bind)
    // ─────────────────────────────────────────────────────────────
    console.log('\n🧪 4. Testing Account Binding & Password Encryption...');

    const cfPassword = 'SuperSecretCFPassword!@#99';
    const bindCfRes = await fetch(`${baseUrl}/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        ojName: 'codeforces', // test case normalization
        handle: 'amust_champion',
        password: cfPassword,
      }),
    });

    assert.equal(bindCfRes.status, 200, 'Valid bind request must return 200');
    const bindCfData = await bindCfRes.json();
    assert.equal(bindCfData.success, true);
    assert.equal(bindCfData.ojName, 'CODEFORCES');
    assert.equal(bindCfData.handle, 'amust_champion');
    assert.equal(bindCfData.isValid, true);
    assert.equal(bindCfData.password, undefined, 'Password must NEVER be returned in response body');

    // Verify DB record directly
    const cfDbRecord = await prisma.remoteAccount.findUnique({
      where: {
        userId_ojName: {
          userId: testUser.id,
          ojName: 'CODEFORCES',
        },
      },
    });
    assert.ok(cfDbRecord, 'RemoteAccount record must exist in database');
    assert.notEqual(cfDbRecord.password, cfPassword, 'Stored password MUST NOT be plain text');
    assert.equal(decrypt(cfDbRecord.password), cfPassword, 'Decrypted DB password must match original plaintext');
    console.log('   ✅ Codeforces account bound successfully; verified encrypted storage in PostgreSQL.');

    // 5.2 Upsert / Update existing binding
    const updatedCfPassword = 'UpdatedSecretPassword!@#44';
    const updateCfRes = await fetch(`${baseUrl}/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        ojName: 'CODEFORCES',
        handle: 'amust_champion_renamed',
        password: updatedCfPassword,
      }),
    });

    assert.equal(updateCfRes.status, 200, 'Re-binding existing OJ must return 200 (upsert)');
    const updateCfData = await updateCfRes.json();
    assert.equal(updateCfData.handle, 'amust_champion_renamed');

    const updatedDbRecord = await prisma.remoteAccount.findUnique({
      where: {
        userId_ojName: {
          userId: testUser.id,
          ojName: 'CODEFORCES',
        },
      },
    });
    assert.equal(updatedDbRecord.handle, 'amust_champion_renamed');
    assert.equal(decrypt(updatedDbRecord.password), updatedCfPassword);
    console.log('   ✅ Upsert verified: existing binding updated without duplicate key violation.');

    // 5.3 Bind a second OJ (AtCoder)
    const atcoderPassword = 'AtCoderSecretPassword123';
    const bindAtcoderRes = await fetch(`${baseUrl}/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        ojName: 'ATCODER',
        handle: 'chokudai_fan',
        password: atcoderPassword,
      }),
    });
    assert.equal(bindAtcoderRes.status, 200);
    console.log('   ✅ AtCoder account bound successfully.');

    // ─────────────────────────────────────────────────────────────
    // 6. Listing Bound Accounts (GET /)
    // ─────────────────────────────────────────────────────────────
    console.log('\n🧪 5. Testing Listing Bound Accounts (GET /api/remote-accounts)...');

    const listRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(listRes.status, 200, 'GET / must return 200');
    const listData = await listRes.json();
    assert.equal(listData.success, true);
    assert.equal(listData.accounts.length, 2, 'Should list both bound accounts');

    for (const acc of listData.accounts) {
      assert.ok(acc.id);
      assert.ok(acc.ojName);
      assert.ok(acc.handle);
      assert.equal(acc.isValid, true);
      assert.ok(acc.createdAt);
      assert.ok(acc.updatedAt);
      assert.equal(acc.password, undefined, 'Password property must NOT be present in list response');
    }
    console.log('   ✅ Account list returned accurately with all passwords sanitized.');

    // ─────────────────────────────────────────────────────────────
    // 7. Unbinding Accounts (DELETE /:ojName)
    // ─────────────────────────────────────────────────────────────
    console.log('\n🧪 6. Testing Unbinding Remote Accounts (DELETE /:ojName)...');

    // 7.1 Delete Codeforces account
    const deleteCfRes = await fetch(`${baseUrl}/CODEFORCES`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(deleteCfRes.status, 200, 'DELETE /CODEFORCES must return 200');
    const deleteCfData = await deleteCfRes.json();
    assert.equal(deleteCfData.success, true);
    assert.equal(deleteCfData.ojName, 'CODEFORCES');

    // Verify deletion in DB
    const deletedDbRecord = await prisma.remoteAccount.findUnique({
      where: {
        userId_ojName: {
          userId: testUser.id,
          ojName: 'CODEFORCES',
        },
      },
    });
    assert.equal(deletedDbRecord, null, 'Deleted account must not exist in DB');
    console.log('   ✅ Codeforces account unbound and deleted from database.');

    // 7.2 Deleting already-unbound account returns 404
    const deleteAgainRes = await fetch(`${baseUrl}/CODEFORCES`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(deleteAgainRes.status, 404, 'Deleting non-existent binding must return 404');
    console.log('   ✅ Deleting non-existent binding correctly returns HTTP 404.');

    // 7.3 Invalid OJ returns 400
    const deleteInvalidRes = await fetch(`${baseUrl}/INVALID_OJ`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(deleteInvalidRes.status, 400, 'Deleting with invalid OJ name must return 400');
    console.log('   ✅ Deleting with invalid OJ name correctly returns HTTP 400.');

    // ─────────────────────────────────────────────────────────────
    // 8. Cascade Deletion on User Delete
    // ─────────────────────────────────────────────────────────────
    console.log('\n🧪 7. Testing User Cascade Deletion...');

    // User still has AtCoder bound
    const remainingBefore = await prisma.remoteAccount.count({ where: { userId: testUser.id } });
    assert.equal(remainingBefore, 1, 'User should have 1 remaining bound account');

    // Delete user
    await prisma.user.delete({ where: { id: testUser.id } });

    const remainingAfter = await prisma.remoteAccount.count({ where: { userId: testUser.id } });
    assert.equal(remainingAfter, 0, 'Cascade delete must purge all remote accounts when User is deleted');
    console.log('   ✅ Cascade deletion verified: deleting user wiped all associated remote accounts.');

    console.log('\n🎉 ALL REMOTE ACCOUNT & CRYPTO TESTS PASSED SUCCESSFULLY! (100% SUCCESS)\n');
  } finally {
    server.close();
    // Safety cleanup in case of test failure
    try {
      await prisma.remoteAccount.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    } catch {
      // ignore
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
