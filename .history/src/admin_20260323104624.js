import { db, storage } from "./firebase.js"
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore"

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage"

const form = document.getElementById("uploadForm")
const progressBar = document.getElementById("progressBar")
const listContainer = document.getElementById("vehicleList")

// 🔁 SWITCH SECTIONS
window.showSection = (section) => {
  document.getElementById("uploadSection").style.display =
    section === "upload" ? "block" : "none"

  document.getElementById("listSection").style.display =
    section === "list" ? "block" : "none"

  if (section === "list") loadVehicles()
}

// 🚀 UPLOAD VEHICLE
form.addEventListener("submit", async (e) => {
  e.preventDefault()

  const name = nameInput.value
  const type = typeInput.value
  const series = seriesInput.value
  const imageFile = image.files[0]
  const modelFile = model.files[0]

  // Upload image with progress
  const imageRef = ref(storage, `vehicles/${imageFile.name}`)
  const uploadTask = uploadBytesResumable(imageRef, imageFile)

  uploadTask.on("state_changed", (snapshot) => {
    const progress =
      (snapshot.bytesTransferred / snapshot.totalBytes) * 100
    progressBar.value = progress
  })

  await uploadTask
  const imageURL = await getDownloadURL(imageRef)

  // Upload model
  const modelRef = ref(storage, `models/${modelFile.name}`)
  await uploadBytesResumable(modelRef, modelFile)
  const modelURL = await getDownloadURL(modelRef)

  // Save DB
  await addDoc(collection(db, "vehicles"), {
    name,
    type,
    series,
    imageURL,
    modelURL
  })

  alert("Uploaded 🚀")
  form.reset()
  progressBar.value = 0
})

// 📦 LOAD VEHICLES
async function loadVehicles() {
  listContainer.innerHTML = ""

  const snapshot = await getDocs(collection(db, "vehicles"))

  snapshot.forEach((docSnap) => {
    const v = docSnap.data()
    const id = docSnap.id

    const card = document.createElement("div")
    card.className = "vehicle-card"

    card.innerHTML = `
      <img src="${v.imageURL}" width="150">
      <h3>${v.name}</h3>

      <button onclick="deleteVehicle('${id}', '${v.imageURL}', '${v.modelURL}')">
        Delete
      </button>

      <button onclick="editVehicle('${id}', '${v.name}')">
        Edit
      </button>
    `

    listContainer.appendChild(card)
  })
}

// 🗑 DELETE
window.deleteVehicle = async (id, imageURL, modelURL) => {

  if (!confirm("Delete this vehicle?")) return

  await deleteDoc(doc(db, "vehicles", id))

  // delete storage
  await deleteObject(ref(storage, imageURL))
  await deleteObject(ref(storage, modelURL))

  loadVehicles()
}

// ✏ EDIT
window.editVehicle = async (id, oldName) => {

  const newName = prompt("Edit name:", oldName)
  if (!newName) return

  await updateDoc(doc(db, "vehicles", id), {
    name: newName
  })

  loadVehicles()
}