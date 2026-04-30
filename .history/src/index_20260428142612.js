import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// Find your existing imports at the top of index.js and update them:
import { auth } from "./firebase.js"
import { signOut, onAuthStateChanged } from "firebase/auth" // Add onAuthStateChanged here

// Put this right below your imports:                                                                                 
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});


import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
/* ================= SYSTEM STRUCTURE ================= */



const selectedVehicle = localStorage.getItem("selectedVehicle")

if (!selectedVehicle) {
  alert("Vehicle missing")
  window.location.href = "home.html"
}



const floatingLabel = document.getElementById("floatingLabel")


function formatName(name) {
  return name
    .replaceAll("_", " ")
    .replace(/\d+/g, "")
    .trim() // 🔥 இதைச் சேர்ப்பது மிகவும் முக்கியம்
}
function getCategory(name){

  const n = name.toLowerCase()

  if(n.includes("wheel") || n.includes("rim") || n.includes("tire"))
    return "Wheel"

  if(n.includes("light") || n.includes("lamp"))
    return "Lighting"

  if(n.includes("glass"))
    return "Glass"

  if(n.includes("brake") || n.includes("caliper"))
    return "Braking System"

  if(n.includes("chassis"))
    return "Chassis"

  if(n.includes("door"))
    return "Body"

  if(n.includes("hood") || n.includes("bumper") || n.includes("body"))
    return "Body"

  if(n.includes("seat") || n.includes("interior"))
    return "Interior"

  return "Others"
}
function generatePartData(){

  const data = {}

  parts.forEach((p, i) => {

    data[p.name] = {
      sno: i + 1,
      displayName: p.name,
      category: getCategory(p.name),
      position: "General",
      qty: 1,
      description: `Component: ${p.name}`
    }

  })

  console.log("AUTO GENERATED ✅", data)

  return data
}
/* ================= PART DESCRIPTIONS ================= */

let partDescriptions = {}


 
const partMetadata = {
  "polymsh_detached29_SUB1_LIVREA_0": "Main housing structure.",
  "polymsh66_SUB1_LIVREA_0": "Front cover assembly.",
  "Part 2": "Internal support bracket.",
}



/* ================= CONSTANT ================= */

const SIDEBAR_WIDTH = 500

/* ================= SCENE ================= */

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xeeeeee)

/* ================= CAMERA ================= */

const camera = new THREE.PerspectiveCamera(
  75,
  (window.innerWidth - SIDEBAR_WIDTH) / window.innerHeight,
  0.1,
  2000
)

/* ================= RENDERER ================= */

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth - SIDEBAR_WIDTH, window.innerHeight)
renderer.domElement.style.position = "absolute"
renderer.domElement.style.left = SIDEBAR_WIDTH + "px"
renderer.domElement.style.top = "0"
document.body.appendChild(renderer.domElement)

/* ================= CONTROLS ================= */

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

/* ================= LIGHT ================= */

/* ================= LIGHT ================= */

const hdrLoader = new HDRLoader()

hdrLoader.load('/hdr/studio.hdr', function(texture){
  texture.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = texture
  // Optional: You can also set scene.background = texture if you want to see the studio
},function(xhr) {}, 
  function(error) {
    console.error("HDR Load Error ❌", error);
  }
)

// 1. Soft ambient light so shadows aren't pitch black
scene.add(new THREE.AmbientLight(0xffffff, 0.6))

// 2. Main directional light (acts like a key light)
const mainLight = new THREE.DirectionalLight(0xffffff, 2.5)
mainLight.position.set(10, 15, 10)
scene.add(mainLight)

// 3. Softer fill light from the opposite side to highlight details
const fillLight = new THREE.DirectionalLight(0xeeeeff, 1.2) 
fillLight.position.set(-10, 10, -10)
scene.add(fillLight)

// Renderer settings
renderer.outputEncoding = THREE.sRGBEncoding
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0 // Lowered from 1.2 to 1.0 to reduce blowout

/* ================= DATA ================= */

let model = null
let parts = []
let defaultCameraPosition = new THREE.Vector3()
let defaultControlsTarget = new THREE.Vector3()
let selectedPart = null
let selectedPartsGroup = []
let hiddenParts = []

let explodeProgress = 0
let explodeDirection = 0
let exploded = false

/* ================= LOAD MODEL ================= */


