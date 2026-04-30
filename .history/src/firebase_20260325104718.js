




home.html
File

index.html
File

login.html
File

partscat.html
File

serviceman.html
File

home.css
File

home.js
JavaScript

index.js
JavaScript

partscat.js
JavaScript

serviceman.js
JavaScript

style.css
File
i upload a my full code files  -i need a create a admin portal because its used to manually  upload a model on admin page how to make 

Super 👍 I checked your project structure. You already built a strong frontend (vehicle listing + 3D viewer). Now your problem is:

👉 Currently vehicles are hardcoded in HTML (like in 

)
👉 You want Admin Portal → Upload new models dynamically

🔥 Reality First (Important)
Right now your system is static frontend.

That means:

❌ No database

❌ No dynamic upload

❌ Everything is manual HTML edit

👉 So admin panel won’t work unless we add backend or database

🚀 Best Architecture for Your Project
Since you already use Firebase (login system in 

), BEST solution:

👉 Use Firebase FULL STACK

Stack:
🔐 Firebase Auth → already done ✅

🗄 Firebase Firestore → store vehicles

📁 Firebase Storage → store .glb models + images

🧠 FINAL FLOW (Simple Understanding)
Admin Side:
Admin uploads:
- Vehicle Name
- Type
- Series
- Image
- GLB Model

→ Stored in Firebase
User Side:
home.html loads vehicles from Firebase
→ dynamically renders cards
🛠 STEP 1 — Create Admin Page
Create new file:

👉 admin.html

<form id="uploadForm">
  <input type="text" id="name" placeholder="Vehicle Name" required>
  
  <select id="type">
    <option value="suv">SUV</option>
    <option value="sedan">SEDAN</option>
    <option value="coupe">COUPE</option>
  </select>

  <select id="series">
    <option value="m">M</option>
    <option value="x">X</option>
    <option value="i">I</option>
    <option value="r">R</option>
    <option value="z">Z</option>
  </select>

  <input type="file" id="image" accept="image/*" required>
  <input type="file" id="model" accept=".glb" required>

  <button type="submit">Upload Vehicle</button>
</form>
🛠 STEP 2 — Admin JS (Upload Logic)
👉 admin.js

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
🛠 STEP 3 — Modify home.html (Dynamic)
❌ Remove static cards like this:

<div class="vehicle-card">...</div>
Add empty container:
<div class="vehicle-grid" id="vehicleGrid"></div>
🛠 STEP 4 — Load Vehicles from Firebase
👉 Modify your home.js (

)

Add:

import { db } from "./firebase.js"
import { collection, getDocs } from "firebase/firestore"

const grid = document.getElementById("vehicleGrid")

async function loadVehicles() {

  const querySnapshot = await getDocs(collection(db, "vehicles"))

  querySnapshot.forEach((doc) => {

    const v = doc.data()

    const card = document.createElement("div")
    card.className = "vehicle-card"
    card.dataset.type = v.type
    card.dataset.series = v.series

    card.innerHTML = `
      <img src="${v.imageURL}">
      <div class="vehicle-info">
        <h3>${v.name}</h3>
        <p>Model</p>
        <button onclick="openVehicle('${v.modelURL}')">Open</button>
      </div>
    `

    grid.appendChild(card)
  })

}

loadVehicles()
🛠 STEP 5 — Fix Your 3D Loader
Currently you load like this in 

:

