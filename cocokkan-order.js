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
