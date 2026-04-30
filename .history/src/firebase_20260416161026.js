import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage" // ✅ ADD THIS

const firebaseConfig = {
 apiKey: "AIzaSyAvjRjbsi5RWmZIgJrzOlINQfr21UwnFFI",
  authDomain: "my-3d-manual.firebaseapp.com",
  projectId: "my-3d-manual",
  storageBucket: "my-3d-manual.firebasestorage.app",
  messagingSenderId: "248682483259",
  appId: "1:248682483259:web:cdecb51f813f964c29d61e",
  measurementId: "G-KMMHL7ECBS"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

// Export both
export { auth, signOut }