const loader = new GLTFLoader()
console.log("Selected Vehicle:", selectedVehicle)
loader.load(`/models/${selectedVehicle}.glb`, (gltf) => {

  model = gltf.scene
  scene.add(model)
   parts = []
  gltf.scene.traverse(obj => {
    if (obj.isMesh) {

      obj.material = obj.material.clone()

      parts.push(obj)

      obj.userData.original = obj.position.clone()
      obj.userData.target = obj.position.clone()

      if (obj.material.color) {
        obj.userData.originalColor = obj.material.color.clone()
      }
    }
    const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.style.display = "none", 500); // Wait for fade out
  }
  })
 // 1. மாடலை Frame செய்கிறோம்
  frameModel(model);

  // 2. 🔥 ஆட்டோமேட்டிக்காக Excel (.xlsx) ஃபைலை பின்னணியில் லோட் செய்கிறோம்
  // குறிப்பு: லோக்கல் டிரைவ் பெயர் (D:\) இல்லாமல், ரிலேட்டிவ் பாத் (Relative Path) கொடுக்க வேண்டும்!
  const excelFilePath = "./Parts Details/Parts data.xlsx";

  fetch(excelFilePath)
    .then(response => {
      if (!response.ok) throw new Error("Excel File not found at " + excelFilePath);
      return response.arrayBuffer(); // Excel ஃபைலை பைனரி டேட்டாவாகப் படிக்கிறோம்
    })
    .then(buffer => {
      // 3. SheetJS மூலம் Excel டேட்டாவைப் பிரித்தெடுத்தல்
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      partDescriptions = {};

      // 4. Excel டேட்டாவை உங்கள் 3D மாடலோடு இணைக்கிறோம்
    jsonData.forEach((row, index) => {
        // 🔥 Excel பெயரில் உள்ள ஸ்பேஸ்களையும் நீக்குகிறோம்
        const partKey = row["Part Name"] ? row["Part Name"].trim() : null;
        
        if (partKey) {
         partDescriptions[partKey] = {
             sno: row["Item No"] || row["ITEM NO"] || (index + 1),
             partId: row["Part ID"] || "-",   // 🔥 NEW
             displayName: partKey,
             category: row["System Category"] || "Others",
              qty: row["Quantity"] || 1        // optional if Excel has it
           };
        }
      });

      console.log("Excel Auto-Loaded Successfully! ✅", partDescriptions);

      // 5. டேட்டா கிடைத்தவுடன் Sidebar மற்றும் Table-ஐ உருவாக்குகிறோம்
      buildSystemTree();  
      createPartsTable(); 
    })
    .catch(error => {
      console.error("Excel ஃபைலைப் படிப்பதில் பிழை ❌:", error);
      alert("Excel டேட்டாவை லோட் செய்ய முடியவில்லை. ஃபைல் மற்றும் போல்டர் பெயர்களில் ஸ்பேஸ் சரியாக உள்ளதா என சரிபார்க்கவும்.");
   // ... existing code ...
    });
}, 
(xhr) => {
  // Safe onProgress function
  if (xhr.total > 0) {
    const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
    const loadingText = document.getElementById("loadingText");
    if (loadingText) {
      loadingText.innerText = `Loading Model: ${percentComplete}%`;
    }
  }
}, 
(error) => {
  console.error("Model Load Error ❌", error);
});
  // ✅ highlight after model loads
  const highlightPart = localStorage.getItem("highlightPart")

  if (highlightPart) {
    const part = parts.find(p => p.name === highlightPart)
    if (part) selectPart(part)
    localStorage.removeItem("highlightPart")
  }


/* ================= CENTER MODEL ================= */

function frameModel(model) {

  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  // 🔥 Center model
  model.position.sub(center)

  // 🔥 Auto scale to consistent size
  const maxDim = Math.max(size.x, size.y, size.z)
  const desiredSize = 30  // you can adjust this

  const scale = desiredSize / maxDim
  model.scale.setScalar(scale)

  // Recalculate bounding box after scaling
  const newBox = new THREE.Box3().setFromObject(model)
  const newSize = newBox.getSize(new THREE.Vector3())
  const newMaxDim = Math.max(newSize.x, newSize.y, newSize.z)

  // 🔥 Position camera dynamically
  const fov = camera.fov * (Math.PI / 180)
const cameraDistance = newMaxDim / (2 * Math.tan(fov / 2))

camera.position.set(0, newMaxDim * 0.4, cameraDistance * 1.3)

  controls.target.set(0, 0, 0)
  controls.update()
  // 🔥 NEW: Save the perfect starting angle for later!
  defaultCameraPosition.copy(camera.position)
  defaultControlsTarget.copy(controls.target)
}

/* ================= TABLE (MERGED PARTS) ================= */

function createPartsTable() {

  const container = document.getElementById("partsList")
  if (!container) return
  container.innerHTML = ""

  const table = document.createElement("table")

  table.innerHTML = `
    <thead>
      <tr>
        <th>ITEM NO</th>
        <th>PART NAME</th>
        <th>QTY</th>
      </tr>
    </thead>
    <tbody></tbody>
  `

  // 1. ஒரே பெயருடைய பாகங்களை ஒன்றிணைக்க ஒரு Object-ஐ உருவாக்குதல்
  const groupedParts = {}

  parts.forEach((p) => {
    // formatName மூலம் பெயரைச் சுத்தப்படுத்துகிறோம்
    const cleanName = formatName(p.name)

    // இந்தப் பெயர் ஏற்கனவே இல்லையென்றால், புதிதாகச் சேர்க்கவும்
    if (!groupedParts[cleanName]) {
      groupedParts[cleanName] = {
        qty: 0,
        partsArray: [] // அந்தப் பெயரில் உள்ள எல்லா 3D Object-களையும் சேமிக்க
      }
    }

    // QTY-ஐ 1 கூட்டுகிறோம், மற்றும் Object-ஐ Array-ல் சேர்க்கிறோம்
    groupedParts[cleanName].qty += 1
    groupedParts[cleanName].partsArray.push(p)
  })

  // 2. ஒன்றிணைக்கப்பட்ட டேட்டாவை வைத்து Table-ல் Rows உருவாக்குதல்
  let serialNo = 1
  
  for (const [name, data] of Object.entries(groupedParts)) {
    const row = document.createElement("tr")
    
    // UI-ல் தேடுவதற்காக (Search/Highlight) முதல் part-ன் பெயரை dataset-ல் வைக்கிறோம்
    row.dataset.name = data.partsArray[0].name 

    row.innerHTML = `
      <td>${serialNo}</td>
      <td>${name}</td>
      <td>${data.qty}</td>
    `

    // Row-ஐ கிளிக் செய்யும் போது, அந்த குரூப்பில் உள்ள முதல் Part-ஐ செலக்ட் செய்ய
    row.onclick = () => selectPart(data.partsArray)

    table.querySelector("tbody").appendChild(row)
    serialNo++
  }

  container.appendChild(table)
}

