importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCSn_E5myNF4uo0O1LJDKj5FHRJiDt0fAc",
  authDomain: "jemput-93fd0.firebaseapp.com",
  projectId: "jemput-93fd0",
  storageBucket: "jemput-93fd0.appspot.com",
  messagingSenderId: "229069926763",
  appId: "1:229069926763:web:36ed7a66c6a3e8d561dc2e",
});

const messaging = firebase.messaging();

// Ini yang jalan kalau ada notifikasi masuk sementara app tertutup/background
messaging.onBackgroundMessage((payload) => {
  const judul = (payload.notification && payload.notification.title) || "Jemput";
  const isi = (payload.notification && payload.notification.body) || "";
  self.registration.showNotification(judul, { body: isi });
});
