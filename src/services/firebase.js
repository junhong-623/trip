// firebase.js — plug in your existing Firebase config here
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ⚠️ Replace with your existing Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyB4dmyFM5Yngbw7sq8XmiAnTRjfeVu2-LM",
  authDomain: "trip-fafb1.firebaseapp.com",
  projectId: "trip-fafb1",
  storageBucket: "trip-fafb1.appspot.com",
  messagingSenderId: "922094377501",
  appId: "1:922094377501:web:a771ce51171431af8184f4",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
