const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} = require("firebase/firestore");
const admin = require("firebase-admin");

const firebaseConfig = {
  apiKey: "AIzaSyCSn_E5myNF4uo0O1LJDKj5FHRJiDt0fAc",
  authDomain: "jemput-93fd0.firebaseapp.com",
  projectId: "jemput-93fd0",
  storageBucket: "jemput-93fd0.appspot.com",
  messagingSenderId: "229069926763",
  appId: "1:229069926763:web:36ed7a66c6a3e8d561dc2e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Setup terpisah untuk pengirim notifikasi (pakai Service Account, akses lebih tinggi)
// Disimpan dalam bentuk base64 di GitHub Secrets supaya tidak rusak saat disalin manual
const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf-8");
const serviceAccount = JSON.parse(serviceAccountJson);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Rumus Haversine: hitung jarak (km) antara dua titik koordinat GPS
function hitungJarakKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Cari driver online terdekat dari titik jemput order,
// tapi lewati driver yang sudah kepasang ke order lain di run ini
function cariDriverTerdekat(order, driverDocs, sudahDipakai) {
  let driverTerpilih = null;
  let jarakTerpendek = Infinity;
  let cadangan = null;

  for (const driverDoc of driverDocs) {
    if (sudahDipakai.has(driverDoc.id)) continue;
    const driver = driverDoc.data();

    if (!cadangan) cadangan = driverDoc;

    const punyaKoordinat =
      order.pickupLat != null &&
      order.pickupLng != null &&
      driver.lat != null &&
      driver.lng != null;

    if (punyaKoordinat) {
      const jarak = hitungJarakKm(order.pickupLat, order.pickupLng, driver.lat, driver.lng);
      if (jarak < jarakTerpendek) {
        jarakTerpendek = jarak;
        driverTerpilih = driverDoc;
      }
    }
  }

  return driverTerpilih || cadangan;
}

// Kirim notifikasi push ke HP driver (kalau dia sudah aktifkan notifikasi)
async function kirimNotifikasiDriver(driverData, order) {
  if (!driverData.fcmToken) {
    console.log("Driver belum aktifkan notifikasi, dilewati.");
    return;
  }
  try {
    await admin.messaging().send({
      token: driverData.fcmToken,
      notification: {
        title: "Pesanan baru masuk!",
        body: `Jemput: ${order.pickup} -> ${order.destination}`,
      },
    });
    console.log("Notifikasi terkirim ke driver.");
  } catch (err) {
    console.log("Gagal kirim notifikasi: " + err.message);
  }
}

async function cocokkanOrder() {
  const orderQuery = query(collection(db, "orders"), where("status", "==", "searching"));
  const orderSnapshot = await getDocs(orderQuery);
  if (orderSnapshot.empty) {
    console.log("Tidak ada order yang perlu dicocokkan.");
    return;
  }

  const driverQuery = query(collection(db, "drivers"), where("isOnline", "==", true));
  const driverSnapshot = await getDocs(driverQuery);
  if (driverSnapshot.empty) {
    console.log("Tidak ada driver online saat ini.");
    return;
  }

  const sudahDipakai = new Set();

  for (const orderDoc of orderSnapshot.docs) {
    const order = orderDoc.data();
    const driverTerpilih = cariDriverTerdekat(order, driverSnapshot.docs, sudahDipakai);

    if (!driverTerpilih) {
      console.log(`Order ${orderDoc.id}: tidak ada driver tersedia lagi.`);
      continue;
    }

    await updateDoc(doc(db, "orders", orderDoc.id), {
      status: "matched",
      driverId: driverTerpilih.id,
    });
    await updateDoc(doc(db, "drivers", driverTerpilih.id), {
      isOnline: false,
    });

    sudahDipakai.add(driverTerpilih.id);
    console.log(`Order ${orderDoc.id} dicocokkan dengan driver ${driverTerpilih.id} (terdekat).`);

    await kirimNotifikasiDriver(driverTerpilih.data(), order);
  }
}

async function main() {
  await signInWithEmailAndPassword(auth, process.env.SYSTEM_EMAIL, process.env.SYSTEM_PASSWORD);
  await cocokkanOrder();
  process.exit(0);
}

main().catch((err) => {
  console.error("Terjadi error:", err.message);
  process.exit(1);
});
