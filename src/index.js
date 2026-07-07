import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import DxfParser from 'dxf-parser'
import { addPartToCart } from './partsCart.js'
// Find your existing imports at the top of index.js and update them:
import { requireLogin, secureLogout } from "./authGuard.js"

await requireLogin();


/* ================= HOME BUTTON FIX ================= */
function goHomeFromViewer(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  window.location.assign('/partscat.html');
}
window.goHomeFromViewer = goHomeFromViewer;

function bindHomeButton() {
  const homeBtn = document.getElementById('homeBtn');
  if (!homeBtn || homeBtn.dataset.bound === 'true') return;
  homeBtn.dataset.bound = 'true';
  homeBtn.addEventListener('click', goHomeFromViewer, true);
  homeBtn.addEventListener('pointerup', goHomeFromViewer, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindHomeButton);
} else {
  bindHomeButton();
}

/* ================= SYSTEM STRUCTURE ================= */



const selectedVehicle = localStorage.getItem("selectedVehicle")
const UPLOAD_SERVER = "https://threed-manual.onrender.com"
const SUPPORTED_VIEWER_MODEL_EXTENSIONS = new Set(["glb", "gltf", "obj", "stl", "fbx", "stp", "step", "dxf", "dwg"])

let selectedVehicleRecord = readStoredVehicleRecord()
let activeBomRevision = null
let activeBomRevisionMode = "base"
let bomDiffSummary = null
let lastLoadedBomRows = []
let baseBomRows = []
let revisionBomRows = []
let appliedRevisionEntries = []
let partHistoryByKey = new Map()
let currentBomByKey = new Map()
let latestRevisionLabel = "Base BOM"

if (!selectedVehicle) {
  alert("Vehicle missing")
  window.location.href = "home.html"
}

let highlightTimeout = null
let activeSystems = new Set()
const floatingLabel = document.getElementById("floatingLabel")


function formatName(name) {
  return String(name || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
}


function formatVehicleDisplayName(name) {
  const text = String(name || "Vehicle")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) return "Vehicle"

  return text
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bBmw\b/g, "BMW")
    .replace(/\bAudi\b/g, "Audi")
    .replace(/\bVw\b/g, "VW")
    .replace(/\bSuv\b/g, "SUV")
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;")
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

function getSidebarWidth() {
  const sidebar = document.getElementById("ui")
  const width = sidebar?.getBoundingClientRect?.().width || 430
  return Math.max(320, Math.round(width))
}

let SIDEBAR_WIDTH = getSidebarWidth()

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
renderer.setSize(Math.max(1, window.innerWidth - SIDEBAR_WIDTH), window.innerHeight)
renderer.domElement.style.position = "absolute"
renderer.domElement.style.left = SIDEBAR_WIDTH + "px"
renderer.domElement.style.top = "0"
renderer.domElement.style.width = `calc(100vw - ${SIDEBAR_WIDTH}px)`
renderer.domElement.style.height = "100vh"
document.body.appendChild(renderer.domElement)

/* ================= CONTROLS ================= */

/* ================= CONTROLS ================= */

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

// 🔥 CAD Style Mouse Controls
controls.mouseButtons = {
  LEFT: null,                 // Left Click: கேமரா நகராது (Selection-க்கு மட்டும் பயன்படும்)
  MIDDLE: THREE.MOUSE.ROTATE, // Middle Scroll-ஐ அழுத்திப் பிடித்தால்: மாடலைச் சுழற்றலாம் (Rotate)
  RIGHT: THREE.MOUSE.PAN      // Right Click-ஐ அழுத்திப் பிடித்தால்: மாடலை நகர்த்தலாம் (Pan)
}

/* ================= LIGHT ================= */

/* ================= LIGHT ================= */

// HDR environment intentionally disabled. If /hdr/studio.hdr is missing or invalid,
// HDRLoader throws "Bad File Format" and can break the viewer on some models.
// These lights are enough to keep every supported model visible.

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
let multiSelectedNames = new Set()
let hiddenParts = []

let explodeProgress = 0
let explodeDirection = 0
let exploded = false

/* ================= LOAD MODEL ================= */

initializeViewer()

async function initializeViewer() {
  try {
    selectedVehicleRecord = await resolveSelectedVehicleRecord()
    renderBomRevisionPanel()

    const modelInfo = getVehicleFileInfo("model", `/models/${selectedVehicle}.glb`)
    const modelExtension = getExtension(modelInfo.url || modelInfo.name || "")

    console.log("Selected Vehicle:", selectedVehicle)
    console.log("Model URL:", modelInfo.url, "Extension:", modelExtension)

    if (!SUPPORTED_VIEWER_MODEL_EXTENSIONS.has(modelExtension)) {
      showViewerMessage(
        `This model file (.${modelExtension || "unknown"}) is saved locally, but browser preview supports GLB/GLTF, OBJ, STL, FBX, STP/STEP and DXF. Convert unsupported formats to GLB/OBJ/STL/FBX/STP/STEP/DXF to view it here.`
      )
      await loadModelDataFile()
      return
    }

    model = await loadModelByExtension(modelInfo.url, modelExtension)
    scene.add(model)
    collectModelParts(model)
    hideLoadingOverlay()
    frameModel(model)

    await loadModelDataFile()

    // ✅ highlight only after model + part data loads
    const highlightPart = localStorage.getItem("highlightPart")
    if (highlightPart) {
      const part = parts.find(p => p.name === highlightPart || formatName(p.name) === formatName(highlightPart))
      if (part) selectPart(part)
      localStorage.removeItem("highlightPart")
    }
  } catch (error) {
    console.error("Viewer initialization failed ❌", error)
    showViewerMessage(error.message || "Unable to load this vehicle.")
  }
}

async function resolveSelectedVehicleRecord() {
  const stored = readStoredVehicleRecord()
  if (stored?.id === selectedVehicle) return stored

  const vehicles = await fetchVehiclesFromDatabase()
  const matched = vehicles.find(vehicle => vehicle.id === selectedVehicle)
  if (matched) {
    localStorage.setItem("selectedVehicleData", JSON.stringify(matched))
    return matched
  }

  return null
}

function readStoredVehicleRecord() {
  try {
    const raw = localStorage.getItem("selectedVehicleData")
    if (!raw) return null
    if (raw.trim().startsWith("<")) throw new Error("selectedVehicleData contains HTML instead of JSON")
    return JSON.parse(raw)
  } catch (error) {
    console.warn("Stored vehicle data is invalid", error)
    localStorage.removeItem("selectedVehicleData")
    return null
  }
}

async function fetchVehiclesFromDatabase() {
  const cacheKey = Date.now()
  const urls = [
    `/api/vehicles/public?v=${cacheKey}`,
    `${UPLOAD_SERVER}/api/vehicles/public?v=${cacheKey}`,
    `${UPLOAD_SERVER}/database.json?v=${cacheKey}`,
    `/database.json?v=${cacheKey}`
  ]

  const data = await fetchJsonFromAny(urls, [])
  return Array.isArray(data) ? data : []
}

function getVehicleFileInfo(kind, fallbackUrl) {
  const record = selectedVehicleRecord || {}
  const directUrl = record[`${kind}Url`]
  const fileMeta = record[kind]
  const url = directUrl || fileMeta?.url || fallbackUrl

  return {
    url,
    name: fileMeta?.name || fileMeta?.storedName || url,
    extension: fileMeta?.extension || getExtension(url)
  }
}

function getExtension(value) {
  const clean = String(value || "").split("?")[0].split("#")[0]
  return clean.includes(".") ? clean.split(".").pop().toLowerCase() : ""
}


async function readJsonSafely(response, sourceUrl = "") {
  const contentType = response.headers.get("content-type") || ""
  const text = await response.text()
  const trimmed = text.trim()

  if (!trimmed) {
    throw new Error(`Empty JSON response from ${sourceUrl || response.url}`)
  }

  if (trimmed.startsWith("<")) {
    throw new Error(`Expected JSON but received HTML from ${sourceUrl || response.url}. Start the upload server with npm run upload-server and use https://threed-manual.onrender.com for API requests.`)
  }

  if (contentType && !contentType.toLowerCase().includes("json") && !trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    throw new Error(`Expected JSON but received ${contentType} from ${sourceUrl || response.url}`)
  }

  return JSON.parse(trimmed)
}

async function fetchJsonFromAny(urls, fallbackValue) {
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" })
      if (!response.ok) continue
      return await readJsonSafely(response, url)
    } catch (error) {
      console.warn("JSON endpoint failed:", url, error.message || error)
    }
  }
  return fallbackValue
}

function loadWithProgress(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      (xhr) => {
        if (xhr.total > 0) {
          const percentComplete = Math.round((xhr.loaded / xhr.total) * 100)
          const loadingText = document.getElementById("loadingText")
          if (loadingText) loadingText.innerText = `Loading Model: ${percentComplete}%`
        }
      },
      reject
    )
  })
}

async function loadModelByExtension(url, extension) {
  const ext = String(extension || "").toLowerCase()

  if (ext === "glb" || ext === "gltf") {
    const gltf = await loadWithProgress(new GLTFLoader(), url)
    return gltf.scene
  }

  if (ext === "obj") {
    return await loadWithProgress(new OBJLoader(), url)
  }

  if (ext === "fbx") {
    return await loadWithProgress(new FBXLoader(), url)
  }

  if (ext === "stl") {
    const geometry = await loadWithProgress(new STLLoader(), url)
    geometry.computeVertexNormals()

    const material = new THREE.MeshStandardMaterial({
      color: 0xd6d6d6,
      metalness: 0.15,
      roughness: 0.55
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = selectedVehicle

    const group = new THREE.Group()
    group.name = selectedVehicle
    group.add(mesh)
    return group
  }

  if (ext === "stp" || ext === "step") {
    return await loadStepModel(url)
  }

  if (ext === "dxf") {
    return await loadDxfModel(url)
  }

  if (ext === "dwg") {
    throw new Error("DWG is saved successfully, but direct browser preview needs a DWG converter. Convert DWG to DXF, GLB, OBJ, STL, FBX, STP or STEP to view it here.")
  }

  throw new Error(`Unsupported model preview format: .${ext}`)
}

let occtLoaderPromise = null

async function loadOpenCascade() {
  if (window.occtimportjs) {
    return await window.occtimportjs()
  }

  if (!occtLoaderPromise) {
    occtLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-occt-import-js="true"]')
      if (existingScript) {
        existingScript.addEventListener("load", resolve, { once: true })
        existingScript.addEventListener("error", reject, { once: true })
        return
      }

      const script = document.createElement("script")
      script.dataset.occtImportJs = "true"
      script.src = "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.22/dist/occt-import-js.js"
      script.onload = resolve
      script.onerror = () => reject(new Error("Unable to load OpenCascade/OCCT STEP parser. Check internet connection or bundle occt-import-js locally."))
      document.head.appendChild(script)
    })
  }

  await occtLoaderPromise
  if (!window.occtimportjs) {
    throw new Error("OpenCascade STEP parser did not initialize.")
  }

  return await window.occtimportjs()
}