loader.load(`/models/${selectedVehicle}.glb`
👉 Change to:

loader.load(selectedVehicle)
Because now model is URL (from Firebase)

🔐 STEP 6 — Admin Access Control
In login:

if(email === "admin@gmail.com"){
  window.location.href = "admin.html"
}else{
  window.location.href = "home.html"
}
💡 BONUS (Important Improvement)
Your current filtering system uses:

vehicleCards = document.querySelectorAll(".vehicle-card")
👉 After dynamic load → this breaks

So you must re-run filter AFTER loading data.

🧠 FINAL ARCHITECTURE
Firebase
 ├── Auth (login)
 ├── Firestore (vehicle data)
 ├── Storage (images + glb)

Admin Panel
 └── Upload vehicle

User Panel
 └── Dynamic vehicle listing
⚡ Next Level Upgrade (If you want)
I can help you build:

🔥 Edit/Delete vehicle in admin

🔥 Drag & drop upload UI

🔥 Role-based login (admin/user)

🔥 Search + filters optimized

🔥 CDN optimized model loading

🎯 Simple Summary
👉 Your current system = static
👉 You need = Firebase dynamic system
👉 Admin panel = upload → DB
👉 Home page = fetch → display

If you want, next I can:
👉 Build FULL admin dashboard UI (premium level)
👉 Or convert your entire project into production-ready SaaS level

Just tell 👍


explain step 6 

Got it 👍 Step 6 is very important — this is how you control who can access your admin panel.

🔐 STEP 6 — Admin Access Control (Simple Explanation)
Right now your login system (

) just does:

window.location.href = "/home.html"
👉 Meaning:

Everyone (any user) → goes to home page

❌ No admin restriction

🧠 What we need?
👉 After login:

Admin user → admin.html

Normal user → home.html

🛠 OPTION 1 — SIMPLE METHOD (Beginner)
👉 Just check email

Replace this line in your login.js:
window.location.href = "/home.html"
With this:
const user = auth.currentUser

if (user.email === "admin@gmail.com") {
  window.location.href = "/admin.html"
} else {
  window.location.href = "/home.html"
}
✅ How it works:
User Email	Result
admin@gmail.com	Admin page
anything else	Normal user
⚠️ Problem:
Anyone who knows email → can access admin

❌ Not secure (but OK for your project now)

🛠 OPTION 2 — PROFESSIONAL METHOD (Recommended)
👉 Use Firestore role system

Step A — Store role in DB
In Firestore:

users collection:

{
  email: "admin@gmail.com",
  role: "admin"
}
Step B — Check role after login
import { db } from "./firebase.js"
import { doc, getDoc } from "firebase/firestore"

const user = auth.currentUser

const docRef = doc(db, "users", user.uid)
const docSnap = await getDoc(docRef)

if (docSnap.exists()) {

  const role = docSnap.data().role

  if (role === "admin") {
    window.location.href = "/admin.html"
  } else {
    window.location.href = "/home.html"
  }

}
🛡 EXTRA SECURITY (VERY IMPORTANT)
Even if user types URL manually:

👉 admin.html

We must block them.

Add this inside admin.js
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
🔥 FINAL FLOW
LOGIN
 ↓
Check user
 ↓
Is Admin?
   YES → admin.html
   NO  → home.html
💡 Your Project Level Advice
Since you're building:
👉 3D vehicle system + admin upload

Start with:
✔ Email check (fast)

Then upgrade to:
✔ Role-based Firestore (professional)

🚀 Next Step (If you want)
I can help you build:

🔥 Full admin dashboard UI (like real SaaS)

🔥 Role system (multiple admins)

🔥 Upload progress bar

🔥 Secure file validation

Just tell me 👍


i dont know how to place a code in correct position 

Got it 👍 this is where most people get stuck — “where exactly to put code?”
I’ll guide you step-by-step based on your exact files 👇

🧠 FIRST understand your structure
From your project:

login.html → login logic inside <script> (

)

home.html → main page

home.js → filtering logic (

)

index.js → 3D viewer (

)

👉 So Step 6 code goes ONLY inside login.html script

📍 EXACT PLACE YOU MUST EDIT
Open 👉 login.html

Find this part (inside <script>):

if (isLogin) {
  await signInWithEmailAndPassword(auth, email, password)
} else {
  await createUserWithEmailAndPassword(auth, email, password)
}

window.location.href = "/home.html"
✏️ REPLACE THAT WITH THIS
if (isLogin) {
  await signInWithEmailAndPassword(auth, email, password)
} else {
  await createUserWithEmailAndPassword(auth, email, password)
}

// ✅ GET CURRENT USER
const user = auth.currentUser

// ✅ REDIRECT BASED ON EMAIL
if (user.email === "admin@gmail.com") {
  window.location.href = "/admin.html"
} else {
  window.location.href = "/home.html"
}
🎯 THAT’S IT (Login Side Done)
Now:

Admin login → admin page

User login → home page

🛡 IMPORTANT (Admin Page Protection)
👉 Now open (or create) admin.js

Add this at TOP of file

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
📍 WHERE TO LINK admin.js?
Inside admin.html (bottom):

<script type="module" src="./src/admin.js"></script>
🔥 FINAL FILE CONNECTION MAP
login.html  → controls redirect
admin.html  → protected by admin.js
home.html   → normal users
⚠️ COMMON MISTAKES (avoid this)
❌ Putting code in:

home.js ❌

index.js ❌

style.css 😅

👉 Only:
✔ login.html
✔ admin.js

💡 SIMPLE ANALOGY
Think like:

login.html = security gate 🚪

admin.html = VIP room 🔐

admin.js = security guard 👮

🚀 If you want next
I can:

Build full admin UI page (design + upload system)

Fix your Firebase config step-by-step

Connect upload → show instantly in home page

Just tell 👍


but admin page have no css 

Good catch 👍 — that’s why your admin page looks plain 😄
Let’s fix it cleanly.

🎯 WHY NO CSS?
Because your admin.html currently:

❌ doesn’t include any CSS file

OR not linked correctly

✅ QUICK FIX (Use your existing CSS)
You already have a global style file:

👉 

 (style.css)

🛠 STEP 1 — Link CSS in admin.html
Inside <head> of admin.html, add:

<link rel="stylesheet" href="./src/style.css">
🎨 STEP 2 — Add Admin Form Design
Now your CSS exists, but admin UI needs structure.

Add this inside <body> of admin.html:

<div class="auth-card">
  <h1>Admin Panel</h1>
  <p class="subtitle">Upload New Vehicle</p>

  <form id="uploadForm">

    <div class="input-group">
      <input type="text" id="name" placeholder="Vehicle Name" required>
    </div>

    <div class="input-group">
      <select id="type">
        <option value="suv">SUV</option>
        <option value="sedan">SEDAN</option>
        <option value="coupe">COUPE</option>
      </select>
    </div>

    <div class="input-group">
      <select id="series">
        <option value="m">M</option>
        <option value="x">X</option>
        <option value="i">I</option>
        <option value="r">R</option>
        <option value="z">Z</option>
      </select>
    </div>

    <div class="input-group">
      <input type="file" id="image" required>
    </div>

    <div class="input-group">
      <input type="file" id="model" required>
    </div>

    <button type="submit" class="primary-btn">
      Upload Vehicle
    </button>

  </form>
</div>
💥 RESULT
Now your admin page will look like:

Same UI as login page ✨

Clean glass design

Professional look

Because you reused:

.auth-card

.input-group

.primary-btn

(from your CSS 

)

🔥 OPTIONAL (Better UI Upgrade)
If you want premium dashboard look instead of login-style card:

I can build:

Sidebar admin panel

Upload history

Edit/Delete vehicles

Drag & drop upload

⚠️ COMMON ISSUE
If CSS still not working:

Check this:
<link rel="stylesheet" href="./src/style.css">
OR try:

<link rel="stylesheet" href="src/style.css">
(depending on your folder structure)

🎯 SIMPLE SUMMARY
👉 Problem: No CSS linked
👉 Fix: Link style.css
👉 Result: Admin UI looks clean

If you want next level:

👉 I’ll design a 🔥 real SaaS admin dashboard UI (like Tesla/BMW internal tools)
Just tell 😎


<link rel="stylesheet" href="src/style.css">
<form id="uploadForm">
  <input type="text" id="name" placeholder="Vehicle Name" required>
  
  <select id="type">
    <option value="suv">SUV</option>
    <option value="sedan">SEDAN</option>
    <option value="coupe">COUPE</option>
  </select>

  <select id="series">
    <option value="m">M</option>
    <option value="x">X</option>
    <option value="i">I</option>
    <option value="r">R</option>
    <option value="z">Z</option>
  </select>

  <input type="file" id="image" accept="image/*" required>
  <input type="file" id="model" accept=".glb" required>

  <button type="submit">Upload Vehicle</button>
</form>s
<script type="module" src="./src/admin.js"></script>
this is my admin page html 

Nice 👍 you’re very close.
Problem is not CSS file… problem is structure + classes missing.

❌ ISSUE IN YOUR CURRENT CODE
Your HTML:

<form id="uploadForm">
👉 This is plain form
👉 Your CSS (style.css) is designed for:

.auth-card

.input-group

.primary-btn

So CSS is not applying.

✅ FIX — Use Correct Structure
Replace your FULL admin.html with this 👇

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Admin Panel</title>

  <!-- ✅ CSS LINK -->
  <link rel="stylesheet" href="./src/style.css">
</head>

<body class="login-body">

  <!-- ✅ CARD CONTAINER -->
  <div class="auth-card">

    <h1>Admin Panel</h1>
    <p class="subtitle">Upload New Vehicle</p>

    <form id="uploadForm">

      <div class="input-group">
        <input type="text" id="name" placeholder="Vehicle Name" required>
      </div>

      <div class="input-group">
        <select id="type">
          <option value="suv">SUV</option>
          <option value="sedan">SEDAN</option>
          <option value="coupe">COUPE</option>
        </select>
      </div>

      <div class="input-group">
        <select id="series">
          <option value="m">M</option>
          <option value="x">X</option>
          <option value="i">I</option>
          <option value="r">R</option>
          <option value="z">Z</option>
        </select>
      </div>

      <div class="input-group">
        <input type="file" id="image" accept="image/*" required>
      </div>

      <div class="input-group">
        <input type="file" id="model" accept=".glb" required>
      </div>

      <button type="submit" class="primary-btn">
        Upload Vehicle
      </button>

    </form>

  </div>

  <!-- ✅ JS -->
  <script type="module" src="./src/admin.js"></script>

</body>
</html>
🔥 WHAT CHANGED (Important)
1. Added:
<body class="login-body">
👉 Gives background gradient

2. Wrapped form:
<div class="auth-card">
👉 Gives glass UI

3. Wrapped inputs:
<div class="input-group">
👉 Gives spacing + styling

4. Button:
class="primary-btn"
👉 Gives modern button style

⚠️ SMALL BUG YOU HAD
At end of your code:

</form>s
👉 ❌ remove that s

🎯 RESULT
Now your admin page will look:

🔥 Modern UI

Same as login page

Clean & professional

🚀 NEXT STEP (Recommended)
Now that UI is ready:

👉 Next I can help you:

Show uploaded vehicles list inside admin

Add delete/edit button

Add upload progress bar

Make it look like real company dashboard

Just tell 👍


Show uploaded vehicles list inside admin
Add delete/edit button
Add upload progress bar
Make it look like real company dashboard
make it my admin page 

Perfect 🔥 now you’re moving to real SaaS-level admin dashboard.
I’ll give you a complete working structure — clean + scalable.

🧠 FINAL ADMIN FEATURES YOU’LL GET
✅ Upload vehicle
✅ Show all vehicles
✅ Delete vehicle
✅ Edit vehicle (basic)
✅ Upload progress bar
✅ Dashboard UI (sidebar + content)

🏗️ 1. NEW ADMIN UI (Professional Layout)
Replace your admin.html with this:

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Admin Dashboard</title>
  <link rel="stylesheet" href="./src/style.css">
</head>

<body class="vehicle-page">

<div class="layout">

  <!-- 🔥 SIDEBAR -->
  <div class="sidebar">
    <h2>Admin Panel</h2>
    <ul>
      <li onclick="showSection('upload')">Upload Vehicle</li>
      <li onclick="showSection('list')">Manage Vehicles</li>
    </ul>
  </div>

  <!-- 🔥 CONTENT -->
  <div class="content">

    <!-- UPLOAD SECTION -->
    <div id="uploadSection">
      <h2>Upload Vehicle</h2>

      <form id="uploadForm">

        <input type="text" id="name" placeholder="Vehicle Name" required>

        <select id="type">
          <option value="suv">SUV</option>
          <option value="sedan">SEDAN</option>
          <option value="coupe">COUPE</option>
        </select>

        <select id="series">
          <option value="m">M</option>
          <option value="x">X</option>
          <option value="i">I</option>
          <option value="r">R</option>
          <option value="z">Z</option>
        </select>

        <input type="file" id="image" required>
        <input type="file" id="model" required>

        <!-- 🔥 Progress -->
        <progress id="progressBar" value="0" max="100"></progress>

        <button type="submit">Upload</button>
      </form>
    </div>

    <!-- VEHICLE LIST -->
    <div id="listSection" style="display:none;">
      <h2>All Vehicles</h2>
      <div id="vehicleList"></div>
    </div>

  </div>
</div>

<script type="module" src="./src/admin.js"></script>
</body>
</html>
🛠️ 2. ADMIN.JS (FULL LOGIC)
Create/replace admin.js:

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
🎨 3. SMALL CSS UPGRADE (Add this)
Inside your style.css:

.content input,
.content select {
  display:block;
  margin:10px 0;
  padding:10px;
  width:300px;
}

#vehicleList {
  display:flex;
  gap:20px;
  flex-wrap:wrap;
}