/* ================= SELECT & CLEAR (FIXED LABEL DISAPPEARING) ================= */

let labelTimeout = null; // 🔥 புதிதாக சேர்க்கப்பட்ட டைமர் வேரியபிள்

function selectPart(partOrArray) {

  clearSelection()

  // 1. இது ஒரு பார்ட்டா அல்லது பார்ட்களின் குழுவா (Group) என செக் செய்கிறோம்
  if (Array.isArray(partOrArray)) {
    selectedPartsGroup = partOrArray
    selectedPart = partOrArray[0] 
  } else {
    selectedPartsGroup = [partOrArray]
    selectedPart = partOrArray
  }

  // 2. குழுவில் உள்ள எல்லா பார்ட்களுக்கும் ஒரே நேரத்தில் Glow கொடுக்கிறோம்
  selectedPartsGroup.forEach(p => {
    if (p.material && p.material.emissive) {
      p.material.emissive.set(0x646cff)
      p.material.emissiveIntensity = 0.6
    }
  })

  // 3. UI மற்றும் Label அப்டேட்
 // 3. UI மற்றும் Label அப்டேட்
  // 🔥 THE FIX: 3D பெயரையும் Excel பெயரையும் சரியாக மேட்ச் செய்கிறோம்
  const cleanName = formatName(selectedPart.name);
  const data = partDescriptions[cleanName] || partDescriptions[selectedPart.name];

  if (data) {

  document.getElementById("partDescription").innerText =
  "Part Name: " + data.displayName +
  "\nItem No: " + data.sno +
  "\nPart ID: " + (data.partId || "-") +
  "\nCategory: " + data.category +
  "\nQuantity: " + selectedPartsGroup.length;

    floatingLabel.innerHTML = `
      <div style="font-size:14px; font-weight:600; margin-bottom:6px; white-space: normal; word-break: break-word;">
       ${formatName(data.displayName)}
      </div>
    <div style="opacity:0.8; font-size:12px; margin-bottom:6px;">
        ${data.category}
      </div>
      <div style="font-size:12px; background:#646cff; display:inline-block; padding:4px 10px; border-radius:8px; margin-bottom:8px;">
        Qty: ${selectedPartsGroup.length}
      </div>
      <div style="font-size:12px; margin-bottom:6px;">
        Part ID: ${data.partId}
        </div>
    `
  } else {
    document.getElementById("part").innerText = selectedPart.name
    document.getElementById("partDescription").innerText = "No description found for this part."
    floatingLabel.innerHTML = `<strong>${selectedPart.name}</strong>`
  }

  // 🔥 THE FIX: பழைய மறையும் டைமரை கேன்சல் செய்து லேபிளை நிரந்தரமாக காட்டுகிறோம்!
  clearTimeout(labelTimeout) 
  floatingLabel.style.display = "block"
  setTimeout(() => floatingLabel.classList.add("show"), 10)

  syncTableHighlight()
  updateHideButton()
}

function clearSelection() {
  // குழுவில் உள்ள எல்லா பார்ட்களின் Glow-ஐயும் அணைக்கிறோம்
  if (selectedPartsGroup && selectedPartsGroup.length > 0) {
    selectedPartsGroup.forEach(p => {
      if (p.material && p.material.emissive) p.material.emissive.set(0x000000)
    })
  } else if (selectedPart && selectedPart.material && selectedPart.material.emissive) {
    selectedPart.material.emissive.set(0x000000)
  }

  selectedPart = null
  selectedPartsGroup = []

  document.getElementById("partDescription").innerText = "Select a part to see details."
  document.querySelectorAll("#partsList tr").forEach(row => row.classList.remove("active"))

  if (floatingLabel) {
    floatingLabel.classList.remove("show")
    
    // 🔥 THE FIX: டைமரை செட் செய்வதற்கு முன் பழைய டைமரை அழிக்கிறோம்
    clearTimeout(labelTimeout)
    labelTimeout = setTimeout(() => {
      floatingLabel.style.display = "none"
    }, 200)
  }
}

/* ================= SYNC TABLE (FIXED FOR MERGED PARTS) ================= */