async function loadStepModel(url) {
  const loadingText = document.getElementById("loadingText")
  if (loadingText) loadingText.innerText = "Loading STEP/STP parser..."

  const occt = await loadOpenCascade()

  if (loadingText) loadingText.innerText = "Reading STEP/STP file..."
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("STEP/STP model not found at " + url)

  const buffer = await response.arrayBuffer()
  const uint8 = new Uint8Array(buffer)

  if (loadingText) loadingText.innerText = "Parsing STEP/STP geometry..."
  const result = occt.ReadStepFile(uint8, null)

  if (!result?.meshes?.length) {
    throw new Error("STEP/STP parser could not find any previewable meshes in this file.")
  }

  if (loadingText) loadingText.innerText = "Building STEP/STP mesh..."
  const group = new THREE.Group()
  group.name = selectedVehicle

  result.meshes.forEach((mesh, index) => {
    const geometry = createGeometryFromOcctMesh(mesh)
    if (!geometry) return

    const color = Array.isArray(mesh.color)
      ? new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2])
      : new THREE.Color(0xaab8c8)

    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.35,
      roughness: 0.55,
      side: THREE.DoubleSide
    })

    const partMesh = new THREE.Mesh(geometry, material)
    partMesh.name = mesh.name || mesh.label || `STEP_Part_${index + 1}`
    group.add(partMesh)
  })

  if (group.children.length === 0) {
    throw new Error("STEP/STP file loaded, but no valid mesh geometry was generated.")
  }

  return group
}

function createGeometryFromOcctMesh(mesh) {
  const positionArray = mesh?.attributes?.position?.array || mesh?.position?.array || mesh?.positions
  if (!positionArray) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positionArray, 3))

  const normalArray = mesh?.attributes?.normal?.array || mesh?.normal?.array || mesh?.normals
  if (normalArray) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normalArray, 3))
  } else {
    geometry.computeVertexNormals()
  }

  const indexArray = mesh?.index?.array || mesh?.indices
  if (indexArray) {
    geometry.setIndex(new THREE.Uint32BufferAttribute(indexArray, 1))
  }

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

async function loadDxfModel(url) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("DXF model not found at " + url)

  const text = await response.text()
  const parser = new DxfParser()
  const dxf = parser.parseSync(text)

  const group = new THREE.Group()
  group.name = selectedVehicle

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x1f6feb })
  const meshMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6d6d6,
    metalness: 0.1,
    roughness: 0.6,
    side: THREE.DoubleSide
  })

  ;(dxf.entities || []).forEach((entity, index) => {
    const object = createObjectFromDxfEntity(entity, index, lineMaterial, meshMaterial)
    if (object) group.add(object)
  })

  if (group.children.length === 0) {
    throw new Error("DXF loaded, but this file has no previewable LINE/POLYLINE/CIRCLE/ARC/3DFACE entities.")
  }

  return group
}

function createObjectFromDxfEntity(entity, index, lineMaterial, meshMaterial) {
  const type = String(entity.type || "").toUpperCase()

  if (type === "LINE") {
    const vertices = entity.vertices || [entity.start, entity.end].filter(Boolean)
    return createLineFromPoints(vertices, `DXF_Line_${index + 1}`, lineMaterial)
  }

  if (type === "LWPOLYLINE" || type === "POLYLINE") {
    const vertices = entity.vertices || []
    const points = vertices.map(toVector3)
    if (entity.shape || entity.closed) points.push(points[0]?.clone())
    return createLineFromPoints(points, `DXF_Polyline_${index + 1}`, lineMaterial)
  }

  if (type === "CIRCLE") {
    return createDxfCircle(entity, index, lineMaterial)
  }

  if (type === "ARC") {
    return createDxfArc(entity, index, lineMaterial)
  }

  if (type === "3DFACE" || type === "SOLID" || type === "TRACE") {
    return createDxfFace(entity, index, meshMaterial)
  }

  if (type === "SPLINE" && entity.controlPoints?.length) {
    return createLineFromPoints(entity.controlPoints, `DXF_Spline_${index + 1}`, lineMaterial)
  }

  return null
}

function createLineFromPoints(rawPoints, name, material) {
  const points = (rawPoints || []).filter(Boolean).map(toVector3).filter(Boolean)
  if (points.length < 2) return null

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const line = new THREE.Line(geometry, material.clone())
  line.name = name
  return line
}

function createDxfCircle(entity, index, material) {
  const center = toVector3(entity.center || entity)
  const radius = Number(entity.radius || 0)
  if (!radius) return null

  const points = []
  for (let i = 0; i <= 96; i++) {
    const angle = (i / 96) * Math.PI * 2
    points.push(new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
      center.z
    ))
  }

  return createLineFromPoints(points, `DXF_Circle_${index + 1}`, material)
}

function createDxfArc(entity, index, material) {
  const center = toVector3(entity.center || entity)
  const radius = Number(entity.radius || 0)
  if (!radius) return null

  let start = Number(entity.startAngle ?? 0)
  let end = Number(entity.endAngle ?? Math.PI * 2)
  if (Math.abs(start) > Math.PI * 2 || Math.abs(end) > Math.PI * 2) {
    start = THREE.MathUtils.degToRad(start)
    end = THREE.MathUtils.degToRad(end)
  }
  if (end < start) end += Math.PI * 2

  const points = []
  const steps = 64
  for (let i = 0; i <= steps; i++) {
    const angle = start + ((end - start) * i) / steps
    points.push(new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
      center.z
    ))
  }

  return createLineFromPoints(points, `DXF_Arc_${index + 1}`, material)
}

function createDxfFace(entity, index, material) {
  const vertices = entity.vertices || []
  const points = vertices.map(toVector3).filter(Boolean)
  if (points.length < 3) return null

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  geometry.setIndex(points.length >= 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2])
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, material.clone())
  mesh.name = `DXF_Face_${index + 1}`
  return mesh
}

function toVector3(point) {
  if (!point) return null
  return new THREE.Vector3(
    Number(point.x || 0),
    Number(point.y || 0),
    Number(point.z || 0)
  )
}

function collectModelParts(root) {
  parts = []

  root.traverse(obj => {
    if (!obj.isMesh) return

    obj.material = normalizeMaterial(obj.material)
    parts.push(obj)

    obj.userData.original = obj.position.clone()
    obj.userData.target = obj.position.clone()

    if (obj.material.color) {
      obj.userData.originalColor = obj.material.color.clone()
    }
  })
}

function normalizeMaterial(material) {
  const source = Array.isArray(material) ? material.find(Boolean) : material
  const cloned = source?.clone ? source.clone() : new THREE.MeshStandardMaterial({ color: 0xd6d6d6 })

  // Some uploaded/converter GLB files contain broken texture references. Three.js then
  // crashes during render with: Cannot read properties of undefined (reading 'image').
  // Keep valid textures, remove broken ones, and preserve the material color.
  sanitizeMaterialTextures(cloned)

  if (!cloned.emissive) {
    const safe = new THREE.MeshStandardMaterial({
      color: cloned.color ? cloned.color.clone() : new THREE.Color(0xd6d6d6),
      metalness: cloned.metalness ?? 0.1,
      roughness: cloned.roughness ?? 0.6,
      transparent: cloned.transparent || false,
      opacity: cloned.opacity ?? 1
    })
    copyValidTexture(cloned, safe, "map")
    copyValidTexture(cloned, safe, "normalMap")
    copyValidTexture(cloned, safe, "roughnessMap")
    copyValidTexture(cloned, safe, "metalnessMap")
    copyValidTexture(cloned, safe, "emissiveMap")
    copyValidTexture(cloned, safe, "aoMap")
    return safe
  }

  return cloned
}

function sanitizeMaterialTextures(material) {
  if (!material) return
  const textureKeys = [
    "map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap",
    "aoMap", "alphaMap", "bumpMap", "displacementMap", "lightMap", "specularMap"
  ]

  textureKeys.forEach((key) => {
    const texture = material[key]
    if (texture && !isValidTexture(texture)) {
      material[key] = null
      material.needsUpdate = true
    }
  })
}

function copyValidTexture(from, to, key) {
  if (from?.[key] && isValidTexture(from[key])) {
    to[key] = from[key]
    to.needsUpdate = true
  }
}

function isValidTexture(texture) {
  if (!texture) return false
  return Boolean(texture.image || texture.source?.data)
}


async function loadModelDataFile() {
  const baseModelDataInfo = getVehicleFileInfo("modelData", "./Parts Details/Parts data.xlsx")
  const sourceUrl = baseModelDataInfo.url

  baseBomRows = []
  revisionBomRows = []
  appliedRevisionEntries = []
  partHistoryByKey = new Map()
  currentBomByKey = new Map()
  activeBomRevision = null
  activeBomRevisionMode = "base"
  bomDiffSummary = null
  latestRevisionLabel = "Base BOM"

  try {
    baseBomRows = await loadSheetRows(baseModelDataInfo.url, baseModelDataInfo.extension || getExtension(baseModelDataInfo.url))
  } catch (error) {
    console.warn("Base model data load failed:", error)
  }

  try {
    const revisions = await fetchAllBomRevisions()
    appliedRevisionEntries = await loadRevisionEntriesForVehicle(revisions)
    revisionBomRows = appliedRevisionEntries.flatMap((entry) => entry.rows)
  } catch (error) {
    console.warn("Revision history load failed. Continuing with base BOM.", error)
    appliedRevisionEntries = []
    revisionBomRows = []
  }

  const applyResult = applyRevisionEntriesToBaseBom(baseBomRows, appliedRevisionEntries)
  let rowsToUse = applyResult.rows
  activeBomRevisionMode = applyResult.mode
  bomDiffSummary = applyResult.diff
  latestRevisionLabel = applyResult.latestRevisionLabel || "Base BOM"
  activeBomRevision = applyResult.latestRevision || null

  lastLoadedBomRows = rowsToUse
  currentBomByKey = mapBomRows(rowsToUse)

  buildPartHistory(baseBomRows, appliedRevisionEntries, rowsToUse)

  if (rowsToUse.length) {
    partDescriptions = buildPartDescriptionsFromRows(rowsToUse)
  }

  if (!rowsToUse.length || Object.keys(partDescriptions).length === 0) {
    partDescriptions = createFallbackPartDescriptions()
    currentBomByKey = mapBomRows(Object.values(partDescriptions).map((p) => p.row || p))
  }

  console.log("BOM data loaded ✅", {
    sourceUrl,
    baseRows: baseBomRows.length,
    revisions: appliedRevisionEntries.length,
    bomDiffSummary,
    latestRevisionLabel,
    partDescriptions
  })

  renderBomRevisionPanel()
  buildSystemTree()
  createPartsTable()
}



