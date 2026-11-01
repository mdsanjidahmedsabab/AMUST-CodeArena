/**
 * utils/crypto.js
 * ───────────────
 * Cryptographic utility for securing remote Online Judge credentials
 * using native Node.js crypto and AES-256-CBC encryption.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 16 bytes for AES block size

let warnedFallback = false;

/**
 * Derives a guaranteed 32-byte (256-bit) Buffer key from environment or fallback.
 * @returns {Buffer} 32-byte key
 */
function getEncryptionKey() {
  const secret = process.env.REMOTE_AUTH_SECRET;

  if (!secret) {
    if (!warnedFallback) {
      console.warn('⚠️ [Crypto Warning] REMOTE_AUTH_SECRET is not set. Using SHA-256 dev fallback key.');
      warnedFallback = true;
    }
    return crypto
      .createHash('sha256')
      .update('amust-codearena-remote-auth-fallback-secret-key-32b')
      .digest();
  }

  // If secret is already a 64-character hex string representing 32 bytes, parse it directly
  if (typeof secret === 'string' && /^[0-9a-fA-F]{64}$/.test(secret.trim())) {
    return Buffer.from(secret.trim(), 'hex');
  }

  // Otherwise, safely hash the secret string with SHA-256 to produce an exact 32-byte key
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts plain text using AES-256-CBC.
 * Returns cipher text in `iv:encryptedData` (hex) format.
 *
 * @param {string} text - Plain text to encrypt
 * @returns {string} iv:encryptedData
 */
export function encrypt(text) {
  if (text === null || text === undefined) {
    throw new Error('Cannot encrypt null or undefined text');
  }

  const plainText = String(text);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts cipher text in `iv:encryptedData` (hex) format back to plain text.
 *
 * @param {string} cipherText - Encrypted string in `iv:encryptedData` (hex)
 * @returns {string} Decrypted original text
 */
export function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') {
    throw new Error('Invalid cipherText: must be a non-empty string');
  }

  const parts = cipherText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid cipherText format. Expected iv:encryptedData');
  }

  const [ivHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export default {
  encrypt,
  decrypt,
};
