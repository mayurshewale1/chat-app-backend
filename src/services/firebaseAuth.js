/**
 * Firebase Auth - verify phone ID tokens from client.
 * Client uses Firebase Phone Auth to send OTP and verify; sends idToken to backend.
 */
const path = require('path');
const logger = require('../utils/logger');

let admin = null;
let initialized = false;

function init() {
  if (initialized) return !!admin;
  try {
    const credPath = path.resolve(process.cwd(), 'firebase-service-account.json');
    const fs = require('fs');
    if (!fs.existsSync(credPath)) {
      logger.warn('Firebase Auth: firebase-service-account.json not found.');
      initialized = true;
      return false;
    }
    if (!admin) {
      admin = require('firebase-admin');
      const cred = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(cred) });
      }
    }
    initialized = true;
    return true;
  } catch (err) {
    logger.warn('Firebase Auth init failed:', err.message);
    initialized = true;
    return false;
  }
}

/**
 * Verify Firebase ID token and extract phone number.
 * @param {string} idToken - Firebase ID token from client
 * @returns {Promise<{phoneNumber: string} | null>} Decoded claims or null
 */
async function verifyPhoneToken(idToken) {
  if (!admin && !init()) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) return null;
    return { phoneNumber: phone };
  } catch (err) {
    logger.warn('Firebase token verify failed:', err.message);
    return null;
  }
}

/**
 * Normalize phone to digits only (e.g. +919876543210 -> 9876543210)
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '').slice(-10);
}

module.exports = { verifyPhoneToken, normalizePhone, init };