async function fetchAllBomRevisions() {
  const urls = [
    `/api/program-revisions/public?_=${Date.now()}`,
    `${UPLOAD_SERVER}/api/program-revisions/public?_=${Date.now()}`
  ]
  const data = await fetchJsonFromAny(urls, [])
  return Array.isArray(data) ? data : []
}

async function loadRevisionEntriesForVehicle(revisions) {
  const entries = []

  for (const revision of Array.isArray(revisions) ? revisions : []) {
    const sheetUrl = revision?.sheet?.url || revision?.sourceUrl || ""
    if (!sheetUrl) continue

    let rows = []
    try {
      rows = await loadSheetRows(sheetUrl, revision?.sheet?.extension || getExtension(sheetUrl))
    } catch (error) {
      console.warn("Could not load revision sheet:", revision?.id, error)
      continue
    }

    const filteredRows = filterRevisionRowsForSelectedVehicle(rows, revision)
    if (!filteredRows.length) continue

    entries.push({
      revision,
      rows: filteredRows,
      mode: detectBomRevisionMode(filteredRows, revision),
      effectiveDate: getEarliestDate(filteredRows, revision),
      validDate: getLatestDate(filteredRows, revision)
    })
  }

  return entries.sort((a, b) => {
    const ad = Date.parse(`${a.effectiveDate || a.revision?.createdAt || ""}T00:00:00Z`) || Date.parse(a.revision?.createdAt || "") || 0
    const bd = Date.parse(`${b.effectiveDate || b.revision?.createdAt || ""}T00:00:00Z`) || Date.parse(b.revision?.createdAt || "") || 0
    if (ad !== bd) return ad - bd
    return String(a.revision?.createdAt || "").localeCompare(String(b.revision?.createdAt || ""))
  })
}

function filterRevisionRowsForSelectedVehicle(rows, revision = {}) {
  if (!Array.isArray(rows) || !rows.length) return []

  const vehicleProgramIds = new Set([
    selectedVehicle,
    selectedVehicleRecord?.id,
    selectedVehicleRecord?.programId,
    selectedVehicleRecord?.groupId,
    selectedVehicleRecord?.groupFields?.["Program ID"],
    selectedVehicleRecord?.normalizedGroupFields?.programid,
    selectedVehicleRecord?.normalizedGroupFields?.programId
  ].map(normalizeComparable).filter(Boolean))

  const groupProgramIds = new Set((revision.groups || []).flatMap((group) => [
    group.groupId,
    group.vehicleId,
    group.programId
  ]).map(normalizeComparable).filter(Boolean))

  const filtered = rows.filter((row) => {
    const rowProgramId = normalizeComparable(getRowValue(row, ["Program ID", "ProgramID", "Program", "Vehicle ID", "VehicleId", "Vehicle"]));
    if (rowProgramId && (vehicleProgramIds.has(rowProgramId) || groupProgramIds.has(rowProgramId))) return true

    const rowModel = normalizeComparable(getRowValue(row, ["Model", "MODEL", "Vehicle Model", "Model Name"]))
    const rowSeries = normalizeComparable(getRowValue(row, ["Series", "SERIES", "Model Series"]))
    const rowVariant = normalizeComparable(getRowValue(row, ["Variant Level", "Variant", "VARIANT NAME", "Varient", "Trim"]))
    const rowVariantCode = normalizeComparable(getRowValue(row, ["Variant Code", "VARIENT TYPE", "VARIANT TYPE", "Type Code"]))
    const rowRegion = normalizeComparable(getRowValue(row, ["Region", "REGION", "Market", "Country"]))

    const vehicleModel = normalizeComparable(selectedVehicleRecord?.modelName || selectedVehicleRecord?.groupFields?.MODEL || selectedVehicleRecord?.name || "")
    const vehicleSeries = normalizeComparable(selectedVehicleRecord?.seriesLabel || selectedVehicleRecord?.series || "")
    const vehicleVariant = normalizeComparable(selectedVehicleRecord?.variantName || selectedVehicleRecord?.variant || "")
    const vehicleVariantCode = normalizeComparable(selectedVehicleRecord?.variantCode || selectedVehicleRecord?.filterFields?.variantCode || selectedVehicleRecord?.variantType || "")
    const vehicleRegion = normalizeComparable(selectedVehicleRecord?.region || selectedVehicleRecord?.filterFields?.region || "")

    const modelOk = !rowModel || !vehicleModel || rowModel === vehicleModel || vehicleModel.includes(rowModel) || rowModel.includes(vehicleModel)
    const seriesOk = !rowSeries || !vehicleSeries || rowSeries === vehicleSeries
    const variantOk = !rowVariant || !vehicleVariant || rowVariant === vehicleVariant
    const variantCodeOk = !rowVariantCode || !vehicleVariantCode || rowVariantCode === vehicleVariantCode
    const regionOk = !rowRegion || !vehicleRegion || rowRegion === vehicleRegion

    return modelOk && seriesOk && variantOk && variantCodeOk && regionOk
  })

  return filtered.length ? filtered : rows
}

function getEarliestDate(rows, revision = {}) {
  const dates = (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeDateInput(getRowValue(row, ["Effective Date", "Effective From", "From Date", "Start Date"])))
    .filter(Boolean)
    .sort()
  if (dates[0]) return dates[0]
  const groupDates = (revision.groups || []).map((group) => normalizeDateInput(group.effectiveDate)).filter(Boolean).sort()
  return groupDates[0] || normalizeDateInput(revision.createdAt || "")
}

function getLatestDate(rows, revision = {}) {
  const dates = (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeDateInput(getRowValue(row, ["Valid Date", "Valid To", "Valid Until", "End Date"])))
    .filter(Boolean)
    .sort()
  if (dates.length) return dates[dates.length - 1]
  const groupDates = (revision.groups || []).map((group) => normalizeDateInput(group.validDate)).filter(Boolean).sort()
  return groupDates[groupDates.length - 1] || ""
}

function applyRevisionEntriesToBaseBom(baseRows, entries) {
  let rows = Array.isArray(baseRows) ? [...baseRows] : []
  const diff = { added: 0, changed: 0, removed: 0, total: 0, baseTotal: mapBomRows(baseRows).size, ignored: 0 }
  let latestRevision = null
  let latestRevisionLabel = "Base BOM"
  let mode = "base"

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry.rows.length) continue
    latestRevision = entry.revision
    latestRevisionLabel = entry.revision?.id || "Revision BOM"
    mode = entry.mode || detectBomRevisionMode(entry.rows, entry.revision)

    if (mode === "full") {
      rows = entry.rows
      const fullDiff = compareBomRows(baseRows, rows, { mode: "full" })
      diff.added += fullDiff.added || 0
      diff.changed += fullDiff.changed || 0
      diff.removed += fullDiff.removed || 0
      diff.ignored += fullDiff.ignored || 0
      continue
    }

    const result = applyDeltaBomRows(rows, entry.rows)
    rows = result.rows
    diff.added += result.added || 0
    diff.changed += result.changed || 0
    diff.removed += result.removed || 0
    diff.ignored += result.ignored || 0
  }

  diff.total = mapBomRows(rows).size
  return { rows, diff: entries?.length ? diff : null, latestRevision, latestRevisionLabel, mode }
}

function buildPartHistory(baseRows, entries, activeRows) {
  const history = new Map()

  ;(Array.isArray(baseRows) ? baseRows : []).forEach((row) => {
    const item = normalizeBomRow(row)
    if (!item.key) return
    addPartHistoryRecord(history, item.key, {
      revisionId: "BASE",
      changeType: "Base Part",
      partId: item.partId,
      partName: item.partName,
      qty: item.qty,
      effectiveDate: getRowValue(row, ["Effective Date", "Effective From", "From Date", "Start Date"]),
      validDate: getRowValue(row, ["Valid Date", "Valid To", "Valid Until", "End Date"]),
      remark: getRowValue(row, ["Notes", "Remark", "Remarks"]),
      row
    })
  })

  ;(Array.isArray(entries) ? entries : []).forEach((entry) => {
    entry.rows.forEach((row) => {
      const oldPartId = getRowValue(row, ["Old Part ID", "Old PartId", "Previous Part ID", "Old ID"])
      const newPartId = getRowValue(row, ["New Part ID", "New PartId", "Replacement Part ID", "Part ID", "PartId", "ID"])
      const partName = getRowValue(row, ["Part Name", "PartName", "Name", "Part", "Component", "Description"])
      const changeType = getChangeType(row) || "Changed"
      const keys = [oldPartId, newPartId, partName].map(normalizePartKey).filter(Boolean)
      const uniqueKeys = Array.from(new Set(keys))
      uniqueKeys.forEach((key) => addPartHistoryRecord(history, key, {
        revisionId: getRowValue(row, ["Revision ID", "RevisionId", "Revision", "Rev"]) || entry.revision?.id || "REVISION",
        revisionMode: entry.mode,
        changeType,
        oldPartId,
        newPartId,
        partId: newPartId || oldPartId,
        partName,
        oldQty: getRowValue(row, ["Old Qty", "Old Quantity"]),
        newQty: getRowValue(row, ["New Qty", "New Quantity", "Qty", "Quantity"]),
        effectiveDate: getRowValue(row, ["Effective Date", "Effective From", "From Date", "Start Date"]),
        validDate: getRowValue(row, ["Valid Date", "Valid To", "Valid Until", "End Date"]),
        remark: getRowValue(row, ["Remark", "Remarks", "Notes", "Reason"]),
        approvalStatus: getRowValue(row, ["Approval Status", "Status"]),
        row
      }))
    })
  })

  ;(Array.isArray(activeRows) ? activeRows : []).forEach((row) => {
    const item = normalizeBomRow(row)
    if (!item.key) return
    if (!history.has(item.key)) {
      addPartHistoryRecord(history, item.key, {
        revisionId: "CURRENT",
        changeType: "Current Active Part",
        partId: item.partId,
        partName: item.partName,
        qty: item.qty,
        effectiveDate: getRowValue(row, ["Effective Date", "Effective From", "From Date", "Start Date"]),
        validDate: getRowValue(row, ["Valid Date", "Valid To", "Valid Until", "End Date"]),
        remark: getRowValue(row, ["Notes", "Remark", "Remarks"]),
        row
      })
    }
  })

  partHistoryByKey = history
}