function syncTableHighlight() {

  // 1. நாம் 3D-யில் செலக்ட் செய்த Part-ன் பெயரை format செய்கிறோம் 
  // (உதாரணம்: "Struct_12" அல்லது "Struct_5" என்பதை "Struct" என்று மாற்றுவது)
  const selectedGroupName = selectedPart ? formatName(selectedPart.name) : null;

  document.querySelectorAll("#partsList tr").forEach(row => {

    // Header row-ஐத் தவிர்க்கிறோம்
    if (!row.dataset.name) return;

    // 2. டேபிளில் 2-வது கட்டத்தில் (Column) உள்ள பெயரை எடுக்கிறோம் ("Struct")
    const rowName = row.cells[1].innerText; 

    // 3. இரண்டும் ஒன்றாக இருந்தால் அந்த வரியை Highlight செய்கிறோம்!
    if (selectedGroupName && rowName === selectedGroupName) {

      row.classList.add("active");

      // அந்த வரிக்கு ஸ்க்ரோல் (Scroll) செய்வது
      row.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    } else {
      row.classList.remove("active");
    }
  });
}
/* ================= MOUSE TRACKING FOR LABEL ================= */
let currentMouseX = 0;
let currentMouseY = 0;

// மவுஸ் நகரும்போதெல்லாம் அதன் துல்லியமான இடத்தைப் பதிவு செய்கிறோம்
window.addEventListener("mousemove", (event) => {
  currentMouseX = event.clientX;
  currentMouseY = event.clientY;
});
/* ================= 3D CLICK & DOUBLE CLICK FIX ================= */
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

window.addEventListener("click", (event) => {

  contextMenu.style.display = "none"

  const sidebar = document.getElementById("ui")
  if (sidebar && sidebar.contains(event.target)) return

  mouse.x =
    ((event.clientX - SIDEBAR_WIDTH) /
      (window.innerWidth - SIDEBAR_WIDTH)) * 2 - 1

  mouse.y =
    -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

 // 🔥 PROFESSIONAL CAD FIX: Only allow the mouse to hit parts that are currently visible
  const visibleParts = parts.filter(p => p.visible === true)
  const intersects = raycaster.intersectObjects(visibleParts, true)

  

  if (intersects.length > 0) {

    selectPart(intersects[0].object)

  } else {

    clearSelection()

  }

})

/* ================= HIDE FUNCTION ================= */

const toggleBtn = document.getElementById("togglePart")

if (toggleBtn) {
  toggleBtn.onclick = () => {

    if (!selectedPart) return

    selectedPart.visible = !selectedPart.visible

    if (!selectedPart.visible) {
      if (!hiddenParts.includes(selectedPart.name))
        hiddenParts.push(selectedPart.name)
    } else {
      hiddenParts = hiddenParts.filter(n => n !== selectedPart.name)
    }

    updateHiddenUI()
    updateHideButton()
  }
}

function updateHideButton() {

  if (!selectedPart) return

  if (!toggleBtn) return   // 🔥 prevents error

  toggleBtn.innerText = selectedPart.visible
    ? "Hide Selected Part"
    : "Show Selected Part"

}

function updateHiddenUI() {

  document.getElementById("hiddenCount").innerText = hiddenParts.length

  document.querySelectorAll("#partsList tr").forEach(row => {

    if (!row.dataset.name) return

    if (hiddenParts.includes(row.dataset.name))
      row.classList.add("hidden-row")
    else
      row.classList.remove("hidden-row")
  })
}

/* ================= HIDE/SHOW ALL FUNCTION ================= */

const showAllBtn = document.getElementById("showAllBtn")

if (showAllBtn) {
  showAllBtn.onclick = () => {
    // 1. Reset logic arrays
    hiddenParts = []
    
    // 2. Restore visibility
    parts.forEach(p => p.visible = true)
    
    // 🔥 THE FIX: Tell the app we are no longer in isolation mode!
    isIsolated = false 
    
    // 3. Update the UI
    updateHiddenUI()
    updateHideButton() // 🔥 Added this so the button text refreshes!
  }
}


/* ================= WIREFRAME MODE ================= */

const wireframeBtn = document.getElementById("wireframeBtn")
let wireframeMode = false

if (wireframeBtn) {

  wireframeBtn.onclick = () => {

    wireframeMode = !wireframeMode

    parts.forEach(p => {
      if (!p.material) return
      p.material = p.material.clone()
      p.material.wireframe = wireframeMode
    })

    // toggle glow
    wireframeBtn.classList.toggle("active")

  }

}
/* ================= TRANSPARENCY MODE ================= */

const transparentBtn = document.getElementById("transparentBtn")
let transparencyMode = false

if (transparentBtn) {

  transparentBtn.onclick = () => {

    transparencyMode = !transparencyMode

    parts.forEach(p => {

      if (!p.material) return

      p.material = p.material.clone()
      p.material.transparent = transparencyMode
      p.material.opacity = transparencyMode ? 0.25 : 1

    })

    // toggle glow
    transparentBtn.classList.toggle("active")

  }

}

