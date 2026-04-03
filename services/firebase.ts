import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA5SMwhA4h8NW4I5qVqqtqPOI139QJgg1w",
  authDomain: "projectkhohangtest.firebaseapp.com",
  projectId: "projectkhohangtest",
  storageBucket: "projectkhohangtest.firebasestorage.app",
  messagingSenderId: "988773842246",
  appId: "1:988773842246:web:086d4e67342668f7e23947",
  measurementId: "G-73T4GZ0KN0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const isFirebaseConfigured = true;