function addPartHistoryRecord(map, key, record) {
  if (!key) return
  if (!map.has(key)) map.set(key, [])
  const signature = historyRecordSignature(record)
  const list = map.get(key)
  if (!list.some((item) => historyRecordSignature(item) === signature)) {
    list.push(record)
  }
}

function historyRecordSignature(record = {}) {
  return [
    record.revisionId,
    record.changeType,
    record.oldPartId,
    record.newPartId,
    record.partId,
    normalizeComparable(record.partName),
    normalizeDateInput(record.effectiveDate),
    normalizeDateInput(record.validDate),
    record.oldQty,
    record.newQty
  ].map((value) => String(value || "").trim().toLowerCase()).join("|")
}

async function loadSheetRows(url, extension = "") {
  if (!url) return []

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("Sheet file not found at " + url)

  let workbook
  const ext = String(extension || getExtension(url)).toLowerCase()
  if (ext === "csv" || url.toLowerCase().includes("output=csv") || url.toLowerCase().includes("format=csv")) {
    const text = await response.text()
    if (text.trim().startsWith("<")) throw new Error("Sheet URL returned HTML instead of CSV/XLSX: " + url)
    workbook = XLSX.read(text, { type: "string" })
  } else {
    const buffer = await response.arrayBuffer()
    const firstBytes = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 80)))
    if (firstBytes.trim().startsWith("<")) throw new Error("Sheet URL returned HTML instead of XLSX: " + url)
    workbook = XLSX.read(buffer, { type: "array" })
  }

  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json(worksheet)
}

async function fetchActiveBomRevision(bomDate) {
  const query = new URLSearchParams({
    vehicleId: selectedVehicle,
    date: bomDate || ""
  })
  const urls = [
    `/api/program-revisions/active?${query.toString()}`,
    `${UPLOAD_SERVER}/api/program-revisions/active?${query.toString()}`
  ]

  const fallback = { active: false, targetDate: bomDate, group: null, revision: null, sheet: null }
  const data = await fetchJsonFromAny(urls, fallback)
  return data && typeof data === "object" ? data : fallback
}

function getSelectedBomDate() {
  const key = `bomDate:${selectedVehicle}`
  const saved = localStorage.getItem(key)
  if (saved) return normalizeDateInput(saved)

  const vehicleDate = normalizeDateInput(selectedVehicleRecord?.effectiveDate || selectedVehicleRecord?.validDate || "")
  if (vehicleDate) return vehicleDate

  return new Date().toISOString().slice(0, 10)
}

function setSelectedBomDate(value) {
  const normalized = normalizeDateInput(value)
  if (!normalized) return
  localStorage.setItem(`bomDate:${selectedVehicle}`, normalized)
}

function normalizeDateInput(value) {
  const text = String(value || "").trim()
  if (!text) return ""
  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  }
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ""
}

function filterRevisionRowsForVehicle(rows, group = {}) {
  if (!Array.isArray(rows) || !rows.length) return []

  const filtered = rows.filter((row) => {
    const rowVehicle = normalizeComparable(getRowValue(row, ["Vehicle Name", "Vehicle", "Program", "Program Name", "Car Name", "Name", "Model Name"]))
    const rowModel = normalizeComparable(getRowValue(row, ["Model", "Model Code", "Car Model"]))
    const rowSeries = normalizeSelectValue(getRowValue(row, ["Series", "Series Label", "Platform"]))
    const rowVariant = normalizeSelectValue(getRowValue(row, ["Variant", "Trim"]))
    const rowEffective = normalizeDateInput(getRowValue(row, ["Effective Date", "Effective", "From Date", "Start Date"]))
    const rowValid = normalizeDateInput(getRowValue(row, ["Valid Date", "Valid Till", "Valid To", "To Date", "End Date"]))

    const hasProgramColumns = Boolean(rowVehicle || rowModel || rowSeries || rowVariant || rowEffective || rowValid)
    if (!hasProgramColumns) return true

    const groupName = normalizeComparable(group.vehicleName || group.displayName || group.model || selectedVehicleRecord?.name || "")
    const groupModel = normalizeComparable(group.model || group.vehicleName || selectedVehicleRecord?.name || "")
    const groupSeries = normalizeSelectValue(group.series || group.seriesLabel || selectedVehicleRecord?.series || "")
    const groupVariant = normalizeSelectValue(group.variant || selectedVehicleRecord?.variant || "")
    const groupEffective = normalizeDateInput(group.effectiveDate || "")
    const groupValid = normalizeDateInput(group.validDate || "")

    const nameOk = !rowVehicle || !groupName || rowVehicle === groupName || rowVehicle === groupModel || groupName.includes(rowVehicle) || rowVehicle.includes(groupName)
    const modelOk = !rowModel || !groupModel || rowModel === groupModel || groupModel.includes(rowModel) || rowModel.includes(groupModel)
    const seriesOk = !rowSeries || !groupSeries || rowSeries === groupSeries
    const variantOk = !rowVariant || !groupVariant || rowVariant === groupVariant
    const effectiveOk = !rowEffective || !groupEffective || rowEffective === groupEffective
    const validOk = !rowValid || !groupValid || rowValid === groupValid

    return nameOk && modelOk && seriesOk && variantOk && effectiveOk && validOk
  })

  return filtered.length ? filtered : rows
}

function compareBomRows(baseRows, activeRows, options = {}) {
  if (options.mode === "delta" && options.deltaResult) {
    return {
      mode: "delta",
      added: options.deltaResult.added,
      removed: options.deltaResult.removed,
      changed: options.deltaResult.changed,
      total: mapBomRows(activeRows).size,
      baseTotal: mapBomRows(baseRows).size,
      ignored: options.deltaResult.ignored
    }
  }

  const base = mapBomRows(baseRows)
  const active = mapBomRows(activeRows)
  let added = 0
  let removed = 0
  let changed = 0

  active.forEach((newItem, key) => {
    const oldItem = base.get(key)
    if (!oldItem) {
      added += 1
      return
    }
    if (isBomItemChanged(oldItem, newItem)) {
      changed += 1
    }
  })

  base.forEach((oldItem, key) => {
    if (!active.has(key)) removed += 1
  })

  return {
    mode: options.mode || "full",
    added,
    removed,
    changed,
    total: active.size,
    baseTotal: base.size
  }
}

function detectBomRevisionMode(rows, revision = {}) {
  const savedMode = String(revision?.revisionMode || revision?.mode || "").toLowerCase()
  if (savedMode.includes("delta") || savedMode.includes("change")) return "delta"
  if (savedMode.includes("full")) return "full"

  const hasChangeType = (Array.isArray(rows) ? rows : []).some((row) => getChangeType(row))
  return hasChangeType ? "delta" : "full"
}

function formatBomRevisionMode(mode) {
  if (mode === "delta") return "Delta / Change Sheet"
  if (mode === "full") return "Full BOM Replacement"
  return "Base BOM"
}

function applyDeltaBomRows(baseRows, deltaRows) {
  const finalMap = mapBomRows(baseRows)
  let added = 0
  let removed = 0
  let changed = 0
  let ignored = 0
  const seenChanges = new Set()

  ;(Array.isArray(deltaRows) ? deltaRows : []).forEach((row) => {
    const item = normalizeBomRow(row)
    const action = normalizeChangeType(getChangeType(row)) || "change"
    const oldKey = normalizePartKey(item.oldPartId || getRowValue(row, ["Old Part ID", "Old PartId", "Previous Part ID", "Old ID"]))
    const newKey = normalizePartKey(item.newPartId || item.partId || item.partName)
    const targetKey = action === "remove" ? (oldKey || item.key) : (newKey || item.key)
    const changeSignature = [
      getRowValue(row, ["Revision ID", "RevisionId", "Revision", "Rev"]),
      action,
      oldKey,
      newKey,
      normalizePartKey(item.partName),
      normalizeDateInput(item.effectiveDate),
      normalizeDateInput(item.validDate)
    ].join("|")

    if (seenChanges.has(changeSignature)) {
      ignored += 1
      return
    }
    seenChanges.add(changeSignature)

    if (!targetKey) {
      ignored += 1
      return
    }

    if (action === "remove") {
      const keyToRemove = oldKey || item.key || findBomKeyByPartName(finalMap, item.partName)
      if (keyToRemove && finalMap.has(keyToRemove)) {
        finalMap.delete(keyToRemove)
        removed += 1
      } else {
        ignored += 1
      }
      return
    }

    if (action === "change") {
      const keyToRemove = oldKey || findBomKeyByPartName(finalMap, item.partName)
      if (keyToRemove && keyToRemove !== targetKey && finalMap.has(keyToRemove)) {
        finalMap.delete(keyToRemove)
      }

      const existed = finalMap.has(targetKey)
      const rowForCurrent = {
        ...row,
        "Part ID": item.newPartId || item.partId || item.oldPartId || item.partName,
        "Base Part ID": item.newPartId || item.basePartId || item.partId || item.oldPartId || "",
        "Service Part No": item.newPartId || item.servicePartNo || item.partId || item.oldPartId || "",
        "Order Part No": item.orderPartNo || item.newPartId || item.servicePartNo || item.partId || item.oldPartId || ""
      }
      const currentItem = { ...normalizeBomRow(rowForCurrent), key: targetKey, row: rowForCurrent }
      finalMap.set(targetKey, currentItem)
      changed += existed || keyToRemove ? 1 : 0
      added += existed || keyToRemove ? 0 : 1
      return
    }

    if (action === "add") {
      const existed = finalMap.has(targetKey)
      finalMap.set(targetKey, { ...item, key: targetKey })
      added += existed ? 0 : 1
      changed += existed ? 1 : 0
      return
    }

    const existed = finalMap.has(targetKey)
    finalMap.set(targetKey, { ...item, key: targetKey })
    changed += existed ? 1 : 0
    added += existed ? 0 : 1
  })

  return {
    rows: Array.from(finalMap.values()).map((item) => item.row),
    added,
    removed,
    changed,
    ignored
  }
}

function findBomKeyByPartName(map, partName) {
  const wanted = normalizeComparable(partName)
  if (!wanted) return ""
  for (const [key, item] of map.entries()) {
    if (normalizeComparable(item.partName) === wanted) return key
  }
  return ""
}

function getChangeType(row) {
  return getRowValue(row, [
    "Change Type", "ChangeType", "Action", "Revision Action", "Update Type",
    "BOM Action", "Status", "Change"
  ])
}

function normalizeChangeType(value) {
  const text = normalizeComparable(value)
  if (!text) return ""
  if (["remove", "removed", "delete", "deleted", "obsolete", "scrap", "drop"].some((word) => text.includes(word))) return "remove"
  if (["add", "added", "new", "insert"].some((word) => text.includes(word))) return "add"
  if (["change", "changed", "modify", "modified", "update", "updated", "replace", "replaced"].some((word) => text.includes(word))) return "change"
  return "change"
}

