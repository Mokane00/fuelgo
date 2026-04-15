// ================================================
// FuelGO — firebase-messaging-sw.js
// Description: Firebase Cloud Messaging service worker (background notifications)
// ================================================
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyB_yxAxdek2vkhDphJ12BPtjbiT0i9Pkis",
  authDomain:        "fuelgo-d4761.firebaseapp.com",
  projectId:         "fuelgo-d4761",
  storageBucket:     "fuelgo-d4761.firebasestorage.app",
  messagingSenderId: "1089175866429",
  appId:             "1:1089175866429:web:e99bcbd35b4c13a0b0ae54",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title = 'FuelGO', body = '' } = payload.notification || {};
  self.registration.showNotification(title, {
    body,
    icon:  '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data:  payload.data || {},
  });
});
