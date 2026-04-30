// Firebase CDN setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
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