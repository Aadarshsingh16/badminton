// lib/firebase.ts — Firebase App & Firestore Client Initialization
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAnXAkmeNYQvg-dJW-vleCLlLsdwzwNfsc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "badminton-8c769.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "badminton-8c769",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "badminton-8c769.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "553702423950",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:553702423950:web:339acd76852ef616f438df",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-NLB9XH27SQ",
};

export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey.trim() !== "" &&
    firebaseConfig.projectId.trim() !== ""
  );
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

if (typeof window !== "undefined") {
  if (isFirebaseConfigured()) {
    try {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      db = getFirestore(app);
    } catch (err) {
      console.warn("Firebase initialization error:", err);
    }
  }
} else {
  // Server-side initialization (Next.js SSR / API routes)
  if (isFirebaseConfigured()) {
    try {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      db = getFirestore(app);
    } catch (err) {
      console.warn("Firebase server initialization error:", err);
    }
  }
}

export { app, db, firebaseConfig };
