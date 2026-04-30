import { db, storage } from "./firebase.js"
import {
  collection,
  addDoc
} from "firebase/firestore"

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage"
import { auth } from "./firebase.js"

auth.onAuthStateChanged((user) => {

  if (!user) {
    window.location.href = "login.html"
  }

  if (user.email !== "admin@gmail.com") {
    alert("Access denied 🚫")
    window.location.href = "home.html"
  }

})
const form = document.getElementById("uploadForm")

form.addEventListener("submit", async (e) => {
  e.preventDefault()

  const name = document.getElementById("name").value
  const type = document.getElementById("type").value
  const series = document.getElementById("series").value
  const imageFile = document.getElementById("image").files[0]
  const modelFile = document.getElementById("model").files[0]

  // Upload Image
  const imageRef = ref(storage, `vehicles/${imageFile.name}`)
  await uploadBytes(imageRef, imageFile)
  const imageURL = await getDownloadURL(imageRef)

  // Upload Model
  const modelRef = ref(storage, `models/${modelFile.name}`)
  await uploadBytes(modelRef, modelFile)
  const modelURL = await getDownloadURL(modelRef)

  // Save in Firestore
  await addDoc(collection(db, "vehicles"), {
    name,
    type,
    series,
    imageURL,
    modelURL
  })

  alert("Vehicle uploaded successfully 🚀")
})