function isBomItemChanged(oldItem, newItem) {
  return ["partName", "partId", "qty", "system", "subsystem", "assembly", "subassembly"].some((key) =>
    String(oldItem[key] || "").trim() !== String(newItem[key] || "").trim()
  )
}

function mapBomRows(rows) {
  const map = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    const item = normalizeBomRow(row)
    if (!item.key) return
    map.set(item.key, item)
  })
  return map
}

function normalizeBomRow(row) {
  const partName = getRowValue(row, ["Part Name", "PartName", "partName", "Name", "Part", "Component", "Description"])
  const oldPartId = getRowValue(row, ["Old Part ID", "Old PartId", "Previous Part ID", "Old ID"])
  const newPartId = getRowValue(row, ["New Part ID", "New PartId", "Replacement Part ID"])
  const rawPartId = getRowValue(row, ["Part ID", "PartId", "partId"])
  const action = normalizeChangeType(getChangeType(row))
  const partId = action === "change"
    ? (newPartId || rawPartId || oldPartId)
    : (rawPartId || newPartId || oldPartId || getRowValue(row, ["Service Part No", "Service Part Number", "Order Part No", "Order Part Number"]))
  const qty = getRowValue(row, ["Qty", "Quantity", "QTY", "Count", "New Qty", "New Quantity"]) || "1"
  const system = getRowValue(row, ["System", "Category"]) || "Others"
  const subsystem = getRowValue(row, ["Subsystem", "Sub System", "Group"]) || "General"
  const assembly = getRowValue(row, ["Assembly"]) || "Main"
  const subassembly = getRowValue(row, ["Sub Assembly", "SubAssembly", "Subassembly"]) || "Group"
  const meshName = getRowValue(row, ["Mesh Name", "MeshName", "3D Mesh Name", "Object Name", "GLB Mesh Name"])
  const basePartId = getRowValue(row, ["Base Part ID", "BasePartID", "Engineering Part No", "Engineering Part Number"])
  const servicePartNo = getRowValue(row, ["Service Part No", "Service Part Number", "ServicePartNo"])
  const orderPartNo = getRowValue(row, ["Order Part No", "Order Part Number", "Orderable Part No", "Spare Part No"])
  const colourCode = getRowValue(row, ["Colour Code", "Color Code", "Colour", "Color"])
  const colourName = getRowValue(row, ["Colour Name", "Color Name", "Finish"])
  const effectiveDate = getRowValue(row, ["Effective Date", "Effective From", "From Date", "Start Date"])
  const validDate = getRowValue(row, ["Valid Date", "Valid To", "Valid Until", "End Date"])
  const programId = getRowValue(row, ["Program ID", "ProgramID", "Program"])
  const key = normalizePartKey(partId || partName)
  return {
    key,
    row,
    programId,
    partName,
    partId,
    oldPartId,
    newPartId,
    qty,
    system,
    subsystem,
    assembly,
    subassembly,
    meshName,
    basePartId,
    servicePartNo,
    orderPartNo,
    colourCode,
    colourName,
    effectiveDate,
    validDate,
    changeType: getChangeType(row),
    remark: getRowValue(row, ["Notes", "Remark", "Remarks", "Reason"])
  }
}

function normalizePartKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function normalizeComparable(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeSelectValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function renderBomRevisionPanel() {
  // Tree-only UI mode: keep revision data in memory for popups/history,
  // but do not render the separate Current BOM summary card in the sidebar.
  const panel = document.getElementById("bomRevisionPanel")
  if (panel) panel.remove()
}



function buildPartDescriptionsFromRows(rows) {
  const descriptions = {}

  rows.forEach((row, index) => {
    const item = normalizeBomRow(row)
    if (!item.partName && !item.partId) return

    const displayName = String(item.partName || item.partId || `Part ${index + 1}`).trim()
    const key = item.key || normalizePartKey(displayName)
    if (!key) return

    descriptions[key] = {
      _partKey: key,
      displayName,
      partName: displayName,
      itemNo: getRowValue(row, ["Item No", "ITEM NO", "S.No", "SNO"]) || String(index + 1),
      partId: item.partId || "-",
      basePartId: item.basePartId || item.partId || "-",
      servicePartNo: item.servicePartNo || item.partId || "-",
      orderPartNo: item.orderPartNo || item.servicePartNo || item.partId || "-",
      colourCode: item.colourCode || "STD",
      colourName: item.colourName || "Standard",
      meshName: item.meshName || "",
      qty: item.qty || "1",
      system: item.system || "Others",
      subsystem: item.subsystem || "General",
      assembly: item.assembly || "Main",
      subassembly: item.subassembly || "Group",
      applicability: getRowValue(row, ["Applicability", "Applicable To", "Vehicle Applicability"]) || "Current selected program",
      effectiveDate: item.effectiveDate || "",
      validDate: item.validDate || "",
      isActive: getRowValue(row, ["Is Active", "Active"]) || "YES",
      notes: item.remark || "",
      changeType: item.changeType || "",
      row
    }
  })

  return descriptions
}


function getRowValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return String(row[key]).trim()
    }
  }

  const normalizedLookup = new Map(
    Object.keys(row).map(key => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), row[key]])
  )

  for (const key of possibleKeys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "")
    const value = normalizedLookup.get(normalizedKey)
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim()
    }
  }

  return ""
}

function createFallbackPartDescriptions() {
  const descriptions = {}

  parts.forEach((part) => {
    const cleanName = formatName(part.name)
    if (!cleanName || descriptions[cleanName]) return

    const category = getCategory(cleanName)
    descriptions[cleanName] = {
      displayName: cleanName,
      partId: "-",
      system: category,
      subsystem: "General",
      assembly: "Main",
      subassembly: "Group"
    }
  })

  return descriptions
}

function hideLoadingOverlay() {
  const overlay = document.getElementById("loadingOverlay")
  if (overlay) {
    overlay.style.opacity = "0"
    setTimeout(() => overlay.style.display = "none", 500)
  }
}

function showViewerMessage(message) {
  const partDescription = document.getElementById("partDescription")
  const partDetails = document.getElementById("partDetails")

  if (partDescription) partDescription.innerText = message
  if (partDetails) partDetails.style.display = "flex"
  console.warn("Viewer message:", message)
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
  table.className = "parts-oem-table"

  table.innerHTML = `
    <colgroup>
      <col class="col-item-no" />
      <col class="col-part-name" />
      <col class="col-part-id" />
      <col class="col-qty" />
    </colgroup>
    <thead>
      <tr>
        <th>ITEM NO</th>
        <th>PART NAME</th>
        <th>PART ID</th>
        <th>QTY</th>
      </tr>
    </thead>
    <tbody></tbody>
  `

  const tbody = table.querySelector("tbody")
  const bomItems = Object.values(partDescriptions)

  if (bomItems.length) {
    bomItems.forEach((item, index) => {
      const key = item._partKey || normalizePartKey(item.partId || item.displayName)
      const row = document.createElement("tr")
      row.dataset.partKey = key
      row.dataset.name = item.meshName || item.displayName
      row.innerHTML = `
        <td>${escapeHtml(item.itemNo || index + 1)}</td>
        <td>
          <div class="part-name-with-actions">
            <span>${escapeHtml(item.displayName || item.partName || "Part")}</span>
            <button type="button" class="part-details-icon" data-part-action="details" data-part-key="${escapeAttr(key)}" title="View part details and revision history">ⓘ</button>
          </div>
        </td>
        <td>${escapeHtml(item.partId || "-")}</td>
        <td>${escapeHtml(item.qty || "1")}</td>
      `

      row.addEventListener("click", (event) => {
        if (event.target.closest("[data-part-action]")) return
        selectBomPart(item, event.ctrlKey || event.metaKey)
      })

      tbody.appendChild(row)
    })
  } else {
    const groupedParts = {}
    parts.forEach((p) => {
      const cleanName = formatName(p.name)
      if (!groupedParts[cleanName]) groupedParts[cleanName] = { qty: 0, partsArray: [] }
      groupedParts[cleanName].qty += 1
      groupedParts[cleanName].partsArray.push(p)
    })

    let serialNo = 1
    for (const [name, data] of Object.entries(groupedParts)) {
      const key = normalizePartKey(name)
      const row = document.createElement("tr")
      row.dataset.partKey = key
      row.dataset.name = data.partsArray[0].name
      row.innerHTML = `
        <td>${serialNo}</td>
        <td>
          <div class="part-name-with-actions">
            <span>${escapeHtml(name)}</span>
            <button type="button" class="part-details-icon" data-part-action="details" data-part-key="${escapeAttr(key)}" title="View part details">ⓘ</button>
          </div>
        </td>
        <td>-</td>
        <td>${data.qty}</td>
      `
      row.addEventListener("click", (event) => {
        if (event.target.closest("[data-part-action]")) return
        selectPart(data.partsArray, event.ctrlKey || event.metaKey)
      })
      tbody.appendChild(row)
      serialNo += 1
    }
  }

  container.appendChild(table)
}




/* ================= PART DETAILS + REVISION HISTORY POPUP ================= */
function getPartDescriptionByKey(partKey) {
  const key = normalizePartKey(partKey)
  if (!key) return null
  return partDescriptions[key] || Object.values(partDescriptions).find((item) => {
    return [item.partId, item.basePartId, item.servicePartNo, item.orderPartNo, item.displayName, item.meshName]
      .map(normalizePartKey)
      .includes(key)
  }) || null
}

function getPartDescriptionByMeshOrName(name) {
  const clean = formatName(name)
  const key = normalizePartKey(clean)
  return getPartDescriptionByKey(key) || Object.values(partDescriptions).find((item) => {
    return formatName(item.meshName) === clean || formatName(item.displayName) === clean || formatName(item.partName) === clean
  }) || null
}

function findPartMeshesForBomItem(item) {
  if (!item) return []
  const meshName = formatName(item.meshName || "")
  const partName = formatName(item.displayName || item.partName || "")
  const partId = normalizePartKey(item.partId || "")

  let matched = []
  if (meshName) {
    matched = parts.filter((part) => formatName(part.name) === meshName || part.name === item.meshName)
  }

  if (!matched.length && partName) {
    matched = parts.filter((part) => formatName(part.name) === partName)
  }

  if (!matched.length && partId) {
    matched = parts.filter((part) => normalizePartKey(part.name).includes(partId) || partId.includes(normalizePartKey(part.name)))
  }

  return matched
}

function selectBomPart(item, isMultiSelect = false) {
  const meshes = findPartMeshesForBomItem(item)
  if (meshes.length) {
    selectPart(meshes, isMultiSelect)
  } else {
    openPartDetailsPopup(item?._partKey || item?.partId || item?.displayName)
  }
}

