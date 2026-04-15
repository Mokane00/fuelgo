// ================================================
// FuelGO — utils/firebase.js
// Description: Firebase Admin SDK — push notifications
// ================================================
const admin = require('firebase-admin');
const path  = require('path');

let _app;
function getApp() {
  if (_app) return _app;
  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      // Railway/cloud: full JSON pasted as a single env var
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } else {
      const credPath = path.resolve(__dirname, '..', process.env.FIREBASE_CREDENTIAL_PATH || './firebase-adminsdk.json');
      credential = admin.credential.cert(require(credPath));
    }
    _app = admin.initializeApp({ credential });
  } catch (err) {
    console.warn('[FCM] Firebase not configured:', err.message);
    return null;
  }
  return _app;
}

/**
 * Send a push notification to a single FCM token.
 * Silently ignores missing tokens.
 * @param {string} token  - FCM registration token
 * @param {string} title
 * @param {string} body
 * @param {object} data   - optional key-value payload
 */
async function sendPush(token, title, body, data = {}) {
  if (!token) return;
  const app = getApp();
  if (!app) return;
  try {
    const msg = {
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      webpush: {
        notification: { icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' },
        fcm_options:  { link: process.env.FRONTEND_URL || 'http://localhost:5001' },
      },
    };
    await app.messaging().send(msg);
  } catch (err) {
    // Don't crash the caller if push fails
    console.error('[FCM]', err.message);
  }
}

module.exports = { sendPush };
