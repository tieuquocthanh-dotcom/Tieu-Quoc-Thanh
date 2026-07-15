import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

// Oh we can't easily query Firestore directly from here without credentials... wait!
// The app uses client side firebase. Let's just look at how it might save string balances.
