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

  const driverDoc = driverSnapshot.docs[0];

  for (const orderDoc of orderSnapshot.docs) {
    await updateDoc(doc(db, "orders", orderDoc.id), {
      status: "matched",
      driverId: driverDoc.id,
    });
    await updateDoc(doc(db, "drivers", driverDoc.id), {
      isOnline: false,
    });
    console.log(`Order ${orderDoc.id} dicocokkan dengan driver ${driverDoc.id}`);
  }
}

async function main() {
  await signInWithEmailAndPassword(auth, process.env.SYSTEM_EMAIL, process.env.SYSTEM_PASSWORD);
  await cocokkanOrder();
}

main();
