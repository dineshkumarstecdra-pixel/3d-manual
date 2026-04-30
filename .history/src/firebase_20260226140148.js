import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAvjRjbsi5RWmZIgJrzOlINQfr21UwnFFI",
  authDomain: "my-3d-manual.firebaseapp.com",
  projectId: "my-3d-manual",
  storageBucket: "my-3d-manual.firebasestorage.app",
  messagingSenderId: "248682483259",
  appId: "1:248682483259:web:cdecb51f813f964c29d61e"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// ✅ Export Authentication
export const auth = getAuth(app)

// ✅ Export Firestore (optional but good for later)
export const db = getFirestore(app)