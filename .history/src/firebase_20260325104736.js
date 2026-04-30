import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage" // ✅ ADD THIS

const firebaseConfig = {
  // your config
}

const app = initializeApp(firebaseConfig)

// ✅ EXPORT EVERYTHING
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app) // ✅ IMPORTANT