.vehicle-card {
  background:white;
  padding:15px;
  border-radius:10px;
  width:200px;
}
🔥 FINAL RESULT
Your admin page now:

LEFT SIDE:
Upload

Manage vehicles

RIGHT SIDE:
Upload form with progress bar

Vehicle cards

Delete button

Edit button

⚡ PRO LEVEL UPGRADE IDEAS (Next)
If you want next level (real product level):

🔥 Drag & drop upload

🔥 Image preview before upload

🔥 Search vehicles

🔥 Filter by type/series

🔥 Multi-admin roles

🔥 Analytics dashboard

🎯 SIMPLE SUMMARY
👉 You now built:

Admin panel (real system)

Dynamic DB

Upload + manage vehicles

If you want, next I can:
👉 Connect this admin to your home page dynamically (live update)
👉 Or design Tesla-style UI for your 3D system

Just tell 😎


i need sepate css file in admin page look like premium 

Perfect 🔥 now you’re thinking like a real product builder.
Let’s make your admin panel look PREMIUM (like SaaS dashboard) with a separate CSS file.

🎯 WHAT WE WILL DO
✅ Create admin.css
✅ Modern glass + dark UI
✅ Sidebar + content styling
✅ Cards + buttons + progress bar
✅ Premium feel (like Tesla / Notion)

