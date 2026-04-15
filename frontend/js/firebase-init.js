// ================================================
// FuelGO — js/firebase-init.js
// Description: Firebase web SDK init + FCM push subscription
// ================================================
import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey:            "AIzaSyB_yxAxdek2vkhDphJ12BPtjbiT0i9Pkis",
  authDomain:        "fuelgo-d4761.firebaseapp.com",
  projectId:         "fuelgo-d4761",
  storageBucket:     "fuelgo-d4761.firebasestorage.app",
  messagingSenderId: "1089175866429",
  appId:             "1:1089175866429:web:e99bcbd35b4c13a0b0ae54",
  measurementId:     "G-CDKQJL0PWV",
};

const app       = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

/**
 * Request notification permission and register the FCM token with the backend.
 * Call this after the user is logged in.
 */
export async function initPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Register firebase-messaging-sw.js as the service worker
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: 'BJ8vDoZ3kxGJWaApqn4RhJr9OdXbEp0xPp-hIyMCNGaVMQ4bKjpPsQKqsKf9pL_t5wPeJgHfPEF_UZaYmGD-M9Y',
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      const { getToken: getAuthToken } = await import('./api.js');
      const authToken = getAuthToken();
      if (!authToken) return;
      await fetch('http://localhost:5001/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ token }),
      });
    }
  } catch (err) {
    console.warn('[FCM] Push setup failed:', err.message);
  }
}

// Handle foreground messages (app is open)
onMessage(messaging, payload => {
  const { title, body } = payload.notification || {};
  if (title && typeof notify === 'function') {
    notify('info', title, body || '');
  }
});