function getHistoryForPart(item) {
  if (!item) return []
  const keys = [item._partKey, item.partId, item.basePartId, item.servicePartNo, item.orderPartNo, item.displayName]
    .map(normalizePartKey)
    .filter(Boolean)
  const found = []
  const signatures = new Set()
  keys.forEach((key) => {
    const rows = partHistoryByKey.get(key) || []
    rows.forEach((row) => {
      const signature = historyRecordSignature(row)
      if (!signatures.has(signature)) {
        signatures.add(signature)
        found.push(row)
      }
    })
  })
  return found
}

function ensurePartDetailsModal() {
  let modal = document.getElementById("partDetailsModal")
  if (modal) return modal

  modal = document.createElement("div")
  modal.id = "partDetailsModal"
  modal.className = "part-details-modal"
  modal.innerHTML = `
    <div class="part-details-backdrop" data-close-part-modal="true"></div>
    <section class="part-details-card" role="dialog" aria-modal="true" aria-labelledby="partDetailsModalTitle">
      <button type="button" class="part-details-close" data-close-part-modal="true" aria-label="Close">×</button>
      <div id="partDetailsModalContent"></div>
    </section>
  `
  document.body.appendChild(modal)
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-part-modal]")) closePartDetailsPopup()
  })
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePartDetailsPopup()
  })
  return modal
}

function openPartDetailsPopup(partKey) {
  const item = getPartDescriptionByKey(partKey) || getPartDescriptionByMeshOrName(partKey)
  if (!item) {
    showPartsCartToast("Part details not found")
    return
  }

  const modal = ensurePartDetailsModal()
  const content = modal.querySelector("#partDetailsModalContent")
  const history = getHistoryForPart(item)
  const meshes = findPartMeshesForBomItem(item)
  const meshStatus = meshes.length ? `${meshes.length} mesh object(s) matched` : "No mesh mapping yet"

  content.innerHTML = `
    <div class="part-details-title-row">
      <div>
        <span class="part-details-kicker">Part Details</span>
        <h2 id="partDetailsModalTitle">${escapeHtml(item.displayName || item.partName || "Part")}</h2>
        <p>${escapeHtml(item.system || "Others")} · ${escapeHtml(item.subsystem || "General")}</p>
      </div>
      <span class="part-status-pill">${escapeHtml(item.isActive || "YES")}</span>
    </div>

    <div class="part-details-grid">
      ${detailCell("Part ID", item.partId)}
      ${detailCell("Base Part ID", item.basePartId)}
      ${detailCell("Service Part No", item.servicePartNo)}
      ${detailCell("Order Part No", item.orderPartNo)}
      ${detailCell("Qty", item.qty)}
      ${detailCell("Colour", [item.colourCode, item.colourName].filter(Boolean).join(" - "))}
      ${detailCell("Assembly", item.assembly)}
      ${detailCell("Sub Assembly", item.subassembly)}
      ${detailCell("Applicability", item.applicability)}
      ${detailCell("Effective", item.effectiveDate)}
      ${detailCell("Valid", item.validDate)}
      ${detailCell("Mesh", item.meshName || meshStatus)}
    </div>

    ${item.notes ? `<div class="part-detail-note"><strong>Notes:</strong> ${escapeHtml(item.notes)}</div>` : ""}

    <div class="part-detail-actions">
      <button type="button" class="part-detail-highlight" data-popup-action="highlight">Highlight in 3D</button>
      <button type="button" class="part-detail-order" data-popup-action="order">Add to Order</button>
    </div>

    <div class="part-history-section">
      <h3>Revision History</h3>
      ${history.length ? renderHistoryList(history) : `<p class="part-history-empty">No old revision history found for this part.</p>`}
    </div>
  `

  content.querySelector('[data-popup-action="highlight"]')?.addEventListener("click", () => selectBomPart(item))
  content.querySelector('[data-popup-action="order"]')?.addEventListener("click", () => {
    addDetailedPartToCart(item, 1)
    showPartsCartToast(`${item.displayName || item.partName} added to Cart`)
  })

  modal.classList.add("open")
}

function closePartDetailsPopup() {
  document.getElementById("partDetailsModal")?.classList.remove("open")
}

function detailCell(label, value) {
  return `
    <div class="part-detail-cell">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `
}

function renderHistoryList(history) {
  return `
    <div class="part-history-list">
      ${history.map((record) => `
        <article class="part-history-item ${escapeAttr(normalizeChangeType(record.changeType || ""))}">
          <div class="history-head">
            <strong>${escapeHtml(record.revisionId || "-")}</strong>
            <span>${escapeHtml(record.changeType || "-")}</span>
          </div>
          <div class="history-meta">
            ${record.oldPartId ? `<span>Old: ${escapeHtml(record.oldPartId)}</span>` : ""}
            ${record.newPartId ? `<span>New: ${escapeHtml(record.newPartId)}</span>` : ""}
            ${record.oldQty ? `<span>Old Qty: ${escapeHtml(record.oldQty)}</span>` : ""}
            ${record.newQty ? `<span>New Qty: ${escapeHtml(record.newQty)}</span>` : ""}
            ${record.effectiveDate ? `<span>Effective: ${escapeHtml(record.effectiveDate)}</span>` : ""}
            ${record.validDate ? `<span>Valid: ${escapeHtml(record.validDate)}</span>` : ""}
            ${record.approvalStatus ? `<span>Status: ${escapeHtml(record.approvalStatus)}</span>` : ""}
          </div>
          ${record.remark ? `<p>${escapeHtml(record.remark)}</p>` : ""}
        </article>
      `).join("")}
    </div>
  `
}

function addDetailedPartToCart(item, qty = 1) {
  addPartToCart({
    vehicleId: selectedVehicle,
    vehicleName: getVehicleDisplayName(),
    partName: item.displayName || item.partName,
    partId: item.partId,
    basePartId: item.basePartId,
    servicePartNo: item.servicePartNo,
    orderPartNo: item.orderPartNo,
    colourCode: item.colourCode,
    colourName: item.colourName,
    system: item.system,
    subsystem: item.subsystem,
    assembly: item.assembly,
    subassembly: item.subassembly,
    effectiveDate: item.effectiveDate,
    validDate: item.validDate,
    meshName: item.meshName,
    availableQty: Number.parseInt(item.qty, 10) || 1,
    qty
  })
}

document.addEventListener("click", (event) => {
  const detailButton = event.target.closest('[data-part-action="details"]')
  if (!detailButton) return
  event.preventDefault()
  event.stopPropagation()
  openPartDetailsPopup(detailButton.dataset.partKey)
})


function clearPartVisualHighlight(part) {
  if (!part?.material) return
  const materials = Array.isArray(part.material) ? part.material : [part.material]
  materials.forEach((material) => {
    if (!material) return
    if (material.emissive) {
      material.emissive.set(0x000000)
      material.emissiveIntensity = 0
    }
    if (material.color && part.userData?.originalColor) {
      material.color.copy(part.userData.originalColor)
    }
    material.needsUpdate = true
  })
}

function applyPartVisualHighlight(part) {
  if (!part?.material) return
  const materials = Array.isArray(part.material) ? part.material : [part.material]
  materials.forEach((material) => {
    if (!material) return
    if (material.emissive) {
      material.emissive.set(0x2563eb)
      material.emissiveIntensity = 1.4
    }
    if (material.color) {
      material.color.set(0xffc857)
    }
    material.needsUpdate = true
  })
}

function getSelectedPartNameSet() {
  const names = new Set()
  ;(selectedPartsGroup || []).forEach((part) => {
    if (part?.name) names.add(formatName(part.name))
  })
  multiSelectedNames.forEach((name) => names.add(formatName(name)))
  return names
}

function focusSelectedPartsInView(partsToFocus) {
  const focusParts = Array.isArray(partsToFocus) ? partsToFocus.filter(Boolean) : []
  if (!focusParts.length) return

  const box = new THREE.Box3()
  focusParts.forEach((part) => box.expandByObject(part))
  if (box.isEmpty()) return

  const center = box.getCenter(new THREE.Vector3())
  controls.target.copy(center)
  controls.update()
}

/* ================= SELECT & CLEAR (FIXED LABEL DISAPPEARING) ================= */

let labelTimeout = null; // 🔥 புதிதாக சேர்க்கப்பட்ட டைமர் வேரியபிள்

function selectPart(partOrArray, isMultiSelect = false) {
  // Ctrl அழுத்தவில்லை என்றால், பழைய அனைத்தையும் அழித்துவிடு
  if (!isMultiSelect) {
    clearSelection()
  }

  let newGroup = Array.isArray(partOrArray) ? partOrArray : [partOrArray]
  let mainPart = newGroup[0]
  let cleanName = formatName(mainPart.name)

  // 🔥 Toggle Logic: ஏற்கனவே செலக்ட் ஆகியிருந்தால், அதை நீக்க வேண்டும் (Deselect)
  if (isMultiSelect && multiSelectedNames.has(cleanName)) {
    newGroup.forEach(p => clearPartVisualHighlight(p))
    selectedPartsGroup = selectedPartsGroup.filter(p => !newGroup.includes(p))
    multiSelectedNames.delete(cleanName)

    if (selectedPartsGroup.length === 0) {
      clearSelection()
      return
    }
    selectedPart = selectedPartsGroup[selectedPartsGroup.length - 1]
  } else {
    // 🔥 புதிதாக ஒன்றை சேர்க்க (Add to Selection)
    newGroup.forEach(p => {
      applyPartVisualHighlight(p)
      if (!selectedPartsGroup.includes(p)) {
        selectedPartsGroup.push(p)
      }
    })
    multiSelectedNames.add(cleanName)
    selectedPart = mainPart
  }

  focusSelectedPartsInView(newGroup)

  // 🔥 UI Update (ஒன்றா அல்லது பலவா என்று பார்த்து UI-ஐ மாற்றுவது)
  if (multiSelectedNames.size > 1) {
    document.getElementById("partDescription").innerText =
      `Selected Items: ${multiSelectedNames.size}\nTotal Quantity: ${selectedPartsGroup.length}`;
    document.getElementById("partDetails").style.display = "flex";

    if (floatingLabel) {
      floatingLabel.innerHTML = `
        <div style="font-size:14px; font-weight:600; margin-bottom:6px;">Multiple Parts Selected</div>
        <div style="font-size:12px; background:#646cff; display:inline-block; padding:4px 10px; border-radius:8px;">
          Items: ${multiSelectedNames.size} | Total Qty: ${selectedPartsGroup.length}
        </div>
      `;
      clearTimeout(labelTimeout);
      floatingLabel.style.display = "block";
      setTimeout(() => floatingLabel.classList.add("show"), 10);
    }
  } else {
    // Single Item UI
    const data = getPartDescriptionByMeshOrName(cleanName) || getPartDescriptionByMeshOrName(selectedPart.name);
    if (data) {
      document.getElementById("partDescription").innerText =
        "Part Name: " + data.displayName +
        "\nPart ID: " + (data.partId || "-") +
        "\nQuantity: " + newGroup.length;
      document.getElementById("partDetails").style.display = "flex";

      if (floatingLabel) {
        floatingLabel.innerHTML = `
          <div style="font-size:14px; font-weight:600; margin-bottom:6px; white-space: normal; word-break: break-word;">
            ${formatName(data.displayName)}
          </div>
          <div style="font-size:12px; background:#646cff; display:inline-block; padding:4px 10px; border-radius:8px; margin-bottom:8px;">
            Qty: ${newGroup.length}
          </div>
          <div style="font-size:12px; margin-bottom:6px;">Part ID: ${data.partId || "-"}</div>
          <div style="font-size:12px; margin-bottom:6px;">Order No: ${data.orderPartNo || data.partId || "-"}</div>
          <button type="button" class="floating-part-details-btn" data-part-action="details" data-part-key="${escapeAttr(data._partKey || data.partId || data.displayName)}">Details / History</button>
        `;
        clearTimeout(labelTimeout);
        floatingLabel.style.display = "block";
        setTimeout(() => floatingLabel.classList.add("show"), 10);
      }
    }
  }

  syncTableHighlight();
  syncTreeHighlight();
  updateHideButton();
}