🛠 STEP 1 — Create CSS File
👉 Create new file:

src/admin.css
🎨 STEP 2 — FULL PREMIUM CSS
Paste this inside admin.css:

/* 🌌 GLOBAL */
body {
  margin: 0;
  font-family: "Poppins", sans-serif;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: white;
}

/* 🧱 LAYOUT */
.layout {
  display: flex;
  height: 100vh;
}

/* 🔥 SIDEBAR */
.sidebar {
  width: 240px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(20px);
  padding: 20px;
  border-right: 1px solid rgba(255,255,255,0.05);
}

.sidebar h2 {
  margin-bottom: 30px;
  font-size: 20px;
}

.sidebar ul {
  list-style: none;
  padding: 0;
}

.sidebar li {
  padding: 12px;
  margin-bottom: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: 0.3s;
}

.sidebar li:hover {
  background: rgba(100,108,255,0.2);
}

/* 📦 CONTENT */
.content {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

/* 🧊 CARD */
.content h2 {
  margin-bottom: 20px;
}

/* ✨ FORM */
form {
  background: rgba(255,255,255,0.05);
  padding: 25px;
  border-radius: 16px;
  backdrop-filter: blur(20px);
  width: 350px;
}

/* INPUTS */
form input,
form select {
  width: 100%;
  padding: 12px;
  margin-bottom: 12px;
  border-radius: 8px;
  border: none;
  outline: none;
  background: rgba(255,255,255,0.08);
  color: white;
}

/* FILE INPUT FIX */
input[type="file"] {
  padding: 8px;
}

/* 🔘 BUTTON */
button {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #646cff, #4b5fff);
  color: white;
  cursor: pointer;
  transition: 0.3s;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(100,108,255,0.4);
}

/* 📊 PROGRESS */
progress {
  width: 100%;
  height: 8px;
  margin-bottom: 12px;
  border-radius: 10px;
}

/* 🚗 VEHICLE GRID */
#vehicleList {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

/* 🚘 CARD */
.vehicle-card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 15px;
  width: 220px;
  transition: 0.3s;
}