/* ================= label ================= */
/* ================= label (FIXED POSITION) ================= */
/* ================= label (ADJUSTABLE DISTANCE) ================= */
function updateFloatingLabel() {
  if (!floatingLabel) return;
  if (!selectedPart || floatingLabel.style.display !== "block") return;

  // 🔥 THE FIX: இங்கே தூரத்தை (Distance) நீங்கள் விரும்பியபடி மாற்றிக்கொள்ளலாம்!
  // மாடலிலிருந்து லேபிள் எவ்வளவு தூரம் தள்ளி இருக்க வேண்டும் என்பதை இங்கே கொடுங்கள்.
  const offset = 60; // நான் 20-ல் இருந்து 60-ஆக அதிகரித்துள்ளேன். உங்களுக்கு ஏற்றபடி மாற்றுங்கள்.

  const box = new THREE.Box3().setFromObject(selectedPart);
  const min = box.min;
  const max = box.max;

  const corners = [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];

  let minScreenX = Infinity;
  let maxScreenX = -Infinity;
  let minScreenY = Infinity;
  let maxScreenY = -Infinity;

  const canvasWidth = window.innerWidth - SIDEBAR_WIDTH;
  const canvasHeight = window.innerHeight;

  corners.forEach(corner => {
    const projected = corner.clone().project(camera);
    if (projected.z > 1) return; 

    const screenX = (projected.x * 0.5 + 0.5) * canvasWidth + SIDEBAR_WIDTH;
    const screenY = (-projected.y * 0.5 + 0.5) * canvasHeight;

    if (screenX < minScreenX) minScreenX = screenX;
    if (screenX > maxScreenX) maxScreenX = screenX;
    if (screenY < minScreenY) minScreenY = screenY;
    if (screenY > maxScreenY) maxScreenY = screenY;
  });

  const labelWidth = floatingLabel.offsetWidth || 260;
  const labelHeight = floatingLabel.offsetHeight || 100;

  // 🔥 மேலே உள்ள 'offset' வேரியபிளைப் பயன்படுத்தி தூரத்தைக் கணக்கிடுகிறோம்
  let finalX = maxScreenX + offset;
  let finalY = minScreenY - offset;

  // திரையின் ஓரங்களுக்குச் சென்றால் ஆட்டோமேட்டிக்காகத் திருப்பிக்கொள்ளும் லாஜிக்
  if (finalX + labelWidth > window.innerWidth) {
    finalX = minScreenX - labelWidth - offset; 
  }
  if (finalY < 0) {
    finalY = maxScreenY + offset;
  }

  // திரையை விட்டு முழுமையாக வெளியே போகாமல் தடுக்க
  if (finalX < SIDEBAR_WIDTH) finalX = SIDEBAR_WIDTH + 15;
  if (finalY + labelHeight > window.innerHeight) finalY = window.innerHeight - labelHeight - 15;

  floatingLabel.style.transform = "none";
  floatingLabel.style.left = finalX + "px";
  floatingLabel.style.top = finalY + "px";
}
/* ================= RESIZE ================= */

window.addEventListener("resize", () => {

  camera.aspect =
    (window.innerWidth - SIDEBAR_WIDTH) /
    window.innerHeight

  camera.updateProjectionMatrix()

  renderer.setSize(
    window.innerWidth - SIDEBAR_WIDTH,
    window.innerHeight
  )
})

/* ================= LOGOUT ================= */

window.addEventListener("DOMContentLoaded", () => {

  const logoutBtn = document.getElementById("logoutBtn")

  if (!logoutBtn) return

  logoutBtn.addEventListener("click", async () => {

    try {
      await signOut(auth)
      window.location.href = "./login.html"
    } catch (error) {
      console.error("Logout Error:", error)
    }

  })
})
window.addEventListener("DOMContentLoaded", () => {

  const homeBtn = document.getElementById("homeBtn")

  if(homeBtn){
    homeBtn.addEventListener("click", () => {
      window.location.href = "/home.html"
    })
  }

})

const contextMenu = document.getElementById("contextMenu")
const hideOption = document.getElementById("hideOption")
const isolateOption = document.getElementById("isolateOption")
const showAllOption = document.getElementById("showAllOption")
let isIsolated = false
window.addEventListener("contextmenu",(event)=>{

  event.preventDefault()

  if(!selectedPart) return

  contextMenu.style.display = "block"
  contextMenu.style.left = event.clientX + "px"
  contextMenu.style.top = event.clientY + "px"

  // MENU STATE CHANGE
  if(isIsolated){
    hideOption.style.display = "none"
    isolateOption.style.display = "none"
    showAllOption.style.display = "block"
  }else{
    hideOption.style.display = "block"
    isolateOption.style.display = "block"
    showAllOption.style.display = "none"
  }

})

/* ================= RIGHT CLICK MENU (GROUP FIX) ================= */

hideOption.onclick = () => {
  if (!selectedPart) return;

  // 🔥 குழுவில் உள்ள 12 பார்ட்களையும் ஒரே நேரத்தில் மறைக்கிறோம்
  selectedPartsGroup.forEach(p => {
    p.visible = false;
    if (!hiddenParts.includes(p.name)) {
      hiddenParts.push(p.name);
    }
  });

  updateHiddenUI(); 
  updateHideButton();
  contextMenu.style.display = "none";
};

isolateOption.onclick = () => {
  if (!selectedPart) return;

  hiddenParts = [];

  parts.forEach(part => {
    // 🔥 பார்ட் நமது 12 பார்ட்கள் கொண்ட குழுவில் இருக்கிறதா என்று செக் செய்கிறோம்
    part.visible = selectedPartsGroup.includes(part);

    if (!part.visible) {
      hiddenParts.push(part.name);
    }
  });

  isIsolated = true;
  updateHiddenUI();
  updateHideButton();
  contextMenu.style.display = "none";
};

