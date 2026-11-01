/**
 * services/remoteAccountService.js
 * ────────────────────────────────
 * Client API integration service for external Online Judge (OJ) credentials.
 * Routes through the authenticated CodeArena Axios client.
 */

import api from '../api/client';

/**
 * Fetch all remote accounts bound by the authenticated user.
 * @returns {Promise<Array<{ id: string, ojName: string, handle: string, isValid: boolean, createdAt: string, updatedAt: string }>>}
 */
export async function getBoundAccounts() {
  try {
    const { data } = await api.get('/remote-accounts');
    return data?.accounts || [];
  } catch (err) {
    const message = err.response?.data?.error || err.message || 'Failed to fetch bound accounts';
    throw new Error(message);
  }
}

/**
 * Bind or update external Online Judge credentials.
 * @param {object} params
 * @param {string} params.ojName 'CODEFORCES' | 'CODECHEF' | 'ATCODER'
 * @param {string} params.handle User handle on external OJ
 * @param {string} params.password Plain text password (encrypted server-side with AES-256-CBC)
 * @returns {Promise<{ success: boolean, message: string, ojName: string, handle: string, isValid: boolean }>}
 */
export async function bindAccount({ ojName, handle, password }) {
  try {
    const { data } = await api.post('/remote-accounts/bind', {
      ojName: ojName.toUpperCase(),
      handle: handle.trim(),
      password,
    });
    return data;
  } catch (err) {
    const message = err.response?.data?.error || err.message || 'Failed to bind remote account';
    throw new Error(message);
  }
}

/**
 * Unbind an external Online Judge account.
 * @param {string} ojName 'CODEFORCES' | 'CODECHEF' | 'ATCODER'
 * @returns {Promise<{ success: boolean, message: string, ojName: string }>}
 */
export async function unbindAccount(ojName) {
  try {
    const normalizedOj = ojName.toUpperCase();
    const { data } = await api.delete(`/remote-accounts/${encodeURIComponent(normalizedOj)}`);
    return data;
  } catch (err) {
    const message = err.response?.data?.error || err.message || 'Failed to unbind remote account';
    throw new Error(message);
  }
}

export default {
  getBoundAccounts,
  bindAccount,
  unbindAccount,
};