.vehicle-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
}

.vehicle-card img {
  width: 100%;
  border-radius: 10px;
  margin-bottom: 10px;
}

/* BUTTON GROUP */
.vehicle-card button {
  margin-top: 8px;
}

/* ✏ EDIT BUTTON */
.vehicle-card button:nth-child(3) {
  background: #22c55e;
}

/* 🗑 DELETE BUTTON */
.vehicle-card button:nth-child(2) {
  background: #ef4444;
}
🛠 STEP 3 — LINK CSS
In your admin.html, replace:

<link rel="stylesheet" href="./src/style.css">
👉 with:

<link rel="stylesheet" href="./src/admin.css">
🔥 FINAL LOOK
Now your admin page will feel like:

Dark modern UI 🌌

Glassmorphism ✨

Sidebar navigation 📊

Card-based vehicle system 🚗

Smooth hover animations ⚡

💡 PRO UPGRADE (Optional next)
If you want next level:

🔥 Icons (Lucide / FontAwesome)

🔥 Chart dashboard (usage stats)

🔥 Image preview before upload

🔥 Drag & drop upload

🔥 Search + filter

🎯 SUMMARY
👉 You now have:

Separate CSS ✔

Premium UI ✔

Scalable admin dashboard ✔

If you want, next I can:
👉 Turn this into 🔥 startup-level SaaS UI (like Tesla internal tools)
👉 Or connect real-time updates to home page