function clearSelection() {
  // குழுவில் உள்ள எல்லா பார்ட்களின் Glow-ஐயும் அணைக்கிறோம்
  if (selectedPartsGroup && selectedPartsGroup.length > 0) {
    selectedPartsGroup.forEach(p => clearPartVisualHighlight(p))
  } else if (selectedPart) {
    clearPartVisualHighlight(selectedPart)
  }

  selectedPart = null
  selectedPartsGroup = []
  multiSelectedNames.clear()

document.getElementById("partDescription").innerText = "Select a part to see details."
  document.querySelectorAll("#partsList tr").forEach(row => row.classList.remove("active"))

  if (floatingLabel) {
    floatingLabel.classList.remove("show")
    clearTimeout(labelTimeout)
    labelTimeout = setTimeout(() => {
      floatingLabel.style.display = "none"
    }, 200)
  }

  // Popup-ஐ மறைக்க (நாம் முதலில் சேர்த்தது)
  const partDetails = document.getElementById("partDetails");
  if(partDetails) partDetails.style.display = "none";

  // 🔥 புதிதாக சேர்க்க வேண்டியது: Tree-ஐ பழைய நிலைக்குக் கொண்டு வருதல் (Collapse All)
  // 🔥 BUG FIX 2.0: Search Box-ல் டைப் செய்யும்போது அதை அழிக்கக்கூடாது!
  const searchBox = document.getElementById("partSearch");
  
  // document.activeElement மூலம் யூசர் Search Box-ல் தான் உள்ளாரா என செக் செய்கிறோம்
  if (searchBox && document.activeElement !== searchBox) { 
    searchBox.value = ""; 
    document.querySelectorAll(".tree-leaf").forEach(leaf => {
      leaf.style.display = ""; 
      leaf.classList.remove("search-hit"); 
    });
  }
  // 1. Highlight-ஐ நீக்குதல்
  document.querySelectorAll(".tree-leaf").forEach(el => {
    el.classList.remove("active-tree");
  });

  // 2. திறந்திருக்கும் அனைத்து ஃபோல்டர்களையும் மூடுதல்
  document.querySelectorAll(".tree-node").forEach(node => {
    node.innerHTML = node.innerHTML.replace("▼", "▶");
    if (node.nextElementSibling) {
      node.nextElementSibling.style.display = "none";
    }
  });
}

/* ================= SYNC TABLE (FIXED FOR MERGED PARTS) ================= */

function syncTableHighlight() {
  const selectedNames = getSelectedPartNameSet()
  const selectedKeys = new Set()

  ;(selectedPartsGroup || []).forEach((part) => {
    const desc = getPartDescriptionByMeshOrName(part?.name)
    ;[desc?._partKey, desc?.partId, desc?.displayName, desc?.meshName, part?.name]
      .filter(Boolean)
      .forEach((value) => selectedKeys.add(normalizePartKey(value)))
  })

  document.querySelectorAll("#partsList tbody tr").forEach(row => {
    const item = getPartDescriptionByKey(row.dataset.partKey)
    const rowNames = [row.dataset.name, item?.displayName, item?.meshName, item?.partId]
      .filter(Boolean)
      .map(formatName)
    const rowKeys = [row.dataset.partKey, item?._partKey, item?.partId, item?.displayName, item?.meshName]
      .filter(Boolean)
      .map(normalizePartKey)

    const matched = rowNames.some((name) => selectedNames.has(name)) || rowKeys.some((key) => selectedKeys.has(key))
    row.classList.toggle("active", matched)

    if (matched && selectedPart) {
      row.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  })
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

  const canvasWidth = Math.max(1, window.innerWidth - SIDEBAR_WIDTH)
  mouse.x =
    ((event.clientX - SIDEBAR_WIDTH) /
      canvasWidth) * 2 - 1

  mouse.y =
    -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

 // 🔥 PROFESSIONAL CAD FIX: Only allow the mouse to hit parts that are currently visible
  const visibleParts = parts.filter(p => p.visible === true)
  const intersects = raycaster.intersectObjects(visibleParts, true)

  

  if (intersects.length > 0) {
    // 🔥 Ctrl அல்லது Cmd (Mac) அழுத்தப்பட்டுள்ளதா என்பதை செக் செய்தல்
    const isMulti = event.ctrlKey || event.metaKey;
    
    // 3D-யில் ஒரு Part-ஐ தொட்டாலும், அது சம்பந்தப்பட்ட அத்தனை Part-களையும் Group ஆக எடுக்க
    const clickedPart = intersects[0].object;
    const cleanName = formatName(clickedPart.name);
    const matchedParts = parts.filter(p => formatName(p.name) === cleanName);

    selectPart(matchedParts, isMulti);
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

  const hiddenCount = document.getElementById("hiddenCount")
  if (hiddenCount) hiddenCount.innerText = hiddenParts.length

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

  // 🔥 Reset logic
  hiddenParts = []
  activeSystems.clear()

  // 🔥 Restore all parts
  parts.forEach(p => {
    p.visible = true

    if (p.material && p.material.emissive) {
      p.material.emissive.set(0x000000)
    }
  })

  // 🔥 Reset system buttons UI
  document.querySelectorAll(".system-card").forEach(btn => {
    btn.classList.remove("active")
  })

  // 🔥 Reset table
  document.querySelectorAll("#partsList tbody tr").forEach(row => {
    row.style.display = ""
  })

  // 🔥 Reset state
  isIsolated = false

  updateHiddenUI()
  updateHideButton()
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

function updateRendererLayout() {
  SIDEBAR_WIDTH = getSidebarWidth()
  const width = Math.max(1, window.innerWidth - SIDEBAR_WIDTH)
  const height = Math.max(1, window.innerHeight)

  renderer.domElement.style.left = SIDEBAR_WIDTH + "px"
  renderer.domElement.style.width = `calc(100vw - ${SIDEBAR_WIDTH}px)`
  renderer.domElement.style.height = "100vh"

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

window.addEventListener("resize", updateRendererLayout)

/* ================= LOGOUT ================= */

window.addEventListener("DOMContentLoaded", () => {

  const logoutBtn = document.getElementById("logoutBtn")

  if (!logoutBtn) return

  logoutBtn.addEventListener("click", async () => {

    try {
      await secureLogout()
    } catch (error) {
      console.error("Logout Error:", error)
    }

  })
})
window.addEventListener("DOMContentLoaded", () => {

  const homeBtn = document.getElementById("homeBtn")

  if(homeBtn){
    homeBtn.addEventListener("click", goHomeFromViewer, true)
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
  // 🔥 RESET SYSTEM UI + LOGIC

activeSystems.clear()

// remove active class from all buttons
document.querySelectorAll(".system-card").forEach(btn => {
  btn.classList.remove("active")
})

// reset table rows
document.querySelectorAll("#partsList tbody tr").forEach(row => {
  row.style.display = ""
})

// reset hidden/isolation
hiddenParts = []
isIsolated = false

// remove highlight
parts.forEach(p => {
  if (p.material && p.material.emissive) {
    p.material.emissive.set(0x000000)
    p.material.emissiveIntensity = 0
  }
})

// update UI
updateHiddenUI()
updateHideButton()
  clearSelection()
}
/* ================= SYSTEM UI ================= */

const subsystemContainer = document.getElementById("subsystems")
 



/* ================= AUTO SYSTEM TREE ================= */

const systemsPanel = document.getElementById("systemsPanel")

function buildSystemTree(){

  const tree = {}

  Object.values(partDescriptions).forEach(p => {

    if (!tree[p.system]) tree[p.system] = {}
    if (!tree[p.system][p.subsystem]) tree[p.system][p.subsystem] = {}
    if (!tree[p.system][p.subsystem][p.assembly]) tree[p.system][p.subsystem][p.assembly] = {}
    if (!tree[p.system][p.subsystem][p.assembly][p.subassembly]) {
      tree[p.system][p.subsystem][p.assembly][p.subassembly] = []
    }

    tree[p.system][p.subsystem][p.assembly][p.subassembly].push(p._partKey || normalizePartKey(p.partId || p.displayName))

  })

  renderOEMTree(tree)
}

function createNode(label, level = 0) {
  const div = document.createElement("div")
  div.style.paddingLeft = (level * 12) + "px"
  div.className = "tree-node"
  div.innerHTML = `▶ ${label}`
  return div
}
const searchInput = document.getElementById("partSearch")

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim()
    handleSearch(query)
  })
}
function handleSearch(query){

  // reset UI first
  document.querySelectorAll(".tree-node, .tree-leaf").forEach(el=>{
    el.style.display = ""
    el.classList.remove("search-hit")
  })

  if(!query) return

  // loop all parts (leaf nodes)
  document.querySelectorAll(".tree-leaf").forEach(leaf=>{

    const name = leaf.innerText.toLowerCase()

    if(name.includes(query)){

      // ✅ highlight match
      leaf.classList.add("search-hit")

      // ✅ auto expand parents
      expandParents(leaf)

    }else{
      leaf.style.display = "none"
    }

  })
 
// 🔥 auto select first match
const firstMatch = document.querySelector(".tree-leaf.search-hit")

if(firstMatch){
  const item = getPartDescriptionByKey(firstMatch.dataset.partKey || firstMatch.dataset.partName)
  const matchedParts = findPartMeshesForBomItem(item)
  if(matchedParts.length > 0){
    selectPart(matchedParts)
  }
}
}
function expandParents(element){

  let parent = element.parentElement

  // 🔥 THE FIX: systemsPanel-ஐ தொட்டதும் இந்த Loop-ஐ நிறுத்திவிட வேண்டும்!
  while(parent && parent.id !== "systemsPanel"){

    parent.style.display = "block"

    const prev = parent.previousSibling

    if(prev && prev.classList && prev.classList.contains("tree-node")){
      prev.innerHTML = prev.innerHTML.replace("▶","▼")
    }

    parent = parent.parentElement
  }
}

/* ================= PARTS CART HELPERS ================= */
function getVehicleDisplayName() {
  const recordName = selectedVehicleRecord?.name || selectedVehicleRecord?.displayName || selectedVehicleRecord?.vehicleName
  return formatVehicleDisplayName(recordName || selectedVehicle || "Vehicle")
}

function getPartDescriptionByName(partName) {
  return getPartDescriptionByKey(partName) || getPartDescriptionByMeshOrName(partName)
}


function showPartsCartToast(message) {
  let toast = document.getElementById("viewerCartToast")
  if (!toast) {
    toast = document.createElement("div")
    toast.id = "viewerCartToast"
    toast.className = "viewer-cart-toast"
    document.body.appendChild(toast)
  }

  toast.textContent = message
  toast.classList.add("show")
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2200)
}

function closeInlineCartControl(control) {
  if (!control) return
  control.classList.remove("open")
  const plus = control.querySelector(".part-inline-plus")
  const qty = control.querySelector(".part-inline-qty")
  if (plus) {
    plus.textContent = "+"
    plus.title = "Add this part to cart"
    plus.setAttribute("aria-label", "Open add to cart controls")
  }
  if (qty) qty.value = "1"
}

function closeAllInlineCartControls(exceptControl = null) {
  document.querySelectorAll(".part-inline-cart.open").forEach((control) => {
    if (control !== exceptControl) closeInlineCartControl(control)
  })
}

function setupInlineCartAutoDismiss() {
  if (window.__inlineCartAutoDismissReady) return
  window.__inlineCartAutoDismissReady = true

  document.addEventListener("click", (event) => {
    if (event.target.closest(".part-inline-cart")) return
    closeAllInlineCartControls()
  })

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllInlineCartControls()
  })
}