showAllOption.onclick = () => {

  // 1. Reset the logic array
  hiddenParts = [];

  // 2. Restore 3D visibility
  parts.forEach(part => {
    part.visible = true;
  });

  // 3. Reset isolation state
  isIsolated = false;

  // 4. Sync the UI Sidebar
  updateHiddenUI();
  updateHideButton();

  contextMenu.style.display = "none";
};
// CLICK OUTSIDE → CLOSE MENU
window.addEventListener("click", () => {
  contextMenu.style.display = "none"
})
/* ================= PREMIUM FLOATING UI LOGIC ================= */

const resetCanvasBtn = document.getElementById("resetCanvasBtn")
const colorCanvasBtn = document.getElementById("colorCanvasBtn")
const explodeCanvasBtn = document.getElementById("explodeCanvasBtn")
const explodeMenu = document.getElementById("explodeMenu")
const btnLinear = document.getElementById("btnLinear")
const btnRadial = document.getElementById("btnRadial")
const sliderWrapper = document.getElementById("sliderWrapper")
const explodeSlider = document.getElementById("explodeSlider")
const sliderTypeLabel = document.getElementById("sliderTypeLabel")

let currentExplodeType = null

// 1. Color Parts - Toggle Logic (மாற்றப்பட்ட குறியீடு)
let colorMode = false; // நிறத்திற்கான ஆன்/ஆஃப் நிலையைச் சேமிக்க

colorCanvasBtn.onclick = () => {
  // 1. நிலையை மாற்றுதல் (Toggle true/false)
  colorMode = !colorMode; 
  
  // 2. பட்டனின் Glow எஃபெக்ட்டை மாற்றுதல் (Toggle active class)
  colorCanvasBtn.classList.toggle("active");

  // 3. மாடலின் பாகங்களுக்கு நிறத்தைப் பயன்படுத்துதல்
  parts.forEach(p => {
    if (!p.material) return;
    
    p.material = p.material.clone();

    if (colorMode) {
      // ஆன் நிலை (ON): புதிய HSL நிறத்தை அமைத்தல்
      const randomColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
      p.material.color.set(randomColor);
    } else {
      // ஆஃப் நிலை (OFF): அசல் நிறத்திற்கு (Original Color) மாற்றுதல்
      if (p.userData.originalColor) {
        p.material.color.copy(p.userData.originalColor);
      }
    }
  });
}

// 2. Toggle Explode / Assemble Menu
// 2. Toggle Explode / Assemble Menu
explodeCanvasBtn.onclick = () => {
  const isMenuOpen = explodeMenu.style.display === "block"

  if (isMenuOpen) {
    // === ASSEMBLE MODE (Premium Animation + Camera Reset) ===
    explodeMenu.style.display = "none"
    explodeCanvasBtn.innerText = "Explode ▼"
    sliderWrapper.style.display = "none"

    // Setup Animation Variables
    const startSliderValue = parseFloat(explodeSlider.value)
    const animationDuration = 1200 // 1.2 seconds
    const startTime = performance.now()

    // 🔥 Capture where the camera is right NOW
    const startCameraPos = camera.position.clone()
    const startControlsTarget = controls.target.clone()

    // The Animation Loop
    function animateAssemble(currentTime) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / animationDuration, 1)

      // "Ease-Out Cubic" Math
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      const currentValue = startSliderValue * (1 - easeProgress)
      
      explodeSlider.value = currentValue

      // 1. Move the 3D parts
      parts.forEach(p => {
        p.position.lerpVectors(p.userData.original, p.userData.target, currentValue)
      })

      // 2. 🔥 Smoothly fly the camera back to its original framing
      camera.position.lerpVectors(startCameraPos, defaultCameraPosition, easeProgress)
      controls.target.lerpVectors(startControlsTarget, defaultControlsTarget, easeProgress)
      controls.update() // Update OrbitControls to accept the new target

      if (progress < 1) {
        requestAnimationFrame(animateAssemble)
      } else {
        // Animation finished: Clean up
        explodeSlider.value = 0
        currentExplodeType = null
        btnLinear.classList.remove("active")
        btnRadial.classList.remove("active")
        
        // Force exact final positions just in case of math rounding errors
        parts.forEach(p => p.position.copy(p.userData.original))
        camera.position.copy(defaultCameraPosition)
        controls.target.copy(defaultControlsTarget)
        controls.update()
      }
    }

    // Start the animation!
    requestAnimationFrame(animateAssemble)
    
  } else {
    // === EXPLODE MODE ===
    explodeMenu.style.display = "block"
    explodeCanvasBtn.innerText = "Assemble ▲"
  }
}