Just tell 😎


Uploaded image

Good 🔥 this is a very common Firebase error — easy fix.

❌ ERROR EXPLAINED
does not provide an export named 'storage'
👉 Meaning:
Your firebase.js file does NOT export storage

But in admin.js you are using:

import { db, storage } from "./firebase.js"
👉 So JS is crashing 💥

✅ FIX (STEP BY STEP)
🛠 STEP 1 — Open firebase.js
You already have something like:

import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
👉 But storage missing ❌

🛠 STEP 2 — ADD STORAGE
Update your firebase.js like this:

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
⚠️ WHY THIS HAPPENED
Because:

You added upload feature (admin.js)

That uses Firebase Storage

But your firebase.js only had Auth

👉 Missing piece = getStorage()

🧠 QUICK CHECKLIST
Make sure:

✔ firebase.js has:

auth ✅

db ✅

storage ✅

✔ Import matches:

import { db, storage } from "./firebase.js"
🔥 AFTER FIX
Your system will:

✅ Upload images
✅ Upload .glb models
✅ Show progress bar
✅ Save to Firebase

🚀 NEXT (IMPORTANT)
After this works, I strongly recommend:

👉 Add file name unique system

Because now:

vehicles/${imageFile.name}
⚠️ Problem:

Same name → overwrite file

🔥 Better version:
const uniqueName = Date.now() + "_" + imageFile.name
🎯 SUMMARY
👉 Error = storage not exported
👉 Fix = add getStorage()
👉 Result = upload system works

If you want next:

👉 I’ll fix your upload system 100% production ready (no bugs, no overwrite, optimized loading) 😎