function createInlineCartControls({ partName, partId, availableQty }) {
  setupInlineCartAutoDismiss()

  const controls = document.createElement("div")
  controls.className = "part-inline-cart"
  controls.addEventListener("click", (event) => event.stopPropagation())
  controls.addEventListener("pointerdown", (event) => event.stopPropagation())

  const plusButton = document.createElement("button")
  plusButton.type = "button"
  plusButton.className = "part-inline-plus"
  plusButton.title = "Add this part to cart"
  plusButton.setAttribute("aria-label", "Open add to cart controls")
  plusButton.textContent = "+"

  const panel = document.createElement("div")
  panel.className = "part-inline-panel"
  panel.innerHTML = `
    <span class="part-inline-qty-label">Qty</span>
    <button type="button" class="part-inline-step" data-step="-1" aria-label="Decrease quantity">−</button>
    <input type="number" min="1" value="1" class="part-inline-qty" aria-label="Quantity" />
    <button type="button" class="part-inline-step" data-step="1" aria-label="Increase quantity">+</button>
    <button type="button" class="part-inline-add">Add to Cart</button>
  `

  const qtyInput = panel.querySelector(".part-inline-qty")

  function openControls() {
    closeAllInlineCartControls(controls)
    controls.classList.add("open")
    plusButton.textContent = "×"
    plusButton.title = "Close add to cart controls"
    plusButton.setAttribute("aria-label", "Close add to cart controls")
    requestAnimationFrame(() => qtyInput?.focus())
  }

  function toggleControls() {
    if (controls.classList.contains("open")) {
      closeInlineCartControl(controls)
      return
    }
    openControls()
  }

  panel.querySelectorAll(".part-inline-step").forEach((button) => {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.step || 0)
      const next = Math.max(1, Number(qtyInput.value || 1) + step)
      qtyInput.value = String(next)
    })
  })

  panel.querySelector(".part-inline-add")?.addEventListener("click", () => {
    const qty = Math.max(1, Number.parseInt(qtyInput.value, 10) || 1)
    const item = getPartDescriptionByName(partId) || getPartDescriptionByName(partName)
    if (item) {
      addDetailedPartToCart(item, qty)
    } else {
      addPartToCart({
        vehicleId: selectedVehicle,
        vehicleName: getVehicleDisplayName(),
        partName,
        partId,
        availableQty,
        qty
      })
    }
    showPartsCartToast(`${partName} × ${qty} added to Cart`)
    closeInlineCartControl(controls)
  })

  plusButton.addEventListener("click", toggleControls)

  controls.append(plusButton, panel)
  return controls
}

function renderOEMTree(tree){

  systemsPanel.innerHTML = "<h3>PARTS CATEGORY</h3>"

  function buildLevel(obj, parent, level){

    Object.keys(obj).forEach(key => {

      const node = createNode(key, level)
      const childrenContainer = document.createElement("div")
      childrenContainer.style.display = "none"

      node.onclick = (e) => {
        e.stopPropagation()
        closeAllInlineCartControls()
        const isCurrentlyOpen = childrenContainer.style.display === "block"
        if (isCurrentlyOpen) {
          childrenContainer.style.display = "none"
          node.innerHTML = `▶ ${key}`
        } else {
          childrenContainer.style.display = "block"
          node.innerHTML = `▼ ${key}`
          setTimeout(() => node.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
        }
      }

      parent.appendChild(node)
      parent.appendChild(childrenContainer)

      if (Array.isArray(obj[key])) {
        obj[key].forEach(partKey => {
          const pData = getPartDescriptionByKey(partKey)
          if (!pData) return
          const partNode = document.createElement("div")
          partNode.className = "tree-leaf"
          partNode.style.paddingLeft = ((level + 1) * 12) + "px"
          partNode.dataset.partName = pData.displayName
          partNode.dataset.partKey = pData._partKey || normalizePartKey(pData.partId || pData.displayName)

          const matchedParts = findPartMeshesForBomItem(pData)
          const qty = pData.qty || matchedParts.length || 1

          const labelWrap = document.createElement("div")
          labelWrap.className = "tree-leaf-main"
          labelWrap.innerHTML = `
            <span class="tree-leaf-part-id">${escapeHtml(pData.partId || "-")}</span>
            <span class="tree-leaf-part-name">${escapeHtml(pData.displayName || "Part")}</span>
            <span class="tree-leaf-qty">Qty: ${escapeHtml(qty)}</span>
            <button type="button" class="tree-part-details-btn" data-part-action="details" data-part-key="${escapeAttr(partNode.dataset.partKey)}" title="Details / History">ⓘ</button>
          `

          const cartControls = createInlineCartControls({ partName: pData.displayName, partId: pData.partId, availableQty: qty })
          partNode.append(labelWrap, cartControls)

          partNode.onclick = (e) => {
            e.stopPropagation()
            if (e.target.closest(".part-inline-cart") || e.target.closest("[data-part-action]")) return
            closeAllInlineCartControls()
            if (matchedParts.length > 0) {
              selectPart(matchedParts, e.ctrlKey || e.metaKey)
            } else {
              openPartDetailsPopup(partNode.dataset.partKey)
            }
          }

          childrenContainer.appendChild(partNode)
        })
      } else {
        buildLevel(obj[key], childrenContainer, level + 1)
      }
    })
  }

  buildLevel(tree, systemsPanel, 0)
}

function syncTreeHighlight() {
  if (!selectedPart) return;

  document.querySelectorAll(".tree-leaf").forEach(el => el.classList.remove("active-tree"));

  if (multiSelectedNames.size <= 1) {
      document.querySelectorAll(".tree-node").forEach(node => {
        node.innerHTML = node.innerHTML.replace("▼", "▶")
        if (node.nextElementSibling) node.nextElementSibling.style.display = "none"
      })
  }

  document.querySelectorAll(".tree-leaf").forEach(leaf => {
    const item = getPartDescriptionByKey(leaf.dataset.partKey)
    const namesToMatch = new Set([
      leaf.dataset.partName,
      item?.displayName,
      item?.meshName,
      item?.partId
    ].filter(Boolean).map(formatName))

    const selectedNames = Array.from(multiSelectedNames)
    const matched = selectedNames.some((name) => namesToMatch.has(formatName(name))) || namesToMatch.has(formatName(selectedPart.name))

    if (matched) {
      leaf.classList.add("active-tree");
      expandParents(leaf);
      leaf.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

function highlightParts(partNames) {
  
  // 1. IF CLOSING A FOLDER: Reset everything back to normal
  if (partNames.length === 0) {
    parts.forEach(p => {
      p.visible = true; // Unhide everything
      clearPartVisualHighlight(p); // Remove glow
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

  if (partNames.includes(cleanName)) {
  p.visible = true
  applyPartVisualHighlight(p)
} else {
      // ❌ NOT IN THE SYSTEM: Hide it completely
      p.visible = false;
      if (!hiddenParts.includes(p.name)) hiddenParts.push(p.name);
      clearPartVisualHighlight(p);
    }
  });

  isIsolated = true; // Tell the app we are in isolated mode
  updateHiddenUI(); // Update the "Hidden Parts:" counter in the sidebar
  // 🔥 clear previous timer
clearTimeout(highlightTimeout)

// 🔥 auto remove highlight after 2 sec
highlightTimeout = setTimeout(() => {

  parts.forEach(p => clearPartVisualHighlight(p))

}, 1000) // ⏳ 2 seconds
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
// 🔥 clear previous timer
clearTimeout(highlightTimeout)

// 🔥 auto remove highlight after 2 sec
highlightTimeout = setTimeout(() => {

  parts.forEach(p => clearPartVisualHighlight(p))

}, 500)
//search//
const partSearch = document.getElementById("partSearch")

if (partSearch) {
  partSearch.addEventListener("input", () => {

    const searchValue = partSearch.value.toLowerCase().trim()

    document.querySelectorAll("#partsList tbody tr").forEach(row => {

      const partName = row.cells[1]?.innerText.toLowerCase() || ""
      const partId   = row.cells[2]?.innerText.toLowerCase() || ""

      // 🔥 match both name + part ID
      if (
        partName.includes(searchValue) ||
        partId.includes(searchValue)
      ) {
        row.style.display = ""
      } else {
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