// 3. Prepare Targets for Slider
// 3. Prepare Targets for Slider (STRICT CAD MATH)
function prepareExplodeTargets(type) {
  // 1. Find the true center of the entire vehicle
  const modelBox = new THREE.Box3().setFromObject(model)
  const modelCenter = modelBox.getCenter(new THREE.Vector3())

  parts.forEach(p => {
    // 2. Find the true center of this specific part
    const partBox = new THREE.Box3().setFromObject(p)
    const partCenter = partBox.getCenter(new THREE.Vector3())

    // 3. Calculate direction from car center to part center
    const dir = new THREE.Vector3().subVectors(partCenter, modelCenter)
    const moveVec = new THREE.Vector3()

    if (type === "linear") {
      /* === STRICT LINEAR MODE === */
      const intensity = 6.0 // Adjust ONLY Linear distance here

      const absX = Math.abs(dir.x)
      const absY = Math.abs(dir.y)
      const absZ = Math.abs(dir.z)

      // Lock to the single largest axis
      if (absX >= absY && absX >= absZ) {
        moveVec.x = dir.x * intensity
      } else if (absY >= absX && absY >= absZ) {
        moveVec.y = dir.y * intensity
      } else {
        moveVec.z = dir.z * intensity
      }

    } else if (type === "radial") {
      /* === PROPORTIONAL RADIAL MODE === */
      const intensity = 6.0 // Adjust ONLY Radial balloon distance here
      
      // Push outward in all 3D directions simultaneously
      moveVec.copy(dir).multiplyScalar(intensity)
    }

    // Adjust for global scale to prevent parts flying off to infinity
    moveVec.divide(model.scale) 
    p.userData.target = p.userData.original.clone().add(moveVec)
  })
}

// 4. Set Linear/Radial Mode
btnLinear.onclick = () => {
  currentExplodeType = "linear"
  btnLinear.classList.add("active")
  btnRadial.classList.remove("active")
  sliderWrapper.style.display = "flex"
  sliderTypeLabel.innerText = "Distance"
  // 🔥 NEW: Reset slider to 0 and snap model back before switching
  explodeSlider.value = 0
  parts.forEach(p => p.position.copy(p.userData.original))
  prepareExplodeTargets("linear")
}

btnRadial.onclick = () => {
  currentExplodeType = "radial"
  btnRadial.classList.add("active")
  btnLinear.classList.remove("active")
  sliderWrapper.style.display = "flex"
  sliderTypeLabel.innerText = "Distance"
  // 🔥 NEW: Reset slider to 0 and snap model back before switching
  explodeSlider.value = 0
  parts.forEach(p => p.position.copy(p.userData.original))
  prepareExplodeTargets("radial")
}

// 5. REAL-TIME SLIDER MAGIC
explodeSlider.addEventListener("input", (e) => {
  const progress = parseFloat(e.target.value) // 0.0 to 1.0
  
  parts.forEach(p => {
    // Dynamically interpolate position based on slider
    p.position.lerpVectors(p.userData.original, p.userData.target, progress)
  })
})

// 6. Complete Reset (STATE BUG FIX)
resetCanvasBtn.onclick = () => {
  explodeCanvasBtn.innerText = "Explode ▼"
  explodeSlider.value = 0
  currentExplodeType = null
  explodeMenu.style.display = "none"
  sliderWrapper.style.display = "none"
  btnLinear.classList.remove("active")
  btnRadial.classList.remove("active")
  colorCanvasBtn.classList.remove("active")
  if (wireframeBtn) wireframeBtn.classList.remove("active")
  if (transparentBtn) transparentBtn.classList.remove("active")

  // 🔥 THE FIX: லாஜிக் வேரியபிள்களை 'false' என்று கட்டாயம் மாற்ற வேண்டும்! (இங்கே தான் பிரச்சனை இருந்தது)
  colorMode = false;
  wireframeMode = false;
  transparencyMode = false;

  parts.forEach(p => {
    p.visible = true
    p.position.copy(p.userData.original)
    if (p.userData.originalColor) {
      p.material = p.material.clone()
      p.material.color.copy(p.userData.originalColor)
    }
    // 🔥 NEW: Reset Wireframe & Transparency on the material
    if (p.material) {
      p.material.wireframe = false
      p.material.transparent = false
      p.material.opacity = 1
    }
    if (p.material.emissive) p.material.emissive.set(0x000000)
  })
  
  // 🔥 NEW: Instantly snap camera back to default on global reset
  camera.position.copy(defaultCameraPosition)
  controls.target.copy(defaultControlsTarget)
  controls.update()
  clearSelection()
}
/* ================= SYSTEM UI ================= */

const subsystemContainer = document.getElementById("subsystems")
 



/* ================= AUTO SYSTEM TREE ================= */

const systemsPanel = document.getElementById("systemsPanel")

function buildSystemTree(){

  const systems = {}

  Object.values(partDescriptions).forEach(part=>{

    const system = part.category

if (!systems[system]) {
  systems[system] = []
}

systems[system].push(part.displayName)
  })
  renderSystems(systems)

}

function renderSystems(systems){

  systemsPanel.innerHTML = "<h3>Systems</h3>"

  Object.keys(systems).forEach(system=>{

    const systemDiv = document.createElement("div")
    systemDiv.className = "system-item"
    
    // 🔥 NEW: Store the system name inside the element so we can identify it later
    systemDiv.dataset.systemName = system 

    systemDiv.innerHTML = `
      <span class="system-arrow">▶</span>
      ${system}
    `

    const subsContainer = document.createElement("div")
    subsContainer.className = "subsystems"

    const partsList = systems[system]

partsList.forEach(partName => {

  const partDiv = document.createElement("div")
  partDiv.className = "subsystem-item"
  partDiv.innerText = partName

  partDiv.onclick = () => {
    highlightParts([partName])
    filterPartsTable([partName])
  }
  
  partDiv.onmouseenter = () => {
    previewHighlight([partName])
  }

  partDiv.onmouseleave = () => {
    if (!isIsolated) {
      parts.forEach(p=>{
        if(p.material && p.material.emissive) p.material.emissive.set(0x000000)
      })
    }
  }

  subsContainer.appendChild(partDiv)

})

  // 🔥 NEW MULTI-SELECT CLICK LOGIC WITH SHIFT-KEY SUPPORT
    systemDiv.onclick = (e) => { // Make sure to add 'e' here to capture the event!

      const isOpen = subsContainer.classList.contains("open")

      // 1. ACCORDION LOGIC: Close others if Shift is NOT pressed
      if (!e.shiftKey) {
        document.querySelectorAll(".system-item.active").forEach(activeDiv => {
          // If the active div isn't the one we just clicked, close it
          if (activeDiv !== systemDiv) { 
            activeDiv.classList.remove("active")
            // The container is always the next element sibling in your DOM structure
            activeDiv.nextElementSibling.classList.remove("open") 
          }
        })
      }

      // 2. Toggle ONLY the clicked folder
      if(isOpen){
        subsContainer.classList.remove("open")
        systemDiv.classList.remove("active")
      } else {
        subsContainer.classList.add("open")
        systemDiv.classList.add("active")
      }

      // 3. Gather every part from EVERY currently open folder
      const allActiveParts = []

      document.querySelectorAll(".system-item.active").forEach(activeDiv => {
        const sysName = activeDiv.dataset.systemName;
        
        if(systems[sysName]){
          systems[sysName].forEach(p => allActiveParts.push(p))
        }
      })

      // 4. Update the 3D Model and the Table with the combined list
      highlightParts(allActiveParts)
      
      if (allActiveParts.length > 0) {
        filterPartsTable(allActiveParts)
      } else {
        // 5. If all folders are closed, reset the table back to normal
        document.querySelectorAll("#partsList tbody tr").forEach(row => {
          row.style.display = ""
        })
      }

    }

    systemsPanel.appendChild(systemDiv)
    systemsPanel.appendChild(subsContainer)

  })

}

function highlightParts(partNames) {
  
  // 1. IF CLOSING A FOLDER: Reset everything back to normal
  if (partNames.length === 0) {
    parts.forEach(p => {
      p.visible = true; // Unhide everything
      if (p.material && p.material.emissive) p.material.emissive.set(0x000000); // Remove glow
    });
    
    hiddenParts = []; // Clear hidden list
    isIsolated = false;
    updateHiddenUI(); // Sync the UI counter to 0
    return;
  }

  // 2. IF OPENING A FOLDER: Engage Isolation Mode!
  hiddenParts = []; // Reset tracking array for the new selection

  parts.forEach(p => {
    // Clean the 3D name so it perfectly matches the Excel data
    const cleanName = formatName(p.name);

    if (partNames.includes(cleanName) || partNames.includes(p.name)) {
      // ✅ IT MATCHES THE SYSTEM: Show it and give it a slight premium glow
      p.visible = true;
      if (p.material && p.material.emissive) {
        p.material.emissive.set(0x646cff);
        p.material.emissiveIntensity = 0.5; 
      }
    } else {
      // ❌ NOT IN THE SYSTEM: Hide it completely
      p.visible = false;
      if (!hiddenParts.includes(p.name)) hiddenParts.push(p.name);
      if (p.material && p.material.emissive) p.material.emissive.set(0x000000);
    }
  });

  isIsolated = true; // Tell the app we are in isolated mode
  updateHiddenUI(); // Update the "Hidden Parts:" counter in the sidebar
}
function filterPartsTable(partNames){
  document.querySelectorAll("#partsList tbody tr").forEach(row=>{
    const rawName = row.dataset.name
    if(!rawName) return

    // 🔥 THE FIX: Clean the raw 3D name so it perfectly matches the Excel name
    const cleanName = formatName(rawName)

    if(partNames.includes(cleanName) || partNames.includes(rawName)){
      row.style.display = "" // Show the row
    }else{
      row.style.display = "none" // Hide the row
    }
  })
}
function previewHighlight(partNames){

  parts.forEach(p=>{

      if(p === selectedPart) return

    if(!p.material || !p.material.emissive) return

    if(partNames.includes(p.name)){

      p.material.emissive.set(0x00ffcc)
      p.material.emissiveIntensity = 0.4

    }else{

      p.material.emissive.set(0x000000)

    }

  })

}
//search//
const searchInput = document.getElementById("partSearch")
if(searchInput){
searchInput.addEventListener("input",()=>{

  const term = searchInput.value.toLowerCase()

  document.querySelectorAll("#partsList tr").forEach(row=>{

    if(!row.dataset.name) return

    if(row.dataset.name.toLowerCase().includes(term)){

      row.style.display = ""

    }else{

      row.style.display = "none"

    }

  })

})
}
/* ================= ANIMATION LOOP ================= */

function animate() {
  requestAnimationFrame(animate)

  // Update OrbitControls (required if enableDamping is true)
  if (controls) {
    controls.update()
  }

  // Render the scene
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }

  // Keep the floating label pinned to the 3D object
  updateFloatingLabel()
}

// Start the loop!
animate()